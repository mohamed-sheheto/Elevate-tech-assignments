import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
@Index(['status', 'createdAt'])
export class Outbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  aggregateType: string;

  @Column('uuid')
  aggregateId: string;

  @Column('jsonb')
  payload: Record<string, any>;

  @Column()
  cacheKey: string;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'PROCESSED' | 'FAILED';

  @Column({ default: 0 })
  retryCount: number;

  @Column('int')
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  processedAt: Date;
}
