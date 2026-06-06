import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class InvoiceItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  invoice_id: number;

  @Column({ type: 'int', nullable: true })
  product_id: number | null;

  @Column('decimal', { precision: 10, scale: 3 })
  weight: number;

  @Column({ type: 'int', nullable: true })
  pieces: number | null;

  @Column('decimal', { precision: 10, scale: 3 })
  price_per_kg: number;

  @Column('decimal', { precision: 10, scale: 3 })
  amount: number;
}
