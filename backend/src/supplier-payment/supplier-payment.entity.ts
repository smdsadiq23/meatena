import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class SupplierPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  supplier_id: number;

  @Column('decimal', { precision: 12, scale: 3 })
  amount: number;

  @Column({ type: 'varchar', default: 'KWD' })
  transaction_currency: 'KWD' | 'USD';

  @Column('decimal', { precision: 12, scale: 6, default: 1 })
  exchange_rate: number;

  @Column({ default: 'cash' })
  mode: 'cash' | 'bank' | 'knet' | 'other';

  @Column({ type: 'varchar', nullable: true })
  reference_no: string | null;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column()
  date: string;
}
