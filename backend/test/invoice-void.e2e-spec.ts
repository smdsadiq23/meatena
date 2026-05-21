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
import { Product } from '../src/product/product.entity';
import { PurchaseItem } from '../src/purchase/purchase-item.entity';
import { Purchase } from '../src/purchase/purchase.entity';
import { Supplier } from '../src/supplier/supplier.entity';

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
  invoice: { id: number; status?: string };
};

type StockItem = {
  id: number;
  stock_kg: number | string;
};

type BalanceResponse = {
  balance: number | string;
};

describe('Invoice void (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let token: string;
  const created: {
    customerId?: number;
    supplierId?: number;
    productId?: number;
    purchaseId?: number;
    invoiceId?: number;
  } = {};

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await cleanupCreatedData();
    await app.close();
  });

  it('voids an unpaid invoice and reverses stock plus ledger', async () => {
    const unique = Date.now();

    const customer = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Void Customer ${unique}` })
      .expect(201);
    created.customerId = (customer.body as EntityResponse).id;

    const supplier = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Void Supplier ${unique}` })
      .expect(201);
    created.supplierId = (supplier.body as EntityResponse).id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Void Meat ${unique}`,
        sku: `VOID-${unique}`,
        price_per_kg: 4,
      })
      .expect(201);
    created.productId = (product.body as EntityResponse).id;

    const purchase = await request(app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplier_id: created.supplierId,
        invoice_no: `VOID-PUR-${unique}`,
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
        invoice_number: `VOID-INV-${unique}`,
        invoice_title: 'Void Test Invoice',
        company_name: 'Void Meat Company',
        company_address: 'Void Address',
        company_phone: '12345678',
        items: [
          {
            product_id: created.productId,
            weight: 2,
            price_per_kg: 4,
          },
        ],
      })
      .expect(201);
    created.invoiceId = (invoice.body as InvoiceResponse).invoice.id;

    await request(app.getHttpServer())
      .post(`/invoices/${created.invoiceId}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'E2E wrong invoice' })
      .expect(201);

    const storedInvoice = await dataSource
      .getRepository(Invoice)
      .findOne({ where: { id: created.invoiceId } });
    expect(storedInvoice?.status).toBe('void');
    expect(storedInvoice?.void_reason).toBe('E2E wrong invoice');

    const stock = await request(app.getHttpServer())
      .get('/inventory/stock')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const stockItem = (stock.body as StockItem[]).find(
      (item) => item.id === created.productId,
    );
    expect(Number(stockItem?.stock_kg)).toBe(5);

    const balance = await request(app.getHttpServer())
      .get(`/ledger/balance/${created.customerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Number((balance.body as BalanceResponse).balance)).toBe(0);
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
      ...movementIds,
    ].filter((id): id is number => Boolean(id));

    if (auditEntityIds.length) {
      await dataSource.getRepository(AuditLog).delete({
        entity_id: In(auditEntityIds),
      });
    }

    if (created.customerId) {
      await dataSource
        .getRepository(Ledger)
        .delete({ customer_id: created.customerId });
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
