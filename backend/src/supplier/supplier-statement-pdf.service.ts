import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { Supplier } from './supplier.entity';
import type { SupplierStatementRow } from './supplier.service';

type StatementCurrency = 'KWD' | 'USD';

type SupplierStatementTotals = {
  charges: number;
  payments: number;
  closing_balance: number;
};

function getLetterheadPath() {
  const imagePaths = [
    path.join(process.cwd(), 'src/assets/letterheads/jcm-letterhead.jpeg'),
    path.join(process.cwd(), 'dist/assets/letterheads/jcm-letterhead.jpeg'),
    path.join(__dirname, '../assets/letterheads/jcm-letterhead.jpeg'),
  ];

  return imagePaths.find((imagePath) => fs.existsSync(imagePath)) ?? null;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeCurrency(value?: string): StatementCurrency {
  return value === 'USD' ? 'USD' : 'KWD';
}

function formatMoney(
  value: number | string,
  currency: StatementCurrency,
  rate = 3.25,
) {
  const kwd = Number(value ?? 0);
  if (currency === 'USD') {
    return `USD ${(kwd * rate).toFixed(2)}`;
  }

  return `KWD ${kwd.toFixed(3)}`;
}

function drawMoney(
  doc: PDFKit.PDFDocument,
  value: number,
  x: number,
  y: number,
  width: number,
  rate?: number,
  currency: StatementCurrency = 'KWD',
) {
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(formatMoney(value, currency, rate), x, y, { width, align: 'right' })
    .fillColor('#0f172a');
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const y = 744;
  const width = doc.page.width - 40;

  doc.save();
  doc.rect(0, y - 6, doc.page.width, doc.page.height - y + 6).fill('#ffffff');
  doc
    .strokeColor('#1b4b9b')
    .lineWidth(1)
    .moveTo(14, y)
    .lineTo(doc.page.width - 14, y)
    .stroke();
  doc
    .strokeColor('#c01822')
    .moveTo(14, y + 4)
    .lineTo(doc.page.width - 14, y + 4)
    .stroke();
  doc
    .fillColor('#1b2f6b')
    .font('Times-Roman')
    .fontSize(8.4)
    .text('javedmeatsupply@gmail.com', 20, y + 18, {
      width,
      align: 'center',
      lineBreak: false,
    });
  doc.restore();
}

export function generateSupplierStatementPDF(
  supplier: Supplier,
  rows: SupplierStatementRow[],
  totals: SupplierStatementTotals,
  res: Response,
  kwdToUsdRate?: number,
  selectedCurrency?: string,
) {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  const letterheadPath = getLetterheadPath();
  const currency = normalizeCurrency(selectedCurrency);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=supplier-statement-${supplier.id}.pdf`,
  );

  doc.pipe(res);

  if (letterheadPath) {
    doc.image(letterheadPath, 0, 0, {
      width: doc.page.width,
      height: doc.page.height,
    });
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#0f172a')
    .text('Supplier Statement', 36, 122, { width: 260 });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#475569')
    .text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 36, 146);

  doc.roundedRect(36, 172, 523, 88, 8).fillAndStroke('#f8fafc', '#e2e8f0');
  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(supplier.name, 54, 190)
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#475569')
    .text(`Mobile: ${supplier.mobile ?? '-'}`, 54, 210)
    .text(`Address: ${supplier.address ?? '-'}`, 54, 226);

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#0f172a')
    .text('Closing Balance', 330, 188);
  drawMoney(doc, totals.closing_balance, 330, 206, 190, kwdToUsdRate, currency);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text(
      `Purchases ${formatMoney(totals.charges, currency, kwdToUsdRate)} | Payments ${formatMoney(totals.payments, currency, kwdToUsdRate)}`,
      330,
      232,
      { width: 190 },
    );

  let y = 292;
  const columns = {
    date: 44,
    type: 112,
    reference: 194,
    charge: 304,
    payment: 398,
    balance: 490,
  };

  doc
    .roundedRect(36, y - 10, 523, 28, 6)
    .fill('#111827')
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('Date', columns.date, y)
    .text('Type', columns.type, y)
    .text('Reference', columns.reference, y)
    .text('Charge', columns.charge, y, { width: 80, align: 'right' })
    .text('Payment', columns.payment, y, { width: 80, align: 'right' })
    .text('Balance', columns.balance, y, { width: 62, align: 'right' });

  y += 30;

  if (!rows.length) {
    doc
      .fillColor('#64748b')
      .font('Helvetica')
      .fontSize(10)
      .text('No supplier purchases or payments recorded yet.', 40, y + 14);
  }

  rows.forEach((row, index) => {
    if (y > 718) {
      drawFooter(doc);
      doc.addPage();
      if (letterheadPath) {
        doc.image(letterheadPath, 0, 0, {
          width: doc.page.width,
          height: doc.page.height,
        });
      }
      y = 48;
    }

    if (index % 2 === 0) {
      doc.rect(36, y - 8, 523, 34).fill('#f8fafc');
    }

    doc
      .fillColor('#0f172a')
      .font('Helvetica')
      .fontSize(8.5)
      .text(formatDate(row.date), columns.date, y)
      .text(row.type === 'purchase' ? 'Purchase' : 'Payment', columns.type, y)
      .text(row.reference, columns.reference, y, { width: 96 });

    drawMoney(doc, row.charge, columns.charge, y, 80, kwdToUsdRate, currency);
    drawMoney(doc, row.payment, columns.payment, y, 80, kwdToUsdRate, currency);
    drawMoney(doc, row.balance, columns.balance, y, 62, kwdToUsdRate, currency);

    y += 34;
  });

  drawFooter(doc);
  doc.end();
}
