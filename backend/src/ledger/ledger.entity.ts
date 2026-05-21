import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index(['type', 'reference_id'], { unique: true })
@Index(['customer_id', 'date'])
@Entity()
export class Ledger {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  customer_id: number;

  @Column()
  type: string;

  @Column('decimal', { precision: 10, scale: 3 })
  amount: number;

  @Column()
  reference_id: number;

  @Column()
  date: string;
}
