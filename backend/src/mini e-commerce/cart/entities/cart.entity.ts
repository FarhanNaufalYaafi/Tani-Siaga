import { Http2ServerRequest } from "http2";
import { CartItems } from "src/mini e-commerce/cart_items/entities/cart_items.entity";
import { User } from "src/user/entities/user.entity";
import { Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { UnorderedBulkOperation } from "typeorm/driver/mongodb/typings.js";

@Entity()
export class Cart {
    @PrimaryGeneratedColumn()
    id!: number

    @OneToOne(() => User, (user) => user.cart)
    @JoinColumn({name: 'user_id'})
    user!: User

    @OneToMany(() => CartItems, (cartItems) => cartItems.cart)
    cartItems!: CartItems[]
}