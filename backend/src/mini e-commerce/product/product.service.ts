import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { userRoles } from 'src/user/enum/user-roles.enum';
import { UserService } from 'src/user/user.service';
import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import { Brackets, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dtos/create-product.dto';
import { FulfillHarvestDto } from './dtos/fulfill-harvest.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { AiRecommendation } from 'src/ai/entities/ai-recomendation.entity';
import { OrderService } from '../order/order.service';

const SELLER_ROLES = [
  userRoles.FARMER,
  userRoles.INDIVIDUAL_FARMER,
  userRoles.GROUP_LEADER,
  userRoles.ADMIN,
];

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private prodRepo: Repository<Product>,
    @InjectRepository(Farmland) private farmlandRepo: Repository<Farmland>,
    @InjectRepository(AiRecommendation) private aiRecommendationRepo: Repository<AiRecommendation>,
    private userService: UserService,
    private orderService: OrderService,
  ) {}

  private isSellerRole(role: string | undefined): boolean {
    if (!role) return false;
    return SELLER_ROLES.includes(role as userRoles);
  }

  private async verifySellerOwnsProduct(userId: number, productId: number): Promise<Product> {
    const user = await this.userService.findOneIdWithShop(userId);
    if (!user) throw new UnauthorizedException();
    if (!this.isSellerRole(user.role)) throw new ForbiddenException('Hanya seller (farmer, individual_farmer, group_leader, admin) yang dapat mengelola produk.');
    if (!user.shop) throw new BadRequestException('User belum memiliki toko');

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

    return product;
  }

  async createProduct(request: CreateProductDto, userId: number) {
    const user = await this.userService.findOneIdWithShop(userId);

    if (!user) throw new UnauthorizedException();
    if (!this.isSellerRole(user.role)) throw new ForbiddenException('Hanya seller (farmer, individual_farmer, group_leader, admin) yang dapat membuat produk.');
    if (!user.shop) throw new BadRequestException('User belum memiliki toko');

    const shopId = (user.shop as any).id || user.shop;
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
      is_pre_order: isPreOrder,
      farmland_id: isPreOrder ? request.farmland_id : undefined,
      po_quota_kg: poQuotaKg,
      po_booked_kg: 0,
      estimated_harvest_date: estimatedHarvestDate || undefined,
    };

    const product = this.prodRepo.create(productData);

    return await this.prodRepo.save(product);
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
    await this.prodRepo.save(product);
    return { message: `Produk "${product.name}" berhasil dihapus dari daftar toko.`, deleted_id: product.id };
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
      this.userService.findOneId(userId),
      this.farmlandRepo.findOne({ where: { id: farmlandId } }),
    ]);

    if (!user) throw new UnauthorizedException();
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

  async findCatalog(category: 'all' | 'pre_order' | 'ready_stock', requestedPage: number, requestedLimit: number, searchTerm = '') {
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 24) : 8;
    const query = this.prodRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.shop', 'shop')
      .leftJoinAndSelect('product.farmland', 'farmland')
      .leftJoinAndSelect('farmland.commodity', 'commodity')
      .where('product.is_active = :isActive', { isActive: true })
      .andWhere(new Brackets((qb) => {
        qb.where('(product.is_pre_order = :preOrder AND product.po_quota_kg > product.po_booked_kg)', { preOrder: true })
          .orWhere('(product.is_pre_order = :readyStock AND product.stock > product.po_booked_kg)', { readyStock: false });
      }))
      .orderBy('product.id', 'DESC');

    if (category === 'pre_order') query.andWhere('product.is_pre_order = :isPreOrder', { isPreOrder: true });
    if (category === 'ready_stock') query.andWhere('product.is_pre_order = :isPreOrder', { isPreOrder: false });
    if (searchTerm.trim()) {
      query.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search OR shop.name ILIKE :search OR commodity.name ILIKE :search)',
        { search: `%${searchTerm.trim()}%` },
      );
    }

    const [data, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
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