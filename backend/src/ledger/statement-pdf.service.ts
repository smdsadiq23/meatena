import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { Customer } from '../customer/customer.entity';
import { dualCurrency } from '../common/utils/currency';

type StatementRow = {
  date: string;
  type: string;
  amount: number;
  balance: number;
};

function getLogoPath() {
  const logoPaths = [
    path.join(process.cwd(), 'src/assets/logo.png'),
    path.join(process.cwd(), 'dist/assets/logo.png'),
    path.join(__dirname, '../assets/logo.png'),
  ];

  return logoPaths.find((logoPath) => fs.existsSync(logoPath));
}

function getArabicFontPath() {
  const fontPaths = [
    path.join(process.cwd(), 'src/assets/fonts/arabic.ttf'),
    path.join(process.cwd(), 'dist/assets/fonts/arabic.ttf'),
    path.join(__dirname, '../assets/fonts/arabic.ttf'),
  ];

  return fontPaths.find((fontPath) => fs.existsSync(fontPath)) ?? fontPaths[0];
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function labelType(value: string) {
  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function moneyParts(value: number | string, rate?: number) {
  return dualCurrency(value, rate).split(' / ');
}

function drawMoney(
  doc: PDFKit.PDFDocument,
  value: number,
  x: number,
  y: number,
  width: number,
  rate?: number,
  prefix = '',
) {
  const [kwd, usd] = moneyParts(value, rate);

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(`${prefix}${kwd}`, x, y, { width, align: 'right' })
    .font('Helvetica')
    .fontSize(7.5)
    .text(usd, x, y + 10, { width, align: 'right' });
}

export function generateStatementPDF(
  customer: Customer,
  rows: StatementRow[],
  res: Response,
  kwdToUsdRate?: number,
) {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  doc.registerFont('Arabic', getArabicFontPath());
  const logoPath = getLogoPath();
  const closingBalance = rows.at(-1)?.balance ?? 0;
  const charges = rows
    .filter((row) => row.amount >= 0)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const receipts = rows
    .filter((row) => row.amount < 0)
    .reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=statement-${customer.id}.pdf`,
  );

  doc.pipe(res);

  if (logoPath) {
    doc.image(logoPath, 36, 28, { width: 76 });
  }

  doc.font('Helvetica-Bold').fontSize(16).text('Customer Statement', 130, 36);
  doc.font('Arabic').fontSize(14).text('كشف حساب العميل', 380, 36, {
    align: 'right',
  });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#475569')
    .text('Al-Majad Al-Basat Selling Meat Company', 130, 58)
    .text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 130, 74);

  doc.roundedRect(36, 112, 523, 86, 8).fillAndStroke('#f8fafc', '#e2e8f0');
  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(customer.name, 54, 130);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#475569')
    .text(`Mobile: ${customer.mobile ?? '-'}`, 54, 150)
    .text(`Address: ${customer.address ?? '-'}`, 54, 166);

  const summaryX = 326;
  doc
    .font('Helvetica-Bold')
    .fillColor('#0f172a')
    .text('Closing Balance', summaryX, 130)
    .fontSize(18)
    .text(dualCurrency(closingBalance, kwdToUsdRate), summaryX, 148)
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#64748b')
    .text(
      `Charges ${dualCurrency(charges, kwdToUsdRate)} | Receipts ${dualCurrency(receipts, kwdToUsdRate)}`,
      summaryX,
      174,
      { width: 210 },
    );

  let y = 230;
  const columns = {
    date: 40,
    type: 126,
    amount: 286,
    balance: 420,
  };

  doc
    .roundedRect(36, y - 10, 523, 28, 6)
    .fill('#111827')
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Date', columns.date, y)
    .text('Type', columns.type, y)
    .text('Amount', columns.amount, y, { width: 120, align: 'right' })
    .text('Balance', columns.balance, y, { width: 120, align: 'right' });

  y += 30;
  doc.font('Helvetica').fontSize(9);

  if (!rows.length) {
    doc
      .fillColor('#64748b')
      .text('No ledger entries found for this customer. / لا توجد قيود لهذا العميل.', 40, y + 14);
  }

  rows.forEach((row, index) => {
    if (y > 760) {
      doc.addPage();
      y = 48;
    }

    if (index % 2 === 0) {
      doc.rect(36, y - 8, 523, 32).fill('#f8fafc');
    }

    doc
      .fillColor('#0f172a')
      .text(formatDate(row.date), columns.date, y)
      .text(labelType(row.type), columns.type, y, { width: 130 });

    doc.fillColor(row.amount < 0 ? '#047857' : '#dc2626');
    drawMoney(
      doc,
      Math.abs(row.amount),
      columns.amount,
      y,
      120,
      kwdToUsdRate,
      row.amount < 0 ? '-' : '+',
    );

    doc.fillColor('#0f172a');
    drawMoney(doc, row.balance, columns.balance, y, 120, kwdToUsdRate);

    y += 32;
  });

  doc
    .moveTo(36, Math.min(y + 10, 780))
    .lineTo(559, Math.min(y + 10, 780))
    .strokeColor('#e2e8f0')
    .stroke();

  doc
    .fontSize(8)
    .fillColor('#64748b')
    .text(
      'This statement is system generated from the customer ledger.',
      36,
      800,
      {
        align: 'center',
        width: 523,
      },
    );

  doc.end();
}
