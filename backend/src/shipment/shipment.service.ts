import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Expense } from '../expense/expense.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Purchase } from '../purchase/purchase.entity';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { Shipment } from './shipment.entity';

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class ShipmentService implements OnModuleInit {
  constructor(
    @InjectRepository(Shipment)
    private readonly repo: Repository<Shipment>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS shipment (
        id SERIAL PRIMARY KEY,
        name varchar NOT NULL,
        reference_no varchar NULL,
        arrival_date varchar NULL,
        status varchar NOT NULL DEFAULT 'open',
        created_at varchar NOT NULL
      )
    `);
    await this.dataSource.query(`
      ALTER TABLE purchase
      ADD COLUMN IF NOT EXISTS shipment_id integer NULL
    `);
    await this.dataSource.query(`
      ALTER TABLE invoice
      ADD COLUMN IF NOT EXISTS shipment_id integer NULL
    `);
    await this.dataSource.query(`
      ALTER TABLE expense
      ADD COLUMN IF NOT EXISTS shipment_id integer NULL
    `);
  }

  async create(data: CreateShipmentDto) {
    const shipment = this.repo.create({
      name: data.name.trim(),
      reference_no: clean(data.reference_no),
      arrival_date: clean(data.arrival_date),
      status: data.status ?? 'open',
      created_at: new Date().toISOString(),
    });
    return this.repo.save(shipment);
  }

  findAll() {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  async update(id: number, data: UpdateShipmentDto) {
    const shipment = await this.getById(id);

    if (data.name !== undefined) {
      shipment.name = data.name.trim();
    }
    if (data.reference_no !== undefined) {
      shipment.reference_no = clean(data.reference_no);
    }
    if (data.arrival_date !== undefined) {
      shipment.arrival_date = clean(data.arrival_date);
    }
    if (data.status !== undefined) {
      shipment.status = data.status;
    }

    return this.repo.save(shipment);
  }

  async getById(id: number) {
    const shipment = await this.repo.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    return shipment;
  }

  async delete(id: number) {
    const shipment = await this.getById(id);
    const [purchaseCount, invoiceCount, expenseCount] =
      await Promise.all([
        this.dataSource
          .getRepository(Purchase)
          .createQueryBuilder('p')
          .select('COUNT(*)', 'count')
          .where('p.shipment_id = :id', { id })
          .getRawOne<{ count: string }>(),
        this.dataSource
          .getRepository(Invoice)
          .createQueryBuilder('i')
          .select('COUNT(*)', 'count')
          .where('i.shipment_id = :id', { id })
          .getRawOne<{ count: string }>(),
        this.dataSource
          .getRepository(Expense)
          .createQueryBuilder('e')
          .select('COUNT(*)', 'count')
          .where('e.shipment_id = :id', { id })
          .getRawOne<{ count: string }>(),
      ]);

    if (
      Number(purchaseCount?.count ?? 0) ||
      Number(invoiceCount?.count ?? 0) ||
      Number(expenseCount?.count ?? 0)
    ) {
      throw new BadRequestException('Cannot delete a shipment with linked purchases, invoices, or expenses');
    }

    await this.repo.remove(shipment);
    return { message: 'Shipment deleted' };
  }

  async summary(id?: number) {
    const shipments = id ? [await this.getById(id)] : await this.findAll();
    const result: Array<
      Shipment & {
        purchase_amount: number;
        sales_amount: number;
        expenses_amount: number;
        profit: number;
        purchase_count: number;
        invoice_count: number;
        expense_count: number;
        purchases: Purchase[];
        invoices: Invoice[];
        expenses: Expense[];
      }
    > = [];

    for (const shipment of shipments) {
      const [purchaseRows, invoiceRows, expenseRows] = await Promise.all([
        this.dataSource
          .getRepository(Purchase)
          .createQueryBuilder('p')
          .where('p.shipment_id = :id', { id: shipment.id })
          .orderBy('p.date', 'DESC')
          .getMany(),
        this.dataSource
          .getRepository(Invoice)
          .createQueryBuilder('i')
          .where('i.shipment_id = :id', { id: shipment.id })
          .andWhere("i.status != 'void'")
          .orderBy('i.date', 'DESC')
          .getMany(),
        this.dataSource
          .getRepository(Expense)
          .createQueryBuilder('e')
          .where('e.shipment_id = :id', { id: shipment.id })
          .orderBy('e.date', 'DESC')
          .getMany(),
      ]);

      const purchaseAmount = roundMoney(
        purchaseRows.reduce((sum, purchase) => sum + Number(purchase.total ?? 0), 0),
      );
      const salesAmount = roundMoney(
        invoiceRows.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0),
      );
      const expensesAmount = roundMoney(
        expenseRows.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0),
      );
      const profit = roundMoney(salesAmount - purchaseAmount - expensesAmount);

      result.push({
        ...shipment,
        purchase_amount: purchaseAmount,
        sales_amount: salesAmount,
        expenses_amount: expensesAmount,
        profit,
        purchase_count: purchaseRows.length,
        invoice_count: invoiceRows.length,
        expense_count: expenseRows.length,
        purchases: purchaseRows,
        invoices: invoiceRows,
        expenses: expenseRows,
      });
    }

    return result;
  }
}
