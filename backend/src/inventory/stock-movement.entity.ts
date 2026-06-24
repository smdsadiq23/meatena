import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class StockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  product_id: number;

  @Column()
  type: 'purchase' | 'sale' | 'wastage' | 'adjustment';

  @Column('decimal', { precision: 12, scale: 3 })
  quantity_kg: number;

  @Column('decimal', { precision: 12, scale: 3 })
  balance_after_kg: number;

  @Column({ nullable: true })
  reference_type: string;

  @Column({ nullable: true })
  reference_id: number;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column()
  date: string;
}
