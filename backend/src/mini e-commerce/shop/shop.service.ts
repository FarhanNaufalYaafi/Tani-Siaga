import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { userRoles } from 'src/user/enum/user-roles.enum';
import { UserService } from 'src/user/user.service';
import { Product } from '../product/entities/product.entity';
import { ProductReview } from '../product/entities/product-review.entity';
import { LessThanOrEqual, Repository } from 'typeorm';
import { CreateShopDto } from './dtos/create-shop.dto';
import { Shop } from './entities/shop.entity';
import { OrderItems } from '../order_items/entities/order_items.entity';
import { orderStatus } from '../order/enum/order-status.enum';
import { NotificationService } from 'src/notification/notification.service';
import { User } from 'src/user/entities/user.entity';
import { normalizePagination, paginatedResult } from 'src/common/pagination';

function isAllowedImageUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:'
            && url.hostname === 'res.cloudinary.com';
    } catch {
        return false;
    }
}

@Injectable()
export class ShopService {
    constructor(
        @InjectRepository(Shop) private shopRepo: Repository<Shop>,
        @InjectRepository(Product) private prodRepo: Repository<Product>,
        @InjectRepository(OrderItems) private orderItemsRepo: Repository<OrderItems>,
        @InjectRepository(ProductReview) private reviewRepo: Repository<ProductReview>,
        @InjectRepository(User) private userRepo: Repository<User>,
        private userService: UserService,
        private notificationService: NotificationService,
){}

    async createShop(request: CreateShopDto, userId: number){
        const user = await this.userService.findOneIdWithShop(userId)

        if(!user) throw new UnauthorizedException()

        if (user.shop && !user.shop.deleted_at) throw new ConflictException('you already have shop');
        if (request.profile_image_url && !isAllowedImageUrl(request.profile_image_url)) {
            throw new BadRequestException('Foto profil toko harus berasal dari penyimpanan gambar yang didukung.');
        }

        const shopData = {
            ...request,
            is_active: true,
            approval_status: 'pending' as const,
            rejection_reason: null,
            warning_reason: null,
            warning_evidence_urls: [],
            warning_at: null,
            ban_reason: null,
            ban_evidence_urls: [],
            banned_until: null,
            deleted_at: null,
            user: {id: user.id}
        };
        const shop = user.shop
            ? this.shopRepo.merge(user.shop, shopData)
            : this.shopRepo.create(shopData);

        const savedShop = await this.shopRepo.save(shop)

        const adminUsers = await this.userRepo.find({ where: { role: userRoles.ADMIN } });
        for (const admin of adminUsers) {
            await this.notificationService.createInAppNotification({
                userId: admin.id,
                title: 'Permintaan toko baru',
                message: `Toko "${savedShop.name}" menunggu persetujuan admin.`,
                type: 'shop_approval',
                severity: 'warning',
                targetUrl: '/admin',
                metadata: { shopId: savedShop.id },
            });
        }

        await this.promoteToSeller(user.id)

        return savedShop
    }

    async promoteToSeller(userId: number) {
        const user = await this.userService.findOneId(userId);
        if (user && user.role === userRoles.USER) {
            await this.userService.update(userId, { role: userRoles.FARMER });
        }
    }

    async getMyShop(userId: number) {
        await this.restoreExpiredBans();
        const user = await this.userService.findOneIdWithShop(userId);
        if (!user) throw new UnauthorizedException();
        return user.shop && !user.shop.deleted_at ? user.shop : null;
    }

    async updateMyShopProfileImage(userId: number, profileImageUrl: string) {
        if (
            typeof profileImageUrl !== 'string'
            || profileImageUrl.length > 2048
            || !isAllowedImageUrl(profileImageUrl)
        ) {
            throw new BadRequestException('Foto profil toko harus berasal dari penyimpanan gambar yang didukung.');
        }
        const shop = await this.shopRepo.findOne({
            where: { user: { id: userId } },
        });
        if (!shop || shop.deleted_at) throw new NotFoundException('Toko tidak ditemukan.');
        shop.profile_image_url = profileImageUrl;
        return this.shopRepo.save(shop);
    }

    async getMyShopProducts(userId: number) {
        await this.restoreExpiredBans();
        const user = await this.userService.findOneIdWithShop(userId);
        if (!user) throw new UnauthorizedException();
        if (!user.shop || user.shop.deleted_at) throw new NotFoundException('User belum memiliki toko');

        const shopId = (user.shop as any).id || user.shop;
        return await this.prodRepo.find({
            where: { shop: { id: shopId } },
            relations: { farmland: { commodity: true } },
            order: { id: 'DESC' },
        });
    }

