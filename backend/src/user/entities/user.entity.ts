import { Column, Entity, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToOne } from "typeorm";
import { userRoles } from "../enum/user-roles.enum";
import { providers } from "../enum/provider.enum";
import { GroupStatus } from "../enum/group-status.enum";
import { FarmerGroup } from "src/farmer-group/entities/farmer-groups.entity";
import { Farmland } from "src/farmlands/entities/farmlands.entity";
import { Order } from "src/mini e-commerce/order/entities/order.entity";
import { Cart } from "src/mini e-commerce/cart/entities/cart.entity";
import { Shop } from "src/mini e-commerce/shop/entities/shop.entity";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: "varchar", length: 100, unique: true })
  email!: string

  @Column({ type: "varchar", length: 200, nullable: true })
  password!: string | null

  @Column({ type: "enum", enum: userRoles, default: userRoles.USER })
  role!: userRoles

  @Column({ type: "text", nullable: true })
  hashedRefreshToken!: string | null

  @Column({ type: "enum", enum: providers, default: providers.LOCAL })
  provider!: providers

  @Column({ name: 'email_verified', type: 'boolean', default: true })
  emailVerified!: boolean;

  @Column({ name: 'verification_code_hash', type: 'text', nullable: true })
  verificationCodeHash!: string | null;

  @Column({ name: 'verification_code_purpose', type: 'varchar', length: 32, nullable: true })
  verificationCodePurpose!: string | null;

  @Column({ name: 'verification_code_expires_at', type: 'timestamp', nullable: true })
  verificationCodeExpiresAt!: Date | null;

  @Column({ name: 'verification_code_sent_at', type: 'timestamp', nullable: true })
  verificationCodeSentAt!: Date | null;

  @Column({ name: 'verification_code_attempts', type: 'int', default: 0 })
  verificationCodeAttempts!: number;

  @Column({
  type: 'enum',
  enum: GroupStatus,
  default: GroupStatus.NONE,
})
  group_status!: GroupStatus;

  @Column({ nullable: true })
    farmer_group_id: number | null | undefined;

  @ManyToOne(() => FarmerGroup, (group) => group.members, {
    onDelete: 'SET NULL',
  })
  
  @JoinColumn({ name: 'farmer_group_id' })
  farmer_group: FarmerGroup | undefined | null;

  @Column({ nullable: true })
  pending_farmer_group_id: number | undefined | null;

  @ManyToOne(() => FarmerGroup, (group) => group.pending_members, {
    onDelete: 'SET NULL',
  })

  @JoinColumn({ name: 'pending_farmer_group_id' })
  pending_farmer_group: FarmerGroup | undefined;

  @OneToMany(() => Farmland, (farmland) => farmland.user)
  farmlands!: Farmland[];

  @OneToOne(() => Shop, (shop) => shop.user)
  shop!: Shop

  @OneToOne(() => Cart, (cart) => cart.user)
  cart!: Cart

  @OneToMany(() => Order, (order) => order.user)
  order!: Order

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}