import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PurchaseItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  purchase_id: number;

  @Column()
  product_id: number;

  @Column('decimal', { precision: 12, scale: 3 })
  weight: number;

  @Column({ type: 'int', nullable: true })
  pieces: number | null;

  @Column('decimal', { precision: 12, scale: 3 })
  cost_per_kg: number;

  @Column('decimal', { precision: 12, scale: 3 })
  amount: number;
}
