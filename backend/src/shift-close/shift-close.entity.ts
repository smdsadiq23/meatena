import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index('IDX_shift_close_user_date_unique', ['user_id', 'date'], {
  unique: true,
})
export class ShiftClose {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  username: string;

  @Column()
  role: string;

  @Column()
  date: string;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  system_cash: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  system_knet: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  system_total: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  counted_cash: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  counted_knet: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  counted_total: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  variance_cash: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  variance_knet: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  variance_total: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: 'submitted' })
  status: 'submitted' | 'reviewed';

  @Column({ type: 'integer', nullable: true })
  reviewed_by: number | null;

  @Column({ type: 'varchar', nullable: true })
  reviewed_at: string | null;

  @Column({ type: 'text', nullable: true })
  review_notes: string | null;

  @Column()
  created_at: string;

  @Column()
  updated_at: string;
}
