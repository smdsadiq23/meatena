import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  name_ar: string | null;

  @Column({ type: 'varchar', nullable: true, unique: true })
  sku: string | null;

  @Column('decimal', { precision: 10, scale: 3 })
  price_per_kg: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  stock_kg: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  low_stock_kg: number;
}
