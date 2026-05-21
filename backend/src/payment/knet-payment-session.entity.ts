import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class KnetPaymentSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  invoice_id: number;

  @Column()
  customer_id: number;

  @Column({ type: 'integer', nullable: true })
  created_by: number | null;

  @Column('decimal', { precision: 10, scale: 3 })
  amount: number;

  @Column({ default: 'knet' })
  payment_method: 'knet' | 'card';

  @Column({ type: 'varchar', nullable: true })
  gateway_invoice_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  payment_id: string | null;

  @Column({ type: 'text' })
  payment_url: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'paid' | 'failed' | 'verified';

  @Column({ type: 'varchar', nullable: true })
  error_message: string | null;

  @Column()
  created_at: string;

  @Column()
  updated_at: string;
}
