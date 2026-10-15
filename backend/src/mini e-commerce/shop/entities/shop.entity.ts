import { Product } from "src/mini e-commerce/product/entities/product.entity";
import { User } from "src/user/entities/user.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Shop {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({
        type: "varchar",
        length: 40
    })
    name!: string

    @Column({ name: 'profile_image_url', type: 'text', nullable: true })
    profile_image_url!: string | null;

    @Column({
        type: "varchar",
        length: 500
    })
    description!: string

    @Column({
        type: "varchar",
        length: 350
    })
    location!: string

    @Column({ type: 'varchar', length: 20 })
    phone_number!: string;

    @Column({ type: 'boolean', default: true })
    is_active!: boolean;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    approval_status!: 'pending' | 'approved' | 'rejected';

    @Column({ type: 'text', nullable: true })
    rejection_reason!: string | null;

    @Column({ type: 'text', nullable: true })
    warning_reason!: string | null;

    @Column({ name: 'warning_evidence_urls', type: 'text', array: true, default: '{}' })
    warning_evidence_urls!: string[];

    @Column({ type: 'timestamp', nullable: true })
    warning_at!: Date | null;

    @Column({ type: 'text', nullable: true })
    ban_reason!: string | null;

    @Column({ name: 'ban_evidence_urls', type: 'text', array: true, default: '{}' })
    ban_evidence_urls!: string[];

    @Column({ type: 'timestamp', nullable: true })
    banned_until!: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    deleted_at!: Date | null;

    @CreateDateColumn({ type: 'timestamp' })
    created_at!: Date;

    @OneToMany(() => Product, (product) => product.shop)
    product!: Product[]

    @OneToOne(() => User, (user) => user.shop, {
        nullable: false
    })
    @JoinColumn({name: 'user_id'})
    user!: User

}