import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { FarmerGroup } from './farmer-groups.entity';
import { User } from 'src/user/entities/user.entity';

export type FarmerGroupApplicationStatus = 'pending' | 'approved' | 'rejected';

@Entity('farmer_group_applications')
@Unique(['userId', 'groupId'])
export class FarmerGroupApplication {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'group_id' })
  groupId!: number;

  @ManyToOne(() => FarmerGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: FarmerGroup;

  @Column({ length: 12, default: 'pending' })
  status!: FarmerGroupApplicationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
