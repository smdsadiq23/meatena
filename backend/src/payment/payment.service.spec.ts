import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './payment.entity';
import { Invoice } from '../invoice/invoice.entity';
import { LedgerService } from '../ledger/ledger.service';
import { MyFatoorahService } from './myfatoorah.service';
import { Customer } from '../customer/customer.entity';
import { KnetPaymentSession } from './knet-payment-session.entity';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: { save: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(KnetPaymentSession),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: { count: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
        {
          provide: LedgerService,
          useValue: { getBalance: jest.fn(), addEntry: jest.fn() },
        },
        {
          provide: MyFatoorahService,
          useValue: {
            createKnetPayment: jest.fn(),
            verifyPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
