import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Expense } from './expense.entity';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private repo: Repository<Expense>,
  ) {}

  create(data: CreateExpenseDto) {
    const expense = this.repo.create({
      ...data,
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
