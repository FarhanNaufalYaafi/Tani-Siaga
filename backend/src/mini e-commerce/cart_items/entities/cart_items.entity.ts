import { Cart } from "src/mini e-commerce/cart/entities/cart.entity";
import { Product } from "src/mini e-commerce/product/entities/product.entity";
import { Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class CartItems {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({
        nullable: false
    })
    quantity!: number

    @Column()
    total_price!: number

    @ManyToOne(() => Cart, (cart) => cart.cartItems)
    cart!: Cart
    
    @ManyToOne(() => Product, (product) => product.cartItems)
    product!: Product
}