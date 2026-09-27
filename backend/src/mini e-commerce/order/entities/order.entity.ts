import { Column, CreateDateColumn, Entity, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { timestamp } from "rxjs";
import { User } from "src/user/entities/user.entity";
import { orderStatus } from "../enum/order-status.enum";
import { OrderItems } from "src/mini e-commerce/order_items/entities/order_items.entity";
import { ShippingMethod } from "../enum/shipping-method.enum";


@Entity()
export class Order {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({
        unique: true
    })
    midtransOrderId!: string

    @Column({
        nullable: true,
        unique: true
    })
    midtransTransactionId?: string;

    @Column({
        type: "enum",
        enum: orderStatus,
        default: orderStatus.PENDING
    })
    status!: orderStatus

    @Column({ nullable: true, type: 'varchar', length: 50 })
    last_midtrans_webhook_status?: string | null;

    @Column({ nullable: true, type: 'simple-json' })
    last_midtrans_webhook_payload?: any;

    @Column({
        type: 'enum',
        enum: ShippingMethod,
        default: ShippingMethod.PICKUP,
    })
    shipping_method!: ShippingMethod;

    @Column()
    recipient_name!: string;

    @Column()
    recipient_phone_number!: string;

    @Column('text')
    recipient_address!: string;

    @Column({ nullable: true })
    snap_redirect_url?: string;

    @Column()
    total_price!: number

    @Column({ default: false })
    buyer_confirmed!: boolean

    @Column({ default: false })
    seller_confirmed!: boolean

    @CreateDateColumn({
        type: 'timestamp'
    })
    created_At!: Date

    @ManyToOne(() => User, (user) => user.order)
    user!: User

    @OneToMany(() => OrderItems, (orderItems) => orderItems.order)
    orderItems!: OrderItems[] 

}