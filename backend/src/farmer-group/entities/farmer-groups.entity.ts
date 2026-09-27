import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';                                          
import { Farmland } from 'src/farmlands/entities/farmlands.entity';

@Entity('farmer_groups')
export class FarmerGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  poktan_id!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => User, (user) => user.farmer_group)
  members!: User[];

  @OneToMany(() => User, (user) => user.pending_farmer_group)
  pending_members!: User[];

  @OneToMany(() => Farmland, (farmland) => farmland.farmerGroup)
  farmlands!: Farmland[];
}