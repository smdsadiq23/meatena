import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class InvoiceProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  invoice_title: string;

  @Column({ type: 'varchar', nullable: true })
  invoice_title_ar: string | null;

  @Column({ type: 'varchar' })
  company_name: string;

  @Column({ type: 'varchar', nullable: true })
  company_name_ar: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_activity: string | null;

  @Column({ type: 'varchar', nullable: true })
  company_activity_ar: string | null;

  @Column({ type: 'varchar' })
  company_address: string;

  @Column({ type: 'varchar' })
  company_phone: string;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'varchar' })
  created_at: string;

  @Column({ type: 'varchar' })
  updated_at: string;
}
