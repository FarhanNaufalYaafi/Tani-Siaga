import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type NotificationSeverity = 'safe' | 'warning' | 'danger';

@Entity('in_app_notifications')
export class InAppNotification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ length: 160 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ length: 40 })
  type!: string;

  @Column({ length: 12, default: 'safe' })
  severity!: NotificationSeverity;

  @Column({ name: 'target_url', type: 'varchar', length: 500, nullable: true })
  targetUrl!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, string | number> | null;

  @Column({ name: 'is_read', default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
