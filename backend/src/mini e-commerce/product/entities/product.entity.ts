import { CartItems } from "src/mini e-commerce/cart_items/entities/cart_items.entity";
import { OrderItems } from "src/mini e-commerce/order_items/entities/order_items.entity";
import { Shop } from "src/mini e-commerce/shop/entities/shop.entity";
import { Farmland } from "src/farmlands/entities/farmlands.entity";                   
import { 
  Column, 
  Entity, 
  JoinColumn, 
  ManyToOne, 
  OneToMany, 
  PrimaryGeneratedColumn 
} from "typeorm";

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: "varchar",
    length: 100,
  })
  name!: string;

  @Column()
  price!: number;

  @Column()
  stock!: number;

  @Column({ default: true })
  is_active!: boolean;

  @Column({
    type: "varchar",
    length: 1500,
  })
  description!: string;

  @Column("text", {
    nullable: false,
    array: true,
  })
  image_url!: string[];

                                                                              
                                                
                                                                              

  @Column({ default: false })
  is_pre_order!: boolean;                                                        

  @Column({ nullable: true })
  farmland_id?: number;                                   

  @ManyToOne(() => Farmland, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'farmland_id' })
  farmland?: Farmland;

  @Column({ type: 'timestamp', nullable: true })
  estimated_harvest_date?: Date;                                                       

  @Column({ type: 'int', default: 0 })
  po_quota_kg!: number;

  @Column({ type: 'int', default: 0 })
  po_booked_kg!: number;

                                                                              
                         
                                                                              

  @ManyToOne(() => Shop, (shop) => shop.product)
  shop!: Shop;

  @OneToMany(() => CartItems, (cartItems) => cartItems.product)
  cartItems!: CartItems[];

  @OneToMany(() => OrderItems, (orderItems) => orderItems.product)
  order_items!: OrderItems[];
}