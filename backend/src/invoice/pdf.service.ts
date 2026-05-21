import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { Customer } from '../customer/customer.entity';
import { dualCurrency } from '../common/utils/currency';
import type { InvoiceItem } from './invoice-item.entity';
import type { InvoiceWithNumber } from './invoice.service';

function getArabicFontPath() {
  const fontPaths = [
    path.join(process.cwd(), 'src/assets/fonts/arabic.ttf'),
    path.join(process.cwd(), 'dist/assets/fonts/arabic.ttf'),
    path.join(__dirname, '../assets/fonts/arabic.ttf'),
  ];

  return fontPaths.find((fontPath) => fs.existsSync(fontPath)) ?? fontPaths[0];
}

function getLogoPath() {
  const logoPaths = [
    path.join(process.cwd(), 'src/assets/logo.png'),
    path.join(process.cwd(), 'dist/assets/logo.png'),
    path.join(__dirname, '../assets/logo.png'),
  ];

  return logoPaths.find((logoPath) => fs.existsSync(logoPath));
}

function detailLine(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.font('Helvetica').text(`${label}: ${value}`);
}

export function generateInvoicePDF(
  invoice: InvoiceWithNumber,
  items: InvoiceItem[],
  customer: Customer,
  productNames: Map<number, string>,
  res: Response,
  kwdToUsdRate?: number,
) {
  const doc = new PDFDocument({ margin: 30 });

  const fontPath = getArabicFontPath();
  const logoPath = getLogoPath();

  doc.registerFont('Arabic', fontPath);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${invoice.invoice_number}.pdf`,
  );

  doc.pipe(res);

  if (logoPath) {
    doc.image(logoPath, 30, 20, { width: 60 });
  }

  doc.font('Helvetica').fontSize(14).text(invoice.company_name ?? '-', 100, 20);

  if (invoice.company_name_ar) {
    doc.font('Arabic').text(invoice.company_name_ar, 350, 20, { align: 'right' });
  }

  doc.moveDown(2);

  if (invoice.company_activity) {
    doc.font('Helvetica').fontSize(10).text(invoice.company_activity);
  }

  if (invoice.company_activity_ar) {
    doc.font('Arabic').text(invoice.company_activity_ar);
  }

  doc.moveDown();

  doc.font('Helvetica').text(invoice.invoice_title ?? 'Invoice');

  if (invoice.invoice_title_ar) {
    doc.font('Arabic').text(invoice.invoice_title_ar);
  }

  doc.moveDown(2);

  doc.font('Helvetica');

  detailLine(doc, 'Invoice No', invoice.invoice_number);
  detailLine(doc, 'Customer', customer.name);
  detailLine(doc, 'Mobile', customer.mobile ?? '-');
  detailLine(doc, 'Date', invoice.date);

  doc.moveDown();

  const startX = 30;
  let y = doc.y;

  const col = {
    desc: startX,
    piece: 150,
    weight: 220,
    price: 320,
    amount: 420,
  };

  doc.fontSize(10).text('Description', col.desc, y);
  doc.text('Piece', col.piece, y);
  doc.text('Weight', col.weight, y);
  doc.text('Price', col.price, y);
  doc.text('Amount', col.amount, y);

  y += 20;

  doc.moveTo(startX, y).lineTo(550, y).stroke();

  y += 10;

  doc.font('Helvetica');

  items.forEach((item) => {
    const description = item.product_id
      ? productNames.get(item.product_id) ?? `Product #${item.product_id}`
      : 'Counter item';

    doc.text(description, col.desc, y, { width: 110 });
    doc.text('1', col.piece, y);
    doc.text(Number(item.weight).toFixed(3), col.weight, y);
    doc.text(dualCurrency(item.price_per_kg, kwdToUsdRate), col.price, y, { width: 95 });
    doc.text(dualCurrency(item.amount, kwdToUsdRate), col.amount, y, { width: 120 });

    y += 28;
  });

  doc.moveTo(startX, y).lineTo(550, y).stroke();

  y += 20;

  doc.font('Helvetica');

  doc.text('TOTAL', 350, y);
  doc.text(dualCurrency(invoice.total, kwdToUsdRate), 420, y, { width: 140 });

  doc.text('PREVIOUS BALANCE', 300, y + 20);
  doc.text(dualCurrency(invoice.previous_balance, kwdToUsdRate), 420, y + 20, { width: 140 });

  doc.text('TOTAL BILLS', 320, y + 40);
  doc.text(dualCurrency(invoice.grand_total, kwdToUsdRate), 420, y + 40, { width: 140 });

  doc.moveDown(4);

  doc.font('Helvetica').fontSize(8);

  doc.text(invoice.company_address ?? '-', {
    align: 'center',
  });

  doc.text(`Phone: ${invoice.company_phone ?? '-'}`, {
    align: 'center',
  });

  doc.end();
}
