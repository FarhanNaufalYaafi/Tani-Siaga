import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { userRoles } from 'src/user/enum/user-roles.enum';
import { UserService } from 'src/user/user.service';
import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductReview } from './entities/product-review.entity';
import { CreateProductDto } from './dtos/create-product.dto';
import { FulfillHarvestDto } from './dtos/fulfill-harvest.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { AiRecommendation } from 'src/ai/entities/ai-recomendation.entity';
import { OrderService } from '../order/order.service';
import { NotificationService } from 'src/notification/notification.service';
import { User } from 'src/user/entities/user.entity';
import { OrderItems } from '../order_items/entities/order_items.entity';
import { orderStatus } from '../order/enum/order-status.enum';
import { CreateProductReviewDto } from './dtos/create-product-review.dto';
import { UpdateProductReviewDto } from './dtos/update-product-review.dto';
import { normalizePagination, paginatedResult } from 'src/common/pagination';

const SELLER_ROLES = [
  userRoles.FARMER,
  userRoles.INDIVIDUAL_FARMER,
  userRoles.GROUP_LEADER,
  userRoles.ADMIN,
];

@Injectable()
export class ProductService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product) private prodRepo: Repository<Product>,
    @InjectRepository(Farmland) private farmlandRepo: Repository<Farmland>,
    @InjectRepository(AiRecommendation) private aiRecommendationRepo: Repository<AiRecommendation>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ProductReview) private reviewRepo: Repository<ProductReview>,
    @InjectRepository(OrderItems) private orderItemsRepo: Repository<OrderItems>,
    private userService: UserService,
    private orderService: OrderService,
    private notificationService: NotificationService,
  ) {}

  private isSellerRole(role: string | undefined): boolean {
    if (!role) return false;
    return SELLER_ROLES.includes(role as userRoles);
  }

  private ensureShopNotSanctioned(shop: { banned_until?: Date | string | null; ban_reason?: string | null }) {
    if (shop.banned_until && new Date(shop.banned_until) > new Date()) {
      const endDate = new Date(shop.banned_until).toLocaleDateString('id-ID');
      throw new ForbiddenException(`Toko sedang dinonaktifkan sampai ${endDate}. Alasan: ${shop.ban_reason || 'Pelanggaran kebijakan toko'}.`);
    }
  }

  private async verifySellerOwnsProduct(userId: number, productId: number): Promise<Product> {
    const user = await this.userService.findOneIdWithShop(userId);
    if (!user) throw new UnauthorizedException();
    if (!this.isSellerRole(user.role)) throw new ForbiddenException('Hanya seller (farmer, individual_farmer, group_leader, admin) yang dapat mengelola produk.');
    if (!user.shop) throw new BadRequestException('User belum memiliki toko');
    this.ensureShopNotSanctioned(user.shop as any);

    const shopId = (user.shop as any).id || user.shop;

    const product = await this.prodRepo.findOne({
      where: { id: productId },
      relations: { shop: true },
    });
    if (!product) throw new NotFoundException(`Produk dengan ID ${productId} tidak ditemukan`);

    const productShopId = (product.shop as any).id || product.shop;
    if (productShopId !== shopId) {
      throw new ForbiddenException('Anda tidak memiliki akses untuk mengelola produk ini');
    }
    if (product.admin_action) {
      throw new ForbiddenException(`Produk dinonaktifkan admin. Alasan: ${product.admin_action_reason || 'Tidak tersedia'}`);
    }

    return product;
  }

  async createProduct(request: CreateProductDto, userId: number) {
    const user = await this.userService.findOneIdWithShop(userId);

    if (!user) throw new UnauthorizedException();
    if (!this.isSellerRole(user.role)) throw new ForbiddenException('Hanya seller (farmer, individual_farmer, group_leader, admin) yang dapat membuat produk.');
    if (!user.shop) throw new BadRequestException('User belum memiliki toko');

    const shop = user.shop as any;
    const shopId = shop.id || shop;
    this.ensureShopNotSanctioned(shop);
    if (shop.approval_status && shop.approval_status !== 'approved') {
      throw new BadRequestException('Toko Anda masih menunggu persetujuan admin. Produk tidak dapat dibuat sebelum toko disetujui.');
    }

    const isPreOrder = request.is_pre_order || false;

    let estimatedHarvestDate: Date | null = null;
    let poQuotaKg = 0;
    let finalStock = 0;

    if (isPreOrder) {
      if (!request.farmland_id) {
        throw new BadRequestException('Produk Pre-Order wajib memilih farmland_id.');
      }

      const farmland = await this.farmlandRepo.findOne({
        where: { id: request.farmland_id },
        relations: { commodity: true },
      });

      if (!farmland) {
        throw new NotFoundException(`Lahan dengan ID ${request.farmland_id} tidak ditemukan.`);
      }

      if (farmland.status !== 'active') {
        throw new BadRequestException('Lahan ini sudah panen. Tanami kembali sebelum membuka pre-order baru.');
      }

      this.assertCanSellFromFarmland(user, farmland);

      const existingPreOrder = await this.prodRepo.count({
        where: { farmland_id: farmland.id, is_pre_order: true, is_active: true },
      });
      if (existingPreOrder > 0) {
        throw new BadRequestException('Lahan ini sudah memiliki produk pre-order aktif. Selesaikan panen atau tutup produk tersebut terlebih dahulu.');
      }

      if (request.po_quota_kg !== undefined && request.po_quota_kg !== null && request.po_quota_kg > 0) {
        poQuotaKg = request.po_quota_kg;
      } else {
        const aiYield = farmland.ai_estimated_yield_kg || 0;
        poQuotaKg = Math.floor(aiYield * 0.60);
      }

      const harvestDays = farmland.custom_avg_harvest_days ?? farmland.commodity?.avg_harvest_days;
      if (farmland.plant_date && harvestDays) {
        const plantDate = new Date(farmland.plant_date);
        estimatedHarvestDate = new Date(plantDate);
        estimatedHarvestDate.setDate(estimatedHarvestDate.getDate() + harvestDays);
      }

      finalStock = 0;
    } else {
      if (request.stock === undefined || request.stock === null || request.stock <= 0) {
        throw new BadRequestException(
          'Untuk produk Ready Stock (non-Pre-Order), jumlah stok wajib diisi dan harus lebih dari 0.',
        );
      }
      finalStock = request.stock;
    }

    const productData = {
      name: request.name,
      price: request.price,
      stock: finalStock,
      description: request.description,
      image_url: request.image_url,
      shop: shopId,
      is_active: true,
      approval_status: 'pending' as const,
      is_pre_order: isPreOrder,
      farmland_id: isPreOrder ? request.farmland_id : undefined,
      po_quota_kg: poQuotaKg,
      po_booked_kg: 0,
      estimated_harvest_date: estimatedHarvestDate || undefined,
    };

    const product = this.prodRepo.create(productData);
    const savedProduct = await this.prodRepo.save(product);

    const adminUsers = await this.userRepo.find({ where: { role: userRoles.ADMIN } });
    for (const admin of adminUsers) {
      await this.notificationService.createInAppNotification({
        userId: admin.id,
        title: 'Permintaan produk baru',
        message: `Produk "${savedProduct.name}" menunggu persetujuan admin.`,
        type: 'product_approval',
        severity: 'warning',
        targetUrl: '/admin',
        metadata: { productId: savedProduct.id },
      });
    }

    return savedProduct;
  }

  async updateProduct(productId: number, request: UpdateProductDto, userId: number) {
    const product = await this.verifySellerOwnsProduct(userId, productId);

    const { name, price, stock, description, image_url, is_pre_order, po_quota_kg } = request;

    if (name !== undefined) product.name = name;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) {
      if (product.is_pre_order) {
        throw new BadRequestException('Untuk ubah stok produk Pre-Order, gunakan endpoint complete-harvest saat panen tiba.');
      }
      if (stock < 0) throw new BadRequestException('Stok tidak boleh negatif');
      if (stock < product.po_booked_kg) {
        throw new BadRequestException(`Stok total tidak boleh lebih kecil dari jumlah PO yang dikunci (${product.po_booked_kg} Kg).`);
      }
      product.stock = stock;
    }
    if (description !== undefined) product.description = description;
    if (image_url !== undefined) product.image_url = image_url;
    if (is_pre_order !== undefined && product.is_pre_order !== is_pre_order) {
      throw new BadRequestException('Tipe produk (Pre-Order vs Ready Stock) tidak bisa diubah setelah dibuat.');
    }
    if (po_quota_kg !== undefined && product.is_pre_order) {
      if (po_quota_kg < product.po_booked_kg) {
        throw new BadRequestException(`Kuota PO tidak boleh lebih kecil dari yang sudah terpesan (${product.po_booked_kg} Kg).`);
      }
      product.po_quota_kg = po_quota_kg;
    }

    return await this.prodRepo.save(product);
  }

  async deleteProduct(productId: number, userId: number) {
    const product = await this.verifySellerOwnsProduct(userId, productId);
    product.stock = 0;
    product.is_active = false;
    product.approval_status = 'rejected';
    await this.prodRepo.save(product);
    return { message: `Produk "${product.name}" berhasil dihapus dari daftar toko.`, deleted_id: product.id };
  }

  async getPendingProductsForAdmin(requestedPage = 1, requestedLimit = 8, search = '') {
    const { page, limit } = normalizePagination(requestedPage, requestedLimit);
    const query = this.prodRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.shop', 'shop')
      .leftJoinAndSelect('shop.user', 'user')
      .leftJoinAndSelect('product.farmland', 'farmland')
      .leftJoinAndSelect('farmland.commodity', 'commodity')
      .where('product.approval_status = :status', { status: 'pending' })
      .orderBy('product.id', 'DESC');

    if (search.trim()) {
      query.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search OR shop.name ILIKE :search OR user.email ILIKE :search OR commodity.name ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    const [data, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    return paginatedResult(data, total, page, limit);
  }

  async approveProduct(productId: number) {
    const product = await this.prodRepo.findOne({
      where: { id: productId },
      relations: { shop: { user: true } },
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan ID ${productId} tidak ditemukan.`);
    }

    product.approval_status = 'approved';
    product.rejection_reason = null;
    product.is_active = true;
    await this.prodRepo.save(product);

    if (product.shop?.user?.id) {
      await this.notificationService.createInAppNotification({
        userId: product.shop.user.id,
        title: 'Produk disetujui admin',
        message: `Produk "${product.name}" telah disetujui dan mulai tampil di katalog publik.`,
        type: 'product_approval',
        severity: 'safe',
        targetUrl: '/toko',
      });
    }

    return {
      message: `Produk "${product.name}" berhasil disetujui.`,
      product,
    };
  }

  async rejectProduct(productId: number, reason?: string) {
    const product = await this.prodRepo.findOne({
      where: { id: productId },
      relations: { shop: { user: true } },
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan ID ${productId} tidak ditemukan.`);
    }

    product.approval_status = 'rejected';
    product.is_active = false;
    product.stock = 0;
    product.rejection_reason = reason || 'Produk tidak memenuhi standar publikasi.';
    await this.prodRepo.save(product);

    if (product.shop?.user?.id) {
      await this.notificationService.createInAppNotification({
        userId: product.shop.user.id,
        title: 'Produk ditolak admin',
        message: `Produk "${product.name}" ditolak oleh admin. ${product.rejection_reason}`,
        type: 'product_approval',
        severity: 'danger',
        targetUrl: '/toko',
      });
    }

    return {
      message: `Produk "${product.name}" ditolak oleh admin.`,
      product,
    };
  }

  async adminDeactivateProduct(productId: number, reason?: string) {
    const normalizedReason = reason?.trim();
    if (!normalizedReason) throw new BadRequestException('Alasan penonaktifan produk wajib diisi.');

    const product = await this.prodRepo.findOne({
      where: { id: productId },
      relations: { shop: { user: true } },
    });
    if (!product) throw new NotFoundException(`Produk dengan ID ${productId} tidak ditemukan.`);
    if (product.approval_status !== 'approved' || !product.is_active) {
      throw new BadRequestException('Hanya produk publik yang aktif yang dapat dinonaktifkan.');
    }

    product.is_active = false;
    product.admin_action = 'disabled';
    product.admin_action_reason = normalizedReason;
    product.admin_action_at = new Date();
    await this.prodRepo.save(product);

    if (product.shop?.user?.id) {
      await this.notificationService.createInAppNotification({
        userId: product.shop.user.id,
        title: 'Produk dinonaktifkan admin',
        message: `Produk "${product.name}" dinonaktifkan oleh admin. Alasan: ${normalizedReason}`,
        type: 'product_admin_action',
        severity: 'warning',
        targetUrl: '/toko',
        metadata: { productId: product.id, action: 'disabled' },
      });
    }

    return { message: `Produk "${product.name}" berhasil dinonaktifkan.`, product };
  }

  async adminReactivateProduct(productId: number) {
    const product = await this.prodRepo.findOne({
      where: { id: productId },
      relations: { shop: { user: true } },
    });
    if (!product) throw new NotFoundException(`Produk dengan ID ${productId} tidak ditemukan.`);
    if (product.admin_action !== 'disabled' || product.approval_status !== 'approved') {
      throw new BadRequestException('Hanya produk publik yang dinonaktifkan admin yang dapat diaktifkan kembali.');
    }
    if (!product.shop?.is_active || product.shop.approval_status !== 'approved' || (product.shop.banned_until && product.shop.banned_until > new Date())) {
      throw new BadRequestException('Toko harus aktif dan tidak sedang dalam masa sanksi untuk mengaktifkan produk.');
    }

    product.is_active = true;
    product.admin_action = null;
    product.admin_action_reason = null;
    product.admin_action_at = null;
    await this.prodRepo.save(product);

    if (product.shop.user?.id) {
      await this.notificationService.createInAppNotification({
        userId: product.shop.user.id,
        title: 'Produk diaktifkan kembali admin',
        message: `Produk "${product.name}" telah diaktifkan kembali dan tampil di katalog.`,
        type: 'product_admin_action',
        severity: 'safe',
        targetUrl: '/toko',
        metadata: { productId: product.id, action: 'reactivated' },
      });
    }

    return { message: `Produk "${product.name}" berhasil diaktifkan kembali.`, product };
  }

  async adminDeleteProduct(productId: number, reason?: string) {
    const normalizedReason = reason?.trim();
    if (!normalizedReason) throw new BadRequestException('Alasan penghapusan produk wajib diisi.');
    const product = await this.prodRepo.findOne({
      where: { id: productId },
      relations: { shop: { user: true } },
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan ID ${productId} tidak ditemukan.`);
    }
    if (product.approval_status !== 'approved') {
      throw new BadRequestException('Produk harus sudah dipublikasikan sebelum dapat dihapus dari halaman publik.');
    }

    product.stock = 0;
    product.is_active = false;
    product.admin_action = 'deleted';
    product.admin_action_reason = normalizedReason;
    product.admin_action_at = new Date();
    await this.prodRepo.save(product);

    if (product.shop?.user?.id) {
      await this.notificationService.createInAppNotification({
        userId: product.shop.user.id,
        title: 'Produk dihapus oleh admin',
        message: `Produk "${product.name}" dihapus oleh admin. Alasan: ${normalizedReason}`,
        type: 'product_admin_action',
        severity: 'warning',
        targetUrl: '/toko',
        metadata: { productId: product.id, action: 'deleted' },
      });
    }

    return {
      message: `Produk "${product.name}" berhasil dihapus oleh admin.`,
      deleted_id: product.id,
      reason: normalizedReason,
    };
  }

  // =========================================================================
  // MASA PANEN TIBA (TRANSISI DARI PRE-ORDER KE READY STOCK RIIL)
  // =========================================================================
  async completeHarvestAndSetStock(
    productId: number,
    dto: FulfillHarvestDto,
    userId: number,
  ) {
    const product = await this.verifySellerOwnsProduct(userId, productId);

    if (!product.is_pre_order) {
      throw new BadRequestException('Produk ini sudah menjadi produk Ready Stock.');
    }

    if (!product.farmland_id) {
      throw new BadRequestException('Produk pre-order ini tidak terhubung dengan lahan.');
    }

    await this.completeFarmlandHarvest(product.farmland_id, dto, userId);
    return this.findOneId(productId);
  }

  async completeFarmlandHarvest(farmlandId: number, dto: FulfillHarvestDto, userId: number) {
    const [user, farmland] = await Promise.all([
      this.userService.findOneIdWithShop(userId),
      this.farmlandRepo.findOne({ where: { id: farmlandId } }),
    ]);

    if (!user) throw new UnauthorizedException();
    if (user.shop) this.ensureShopNotSanctioned(user.shop as any);
    if (!farmland) throw new NotFoundException(`Lahan dengan ID ${farmlandId} tidak ditemukan.`);
    this.assertCanManageFarmland(user, farmland);

    if (farmland.status === 'harvested') {
      throw new BadRequestException('Lahan ini sudah berstatus panen. Tanami kembali sebelum mencatat panen berikutnya.');
    }
    if (!Number.isInteger(dto.actual_harvest_yield_kg) || dto.actual_harvest_yield_kg < 0) {
      throw new BadRequestException('Hasil panen harus berupa bilangan bulat kilogram yang tidak negatif.');
    }

    const products = await this.prodRepo.find({
      where: { farmland_id: farmland.id, is_pre_order: true, is_active: true },
      order: { id: 'ASC' },
    });
    const bookedTotal = products.reduce((total, product) => total + product.po_booked_kg, 0);
    if (dto.actual_harvest_yield_kg < bookedTotal) {
      throw new BadRequestException(`Hasil panen minimal ${bookedTotal} Kg karena sejumlah itu sudah dipesan melalui pre-order.`);
    }

    let remainingSurplus = dto.actual_harvest_yield_kg - bookedTotal;
    const quotaWeights = products.map((product) => Math.max(0, product.po_quota_kg - product.po_booked_kg));
    const totalWeight = quotaWeights.reduce((total, weight) => total + weight, 0) || products.length;

    for (const [index, product] of products.entries()) {
      const weight = quotaWeights.reduce((total, current) => total + current, 0)
        ? quotaWeights[index]
        : 1;
      const surplus = index === products.length - 1
        ? remainingSurplus
        : Math.floor((dto.actual_harvest_yield_kg - bookedTotal) * weight / totalWeight);
      remainingSurplus -= surplus;
      product.is_pre_order = false;
      product.stock = product.po_booked_kg + surplus;
      await this.prodRepo.save(product);
      await this.orderService.markProductHarvested(product.id);
    }

    farmland.status = 'harvested';
    farmland.harvested_at = new Date();
    await this.farmlandRepo.save(farmland);

    return {
      message: products.length
        ? 'Lahan ditandai sudah panen dan seluruh produk pre-order dipindahkan ke ready stock.'
        : 'Lahan ditandai sudah panen.',
      farmland: await this.farmlandRepo.findOne({
        where: { id: farmland.id },
        relations: { user: true, farmerGroup: true, commodity: true },
      }),
      products: await Promise.all(products.map((product) => this.findOneId(product.id))),
    };
  }

  private assertCanSellFromFarmland(user: any, farmland: Farmland) {
    if (user.role === userRoles.ADMIN) return;
    if (farmland.farmer_group_id) {
      if (user.role === userRoles.GROUP_LEADER && Number(user.farmer_group_id) === Number(farmland.farmer_group_id)) return;
      throw new ForbiddenException('Hanya ketua kelompok tani yang dapat membuka pre-order dari lahan kelompok.');
    }
    if (Number(farmland.user_id) !== Number(user.id)) {
      throw new ForbiddenException('Pre-order hanya dapat dibuat dari lahan milik sendiri.');
    }
  }

  private assertCanManageFarmland(user: any, farmland: Farmland) {
    if (user.role === userRoles.ADMIN) return;
    if (farmland.farmer_group_id) {
      if (user.role === userRoles.GROUP_LEADER && Number(user.farmer_group_id) === Number(farmland.farmer_group_id)) return;
      throw new ForbiddenException('Hanya ketua kelompok tani yang dapat mencatat panen lahan kelompok.');
    }
    if (Number(farmland.user_id) !== Number(user.id)) {
      throw new ForbiddenException('Hanya pemilik lahan yang dapat mencatat panen.');
    }
  }

  async findOneId(id: number) {
    const product = await this.prodRepo.findOne({
      where: { id },
      relations: {
        shop: true,
        farmland: {
          commodity: true,
        },
      },
    });

    if (!product) return null;

    if (product.is_pre_order && product.farmland_id) {
      const latestRecommendation = await this.aiRecommendationRepo.findOne({
        where: { farmlandId: product.farmland_id },
        order: { created_at: 'DESC' },
      });

      (product as Product & { weather_forecasts?: unknown[] }).weather_forecasts =
        latestRecommendation?.weather_snapshot || [];
    }

    return product;
  }

  async getProductReviews(productId: number, requestedPage = 1, requestedLimit = 10) {
    const product = await this.prodRepo.findOne({
      where: { id: productId, is_active: true, approval_status: 'approved' },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan.');

    const allReviews = await this.reviewRepo.find({
      where: { productId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    const selectedReviews = new Map<number, ProductReview>();
    for (const review of allReviews) {
      const selected = selectedReviews.get(review.userId);
      const words = review.comment.trim().split(/\s+/).filter(Boolean).length;
      const selectedWords = selected?.comment.trim().split(/\s+/).filter(Boolean).length ?? -1;
      if (!selected || words > selectedWords || (
        words === selectedWords
        && (review.createdAt > selected.createdAt
          || (review.createdAt.getTime() === selected.createdAt.getTime() && review.id > selected.id))
      )) {
        selectedReviews.set(review.userId, review);
      }
    }
    const reviews = [...selectedReviews.values()];
    const reviewUserIds = [...new Set(reviews.map((review) => review.userId))];
    const repeatOrderStats = reviewUserIds.length
      ? await this.orderItemsRepo
        .createQueryBuilder('orderItem')
        .innerJoin('orderItem.order', 'order')
        .innerJoin('order.user', 'buyer')
        .select('buyer.id', 'user_id')
        .addSelect('COUNT(DISTINCT order.id)', 'repeat_order_count')
        .where('orderItem.productId = :productId', { productId })
        .andWhere('buyer.id IN (:...reviewUserIds)', { reviewUserIds })
        .andWhere('order.status = :completed', { completed: orderStatus.COMPLETED })
        .andWhere('order.buyer_confirmed = :buyerConfirmed', { buyerConfirmed: true })
        .andWhere('order.seller_confirmed = :sellerConfirmed', { sellerConfirmed: true })
        .groupBy('buyer.id')
        .getRawMany<{ user_id: number; repeat_order_count: string }>()
      : [];
    const repeatOrdersByUser = new Map(
      repeatOrderStats.map((stat) => [Number(stat.user_id), Number(stat.repeat_order_count)]),
    );
    reviews.sort((left, right) => {
      const leftRatingGroup = left.rating >= 4 ? 1 : 0;
      const rightRatingGroup = right.rating >= 4 ? 1 : 0;
      if (leftRatingGroup !== rightRatingGroup) return rightRatingGroup - leftRatingGroup;

      const leftWords = left.comment.trim().split(/\s+/).filter(Boolean).length;
      const rightWords = right.comment.trim().split(/\s+/).filter(Boolean).length;
      const repeatOrderDifference =
        (repeatOrdersByUser.get(right.userId) || 0) - (repeatOrdersByUser.get(left.userId) || 0);
      const ratingDifference = leftRatingGroup
        ? right.rating - left.rating
        : left.rating - right.rating;
      return (leftRatingGroup
        ? ratingDifference || repeatOrderDifference
        : repeatOrderDifference || ratingDifference)
        || rightWords - leftWords
        || right.createdAt.getTime() - left.createdAt.getTime()
        || right.id - left.id;
    });
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 50) : 10;
    const pageReviews = reviews.slice((page - 1) * limit, page * limit);
    const userEmails = reviewUserIds.length
      ? await this.userRepo.find({
          where: { id: In(reviewUserIds) },
          select: { id: true, email: true, profile_image_url: true },
        })
      : [];
    const userEmailMap = new Map(userEmails.map((user) => [user.id, user.email]));
    const userImageMap = new Map(userEmails.map((user) => [user.id, user.profile_image_url]));

    const ratingTotal = reviews.reduce((total, review) => total + review.rating, 0);
    return {
      average_rating: reviews.length ? Number((ratingTotal / reviews.length).toFixed(1)) : 0,
      rating_count: reviews.length,
      reviews: pageReviews.map(({ id, rating, comment, createdAt, userId, imageUrls }) => ({
        id,
        rating,
        comment,
        image_urls: imageUrls || [],
        createdAt,
        user_id: userId,
        user_email: userEmailMap.get(userId) || null,
        user_image_url: userImageMap.get(userId) || null,
        repeat_order_count: repeatOrdersByUser.get(userId) || 0,
      })),
      meta: {
        page,
        limit,
        total: reviews.length,
        total_pages: Math.max(1, Math.ceil(reviews.length / limit)),
      },
    };
  }

  async getReviewEligibility(productId: number, userId: number) {
    const eligibleOrders = await this.orderItemsRepo
      .createQueryBuilder('orderItem')
      .innerJoin('orderItem.order', 'order')
      .innerJoin('order.user', 'buyer')
      .select('order.id', 'order_id')
      .where('orderItem.productId = :productId', { productId })
      .andWhere('buyer.id = :userId', { userId })
      .andWhere('order.status = :completed', { completed: orderStatus.COMPLETED })
      .andWhere('order.buyer_confirmed = :buyerConfirmed', { buyerConfirmed: true })
      .andWhere('order.seller_confirmed = :sellerConfirmed', { sellerConfirmed: true })
      .orderBy('order.id', 'DESC')
      .getRawMany<{ order_id: number }>();

    const existingReview = await this.reviewRepo.findOne({
      where: { userId, productId },
      order: { createdAt: 'DESC' },
    });
    const orderIds = existingReview || !eligibleOrders.length
      ? []
      : [Number(eligibleOrders[0].order_id)];
    return {
      eligible: orderIds.length > 0,
      order_ids: orderIds,
      has_review: Boolean(existingReview),
      review_id: existingReview?.id ?? null,
    };
  }

  async createProductReview(productId: number, userId: number, dto: CreateProductReviewDto) {
    const eligibility = await this.getReviewEligibility(productId, userId);
    if (!eligibility.order_ids.includes(dto.orderId)) {
      throw new BadRequestException('Ulasan hanya dapat diberikan untuk pesanan yang telah selesai dan satu kali untuk setiap produk. Gunakan fitur perbarui ulasan jika sudah pernah memberi ulasan.');
    }
    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating harus berupa bintang 1 sampai 5.');
    }
    const comment = dto.comment?.trim() || '';
    if (comment.length > 1000) {
      throw new BadRequestException('Ulasan maksimal 1000 karakter.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const product = await queryRunner.manager
        .createQueryBuilder(Product, 'product')
        .setLock('pessimistic_write')
        .where('product.id = :productId', { productId })
        .getOne();
      if (!product) throw new NotFoundException('Produk tidak ditemukan.');

      const existingReviews = await queryRunner.manager.find(ProductReview, {
        where: { productId, userId },
        order: { createdAt: 'DESC' },
      });
      if (existingReviews.length) {
        throw new BadRequestException('Anda sudah memiliki ulasan untuk produk ini. Perbarui ulasan yang sudah ada.');
      }
      const review = queryRunner.manager.create(ProductReview, {
        productId,
        orderId: dto.orderId,
        userId,
        rating: dto.rating,
        comment,
        imageUrls: dto.image_urls || [],
      });
      await queryRunner.manager.save(ProductReview, review);
      await queryRunner.commitTransaction();
      return { message: 'Ulasan produk berhasil dikirim.', review };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateProductReview(
    productId: number,
    reviewId: number,
    userId: number,
    dto: UpdateProductReviewDto,
    role?: string,
  ) {
    if (dto.rating === undefined && dto.comment === undefined && dto.image_urls === undefined) {
      throw new BadRequestException('Ubah rating atau ulasan terlebih dahulu.');
    }
    if (dto.rating !== undefined && (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5)) {
      throw new BadRequestException('Rating harus berupa bintang 1 sampai 5.');
    }
    const review = await this.reviewRepo.findOne({ where: { id: reviewId, productId } });
    if (!review) throw new NotFoundException('Ulasan tidak ditemukan.');
    if (review.userId !== userId) {
      if (role === userRoles.ADMIN) {
        throw new ForbiddenException('Admin hanya dapat menghapus ulasan pengguna lain, bukan mengubahnya.');
      }
      throw new ForbiddenException('Anda hanya dapat mengubah ulasan milik sendiri.');
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.comment !== undefined) {
      const comment = typeof dto.comment === 'string' ? dto.comment.trim() : '';
      if (comment.length > 1000) throw new BadRequestException('Ulasan maksimal 1000 karakter.');
      review.comment = comment;
    }
    if (dto.image_urls !== undefined) review.imageUrls = dto.image_urls;
    await this.reviewRepo.save(review);

    await this.reviewRepo
      .createQueryBuilder()
      .delete()
      .where('product_id = :productId AND user_id = :userId AND id != :reviewId', { productId, userId, reviewId })
      .execute();
    return { message: 'Ulasan berhasil diperbarui.', review };
  }

  async deleteProductReview(productId: number, reviewId: number, userId: number, role?: string) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId, productId } });
    if (!review) throw new NotFoundException('Ulasan tidak ditemukan.');
    if (review.userId !== userId && role !== userRoles.ADMIN) {
      throw new ForbiddenException('Anda hanya dapat menghapus ulasan milik sendiri.');
    }
    await this.reviewRepo.delete({ productId, userId: review.userId });
    return { message: 'Ulasan berhasil dihapus.' };
  }

  async findCatalog(category: 'all' | 'pre_order' | 'ready_stock', requestedPage: number, requestedLimit: number, searchTerm = '') {
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 24) : 8;
    const query = this.prodRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.shop', 'shop')
      .leftJoinAndSelect('product.farmland', 'farmland')
      .leftJoinAndSelect('farmland.commodity', 'commodity')
      .where('product.is_active = :isActive', { isActive: true })
      .andWhere('product.approval_status = :approvalStatus', { approvalStatus: 'approved' })
      .andWhere('shop.is_active = :shopActive', { shopActive: true })
      .andWhere('shop.approval_status = :shopApprovalStatus', { shopApprovalStatus: 'approved' })
      .andWhere(new Brackets((qb) => {
        qb.where('(product.is_pre_order = :preOrder AND product.po_quota_kg > product.po_booked_kg)', { preOrder: true })
          .orWhere('(product.is_pre_order = :readyStock AND product.stock > product.po_booked_kg)', { readyStock: false });
      }))
      .addSelect(
        (subQuery) => subQuery
          .select('COALESCE(SUM(orderItem.quantity), 0)')
          .from(OrderItems, 'orderItem')
          .innerJoin('orderItem.order', 'completedOrder')
          .where('orderItem.productId = product.id')
          .andWhere('completedOrder.status = :catalogCompleted', { catalogCompleted: orderStatus.COMPLETED })
          .andWhere('completedOrder.buyer_confirmed = :catalogBuyerConfirmed', { catalogBuyerConfirmed: true })
          .andWhere('completedOrder.seller_confirmed = :catalogSellerConfirmed', { catalogSellerConfirmed: true }),
        'catalog_sold_quantity',
      )
      .addSelect(
        (subQuery) => subQuery
          .select('COALESCE(AVG(review.rating), 0)')
          .from(ProductReview, 'review')
          .where('review.productId = product.id')
          .andWhere(`review.id = (
            SELECT winner.id
            FROM product_reviews winner
            WHERE winner.product_id = review.product_id
              AND winner.user_id = review.user_id
            ORDER BY COALESCE(array_length(regexp_split_to_array(NULLIF(trim(winner.comment), ''), '[[:space:]]+'), 1), 0) DESC,
              winner.created_at DESC, winner.id DESC
            LIMIT 1
          )`),
        'catalog_rating_average',
      )
      .orderBy('catalog_sold_quantity', 'DESC')
      .addOrderBy('catalog_rating_average', 'DESC')
      .addOrderBy('product.id', 'DESC');

    if (category === 'pre_order') query.andWhere('product.is_pre_order = :isPreOrder', { isPreOrder: true });
    if (category === 'ready_stock') query.andWhere('product.is_pre_order = :isPreOrder', { isPreOrder: false });
    if (searchTerm.trim()) {
      query.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search OR shop.name ILIKE :search OR commodity.name ILIKE :search)',
        { search: `%${searchTerm.trim()}%` },
      );
    }

    const [products, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    const productIds = products.map((product) => product.id);
    const ranking = productIds.length
      ? await this.prodRepo.createQueryBuilder('product')
        .select('product.id', 'product_id')
        .addSelect(
          (subQuery) => subQuery
            .select('COALESCE(SUM(orderItem.quantity), 0)')
            .from(OrderItems, 'orderItem')
            .innerJoin('orderItem.order', 'completedOrder')
            .where('orderItem.productId = product.id')
            .andWhere('completedOrder.status = :statsCompleted', { statsCompleted: orderStatus.COMPLETED })
            .andWhere('completedOrder.buyer_confirmed = :statsBuyerConfirmed', { statsBuyerConfirmed: true })
            .andWhere('completedOrder.seller_confirmed = :statsSellerConfirmed', { statsSellerConfirmed: true }),
          'sold_quantity',
        )
        .addSelect(
          (subQuery) => subQuery
            .select('COALESCE(AVG(review.rating), 0)')
            .from(ProductReview, 'review')
            .where('review.productId = product.id')
            .andWhere(`review.id = (
              SELECT winner.id
              FROM product_reviews winner
              WHERE winner.product_id = review.product_id
                AND winner.user_id = review.user_id
              ORDER BY COALESCE(array_length(regexp_split_to_array(NULLIF(trim(winner.comment), ''), '[[:space:]]+'), 1), 0) DESC,
                winner.created_at DESC, winner.id DESC
              LIMIT 1
            )`),
          'rating_average',
        )
        .addSelect(
          (subQuery) => subQuery
            .select('COUNT(review.id)')
            .from(ProductReview, 'review')
            .where('review.productId = product.id')
            .andWhere(`review.id = (
              SELECT winner.id
              FROM product_reviews winner
              WHERE winner.product_id = review.product_id
                AND winner.user_id = review.user_id
              ORDER BY COALESCE(array_length(regexp_split_to_array(NULLIF(trim(winner.comment), ''), '[[:space:]]+'), 1), 0) DESC,
                winner.created_at DESC, winner.id DESC
              LIMIT 1
            )`),
          'rating_count',
        )
        .where('product.id IN (:...productIds)', { productIds })
        .getRawMany<{ product_id: number; sold_quantity: string; rating_average: string; rating_count: string }>()
      : [];
    const statsByProduct = new Map(ranking.map((stat) => [Number(stat.product_id), stat]));
    const data = products.map((product) => {
      const stats = statsByProduct.get(product.id);
      return {
        ...product,
        sold_quantity: Number(stats?.sold_quantity || 0),
        rating_average: Number(Number(stats?.rating_average || 0).toFixed(1)),
        rating_count: Number(stats?.rating_count || 0),
      };
    });
    return { data, meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } };
  }

  findAll() {
    return this.prodRepo.find({
      where: { is_active: true },
      relations: {
        shop: true,
        farmland: true,
      },
    });
  }
}