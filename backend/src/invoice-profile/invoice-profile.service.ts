import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SaveInvoiceProfileDto } from './dto/save-invoice-profile.dto';
import { InvoiceProfile } from './invoice-profile.entity';

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class InvoiceProfileService implements OnModuleInit {
  constructor(
    @InjectRepository(InvoiceProfile)
    private profileRepo: Repository<InvoiceProfile>,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS invoice_profile (
        id SERIAL PRIMARY KEY,
        name varchar NOT NULL,
        invoice_title varchar NOT NULL,
        invoice_title_ar varchar NULL,
        company_name varchar NOT NULL,
        company_name_ar varchar NULL,
        company_activity varchar NULL,
        company_activity_ar varchar NULL,
        company_address varchar NOT NULL,
        company_phone varchar NOT NULL,
        is_default boolean NOT NULL DEFAULT false,
        created_at varchar NOT NULL,
        updated_at varchar NOT NULL
      )
    `);

    const count = await this.profileRepo.count();
    if (count === 0) {
      await this.create({
        name: 'Default',
        invoice_title: 'Credit Invoice',
        company_name: 'Meatena Butchery Operations',
        company_address: 'Kuwait',
        company_phone: '00000000',
        is_default: true,
      });
    }
  }

  findAll() {
    return this.profileRepo.find({ order: { is_default: 'DESC', name: 'ASC' } });
  }

  async getDefault() {
    const profile = await this.profileRepo.findOne({ where: { is_default: true } });
    if (profile) {
      return profile;
    }

    const firstProfile = await this.profileRepo.findOne({ order: { id: 'ASC' } });
    if (!firstProfile) {
      throw new NotFoundException('No invoice profile found.');
    }

    return this.setDefault(firstProfile.id);
  }

  async create(data: SaveInvoiceProfileDto) {
    const now = new Date().toISOString();
    const shouldDefault = data.is_default ?? (await this.profileRepo.count()) === 0;

    if (shouldDefault) {
      await this.clearDefault();
    }

    const profile = this.profileRepo.create({
      name: data.name.trim(),
      invoice_title: data.invoice_title.trim(),
      invoice_title_ar: clean(data.invoice_title_ar),
      company_name: data.company_name.trim(),
      company_name_ar: clean(data.company_name_ar),
      company_activity: clean(data.company_activity),
      company_activity_ar: clean(data.company_activity_ar),
      company_address: data.company_address.trim(),
      company_phone: data.company_phone.trim(),
      is_default: shouldDefault,
      created_at: now,
      updated_at: now,
    });

    return this.profileRepo.save(profile);
  }

  async update(id: number, data: SaveInvoiceProfileDto) {
    const profile = await this.profileRepo.findOne({ where: { id } });
    if (!profile) {
      throw new NotFoundException('Invoice profile not found.');
    }

    if (data.is_default) {
      await this.clearDefault();
    }

    Object.assign(profile, {
      name: data.name.trim(),
      invoice_title: data.invoice_title.trim(),
      invoice_title_ar: clean(data.invoice_title_ar),
      company_name: data.company_name.trim(),
      company_name_ar: clean(data.company_name_ar),
      company_activity: clean(data.company_activity),
      company_activity_ar: clean(data.company_activity_ar),
      company_address: data.company_address.trim(),
      company_phone: data.company_phone.trim(),
      is_default: data.is_default ?? profile.is_default,
      updated_at: new Date().toISOString(),
    });

    return this.profileRepo.save(profile);
  }

  async setDefault(id: number) {
    const profile = await this.profileRepo.findOne({ where: { id } });
    if (!profile) {
      throw new NotFoundException('Invoice profile not found.');
    }

    await this.clearDefault();
    profile.is_default = true;
    profile.updated_at = new Date().toISOString();
    return this.profileRepo.save(profile);
  }

  async remove(id: number) {
    const profile = await this.profileRepo.findOne({ where: { id } });
    if (!profile) {
      throw new NotFoundException('Invoice profile not found.');
    }

    const count = await this.profileRepo.count();
    if (count <= 1) {
      throw new BadRequestException('At least one invoice profile is required.');
    }

    const wasDefault = profile.is_default;
    await this.profileRepo.delete(id);

    if (wasDefault) {
      const next = await this.profileRepo.findOne({ order: { id: 'ASC' } });
      if (next) {
        await this.setDefault(next.id);
      }
    }

    return { deleted: true };
  }

  private clearDefault() {
    return this.profileRepo
      .createQueryBuilder()
      .update(InvoiceProfile)
      .set({ is_default: false })
      .execute();
  }
}
