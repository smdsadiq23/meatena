import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { Customer } from './customer.entity';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Invoice } from '../invoice/invoice.entity';
import { Payment } from '../payment/payment.entity';
import { Ledger } from '../ledger/ledger.entity';
import { roundMoney } from '../common/utils/money';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,

    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,

    @InjectRepository(Ledger)
    private ledgerRepo: Repository<Ledger>,
  ) {}

  create(data: CreateCustomerDto) {
    const customer = this.customerRepo.create({
      ...data,
      credit_limit: roundMoney(data.credit_limit ?? 0),
    });
    return this.customerRepo.save(customer);
  }

  findAll() {
    return this.customerRepo.find();
  }

  async getCreditSummary() {
    const [customers, ledgerEntries] = await Promise.all([
      this.customerRepo.find({ order: { name: 'ASC' } }),
      this.ledgerRepo.find(),
    ]);

    const balanceByCustomer = new Map<number, number>();

    for (const entry of ledgerEntries) {
      balanceByCustomer.set(
        entry.customer_id,
        roundMoney(
          (balanceByCustomer.get(entry.customer_id) ?? 0) +
            Number(entry.amount),
        ),
      );
    }

    let totalOutstanding = 0;
    let overLimitCount = 0;
    let nearLimitCount = 0;
    let dueCustomerCount = 0;

    const customersWithCredit = customers.map((customer) => {
      const balance = roundMoney(balanceByCustomer.get(customer.id) ?? 0);
      const creditLimit = roundMoney(Number(customer.credit_limit ?? 0));
      const hasLimit = creditLimit > 0;
      const remainingCredit = hasLimit
        ? roundMoney(Math.max(creditLimit - balance, 0))
        : null;
      const creditUsedPercent =
        hasLimit && balance > 0
          ? roundMoney(Math.min((balance / creditLimit) * 100, 999.999))
          : 0;
      const status =
        balance <= 0
          ? 'clear'
          : hasLimit && balance > creditLimit
            ? 'over_limit'
            : hasLimit && creditUsedPercent >= 80
              ? 'near_limit'
              : 'due';

      if (balance > 0) {
        dueCustomerCount += 1;
        totalOutstanding = roundMoney(totalOutstanding + balance);
      }

      if (status === 'over_limit') {
        overLimitCount += 1;
      }

      if (status === 'near_limit') {
        nearLimitCount += 1;
      }

      return {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        address: customer.address,
        balance,
        credit_limit: creditLimit,
        remaining_credit: remainingCredit,
        credit_used_percent: creditUsedPercent,
        status,
      };
    });

    const priority = {
      over_limit: 0,
      near_limit: 1,
      due: 2,
      clear: 3,
    };

    customersWithCredit.sort((a, b) => {
      const priorityDiff = priority[a.status] - priority[b.status];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return b.balance - a.balance;
    });

    return {
      totals: {
        customerCount: customers.length,
        dueCustomerCount,
        totalOutstanding,
        overLimitCount,
        nearLimitCount,
      },
      customers: customersWithCredit,
    };
  }

  async getCollectionFollowups() {
    const [customers, ledgerEntries, invoices, payments] = await Promise.all([
      this.customerRepo.find({ order: { name: 'ASC' } }),
      this.ledgerRepo.find(),
      this.invoiceRepo.find(),
      this.paymentRepo.find(),
    ]);

    const balanceByCustomer = new Map<number, number>();
    const lastInvoiceByCustomer = new Map<number, string>();
    const lastPaymentByCustomer = new Map<number, string>();

    for (const entry of ledgerEntries) {
      balanceByCustomer.set(
        entry.customer_id,
        roundMoney(
          (balanceByCustomer.get(entry.customer_id) ?? 0) +
            Number(entry.amount),
        ),
      );
    }

    for (const invoice of invoices) {
      if (invoice.status === 'void') {
        continue;
      }

      const current = lastInvoiceByCustomer.get(invoice.customer_id);

      if (!current || invoice.date > current) {
        lastInvoiceByCustomer.set(invoice.customer_id, invoice.date);
      }
    }

    for (const payment of payments) {
      if (payment.status === 'reversed') {
        continue;
      }

      const current = lastPaymentByCustomer.get(payment.customer_id);

      if (!current || payment.date > current) {
        lastPaymentByCustomer.set(payment.customer_id, payment.date);
      }
    }

    const followups = customers
      .map((customer) => {
        const balance = roundMoney(balanceByCustomer.get(customer.id) ?? 0);
        const creditLimit = roundMoney(Number(customer.credit_limit ?? 0));
        const hasLimit = creditLimit > 0;
        const creditUsedPercent =
          hasLimit && balance > 0
            ? roundMoney(Math.min((balance / creditLimit) * 100, 999.999))
            : 0;
        const lastInvoiceDate = lastInvoiceByCustomer.get(customer.id) ?? null;
        const lastPaymentDate = lastPaymentByCustomer.get(customer.id) ?? null;
        const lastActivityDate = [lastInvoiceDate, lastPaymentDate]
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1);
        const daysSinceActivity = lastActivityDate
          ? Math.max(
              Math.floor(
                (Date.now() - new Date(lastActivityDate).getTime()) / 86400000,
              ),
              0,
            )
          : null;
        const status =
          balance <= 0
            ? 'clear'
            : hasLimit && balance > creditLimit
              ? 'over_limit'
              : hasLimit && creditUsedPercent >= 80
                ? 'near_limit'
                : 'due';

        return {
          id: customer.id,
          name: customer.name,
          mobile: customer.mobile,
          address: customer.address,
          balance,
          credit_limit: creditLimit,
          credit_used_percent: creditUsedPercent,
          last_invoice_date: lastInvoiceDate,
          last_payment_date: lastPaymentDate,
          days_since_activity: daysSinceActivity,
          status,
        };
      })
      .filter((customer) => customer.balance > 0);

    const priority = {
      over_limit: 0,
      near_limit: 1,
      due: 2,
      clear: 3,
    };

    followups.sort((a, b) => {
      const priorityDiff = priority[a.status] - priority[b.status];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return b.balance - a.balance;
    });

    return {
      totals: {
        dueCustomerCount: followups.length,
        totalOutstanding: followups.reduce(
          (sum, customer) => roundMoney(sum + customer.balance),
          0,
        ),
      },
      customers: followups,
    };
  }

  async update(id: number, data: UpdateCustomerDto) {
    const customer = await this.customerRepo.findOne({ where: { id } });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    const updatedCustomer = this.customerRepo.merge(customer, {
      ...data,
      credit_limit:
        data.credit_limit === undefined
          ? customer.credit_limit
          : roundMoney(data.credit_limit),
    });
    return this.customerRepo.save(updatedCustomer);
  }

  async remove(id: number) {
    const customer = await this.customerRepo.findOne({ where: { id } });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    const [invoiceCount, paymentCount, ledgerCount] = await Promise.all([
      this.invoiceRepo.count({ where: { customer_id: id } }),
      this.paymentRepo.count({ where: { customer_id: id } }),
      this.ledgerRepo.count({ where: { customer_id: id } }),
    ]);

    if (invoiceCount > 0 || paymentCount > 0 || ledgerCount > 0) {
      throw new BadRequestException(
        'Cannot delete customer with existing transactions.',
      );
    }

    await this.customerRepo.delete(id);

    return { message: 'Customer deleted successfully.' };
  }
}
