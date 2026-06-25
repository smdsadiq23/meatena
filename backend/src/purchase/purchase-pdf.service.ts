import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { Product } from '../product/product.entity';
import { drawCleanJcmFooter, drawJcmLetterheadPage, registerArabicFont } from '../common/pdf/jcm-letterhead';
import type { Supplier } from '../supplier/supplier.entity';
import type { PurchaseItem } from './purchase-item.entity';
import type { Purchase } from './purchase.entity';

function purchaseCurrency(purchase: Purchase) {
  return purchase.transaction_currency === 'USD' ? 'USD' : 'KWD';
}

function displayMoney(
  value: number | string | null | undefined,
  purchase: Purchase,
  kwdToUsdRate = 3.25,
) {
  const currency = purchaseCurrency(purchase);
  const amount = Number(value ?? 0);
  const rate = Number(purchase.exchange_rate ?? kwdToUsdRate ?? 3.25);
  const display = currency === 'USD' ? amount * (Number.isFinite(rate) && rate > 0 ? rate : 3.25) : amount;
  return `${currency} ${display.toFixed(currency === 'KWD' ? 3 : 2)}`;
}

export function generatePurchasePDF(
  purchase: Purchase,
  items: PurchaseItem[],
  supplier: Supplier,
  products: Product[],
  res: Response,
  kwdToUsdRate?: number,
) {
  const doc = new PDFDocument({ margin: 32, size: 'A4' });
  registerArabicFont(doc);
  drawJcmLetterheadPage(doc);
  const productNameById = new Map(
    products.map((product) => [product.id, product.name]),
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=purchase-${purchase.id}.pdf`,
  );

  doc.pipe(res);

  doc.y = 112;
  doc.font('Helvetica-Bold').fontSize(18).text('Purchase Invoice');
  doc.font('Arabic').fontSize(16).text('فاتورة شراء', { align: 'right' });
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(12).text(`Purchase #${purchase.id}`);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Supplier: ${supplier.name}`);
  doc.text(`Mobile: ${supplier.mobile ?? '-'}`);
  doc.text(`Supplier Invoice: ${purchase.invoice_no ?? '-'}`);
  doc.text(`Purchase Date: ${purchase.purchase_date ?? new Date(purchase.date).toLocaleDateString()}`);
  doc.text(`Goods Received: ${purchase.goods_received_date ?? purchase.purchase_date ?? new Date(purchase.date).toLocaleDateString()}`);
  doc.text(`Recorded At: ${new Date(purchase.date).toLocaleString()}`);

  doc.moveDown();

  const startX = 32;
  let y = doc.y;
  const col = {
    product: startX,
    pieces: 230,
    weight: 300,
    cost: 392,
    amount: 480,
  };

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Product', col.product, y);
  doc.text('Pieces', col.pieces, y);
  doc.text('Weight', col.weight, y);
  doc.text('Cost / kg', col.cost, y);
  doc.text('Amount', col.amount, y);

  y += 22;
  doc.moveTo(startX, y).lineTo(560, y).stroke();
  y += 10;

  doc.font('Helvetica').fontSize(10);
  items.forEach((item) => {
    doc.text(
      productNameById.get(item.product_id) ?? `Product #${item.product_id}`,
      col.product,
      y,
      { width: 180 },
    );
    doc.text(String(item.pieces ?? '-'), col.pieces, y);
    doc.text(Number(item.weight).toFixed(3), col.weight, y);
    doc.text(displayMoney(item.cost_per_kg, purchase, kwdToUsdRate), col.cost, y, { width: 78 });
    doc.text(displayMoney(item.amount, purchase, kwdToUsdRate), col.amount, y, { width: 90 });
    y += 28;
  });

  doc.moveTo(startX, y).lineTo(560, y).stroke();
  y += 18;

  const summaryLabelX = 350;
  const summaryAmountX = 482;
  const summaryLabelWidth = 118;
  const summaryAmountWidth = 98;

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Subtotal', summaryLabelX, y, { width: summaryLabelWidth, align: 'right' });
  doc.text(displayMoney(purchase.subtotal ?? purchase.total, purchase, kwdToUsdRate), summaryAmountX, y, { width: summaryAmountWidth });
  y += 18;

  if (Number(purchase.discount_amount ?? 0) > 0) {
    doc.text('Discount', summaryLabelX, y, { width: summaryLabelWidth, align: 'right' });
    doc.text(`-${displayMoney(purchase.discount_amount, purchase, kwdToUsdRate)}`, summaryAmountX, y, { width: summaryAmountWidth });
    y += 18;
  }

  doc.text('Net Total', summaryLabelX, y, { width: summaryLabelWidth, align: 'right' });
  doc.text(displayMoney(purchase.total, purchase, kwdToUsdRate), summaryAmountX, y, { width: summaryAmountWidth });
  y += 18;

  if (Number(purchase.advance_paid ?? 0) > 0) {
    doc.text('Advance Paid', summaryLabelX, y, { width: summaryLabelWidth, align: 'right' });
    doc.text(`-${displayMoney(purchase.advance_paid, purchase, kwdToUsdRate)}`, summaryAmountX, y, { width: summaryAmountWidth });
    y += 18;
  }

  doc.text('Supplier Balance', summaryLabelX, y, { width: summaryLabelWidth, align: 'right' });
  doc.text(displayMoney(purchase.balance_due ?? purchase.total, purchase, kwdToUsdRate), summaryAmountX, y, { width: summaryAmountWidth });

  drawCleanJcmFooter(doc);

  doc.end();
}
