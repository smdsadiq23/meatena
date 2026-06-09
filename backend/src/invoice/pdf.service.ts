import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { Customer } from '../customer/customer.entity';
import type { InvoiceItem } from './invoice-item.entity';
import type { InvoiceWithNumber } from './invoice.service';

function getArabicFontPath() {
  const fontPaths = [
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

function clean(value: string | null | undefined, fallback = '-') {
  const next = value?.trim();
  return next || fallback;
}

function formatDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return value ?? '-';
  }

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatAmount(value: number | string | null | undefined, decimals = 3) {
  return Number(value ?? 0).toFixed(decimals);
}

function drawCell(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    font?: 'Helvetica' | 'Arabic';
    size?: number;
  } = {},
) {
  doc
    .rect(x, y, width, height)
    .stroke()
    .font(options.font ?? 'Helvetica')
    .fontSize(options.size ?? 12);

  if (options.bold) {
    doc.font(options.font === 'Arabic' ? 'Arabic' : 'Helvetica-Bold');
  }

  doc.text(text, x + 5, y + 9, {
    width: width - 10,
    height: height - 12,
    align: options.align ?? 'center',
  });
}

function drawBilingualHeader(
  doc: PDFKit.PDFDocument,
  english: string,
  arabic: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.rect(x, y, width, height).stroke();
  doc.font('Helvetica-Bold').fontSize(11).text(english, x + 5, y + 12, {
    width: width - 10,
    align: 'center',
  });
  doc.font('Arabic').fontSize(11).text(arabic, x + 5, y + 33, {
    width: width - 10,
    align: 'center',
  });
}

function splitContacts(contactNames: string | null, companyPhone: string | null) {
  const names = clean(contactNames, 'Abdul Basit, Zahoor Ellahi')
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const phones = clean(companyPhone, '96684998 / 94942708')
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return names.slice(0, 2).map((name, index) => ({
    name,
    phone: phones[index] ?? phones[0] ?? '',
  }));
}

function drawTopLine(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: {
    align?: 'left' | 'center' | 'right';
    font?: 'Helvetica' | 'Helvetica-Bold' | 'Helvetica-BoldOblique' | 'Arabic';
    size?: number;
    underline?: boolean;
  } = {},
) {
  doc
    .font(options.font ?? 'Helvetica')
    .fontSize(options.size ?? 13)
    .text(text, x, y, {
      width,
      align: options.align ?? 'left',
      underline: options.underline ?? false,
      lineGap: 1,
    });
}

