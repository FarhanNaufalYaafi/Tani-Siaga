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