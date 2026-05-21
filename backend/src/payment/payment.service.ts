import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { roundMoney } from '../common/utils/money';
import { Customer } from '../customer/customer.entity';
import { Invoice } from '../invoice/invoice.entity';
import { LedgerService } from '../ledger/ledger.service';
import { CreateKnetPaymentDto } from './dto/create-knet-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { KnetPaymentSession } from './knet-payment-session.entity';
import { MyFatoorahService } from './myfatoorah.service';
import { Payment } from './payment.entity';

@Injectable()
export class PaymentService implements OnModuleInit {
  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,

    @InjectRepository(KnetPaymentSession)
    private knetSessionRepo: Repository<KnetPaymentSession>,

    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,

    private dataSource: DataSource,
    private ledgerService: LedgerService,
    private myFatoorahService: MyFatoorahService,
  ) {}

  async onModuleInit() {
    await this.dataSource.query(`
      ALTER TABLE knet_payment_session
      ADD COLUMN IF NOT EXISTS payment_method varchar NOT NULL DEFAULT 'knet'
    `);
  }

  async create(data: CreatePaymentDto, user?: { sub: number }) {
    return this.recordPayment(
      {
        customer_id: data.customer_id,
        invoice_id: data.invoice_id,
        amount: data.amount,
        mode: data.mode,
        reference: data.reference,
        created_by: user?.sub ?? null,
      },
      { requireInvoiceAmountMatch: false },
    );
  }

  async initiateKnetPayment(
    data: CreateKnetPaymentDto,
    user?: { sub: number },
  ) {
    return this.initiateOnlinePayment('knet', data, user);
  }

  async initiateCardPayment(
    data: CreateKnetPaymentDto,
    user?: { sub: number },
  ) {
    return this.initiateOnlinePayment('card', data, user);
  }

  private async initiateOnlinePayment(
    method: 'knet' | 'card',
    data: CreateKnetPaymentDto,
    user?: { sub: number },
  ) {
    const amount = roundMoney(data.amount);

    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.validateInvoicePaymentRequest(
        data.invoice_id,
        amount,
        manager,
        { requireInvoiceAmountMatch: true },
      );
      const customer = await manager.getRepository(Customer).findOne({
        where: { id: invoice.customer_id },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const checkout =
        method === 'card'
          ? await this.myFatoorahService.createCardPayment({
              amount,
              customerName: customer.name,
              invoiceReference: String(invoice.id),
            })
          : await this.myFatoorahService.createKnetPayment({
              amount,
              customerName: customer.name,
              invoiceReference: String(invoice.id),
            });
      const now = new Date().toISOString();
      const session = await manager.getRepository(KnetPaymentSession).save({
        invoice_id: invoice.id,
        customer_id: customer.id,
        created_by: user?.sub ?? null,
        amount,
        payment_method: method,
        gateway_invoice_id: checkout.invoiceId
          ? String(checkout.invoiceId)
          : null,
        payment_id: null,
        payment_url: checkout.url,
        status: 'pending',
        error_message: null,
        created_at: now,
        updated_at: now,
      });

      return {
        url: checkout.url,
        invoiceId: invoice.id,
        gatewayInvoiceId: checkout.invoiceId,
        sessionId: session.id,
      };
    });
  }

  getKnetAvailability() {
    return this.myFatoorahService.getAvailability();
  }

  async finalizeKnetPayment(paymentId: string) {
    const existingPayment = await this.paymentRepo.findOne({
      where: { reference: paymentId },
    });

    if (existingPayment) {
      if (existingPayment.status === 'reversed') {
        throw new BadRequestException(
          'Payment was reversed and cannot be finalized again',
        );
      }

      await this.markKnetSession(existingPayment.invoice_id, {
        payment_id: paymentId,
        status: 'paid',
        error_message: null,
      });

      return {
        message: 'Payment already recorded',
        payment: existingPayment,
        new_balance: await this.ledgerService.getBalance(
          existingPayment.customer_id,
        ),
      };
    }

    const verifiedPayment =
      await this.myFatoorahService.verifyPayment(paymentId);
    const invoice_id = Number(verifiedPayment.customerReference);

    if (!Number.isInteger(invoice_id) || invoice_id <= 0) {
      throw new BadRequestException(
        'Invalid invoice reference from MyFatoorah',
      );
    }

    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoice_id },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found for verified payment');
    }

    const session = await this.knetSessionRepo.findOne({
      where: { invoice_id: invoice.id },
      order: { id: 'DESC' },
    });

    const result = await this.recordPayment(
      {
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        amount: verifiedPayment.amount,
        mode: verifiedPayment.paymentMode,
        reference: verifiedPayment.paymentId,
        created_by: session?.created_by ?? null,
      },
      { allowOverpayment: true, requireInvoiceAmountMatch: true },
    );

    await this.markKnetSession(invoice.id, {
      payment_id: verifiedPayment.paymentId,
      status: 'paid',
      error_message: null,
    });

    return result;
  }

  async getKnetPaymentStatus(paymentId: string) {
    const payment = await this.paymentRepo.findOne({
      where: { reference: paymentId },
    });

    if (payment) {
      if (payment.status === 'reversed') {
        return {
          status: 'reversed',
          payment,
        };
      }

      await this.markKnetSession(payment.invoice_id, {
        payment_id: paymentId,
        status: 'paid',
        error_message: null,
      });

      return {
        status: 'paid',
        payment,
      };
    }

    const verifiedPayment =
      await this.myFatoorahService.verifyPayment(paymentId);
    const invoice_id = Number(verifiedPayment.customerReference);
    const invoice =
      Number.isInteger(invoice_id) && invoice_id > 0
        ? await this.invoiceRepo.findOne({ where: { id: invoice_id } })
        : null;

    await this.markKnetSession(invoice?.id ?? null, {
      payment_id: verifiedPayment.paymentId,
      status: 'verified',
      error_message: null,
    });

    return {
      status: 'verified',
      paymentId: verifiedPayment.paymentId,
      amount: verifiedPayment.amount,
      invoice_id: invoice?.id ?? null,
      customer_id: invoice?.customer_id ?? null,
      method: verifiedPayment.paymentMethod,
    };
  }

  async markKnetFailure(paymentId: string | undefined, message: string) {
    if (!paymentId) {
      return;
    }

    const session = await this.knetSessionRepo.findOne({
      where: { payment_id: paymentId },
      order: { id: 'DESC' },
    });

    if (!session) {
      return;
    }

    await this.knetSessionRepo.save({
      ...session,
      status: 'failed',
      error_message: message,
      updated_at: new Date().toISOString(),
    });
  }

  async getKnetReconciliation() {
    const sessions = await this.knetSessionRepo.find({
      order: { created_at: 'DESC', id: 'DESC' },
    });
    const paidPayments = await this.paymentRepo.find({
      where: [{ mode: 'knet' }, { mode: 'card' }],
      order: { date: 'DESC', id: 'DESC' },
    });
    const activePaidPayments = paidPayments.filter(
      (payment) => payment.status !== 'reversed',
    );

    const totals = {
      pending: 0,
      paid: 0,
      failed: 0,
      verified: 0,
      pendingAmount: 0,
      paidAmount: 0,
    };

    sessions.forEach((session) => {
      totals[session.status] += 1;

      if (session.status === 'pending') {
        totals.pendingAmount = roundMoney(
          totals.pendingAmount + Number(session.amount),
        );
      }

      if (session.status === 'paid') {
        totals.paidAmount = roundMoney(
          totals.paidAmount + Number(session.amount),
        );
      }
    });

    return {
      totals,
      sessions,
      paidPayments: activePaidPayments,
    };
  }

  async reversePayment(
    id: number,
    data: ReversePaymentDto,
    user?: { sub: number },
  ) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(Payment)
        .findOne({ where: { id } });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === 'reversed') {
        throw new BadRequestException('Payment is already reversed');
      }

      const date = new Date().toISOString();
      await this.ledgerService.addEntry(
        {
          customer_id: payment.customer_id,
          type: 'payment_reversal',
          amount: Number(payment.amount),
          reference_id: payment.id,
          date,
        },
        manager,
      );

      const saved = await manager.getRepository(Payment).save({
        ...payment,
        status: 'reversed',
        reversal_reason: data.reason?.trim() || null,
        reversed_at: date,
        reversed_by: user?.sub ?? null,
      });
      const new_balance = await this.ledgerService.getBalance(
        payment.customer_id,
        manager,
      );

      return {
        message: 'Payment reversed',
        payment: saved,
        new_balance,
      };
    });
  }

  private async recordPayment(
    data: {
      customer_id: number;
      invoice_id?: number;
      amount: number;
      mode: 'cash' | 'knet' | 'card';
      reference?: string;
      created_by?: number | null;
    },
    options?: {
      allowOverpayment?: boolean;
      requireInvoiceAmountMatch?: boolean;
    },
  ) {
    const { customer_id, invoice_id, mode, reference } = data;
    const amount = roundMoney(data.amount);

    return this.dataSource.transaction(async (manager) => {
      const customer = await this.validateCustomerPaymentRequest(
        customer_id,
        amount,
        manager,
        options,
      );

      let invoice: Invoice | null = null;

      if (invoice_id) {
        invoice = await this.validateInvoicePaymentRequest(
          invoice_id,
          amount,
          manager,
          options,
        );

        if (invoice.customer_id !== customer_id) {
          throw new BadRequestException(
            'Invoice does not belong to the provided customer',
          );
        }
      }

      if (reference) {
        const existingPayment = await manager.getRepository(Payment).findOne({
          where: { reference },
        });

        if (existingPayment) {
          if (existingPayment.status === 'reversed') {
            throw new BadRequestException(
              'Payment reference belongs to a reversed payment',
            );
          }

          return {
            message: 'Payment already recorded',
            payment: existingPayment,
            new_balance: await this.ledgerService.getBalance(
              existingPayment.customer_id,
              manager,
            ),
          };
        }
      }

      const date = new Date().toISOString();
      const payment = await manager.getRepository(Payment).save({
        customer_id,
        invoice_id: invoice?.id ?? null,
        amount,
        mode,
        reference,
        date,
        created_by: data.created_by ?? null,
        status: 'active',
      });

      await this.ledgerService.addEntry(
        {
          customer_id,
          type: 'payment',
          amount: -amount,
          reference_id: payment.id,
          date,
        },
        manager,
      );

      const new_balance = await this.ledgerService.getBalance(
        customer_id,
        manager,
      );

      return {
        message: `Payment recorded for ${customer.name}`,
        payment,
        new_balance,
      };
    });
  }

  private async validateCustomerPaymentRequest(
    customer_id: number,
    amount: number,
    manager: EntityManager,
    options?: { allowOverpayment?: boolean },
  ) {
    const customer = await manager
      .getRepository(Customer)
      .findOne({ where: { id: customer_id } });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const invoiceCount = await manager
      .getRepository(Invoice)
      .count({ where: { customer_id } });

    if (!invoiceCount) {
      throw new BadRequestException('No invoice found for this customer');
    }

    const currentBalance = await this.ledgerService.getBalance(
      customer_id,
      manager,
    );

    if (currentBalance <= 0 && !options?.allowOverpayment) {
      throw new BadRequestException(
        'Customer does not have an outstanding balance',
      );
    }

    if (amount > currentBalance && !options?.allowOverpayment) {
      throw new BadRequestException(
        'Payment amount cannot exceed current balance',
      );
    }

    return customer;
  }

  private async validateInvoicePaymentRequest(
    invoice_id: number,
    amount: number,
    manager: EntityManager,
    options?: {
      allowOverpayment?: boolean;
      requireInvoiceAmountMatch?: boolean;
    },
  ) {
    const invoice = await manager
      .getRepository(Invoice)
      .findOne({ where: { id: invoice_id } });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'void') {
      throw new BadRequestException(
        'Cannot collect payment for a void invoice',
      );
    }

    const invoiceAmount = roundMoney(Number(invoice.total));
    const paidAmount = await this.getInvoicePaidAmount(invoice.id, manager);
    const remainingAmount = roundMoney(invoiceAmount - paidAmount);

    if (
      options?.requireInvoiceAmountMatch === true &&
      roundMoney(amount) !== remainingAmount
    ) {
      throw new BadRequestException(
        'Payment amount must match the invoice outstanding amount',
      );
    }

    if (options?.requireInvoiceAmountMatch !== true) {
      if (remainingAmount <= 0 && !options?.allowOverpayment) {
        throw new BadRequestException('Invoice is already paid');
      }

      if (roundMoney(amount) > remainingAmount && !options?.allowOverpayment) {
        throw new BadRequestException(
          `Payment amount cannot exceed invoice outstanding amount ${remainingAmount.toFixed(3)}`,
        );
      }
    }

    return invoice;
  }

  private async getInvoicePaidAmount(
    invoice_id: number,
    manager: EntityManager,
  ) {
    const payments = await manager.getRepository(Payment).find({
      where: { invoice_id },
    });

    return payments
      .filter((payment) => payment.status !== 'reversed')
      .reduce((sum, payment) => roundMoney(sum + Number(payment.amount)), 0);
  }

  findAll() {
    return this.paymentRepo.find({ order: { date: 'DESC', id: 'DESC' } });
  }

  private async markKnetSession(
    invoiceId: number | null | undefined,
    data: {
      payment_id: string;
      status: KnetPaymentSession['status'];
      error_message: string | null;
    },
  ) {
    if (!invoiceId) {
      return;
    }

    const session = await this.knetSessionRepo.findOne({
      where: { invoice_id: invoiceId },
      order: { id: 'DESC' },
    });

    if (!session) {
      return;
    }

    await this.knetSessionRepo.save({
      ...session,
      payment_id: data.payment_id,
      status: data.status,
      error_message: data.error_message,
      updated_at: new Date().toISOString(),
    });
  }
}
