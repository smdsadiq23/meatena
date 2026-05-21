import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { billingEntities } from '../database/entities';
import { Invoice } from '../invoice/invoice.entity';
import { Ledger } from '../ledger/ledger.entity';
import { Payment } from '../payment/payment.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: billingEntities,
  synchronize: false,
});

async function run() {
  await AppDataSource.initialize();

  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const paymentRepo = AppDataSource.getRepository(Payment);
  const ledgerRepo = AppDataSource.getRepository(Ledger);

  console.log('Starting backfill...');

  let invoiceCount = 0;
  let paymentCount = 0;
  let skippedInvoices = 0;
  let skippedPayments = 0;

  const invoices = await invoiceRepo.find();
  for (const inv of invoices) {
    const exists = await ledgerRepo.findOne({
      where: {
        type: 'invoice',
        reference_id: inv.id,
      },
    });

    if (exists) {
      skippedInvoices += 1;
      continue;
    }

    await ledgerRepo.save({
      customer_id: inv.customer_id,
      type: 'invoice',
      amount: Number(inv.total),
      reference_id: inv.id,
      date: inv.date,
    });

    invoiceCount += 1;
  }

  console.log(`Invoices backfilled: ${invoiceCount}`);
  console.log(`Invoices skipped: ${skippedInvoices}`);

  const payments = await paymentRepo.find();
  for (const pay of payments) {
    const exists = await ledgerRepo.findOne({
      where: {
        type: 'payment',
        reference_id: pay.id,
      },
    });

    if (exists) {
      skippedPayments += 1;
      continue;
    }

    await ledgerRepo.save({
      customer_id: pay.customer_id,
      type: 'payment',
      amount: -Number(pay.amount),
      reference_id: pay.id,
      date: pay.date,
    });

    paymentCount += 1;
  }

  console.log(`Payments backfilled: ${paymentCount}`);
  console.log(`Payments skipped: ${skippedPayments}`);
  console.log('Backfill completed successfully');

  await AppDataSource.destroy();
}

run().catch(async (error) => {
  console.error('Backfill failed:', error);

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  process.exit(1);
});
