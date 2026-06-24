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

function getLetterheadPath() {
  const imagePaths = [
    path.join(process.cwd(), 'src/assets/letterheads/jcm-letterhead.jpeg'),
    path.join(process.cwd(), 'dist/assets/letterheads/jcm-letterhead.jpeg'),
    path.join(__dirname, '../assets/letterheads/jcm-letterhead.jpeg'),
  ];

  return imagePaths.find((imagePath) => fs.existsSync(imagePath)) ?? null;
}

function getArabicFontPath() {
  const fontPaths = [
    '/usr/share/fonts/google-noto/NotoSansArabic-Regular.ttf',
    '/usr/share/fonts/google-noto/NotoNaskhArabic-Regular.ttf',
    '/usr/share/fonts/google-noto-naskh-arabic/NotoNaskhArabic-Regular.ttf',
    '/usr/share/fonts/google-noto-naskh-arabic-vf/NotoNaskhArabic[wght].ttf',
    '/usr/share/fonts/google-noto-sans-arabic/NotoSansArabic-Regular.ttf',
    '/usr/share/fonts/google-noto-sans-arabic-vf/NotoSansArabic[wdth,wght].ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/Library/Fonts/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/GeezaPro.ttc',
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

function rtlVisual(text: string) {
  return text
    .split('\n')
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .reverse()
        .join(' '),
    )
    .join('\n');
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

function drawCleanLetterheadFooter(doc: PDFKit.PDFDocument) {
  const pageWidth = doc.page.width;
  const footerTop = 740;
  const lineBlueY = 747;
  const lineRedY = 750;
  const textWidth = pageWidth - 40;

  doc.save();
  doc.rect(0, footerTop, pageWidth, doc.page.height - footerTop).fill('#ffffff');

  doc
    .lineWidth(1)
    .strokeColor('#1b4b9b')
    .moveTo(14, lineBlueY)
    .lineTo(pageWidth - 14, lineBlueY)
    .stroke();
  doc
    .strokeColor('#c01822')
    .moveTo(14, lineRedY)
    .lineTo(pageWidth - 14, lineRedY)
    .stroke();

  doc
    .fillColor('#1b2f6b')
    .font('Times-Roman')
    .fontSize(10)
    .text('Shuwaikh Industrial Area 3, Block No.1, Street No.71, Building No.222, Shop No.06', 20, 758, {
      width: textWidth,
      align: 'center',
      lineBreak: false,
    });

  doc
    .fillColor('#c01822')
    .font('Arabic')
    .fontSize(9)
    .text(rtlVisual('منطقة الشويخ الصناعية ٣، قطعة رقم ١، شارع رقم ٧١، مبنى رقم ٢٢٢، محل رقم ٠٦'), 20, 770, {
      width: textWidth,
      align: 'center',
      lineBreak: false,
    });

  doc
    .fillColor('#1b2f6b')
    .font('Times-Roman')
    .fontSize(8.4)
    .text('javedmeatsupply@gmail.com', 20, 790, {
      width: textWidth,
      align: 'center',
      lineBreak: false,
    });

  doc.restore();
}

export function generateStatementPDF(
  customer: Customer,
  rows: StatementRow[],
  res: Response,
  kwdToUsdRate?: number,
) {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  doc.registerFont('Arabic', getArabicFontPath());
  const letterheadPath = getLetterheadPath();
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

  if (letterheadPath) {
    doc.image(letterheadPath, 0, 0, {
      width: doc.page.width,
      height: doc.page.height,
    });
  }

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('Customer Statement', 36, 122, {
    width: 250,
  });
  doc.font('Arabic').fontSize(14).text(rtlVisual('كشف حساب العميل'), 344, 122, {
    width: 215,
    align: 'right',
  });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#475569')
    .text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 36, 146);

  doc.roundedRect(36, 172, 523, 86, 8).fillAndStroke('#f8fafc', '#e2e8f0');
  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(customer.name, 54, 190);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#475569')
    .text(`Mobile: ${customer.mobile ?? '-'}`, 54, 210)
    .text(`Address: ${customer.address ?? '-'}`, 54, 226);

  const summaryX = 326;
  doc
    .font('Helvetica-Bold')
    .fillColor('#0f172a')
    .text('Closing Balance', summaryX, 190)
    .fontSize(18)
    .text(dualCurrency(closingBalance, kwdToUsdRate), summaryX, 208)
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#64748b')
    .text(
      `Charges ${dualCurrency(charges, kwdToUsdRate)} | Receipts ${dualCurrency(receipts, kwdToUsdRate)}`,
      summaryX,
      234,
      { width: 210 },
    );

  let y = 290;
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
    if (y > 724) {
      drawCleanLetterheadFooter(doc);
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

  drawCleanLetterheadFooter(doc);

  doc.end();
}
