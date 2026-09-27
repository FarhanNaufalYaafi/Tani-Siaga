import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CartService {
    constructor(@InjectRepository(Cart) private cartRepo: Repository<Cart>){}

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
            return await this.createCart(userId);
        }

        return cart
    }
}

