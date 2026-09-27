import { Order } from "src/mini e-commerce/order/entities/order.entity";
import { Product } from "src/mini e-commerce/product/entities/product.entity";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class OrderItems {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    quantity!: number

    @Column()
    current_price!: number

    @ManyToOne(() => Product, (product) => product.order_items)
    product!: Product

    @ManyToOne(() => Order, (order) => order.orderItems)
    order!: Order

}