    async getPublicShop(shopId: number) {
        await this.restoreExpiredBans();
        const shop = await this.shopRepo.findOne({
            where: { id: shopId, is_active: true, approval_status: 'approved' },
        });
        if (!shop) throw new NotFoundException('Toko tidak ditemukan');

        const products = await this.prodRepo.find({
            where: { shop: { id: shopId }, is_active: true, approval_status: 'approved' },
            relations: { farmland: { commodity: true } },
        });

        const productStats = await this.orderItemsRepo
            .createQueryBuilder('orderItem')
            .innerJoin('orderItem.product', 'product')
            .innerJoin('product.shop', 'shop')
            .innerJoin('orderItem.order', 'order')
            .select('product.id', 'product_id')
            .addSelect('COALESCE(SUM(orderItem.quantity), 0)', 'sold_quantity')
            .addSelect('COUNT(DISTINCT order.id)', 'completed_orders')
            .where('shop.id = :shopId', { shopId })
            .andWhere('order.status = :status', { status: orderStatus.COMPLETED })
            .andWhere('order.buyer_confirmed = :buyerConfirmed', { buyerConfirmed: true })
            .andWhere('order.seller_confirmed = :sellerConfirmed', { sellerConfirmed: true })
            .groupBy('product.id')
            .getRawMany();

        const productRatings = await this.reviewRepo
            .createQueryBuilder('review')
            .select('review.productId', 'product_id')
            .addSelect('AVG(review.rating)', 'rating_average')
            .addSelect('COUNT(review.id)', 'rating_count')
            .innerJoin('review.product', 'reviewProduct')
            .innerJoin('reviewProduct.shop', 'reviewShop')
            .where('reviewShop.id = :shopId', { shopId })
            .andWhere(`review.id = (
                SELECT winner.id
                FROM product_reviews winner
                WHERE winner.product_id = review.product_id
                  AND winner.user_id = review.user_id
                ORDER BY COALESCE(array_length(regexp_split_to_array(NULLIF(trim(winner.comment), ''), '[[:space:]]+'), 1), 0) DESC,
                  winner.created_at DESC, winner.id DESC
                LIMIT 1
            )`)
            .groupBy('review.productId')
            .getRawMany();

        const statsByProduct = new Map(
            productStats.map((stat) => [Number(stat.product_id), {
                sold_quantity: Number(stat.sold_quantity),
                completed_orders: Number(stat.completed_orders),
            }]),
        );
        const ratingsByProduct = new Map(
            productRatings.map((stat) => [Number(stat.product_id), {
                rating_average: Number(Number(stat.rating_average).toFixed(1)),
                rating_count: Number(stat.rating_count),
            }]),
        );

        const productsWithStats = products
            .map((product) => ({
                ...product,
                sold_quantity: statsByProduct.get(product.id)?.sold_quantity || 0,
                completed_orders: statsByProduct.get(product.id)?.completed_orders || 0,
                rating_average: ratingsByProduct.get(product.id)?.rating_average || 0,
                rating_count: ratingsByProduct.get(product.id)?.rating_count || 0,
                booked_percentage: product.is_pre_order && product.po_quota_kg > 0
                    ? Math.min(100, Math.round((product.po_booked_kg / product.po_quota_kg) * 100))
                    : null,
            }))
            .sort((left, right) => {
                return right.sold_quantity - left.sold_quantity
                    || right.rating_average - left.rating_average;
            });

        const shopStats = productsWithStats.reduce(
            (summary, product) => ({
                sold_quantity: summary.sold_quantity + product.sold_quantity,
                completed_orders: summary.completed_orders + product.completed_orders,
            }),
            { sold_quantity: 0, completed_orders: 0 },
        );

        return {
            shop,
            stats: shopStats,
            products: productsWithStats,
        };
    }

