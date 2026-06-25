import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Shipment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  reference_no: string | null;

  @Column({ type: 'varchar', nullable: true })
  arrival_date: string | null;

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'closed';

  @Column()
  created_at: string;
}
