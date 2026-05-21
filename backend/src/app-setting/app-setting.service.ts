import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from './app-setting.entity';

const CURRENCY_RATE_KEY = 'kwd_to_usd_rate';
const DEFAULT_KWD_TO_USD_RATE = Number(process.env.KWD_TO_USD_RATE ?? 3.25);

@Injectable()
export class AppSettingService implements OnModuleInit {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
  ) {}

  async onModuleInit() {
    await this.repo.query(`
      CREATE TABLE IF NOT EXISTS app_setting (
        key varchar PRIMARY KEY,
        value text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const existing = await this.repo.findOneBy({ key: CURRENCY_RATE_KEY });

    if (!existing) {
      await this.setCurrencyRate(DEFAULT_KWD_TO_USD_RATE);
    }
  }

  async getCurrencyRate() {
    const setting = await this.repo.findOneBy({ key: CURRENCY_RATE_KEY });
    const rate = Number(setting?.value ?? DEFAULT_KWD_TO_USD_RATE);

    return {
      kwd_to_usd_rate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_KWD_TO_USD_RATE,
      updated_at: setting?.updated_at ?? new Date(),
    };
  }

  async setCurrencyRate(rate: number) {
    const value = String(rate);
    const setting = this.repo.create({
      key: CURRENCY_RATE_KEY,
      value,
      updated_at: new Date(),
    });

    await this.repo.save(setting);
    return this.getCurrencyRate();
  }
}
