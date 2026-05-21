import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuditLog } from '../src/audit/audit-log.entity';
import { AppModule } from '../src/app.module';
import { Customer } from '../src/customer/customer.entity';
import { StockMovement } from '../src/inventory/stock-movement.entity';
import { InvoiceItem } from '../src/invoice/invoice-item.entity';
import { Invoice } from '../src/invoice/invoice.entity';
import { Ledger } from '../src/ledger/ledger.entity';
import { KnetPaymentSession } from '../src/payment/knet-payment-session.entity';
import { Payment } from '../src/payment/payment.entity';
import { Product } from '../src/product/product.entity';
import { PurchaseItem } from '../src/purchase/purchase-item.entity';
import { Purchase } from '../src/purchase/purchase.entity';
import { Supplier } from '../src/supplier/supplier.entity';

type CreatedIds = {
  customerId?: number;
  productId?: number;
  supplierId?: number;
  purchaseId?: number;
  invoiceId?: number;
  paymentId?: number;
  sessionId?: number;
};

type LoginResponse = {
  access_token: string;
};

type EntityResponse = {
  id: number;
};

type PurchaseResponse = {
  purchase: { id: number };
};

type InvoiceResponse = {
  invoice: { id: number; total: number | string };
};

type KnetLinkResponse = {
  url: string;
  invoiceId: number;
  sessionId: number;
};

type BalanceResponse = {
  balance: number | string;
};

type ReconciliationResponse = {
  totals: {
    paid: number;
    paidAmount: number | string;
  };
  sessions: Array<{
    id: number;
    status: string;
    payment_id: string | null;
  }>;
};

describe('Mock KNET flow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let token: string;
  const created: CreatedIds = {};

  beforeAll(async () => {
    process.env.MYFATOORAH_MOCK = 'true';
    process.env.KNET_PUBLIC_BASE_URL = 'http://localhost:3003';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(201);

    token = (login.body as LoginResponse).access_token;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    await cleanupCreatedData();
    await app.close();
  });

  it('creates and approves a mock KNET payment link', async () => {
    const unique = Date.now();

    const customer = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `KNET Customer ${unique}` })
      .expect(201);
    created.customerId = (customer.body as EntityResponse).id;

    const supplier = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `KNET Supplier ${unique}` })
      .expect(201);
    created.supplierId = (supplier.body as EntityResponse).id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `KNET Meat ${unique}`,
        sku: `KNET-${unique}`,
        price_per_kg: 5,
      })
      .expect(201);
    created.productId = (product.body as EntityResponse).id;

    const purchase = await request(app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplier_id: created.supplierId,
        invoice_no: `KNET-PUR-${unique}`,
        items: [
          {
            product_id: created.productId,
            weight: 5,
            cost_per_kg: 2,
          },
        ],
      })
      .expect(201);
    created.purchaseId = (purchase.body as PurchaseResponse).purchase.id;

    const invoice = await request(app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_id: created.customerId,
        type: 'credit',
        invoice_number: `KNET-INV-${unique}`,
        invoice_title: 'KNET Test Invoice',
        company_name: 'KNET Meat Company',
        company_address: 'KNET Address',
        company_phone: '12345678',
        items: [
          {
            product_id: created.productId,
            weight: 2,
            price_per_kg: 5,
          },
        ],
      })
      .expect(201);
    const invoiceBody = invoice.body as InvoiceResponse;
    created.invoiceId = invoiceBody.invoice.id;
    expect(Number(invoiceBody.invoice.total)).toBe(10);

    const link = await request(app.getHttpServer())
      .post('/payments/knet')
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoice_id: created.invoiceId,
        amount: 10,
      })
      .expect(201);
    const linkBody = link.body as KnetLinkResponse;
    created.sessionId = linkBody.sessionId;
    expect(linkBody.url).toContain('/payments/knet/mock-checkout');

    const paymentId = new URL(linkBody.url).searchParams.get('paymentId');
    expect(paymentId).toBeTruthy();

    await request(app.getHttpServer())
      .get(
        `/payments/knet/callback?paymentId=${encodeURIComponent(paymentId!)}`,
      )
      .expect(200);

    const session = await dataSource
      .getRepository(KnetPaymentSession)
      .findOne({ where: { id: created.sessionId } });
    expect(session?.status).toBe('paid');
    expect(session?.payment_id).toBe(paymentId);

    const payment = await dataSource
      .getRepository(Payment)
      .findOne({ where: { reference: paymentId! } });
    expect(payment).toBeDefined();
    created.paymentId = payment?.id;
    expect(Number(payment?.amount)).toBe(10);

    const balance = await request(app.getHttpServer())
      .get(`/ledger/balance/${created.customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Number((balance.body as BalanceResponse).balance)).toBe(0);

    const reconciliation = await request(app.getHttpServer())
      .get('/payments/knet/reconciliation')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const reconciliationBody = reconciliation.body as ReconciliationResponse;
    expect(
      reconciliationBody.sessions.some(
        (item) => item.id === created.sessionId && item.status === 'paid',
      ),
    ).toBe(true);
  });

  async function cleanupCreatedData() {
    if (!dataSource?.isInitialized) {
      return;
    }

    const movements = created.productId
      ? await dataSource.getRepository(StockMovement).find({
          where: { product_id: created.productId },
          select: { id: true },
        })
      : [];
    const movementIds = movements.map((movement) => movement.id);
    const auditEntityIds = [
      created.invoiceId,
      created.purchaseId,
      created.paymentId,
      created.sessionId,
      ...movementIds,
    ].filter((id): id is number => Boolean(id));

    if (auditEntityIds.length) {
      await dataSource.getRepository(AuditLog).delete({
        entity_id: In(auditEntityIds),
      });
    }

    if (created.sessionId) {
      await dataSource
        .getRepository(KnetPaymentSession)
        .delete(created.sessionId);
    }

    if (created.customerId) {
      await dataSource
        .getRepository(Ledger)
        .delete({ customer_id: created.customerId });
    }

    if (created.paymentId) {
      await dataSource.getRepository(Payment).delete(created.paymentId);
    }

    if (created.invoiceId) {
      await dataSource
        .getRepository(InvoiceItem)
        .delete({ invoice_id: created.invoiceId });
      await dataSource.getRepository(Invoice).delete(created.invoiceId);
    }

    if (created.purchaseId) {
      await dataSource
        .getRepository(PurchaseItem)
        .delete({ purchase_id: created.purchaseId });
      await dataSource.getRepository(Purchase).delete(created.purchaseId);
    }

    if (movementIds.length) {
      await dataSource
        .getRepository(StockMovement)
        .delete({ id: In(movementIds) });
    }

    if (created.productId) {
      await dataSource.getRepository(Product).delete(created.productId);
    }

    if (created.supplierId) {
      await dataSource.getRepository(Supplier).delete(created.supplierId);
    }

    if (created.customerId) {
      await dataSource.getRepository(Customer).delete(created.customerId);
    }
  }
});
