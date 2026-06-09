import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  customer_id: number;

  @Column()
  date: string;

  @Column()
  type: string;

  @Column({ type: 'varchar', default: 'KWD' })
  transaction_currency: 'KWD' | 'USD';

  @Column('decimal', { precision: 12, scale: 6, default: 3.25 })
  exchange_rate: number;

  @Column({ type: 'varchar', nullable: true, unique: true })
  invoice_number: string | null;

  @Column({ type: 'varchar', nullable: true })
  invoice_title: string | null;

  @Column({ type: 'varchar', nullable: true })
  invoice_title_ar: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_name_ar: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_activity: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_activity_ar: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_address: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_email: string | null;

  @Column({ type: 'varchar', nullable: true })
  contact_names: string | null;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  total: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  previous_balance: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  grand_total: number;

  @Column({ type: 'boolean', default: false })
  include_previous_balance: boolean;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'void';

  @Column({ type: 'varchar', nullable: true })
  void_reason: string | null;

  @Column({ type: 'varchar', nullable: true })
  voided_at: string | null;

  @Column({ type: 'integer', nullable: true })
  voided_by: number | null;

  @Column({ type: 'varchar', nullable: true })
  delivery_receipt_original_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  delivery_receipt_file_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  delivery_receipt_mime_type: string | null;

  @Column({ type: 'integer', nullable: true })
  delivery_receipt_size: number | null;

  @Column({ type: 'varchar', nullable: true })
  delivery_receipt_uploaded_at: string | null;
}
