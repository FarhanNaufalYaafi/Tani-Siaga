import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Cart } from 'src/mini e-commerce/cart/entities/cart.entity';
import { Order } from 'src/mini e-commerce/order/entities/order.entity';
import { Shop } from 'src/mini e-commerce/shop/entities/shop.entity';

@Entity('user_device_tokens')
export class UserDeviceToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text', unique: true })
  fcmToken!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceType!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}