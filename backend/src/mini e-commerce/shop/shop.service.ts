import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { userRoles } from 'src/user/enum/user-roles.enum';
import { UserService } from 'src/user/user.service';
import { Product } from '../product/entities/product.entity';
import { Repository } from 'typeorm';
import { CreateShopDto } from './dtos/create-shop.dto';
import { Shop } from './entities/shop.entity';
import { OrderItems } from '../order_items/entities/order_items.entity';
import { orderStatus } from '../order/enum/order-status.enum';

Injectable()
export class ShopService {
    constructor(
        @InjectRepository(Shop) private shopRepo: Repository<Shop>,
        @InjectRepository(Product) private prodRepo: Repository<Product>,
        @InjectRepository(OrderItems) private orderItemsRepo: Repository<OrderItems>,
        private userService: UserService
){}

    async createShop(request: CreateShopDto, userId: number){
        const user = await this.userService.findOneIdWithShop(userId)

        if(!user) throw new UnauthorizedException()

        if(user.shop) throw new ConflictException("you already have shop")

        const shop = this.shopRepo.create({
            ...request,
            user: {id: user.id}
        })

        const savedShop = await this.shopRepo.save(shop)

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
        const user = await this.userService.findOneIdWithShop(userId);
        if (!user) throw new UnauthorizedException();
        return user.shop || null;
    }

    async getMyShopProducts(userId: number) {
        const user = await this.userService.findOneIdWithShop(userId);
        if (!user) throw new UnauthorizedException();
        if (!user.shop) throw new NotFoundException('User belum memiliki toko');

        const shopId = (user.shop as any).id || user.shop;
        return await this.prodRepo.find({
            where: { shop: { id: shopId }, is_active: true },
            relations: { farmland: { commodity: true } },
            order: { id: 'DESC' },
        });
    }

    async getPublicShop(shopId: number) {
        const shop = await this.shopRepo.findOne({ where: { id: shopId } });
        if (!shop) throw new NotFoundException('Toko tidak ditemukan');

        const products = await this.prodRepo.find({
            where: { shop: { id: shopId }, is_active: true },
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
            .groupBy('product.id')
            .getRawMany();

        const statsByProduct = new Map(
            productStats.map((stat) => [Number(stat.product_id), {
                sold_quantity: Number(stat.sold_quantity),
                completed_orders: Number(stat.completed_orders),
            }]),
        );

        const productsWithStats = products
            .map((product) => ({
                ...product,
                sold_quantity: statsByProduct.get(product.id)?.sold_quantity || 0,
                completed_orders: statsByProduct.get(product.id)?.completed_orders || 0,
                booked_percentage: product.is_pre_order && product.po_quota_kg > 0
                    ? Math.min(100, Math.round((product.po_booked_kg / product.po_quota_kg) * 100))
                    : null,
            }))
            .sort((left, right) => {
                const leftScore = left.is_pre_order ? (left.booked_percentage || 0) : left.sold_quantity;
                const rightScore = right.is_pre_order ? (right.booked_percentage || 0) : right.sold_quantity;
                return rightScore - leftScore;
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
}