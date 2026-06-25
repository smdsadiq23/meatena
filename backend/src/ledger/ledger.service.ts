import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Customer } from '../customer/customer.entity';
import { InvoiceItem } from '../invoice/invoice-item.entity';
import { Ledger } from './ledger.entity';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(Ledger)
    private repo: Repository<Ledger>,

    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,

    @InjectRepository(InvoiceItem)
    private invoiceItemRepo: Repository<InvoiceItem>,
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
        reference_id: entry.reference_id,
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

    const rows = await this.getStatement(customer_id);
    const invoiceIds = rows
      .filter((row) => ['invoice', 'invoice_void'].includes(row.type))
      .map((row) => Number(row.reference_id))
      .filter((referenceId) => Number.isFinite(referenceId) && referenceId > 0);
    const invoiceWeights = new Map<number, number>();

    if (invoiceIds.length > 0) {
      const items = await this.invoiceItemRepo
        .createQueryBuilder('item')
        .select('item.invoice_id', 'invoice_id')
        .addSelect('SUM(item.weight)', 'weight')
        .where('item.invoice_id IN (:...invoiceIds)', { invoiceIds })
        .groupBy('item.invoice_id')
        .getRawMany<{ invoice_id: number | string; weight: string }>();

      for (const item of items) {
        invoiceWeights.set(Number(item.invoice_id), roundMoney(Number(item.weight ?? 0)));
      }
    }

    return {
      customer,
      rows: rows.map((row) => ({
        ...row,
        weight: invoiceWeights.get(Number(row.reference_id)) ?? 0,
      })),
    };
  }
}
