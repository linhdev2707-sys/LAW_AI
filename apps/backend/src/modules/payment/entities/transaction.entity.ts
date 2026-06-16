import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 50 })
  plan: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string; // 'pending' | 'completed' | 'failed'

  @Column({ name: 'payment_gateway', type: 'varchar', length: 50, default: 'casso' })
  paymentGateway: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100, nullable: true })
  transactionId: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
