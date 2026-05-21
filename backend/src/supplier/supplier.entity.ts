import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  mobile: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  balance: number;
}