export function generateInvoicePDF(
  invoice: InvoiceWithNumber,
  items: InvoiceItem[],
  customer: Customer,
  productNames: Map<number, string>,
  res: Response,
  _kwdToUsdRate?: number,
) {
  const doc = new PDFDocument({
    layout: 'landscape',
    margin: 28,
    size: 'A4',
  });

  doc.registerFont('Arabic', getArabicFontPath());

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${invoice.invoice_number}.pdf`,
  );

  doc.pipe(res);
  doc.lineWidth(1.3);

  const pageWidth = doc.page.width;
  const tableX = 28;
  const tableW = pageWidth - 56;
  const rightX = pageWidth - 380;

  const address = clean(
    invoice.company_address,
    'Shuwaikh Industrial Area, Block No.1,\nStreet No. 71, Building No. 222, Shop No. 06.',
  );
  const email = clean(invoice.company_email, 'almajad.albasat.co@gmail.com');
  const contacts = splitContacts(invoice.contact_names, invoice.company_phone);
  const companyEnglish = clean(
    invoice.company_name,
    'I-Majad Al-Basat Selling Meet Company',
  );
  const companyArabic = clean(
    invoice.company_name_ar,
    'شركة المجد الباسط لبيع اللحوم',
  );
  const titleEnglish = clean(invoice.invoice_title, 'Cash / Credit invoice');
  const titleArabic = clean(invoice.invoice_title_ar, 'فاتورة نقدية / الحساب');
  const activityEnglish = clean(invoice.company_activity, 'Import All Kinds Of Meat');
  const activityArabic = clean(invoice.company_activity_ar, 'استيراد جميع انواع اللحوم');
  const englishAddress = address.replace(/\n/g, ' ');
  const streetAddressIndex = englishAddress.search(/\bStreet\b/i);
  const addressLine1 =
    streetAddressIndex > 0
      ? englishAddress.slice(0, streetAddressIndex).trim().replace(/,$/, ',')
      : englishAddress;
  const addressLine2 =
    streetAddressIndex > 0 ? englishAddress.slice(streetAddressIndex).trim() : '';

  drawTopLine(doc, 'Address:', 32, 38, 58, {
    font: 'Helvetica-Bold',
  });
  drawTopLine(doc, addressLine1, 92, 38, 420);
  if (addressLine2) {
    drawTopLine(doc, addressLine2, 32, 62, 470);
  }
  drawTopLine(doc, email, 68, 96, 350);
  doc.rect(38, 96, 22, 12).stroke();
  drawTopLine(doc, '@', 43, 95, 14, {
    size: 9,
    align: 'center',
  });
  contacts.forEach((contact, index) => {
    drawTopLine(doc, `${contact.name}    | ${contact.phone}`, 32, 122 + index * 22, 350);
  });

  drawTopLine(doc, 'العنوان : الشويخ الصناعية بلوك رقم 1', rightX, 38, 340, {
    font: 'Arabic',
    align: 'right',
  });
  drawTopLine(doc, 'شارع رقم 71 ، مبنى رقم 222 ، محل رقم 06', rightX, 66, 340, {
    font: 'Arabic',
    align: 'right',
  });
  drawTopLine(doc, email, rightX, 96, 340, {
    align: 'right',
  });

  drawTopLine(doc, companyEnglish, tableX, 178, 505, {
    font: 'Helvetica-BoldOblique',
    size: 20,
    align: 'left',
  });
  drawTopLine(doc, companyArabic, tableX + 390, 178, tableW - 390, {
    font: 'Arabic',
    size: 20,
    align: 'right',
  });

  drawTopLine(doc, titleEnglish, 135, 238, 315, {
    font: 'Helvetica-BoldOblique',
    size: 20,
    align: 'right',
    underline: true,
  });
  drawTopLine(doc, titleArabic, 455, 238, 330, {
    font: 'Arabic',
    size: 20,
    align: 'right',
    underline: true,
  });

  doc.moveTo(tableX, 273).lineTo(tableX + tableW, 273).stroke();
  drawTopLine(doc, `${activityEnglish} /`, 150, 280, 300, {
    font: 'Helvetica-BoldOblique',
    size: 18,
    align: 'right',
  });
  drawTopLine(doc, activityArabic, 454, 280, 330, {
    font: 'Arabic',
    size: 18,
    align: 'right',
  });

  let y = 308;
  const customerRowH = 52;
  const customerCols = [190, 240, 210, tableW - 640];
  let x = tableX;
  drawCell(doc, 'Customer Name /', x, y, customerCols[0], customerRowH, {
    align: 'left',
    bold: true,
    size: 12,
  });
  doc.font('Arabic').fontSize(12).text('اسم الزبون', x + 108, y + 12, {
    width: 80,
    align: 'right',
  });
  x += customerCols[0];
  drawCell(doc, clean(customer.name, '-').toUpperCase(), x, y, customerCols[1], customerRowH, {
    bold: true,
    size: 15,
  });
  x += customerCols[1];
  drawCell(doc, 'Mobile Number /', x, y, customerCols[2], customerRowH, {
    align: 'left',
    bold: true,
    size: 12,
  });
  doc.font('Arabic').fontSize(12).text('رقم الهاتف', x + 118, y + 12, {
    width: 85,
    align: 'right',
  });
  x += customerCols[2];
  drawCell(doc, customer.mobile ?? '', x, y, customerCols[3], customerRowH, {
    bold: true,
    size: 12,
  });

  y += customerRowH;
  doc.rect(tableX, y, tableW, 14).stroke();
  y += 14;

  const headerH = 64;
  const cols = [70, 120, 145, 90, 100, 110, tableW - 635];
  x = tableX;
  drawBilingualHeader(doc, 'Serial', 'الرقم\nالتسلسلي', x, y, cols[0], headerH);
  x += cols[0];
  drawBilingualHeader(doc, 'Date\n(DD/MM/YY)', 'تاريخ', x, y, cols[1], headerH);
  x += cols[1];
  drawBilingualHeader(doc, 'Description', 'وصف', x, y, cols[2], headerH);
  x += cols[2];
  drawBilingualHeader(doc, 'Piece\n(No.)', 'قطع', x, y, cols[3], headerH);
  x += cols[3];
  drawBilingualHeader(doc, 'Weight\n(kg)', 'وزن', x, y, cols[4], headerH);
  x += cols[4];
  drawBilingualHeader(doc, 'Price\n(per kg)', 'سعر', x, y, cols[5], headerH);
  x += cols[5];
  drawBilingualHeader(doc, 'Amount\n(K.D)', 'كمية', x, y, cols[6], headerH);

  y += headerH;
  const rowH = 48;
  const invoiceDate = formatDate(invoice.date);
  let totalPieces = 0;
  let totalWeight = 0;

  items.forEach((item, index) => {
    const description = item.product_id
      ? productNames.get(item.product_id) ?? `Product #${item.product_id}`
      : 'Counter item';
    const pieces = Number(item.pieces ?? 0);
    const weight = Number(item.weight ?? 0);
    totalPieces += pieces;
    totalWeight += weight;

    x = tableX;
    drawCell(doc, String(index + 1), x, y, cols[0], rowH, { size: 14 });
    x += cols[0];
    drawCell(doc, invoiceDate, x, y, cols[1], rowH, { size: 14 });
    x += cols[1];
    drawCell(doc, description, x, y, cols[2], rowH, {
      font: /[\u0600-\u06FF]/.test(description) ? 'Arabic' : 'Helvetica',
      size: 13,
    });
    x += cols[2];
    drawCell(doc, pieces ? String(pieces) : '', x, y, cols[3], rowH, { size: 14 });
    x += cols[3];
    drawCell(doc, formatAmount(weight, 2), x, y, cols[4], rowH, { size: 14 });
    x += cols[4];
    drawCell(doc, formatAmount(item.price_per_kg), x, y, cols[5], rowH, { size: 14 });
    x += cols[5];
    drawCell(doc, formatAmount(item.amount), x, y, cols[6], rowH, { size: 14 });
    y += rowH;
  });

  const minRows = Math.max(0, 2 - items.length);
  for (let index = 0; index < minRows; index += 1) {
    x = tableX;
    cols.forEach((width) => {
      drawCell(doc, '', x, y, width, rowH);
      x += width;
    });
    y += rowH;
  }

  const totalH = 48;
  doc.save().fillColor('#d9d9d9').rect(tableX, y, tableW, totalH).fill().restore();
  x = tableX;
  drawCell(doc, '', x, y, cols[0], totalH, { bold: true });
  x += cols[0];
  drawCell(doc, 'TOTAL', x, y, cols[1] + cols[2], totalH, {
    align: 'right',
    bold: true,
    size: 14,
  });
  x += cols[1] + cols[2];
  drawCell(doc, String(totalPieces), x, y, cols[3], totalH, { bold: true, size: 14 });
  x += cols[3];
  drawCell(doc, formatAmount(totalWeight, 2), x, y, cols[4], totalH, {
    bold: true,
    size: 14,
  });
  x += cols[4];
  drawCell(doc, '', x, y, cols[5], totalH, { bold: true });
  x += cols[5];
  drawCell(doc, formatAmount(invoice.total), x, y, cols[6], totalH, {
    bold: true,
    size: 14,
  });

  doc.end();
}
