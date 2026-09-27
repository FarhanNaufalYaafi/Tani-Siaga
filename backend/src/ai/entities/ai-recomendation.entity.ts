import { Farmland } from 'src/farmlands/entities/farmlands.entity';
import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('ai_recommendations')
export class AiRecommendation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'farmland_id' })
  farmlandId!: number;

  @ManyToOne(() => Farmland, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farmland_id' })
  farmland!: Farmland;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  summary!: string;

  @Column({ type: 'text' })
  detailed_advice!: string;

  @Column({ type: 'json' })
  step_by_step_steps!: string[];

  @Column({ type: 'varchar', length: 50 })
  action_type!: string;

  @Column({ type: 'json', nullable: true })
  weather_snapshot!: any; 

  @Column({ type: 'boolean', default: false })
  is_read!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}