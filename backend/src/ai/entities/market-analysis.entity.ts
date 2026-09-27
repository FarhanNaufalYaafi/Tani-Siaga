import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('market_analyses')
export class MarketAnalysis {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 2 })
  province_code!: string;                                    

  @Column()
  commodity_name!: string;

  @Column('float')
  surplus_percentage!: number;                                                              

  @Column({ type: 'varchar', length: 20 })
  price_trend!: 'NAIK' | 'TURUN' | 'STABIL';

  @Column('text')
  analysis_summary!: string;

  @Column('json', { nullable: true })
  prediction_meta!: any;                              

  @CreateDateColumn()
  created_at!: Date;
}