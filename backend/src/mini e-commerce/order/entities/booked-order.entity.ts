import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Product } from 'src/mini e-commerce/product/entities/product.entity';
import { ShippingMethod } from '../enum/shipping-method.enum';
import { bookedOrderStatus } from '../enum/booked-order-status.enum';

@Entity('booked_orders')
export class BookedOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'product_id' })
  productId!: number;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId!: number | null;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column()
  quantity!: number;

  @Column({ name: 'total_price' })
  totalPrice!: number;

  @Column({ name: 'deposit_amount', type: 'int', default: 0 })
  depositAmount!: number;

  @Column({ name: 'remaining_amount', type: 'int', default: 0 })
  remainingAmount!: number;

  @Column({ name: 'deposit_status', type: 'varchar', length: 20, default: 'unpaid' })
  depositStatus!: 'unpaid' | 'pending' | 'paid' | 'failed' | 'expired';

  @Column({ name: 'deposit_midtrans_order_id', type: 'varchar', length: 60, nullable: true, unique: true })
  depositMidtransOrderId!: string | null;

  @Column({ name: 'deposit_midtrans_transaction_id', type: 'varchar', length: 100, nullable: true, unique: true })
  depositMidtransTransactionId!: string | null;

  @Column({ name: 'deposit_payment_url', type: 'text', nullable: true })
  depositPaymentUrl!: string | null;

  @Column({ name: 'deposit_expires_at', type: 'timestamp', nullable: true })
  depositExpiresAt!: Date | null;

  @Column({ name: 'balance_payment_url', type: 'text', nullable: true })
  balancePaymentUrl!: string | null;

  @Column({ length: 150 })
  recipientName!: string;

  @Column({ length: 50 })
  recipientPhoneNumber!: string;

  @Column('text')
  recipientAddress!: string;

  @Column({ type: 'enum', enum: ShippingMethod })
  shippingMethod!: ShippingMethod;

  @Column({ type: 'enum', enum: bookedOrderStatus, default: bookedOrderStatus.BOOKED })
  status!: bookedOrderStatus;

  @Column({ type: 'timestamp', nullable: true })
  estimatedHarvestDate!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  harvestedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'last_reminder_code', type: 'varchar', length: 12, nullable: true })
  lastReminderCode!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
