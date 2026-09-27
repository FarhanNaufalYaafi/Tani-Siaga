import { Commodity } from 'src/commodities/entities/commodity.entity';
import { FarmerGroup } from 'src/farmer-group/entities/farmer-groups.entity';
import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('farmlands')
export class Farmland {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  area_size!: number;

  @Column({ type: 'text', nullable: true })
  address_detail!: string;

  @Column({ length: 13 })
  adm4_code!: string;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  latitude?: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  longitude?: number;

  @Column({ type: 'date', nullable: true })
  plant_date!: Date;

  @Column({ type: 'varchar', length: 100, nullable: false })
  plant_method!: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  expected_yield_user_kg!: number | null;                                            

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  ai_estimated_yield_kg!: number | null;                                              

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'harvested';

  @Column({ type: 'timestamp', nullable: true })
  harvested_at!: Date | null;

  @Column({ name: 'custom_avg_harvest_days', type: 'int', nullable: true })
  custom_avg_harvest_days!: number | null;

  @Column({ name: 'custom_max_humidity_percentage', type: 'float', nullable: true })
  custom_max_humidity_percentage!: number | null;

  @Column({ name: 'custom_max_temp_celsius', type: 'float', nullable: true })
  custom_max_temp_celsius!: number | null;

  @Column({ name: 'custom_min_temp_celsius', type: 'float', nullable: true })
  custom_min_temp_celsius!: number | null;

  @ManyToOne(() => Commodity, (commodity) => commodity.farmlands, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'commodity_id' })
  commodity!: Commodity;

  @Column({ nullable: true })
  commodity_id!: number;

  @ManyToOne(() => User, (user) => user.farmlands, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ nullable: true })
  user_id!: number;

  @ManyToOne(() => FarmerGroup, (group) => group.farmlands, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'farmer_group_id' })
  farmerGroup!: FarmerGroup;

  @Column({ nullable: true })
  farmer_group_id!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}