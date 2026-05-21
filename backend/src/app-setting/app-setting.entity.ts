import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'app_setting' })
export class AppSetting {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
