import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Purchase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  supplier_id: number;

  @Column()
  date: string;

  @Column({ type: 'varchar', nullable: true })
  invoice_no: string | null;

  @Column({ type: 'varchar', default: 'KWD' })
  transaction_currency: 'KWD' | 'USD';

  @Column('decimal', { precision: 12, scale: 6, default: 3.25 })
  exchange_rate: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  total: number;

  @Column({ type: 'varchar', nullable: true })
  receipt_original_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  receipt_file_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  receipt_mime_type: string | null;

  @Column({ type: 'integer', nullable: true })
  receipt_size: number | null;

  @Column({ type: 'varchar', nullable: true })
  receipt_uploaded_at: string | null;
}
