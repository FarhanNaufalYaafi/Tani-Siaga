import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { CartItems } from '../cart_items/entities/cart_items.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CartService {
    constructor(
        @InjectRepository(Cart) private cartRepo: Repository<Cart>,
        @InjectRepository(CartItems) private cartItemsRepo: Repository<CartItems>,
    ){}

    async createCart(userId: number){
        const cart = this.cartRepo.create({
            user: {id: userId}
        })

        return await this.cartRepo.save(cart)
    }

    async findCartIdByUserId(userId: number){
        const cart = await this.cartRepo.findOne({
            where: {
                user: {id: userId}
            }
        })

        if(!cart) {
            const newCart = await this.createCart(userId);
            return newCart.id;
        }

        return cart.id
    }

    async getCartAndItems(userId: number){
        const cart = await this.cartRepo.findOne({
            where: {
                user: {id: userId}
            },
            relations: {
                cartItems: {
                    product: {
                        shop: true,
                    }
                }
            }
        })

        if(!cart) {
            return { ...(await this.createCart(userId)), cartItems: [] };
        }

        const availableItems: CartItems[] = [];
        for (const item of cart.cartItems || []) {
            const product = item.product;
            const availableQuantity = product.is_pre_order
                ? Math.max(0, product.po_quota_kg - product.po_booked_kg)
                : Math.max(0, product.stock - product.po_booked_kg);

            if (!product.is_active || product.approval_status !== 'approved' || availableQuantity < 1) {
                await this.cartItemsRepo.delete(item.id);
                continue;
            }

            if (item.quantity > availableQuantity) {
                item.quantity = availableQuantity;
                item.total_price = availableQuantity * Number(product.price);
                await this.cartItemsRepo.save(item);
            }
            availableItems.push(item);
        }
        cart.cartItems = availableItems;
        return cart
    }
}