    async getPendingShopsForAdmin(requestedPage = 1, requestedLimit = 8, search = '') {
        const { page, limit } = normalizePagination(requestedPage, requestedLimit);

        const query = this.shopRepo
            .createQueryBuilder('shop')
            .leftJoinAndSelect('shop.user', 'user')
            .where('shop.approval_status = :status', { status: 'pending' })
            .orderBy('shop.id', 'DESC');

        if (search.trim()) {
            query.andWhere(
                '(shop.name ILIKE :search OR shop.location ILIKE :search OR shop.phone_number ILIKE :search OR user.email ILIKE :search)',
                { search: `%${search.trim()}%` },
            );
        }

        const [data, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
        return paginatedResult(data, total, page, limit);
    }

    async getShopsForAdmin(requestedPage = 1, requestedLimit = 8, search = '') {
        await this.restoreExpiredBans();
        const { page, limit } = normalizePagination(requestedPage, requestedLimit);
        const query = this.shopRepo
            .createQueryBuilder('shop')
            .leftJoinAndSelect('shop.user', 'user')
            .where('shop.deleted_at IS NULL')
            .orderBy('shop.id', 'DESC');

        if (search.trim()) {
            query.andWhere(
                '(shop.name ILIKE :search OR shop.location ILIKE :search OR shop.phone_number ILIKE :search OR user.email ILIKE :search)',
                { search: `%${search.trim()}%` },
            );
        }

        const [data, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
        return paginatedResult(data, total, page, limit);
    }

    async getAdminShopDashboard(shopId: number) {
        await this.restoreExpiredBans();
        const shop = await this.shopRepo
            .createQueryBuilder('shop')
            .leftJoinAndSelect('shop.user', 'user')
            .leftJoinAndSelect('shop.product', 'product')
            .where('shop.id = :shopId', { shopId })
            .andWhere('shop.deleted_at IS NULL')
            .orderBy('product.id', 'DESC')
            .getOne();

        if (!shop) throw new NotFoundException(`Toko dengan ID ${shopId} tidak ditemukan.`);

        const products = shop.product || [];
        return {
            shop,
            products,
            stats: {
                total_products: products.length,
                active_products: products.filter((product) => product.is_active).length,
                approved_products: products.filter((product) => product.approval_status === 'approved').length,
                pending_products: products.filter((product) => product.approval_status === 'pending').length,
                rejected_products: products.filter((product) => product.approval_status === 'rejected').length,
            },
        };
    }

    async warnShop(shopId: number, reason?: string, evidenceUrls: string[] = []) {
        const normalizedReason = reason?.trim();
        if (!normalizedReason) throw new BadRequestException('Alasan peringatan wajib diisi.');
        this.validateEvidenceUrls(evidenceUrls);

        const shop = await this.shopRepo.findOne({ where: { id: shopId }, relations: { user: true } });
        if (!shop) throw new NotFoundException(`Toko dengan ID ${shopId} tidak ditemukan.`);

        shop.warning_reason = normalizedReason;
        shop.warning_evidence_urls = evidenceUrls;
        shop.warning_at = new Date();
        await this.shopRepo.save(shop);
        await this.notificationService.createInAppNotification({
            userId: shop.user.id,
            title: 'Peringatan untuk toko Anda',
            message: `Toko "${shop.name}" menerima peringatan admin: ${normalizedReason} Jika pelanggaran berlanjut, toko dapat dinonaktifkan selama beberapa hari.`,
            type: 'shop_warning',
            severity: 'warning',
            targetUrl: '/toko',
        });

        return { message: `Peringatan untuk toko "${shop.name}" berhasil dikirim.`, shop };
    }

    async banShop(shopId: number, reason?: string, durationDays?: number, evidenceUrls: string[] = []) {
        const normalizedReason = reason?.trim();
        if (!normalizedReason) throw new BadRequestException('Alasan sanksi wajib diisi.');
        if (!Number.isInteger(durationDays) || !durationDays || durationDays < 1 || durationDays > 365) {
            throw new BadRequestException('Durasi sanksi harus antara 1 sampai 365 hari.');
        }
        this.validateEvidenceUrls(evidenceUrls);

        await this.restoreExpiredBans();
        const shop = await this.shopRepo.findOne({
            where: { id: shopId },
            relations: { user: true },
        });
        if (!shop) throw new NotFoundException(`Toko dengan ID ${shopId} tidak ditemukan.`);
        if (shop.approval_status !== 'approved') {
            throw new BadRequestException('Sanksi hanya dapat diberikan kepada toko yang sudah disetujui.');
        }
        const alreadyBanned = Boolean(shop.banned_until && shop.banned_until > new Date());
        const bannedUntil = alreadyBanned ? new Date(shop.banned_until!) : new Date();
        bannedUntil.setUTCDate(bannedUntil.getUTCDate() + durationDays);
        const products = await this.prodRepo.find({ where: { shop: { id: shopId } } });
        for (const product of products) {
            if (!alreadyBanned) product.active_before_shop_ban = product.is_active;
            product.is_active = false;
        }
        await this.prodRepo.save(products);

        shop.is_active = false;
        shop.ban_reason = alreadyBanned && shop.ban_reason
            ? `${shop.ban_reason}; ${normalizedReason}`
            : normalizedReason;
        shop.ban_evidence_urls = alreadyBanned
            ? [...new Set([...(shop.ban_evidence_urls || []), ...evidenceUrls])].slice(-4)
            : evidenceUrls;
        shop.banned_until = bannedUntil;
        await this.shopRepo.save(shop);
        await this.notificationService.createInAppNotification({
            userId: shop.user.id,
            title: alreadyBanned ? 'Sanksi toko ditambahkan' : 'Toko dinonaktifkan sementara',
            message: alreadyBanned
                ? `Sanksi toko "${shop.name}" ditambah ${durationDays} hari dan berakhir ${bannedUntil.toLocaleDateString('id-ID')}. Alasan tambahan: ${normalizedReason}`
                : `Toko "${shop.name}" dinonaktifkan selama ${durationDays} hari sampai ${bannedUntil.toLocaleDateString('id-ID')}. Alasan: ${normalizedReason}`,
            type: 'shop_sanction',
            severity: 'danger',
            targetUrl: '/toko',
        });

        return {
            message: alreadyBanned
                ? `Sanksi toko "${shop.name}" ditambah ${durationDays} hari.`
                : `Toko "${shop.name}" disanksi selama ${durationDays} hari.`,
            shop,
        };
    }

    private validateEvidenceUrls(evidenceUrls: string[]) {
        if (!Array.isArray(evidenceUrls) || evidenceUrls.length > 4) {
            throw new BadRequestException('Lampirkan maksimal 4 foto bukti.');
        }
        if (evidenceUrls.some((url) =>
            typeof url !== 'string'
            || url.length > 2048
            || !isAllowedImageUrl(url)
        )) {
            throw new BadRequestException('Foto bukti harus berasal dari penyimpanan gambar yang didukung.');
        }
    }

    async liftShopSanction(shopId: number) {
        await this.restoreExpiredBans();
        const shop = await this.shopRepo.findOne({ where: { id: shopId }, relations: { user: true } });
        if (!shop) throw new NotFoundException(`Toko dengan ID ${shopId} tidak ditemukan.`);
        if (!shop.banned_until || shop.banned_until <= new Date()) {
            throw new BadRequestException('Toko ini tidak sedang dalam masa sanksi.');
        }

        const products = await this.prodRepo.find({ where: { shop: { id: shopId } } });
        for (const product of products) {
            if (product.active_before_shop_ban !== null && product.active_before_shop_ban !== undefined) {
                product.is_active = product.active_before_shop_ban;
                product.active_before_shop_ban = null;
            }
        }
        await this.prodRepo.save(products);

        shop.is_active = shop.approval_status === 'approved';
        shop.banned_until = null;
        shop.ban_reason = null;
        await this.shopRepo.save(shop);
        await this.notificationService.createInAppNotification({
            userId: shop.user.id,
            title: 'Sanksi toko dicabut',
            message: `Sanksi untuk toko "${shop.name}" telah dicabut oleh admin.`,
            type: 'shop_sanction',
            severity: 'safe',
            targetUrl: '/toko',
        });

        return { message: `Sanksi untuk toko "${shop.name}" berhasil dicabut.`, shop };
    }

    async reduceShopSanction(shopId: number, days?: number) {
        if (!Number.isInteger(days) || !days || days < 1) {
            throw new BadRequestException('Pengurangan sanksi harus berupa jumlah hari minimal 1.');
        }

        const shop = await this.shopRepo.findOne({ where: { id: shopId }, relations: { user: true } });
        if (!shop) throw new NotFoundException(`Toko dengan ID ${shopId} tidak ditemukan.`);
        if (!shop.banned_until || shop.banned_until <= new Date()) {
            throw new BadRequestException('Toko ini tidak sedang dalam masa sanksi.');
        }

        const shortenedUntil = new Date(shop.banned_until);
        shortenedUntil.setUTCDate(shortenedUntil.getUTCDate() - days);
        if (shortenedUntil <= new Date()) {
            await this.liftShopSanction(shopId);
            return { message: `Pengurangan ${days} hari mengakhiri sanksi toko "${shop.name}".`, shop_id: shop.id, lifted: true };
        }

        shop.banned_until = shortenedUntil;
        await this.shopRepo.save(shop);
        await this.notificationService.createInAppNotification({
            userId: shop.user.id,
            title: 'Durasi sanksi toko dikurangi',
            message: `Sisa sanksi toko "${shop.name}" dikurangi ${days} hari. Sanksi berakhir ${shortenedUntil.toLocaleDateString('id-ID')}.`,
            type: 'shop_sanction',
            severity: 'warning',
            targetUrl: '/toko',
        });

        return { message: `Sanksi toko "${shop.name}" dikurangi ${days} hari.`, shop, lifted: false };
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async restoreExpiredBans() {
        const shops = await this.shopRepo.find({
            where: { banned_until: LessThanOrEqual(new Date()) },
        });

        for (const shop of shops) {
            const products = await this.prodRepo.find({ where: { shop: { id: shop.id } } });
            for (const product of products) {
                if (product.active_before_shop_ban !== null && product.active_before_shop_ban !== undefined) {
                    product.is_active = product.active_before_shop_ban;
                    product.active_before_shop_ban = null;
                }
            }
            await this.prodRepo.save(products);
            shop.is_active = shop.approval_status === 'approved';
            shop.banned_until = null;
            await this.shopRepo.save(shop);
        }
    }

    async approveShop(shopId: number) {
        const shop = await this.shopRepo.findOne({
            where: { id: shopId },
            relations: { user: true },
        });

        if (!shop) {
            throw new NotFoundException(`Toko dengan ID ${shopId} tidak ditemukan.`);
        }

        shop.approval_status = 'approved';
        shop.is_active = true;
        shop.rejection_reason = null;
        shop.banned_until = null;
        shop.deleted_at = null;
        await this.shopRepo.save(shop);

        await this.userService.update(shop.user.id, { role: userRoles.FARMER });
        await this.notificationService.createInAppNotification({
            userId: shop.user.id,
            title: 'Toko disetujui admin',
            message: `Toko "${shop.name}" telah disetujui dan siap dipublikasikan ke publik.`,
            type: 'shop_approval',
            severity: 'safe',
            targetUrl: '/toko',
        });

        return {
            message: `Toko "${shop.name}" berhasil disetujui.`,
            shop,
        };
    }

    async rejectShop(shopId: number, reason?: string) {
        const shop = await this.shopRepo.findOne({
            where: { id: shopId },
            relations: { user: true },
        });

        if (!shop) {
            throw new NotFoundException(`Toko dengan ID ${shopId} tidak ditemukan.`);
        }

        shop.approval_status = 'rejected';
        shop.is_active = false;
        shop.rejection_reason = reason || 'Data toko tidak memenuhi standar persetujuan.';
        shop.banned_until = null;
        shop.deleted_at = new Date();
        await this.shopRepo.save(shop);

        await this.prodRepo.update({ shop: { id: shop.id } } as any, {
            is_active: false,
            stock: 0,
            approval_status: 'rejected',
            rejection_reason: shop.rejection_reason,
        });

        await this.userService.update(shop.user.id, { role: userRoles.USER });
        await this.notificationService.createInAppNotification({
            userId: shop.user.id,
            title: 'Toko ditolak admin',
            message: `Toko "${shop.name}" ditolak oleh admin. ${shop.rejection_reason}`,
            type: 'shop_approval',
            severity: 'danger',
            targetUrl: '/toko/create',
        });

        return {
            message: `Toko "${shop.name}" ditolak oleh admin.`,
            shop,
        };
    }

    async adminDeleteShop(shopId: number) {
        const shop = await this.shopRepo.findOne({
            where: { id: shopId },
            relations: { user: true, product: true },
        });

        if (!shop) {
            throw new NotFoundException(`Toko dengan ID ${shopId} tidak ditemukan.`);
        }

        shop.is_active = false;
        shop.approval_status = 'rejected';
        shop.rejection_reason = 'Dihapus oleh admin';
        shop.banned_until = null;
        shop.deleted_at = new Date();
        await this.shopRepo.save(shop);

        if (shop.product?.length) {
            await this.prodRepo.save(
                shop.product.map((product) => ({
                    ...product,
                    stock: 0,
                    is_active: false,
                    approval_status: 'rejected',
                    rejection_reason: 'Dihapus oleh admin',
                })),
            );
        }

        await this.userService.update(shop.user.id, { role: userRoles.USER, farmer_group_id: null, group_status: 'none' as any });
        await this.notificationService.createInAppNotification({
            userId: shop.user.id,
            title: 'Toko dibubarkan admin',
            message: `Toko "${shop.name}" dibubarkan oleh admin dan semua produk publikasi dihapus dari katalog.`,
            type: 'shop_approval',
            severity: 'danger',
            targetUrl: '/toko',
        });

        return {
            message: `Toko "${shop.name}" berhasil dibubarkan.`,
            shop_id: shop.id,
        };
    }
}