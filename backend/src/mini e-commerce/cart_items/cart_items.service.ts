import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CartItems } from './entities/cart_items.entity';
import { CartService } from '../cart/cart.service';
import { Repository } from 'typeorm';
import { ProductService } from '../product/product.service';

@Injectable()
export class CartItemsService {
    constructor(
        @InjectRepository(CartItems) private cartItemsRepo: Repository<CartItems>,
        private prodService: ProductService,
        private cartService: CartService
    ){}
    
    async create(cartId: number, quantity: number, productId: number) {
        const product = await this.prodService.findOneId(productId);

        if (!product) throw new NotFoundException(`product with id ${productId}, not found!!!`);
        if (!product.is_active) throw new NotFoundException(`product with id ${productId}, not found!!!`);

        if (!Number.isInteger(quantity) || quantity < 1) {
            throw new BadRequestException('Jumlah produk minimal 1 dan harus berupa bilangan bulat.');
        }

        const availableQuantity = product.is_pre_order
            ? Math.max(0, (product.po_quota_kg || 0) - (product.po_booked_kg || 0))
            : Math.max(0, (product.stock || 0) - (product.po_booked_kg || 0));

        const existingItem = await this.cartItemsRepo.findOne({
            where: { cart: { id: cartId }, product: { id: productId } },
        });
        const nextQuantity = quantity + (existingItem?.quantity || 0);

        if (nextQuantity > availableQuantity) {
            throw new BadRequestException(
                `Jumlah melebihi ketersediaan produk. Maksimal yang bisa ditambahkan: ${availableQuantity} kg.`,
            );
        }

        const totalPrice = nextQuantity * product.price;

        if (existingItem) {
            existingItem.quantity = nextQuantity;
            existingItem.total_price = totalPrice;
            return this.cartItemsRepo.save(existingItem);
        }
       
        const cartItems = this.cartItemsRepo.create({
            quantity,
            total_price: totalPrice,
            cart: { id: cartId },
            product: { id: product.id }
        });

        return await this.cartItemsRepo.save(cartItems);
    }

    async updateQuantity(cartItemsId: number, userId: number, quantity: number) {
        if (!Number.isInteger(quantity) || quantity < 1) {
            throw new BadRequestException('Jumlah produk minimal 1 dan harus berupa bilangan bulat.');
        }

        const cartId = await this.cartService.findCartIdByUserId(userId);
        const item = await this.cartItemsRepo.findOne({
            where: { id: cartItemsId, cart: { id: cartId } },
            relations: { product: true },
        });
        if (!item) throw new NotFoundException('Produk tidak ditemukan di keranjang.');
        if (!item.product.is_active) throw new NotFoundException('Produk ini sudah tidak tersedia.');

        const availableQuantity = item.product.is_pre_order
            ? Math.max(0, item.product.po_quota_kg - item.product.po_booked_kg)
            : Math.max(0, item.product.stock - item.product.po_booked_kg);
        if (quantity > availableQuantity) {
            throw new BadRequestException(`Jumlah melebihi ketersediaan. Maksimal ${availableQuantity}.`);
        }

        item.quantity = quantity;
        item.total_price = quantity * item.product.price;
        return this.cartItemsRepo.save(item);
    }

    async delete(cartItemsId: number, userId: number){
        const cartIdFromUserId = await this.cartService.findCartIdByUserId(userId)

        const check = await this.cartItemsRepo.findOne({
            where: {
                cart: {
                    id: cartIdFromUserId
                },
                id: cartItemsId
            }
        })

        if(!check) throw new BadRequestException()

        return await this.cartItemsRepo.delete(check.id)
    }

    async findOne(cartItemsId){
        return await this.cartItemsRepo.findOne({
            where: {
                id: cartItemsId
            },
            relations: {
                product: true
            }
        })
    }
}
