import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtUser } from '../auth/jwt.strategy';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  record(params: {
    user?: JwtUser | null;
    action: string;
    entity: string;
    entity_id?: number | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.repo.save({
      user_id: params.user?.sub ?? null,
      username: params.user?.username ?? null,
      role: params.user?.role ?? null,
      action: params.action,
      entity: params.entity,
      entity_id: params.entity_id ?? null,
      metadata: params.metadata ?? {},
      date: new Date().toISOString(),
    });
  }

  findAll() {
    return this.repo.find({ order: { date: 'DESC', id: 'DESC' }, take: 250 });
  }
}
