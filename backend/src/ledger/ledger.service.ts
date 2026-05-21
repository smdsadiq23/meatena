import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Customer } from '../customer/customer.entity';
import { Ledger } from './ledger.entity';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(Ledger)
    private repo: Repository<Ledger>,

    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  private getRepository(manager?: EntityManager) {
    return manager ? manager.getRepository(Ledger) : this.repo;
  }

  addEntry(data: Partial<Ledger>, manager?: EntityManager) {
    return this.getRepository(manager).save(data);
  }

  async getBalance(customer_id: number, manager?: EntityManager) {
    const entries = await this.getRepository(manager).find({
      where: { customer_id },
    });

    let balance = 0;

    for (const entry of entries) {
      balance = roundMoney(balance + Number(entry.amount));
    }

    return balance;
  }

  async getStatement(customer_id: number) {
    const entries = await this.repo.find({
      where: { customer_id },
      order: { date: 'ASC', id: 'ASC' },
    });

    let running_balance = 0;

    const statement = entries.map((entry) => {
      running_balance = roundMoney(running_balance + Number(entry.amount));

      return {
        date: entry.date,
        type: entry.type,
        amount: Number(entry.amount),
        balance: running_balance,
      };
    });

    return statement;
  }

  async getStatementPdfData(customer_id: number) {
    const customer = await this.customerRepo.findOne({
      where: { id: customer_id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      customer,
      rows: await this.getStatement(customer_id),
    };
  }
}
