import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('commodities')
export class Commodity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  variety!: string;

  @Column({ name: 'avg_harvest_days', type: 'int' })
  avg_harvest_days!: number;

  @Column({ name: 'max_humidity_percentage', type: 'float' })
  max_humidity_percentage!: number;

  @Column({ name: 'max_temp_celsius', type: 'float' })
  max_temp_celsius!: number;

  @Column({ name: 'min_temp_celsius', type: 'float' })
  min_temp_celsius!: number;

  @OneToMany(() => Farmland, (farmland) => farmland.commodity)
  farmlands!: Farmland[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}