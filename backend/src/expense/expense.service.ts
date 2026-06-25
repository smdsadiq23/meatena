import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Expense } from './expense.entity';

@Injectable()
export class ExpenseService implements OnModuleInit {
  constructor(
    @InjectRepository(Expense)
    private repo: Repository<Expense>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      ALTER TABLE expense
      ADD COLUMN IF NOT EXISTS shipment_id integer NULL
    `);
  }

  create(data: CreateExpenseDto) {
    const expense = this.repo.create({
      ...data,
      shipment_id: data.shipment_id ?? null,
      amount: roundMoney(data.amount),
      date: new Date().toISOString(),
    });
    return this.repo.save(expense);
  }

  async findAll(from?: string, to?: string) {
    const qb = this.repo.createQueryBuilder('e');

    if (from) {
      qb.andWhere('e.date >= :from', { from: `${from}T00:00:00.000Z` });
    }

    if (to) {
      qb.andWhere('e.date <= :to', { to: `${to}T23:59:59.999Z` });
    }

    return qb.orderBy('e.id', 'DESC').getMany();
  }
}
