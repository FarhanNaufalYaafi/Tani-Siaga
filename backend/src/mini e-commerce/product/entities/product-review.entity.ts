import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';
import { Product } from './product.entity';
import { Order } from '../../order/entities/order.entity';

@Entity('product_reviews')
@Unique(['orderId', 'productId'])
export class ProductReview {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'product_id' })
  productId!: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'order_id' })
  orderId!: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'text' })
  comment!: string;

  @Column({ name: 'image_urls', type: 'text', array: true, default: '{}' })
  imageUrls!: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
