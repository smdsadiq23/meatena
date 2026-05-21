import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index('IDX_payment_reference_unique', ['reference'], {
  unique: true,
  where: '"reference" IS NOT NULL',
})
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  customer_id: number;

  @Column({ type: 'integer', nullable: true })
  invoice_id: number | null;

  @Column('decimal', { precision: 10, scale: 3 })
  amount: number;

  @Column()
  mode: string;

  @Column({ nullable: true })
  reference: string;

  @Column()
  date: string;

  @Column({ type: 'integer', nullable: true })
  created_by: number | null;

  @Column({ default: 'active' })
  status: 'active' | 'reversed';

  @Column({ type: 'varchar', nullable: true })
  reversal_reason: string | null;

  @Column({ type: 'varchar', nullable: true })
  reversed_at: string | null;

  @Column({ type: 'integer', nullable: true })
  reversed_by: number | null;
}
