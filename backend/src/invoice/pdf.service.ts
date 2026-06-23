import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { Customer } from '../customer/customer.entity';
import type { InvoiceItem } from './invoice-item.entity';
import type { InvoiceWithNumber } from './invoice.service';

type ProductPdfName = {
  name: string;
  name_ar: string | null;
};

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

function getLetterheadPath() {
  const imagePaths = [
    path.join(process.cwd(), 'src/assets/letterheads/jcm-letterhead.jpeg'),
    path.join(process.cwd(), 'dist/assets/letterheads/jcm-letterhead.jpeg'),
    path.join(__dirname, '../assets/letterheads/jcm-letterhead.jpeg'),
  ];

  return imagePaths.find((imagePath) => fs.existsSync(imagePath)) ?? null;
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

function hasArabic(text: string | null | undefined) {
  return Boolean(text && /[\u0600-\u06FF]/.test(text));
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

function inferArabicDescription(english: string) {
  const normalized = english.toLowerCase();
  const meat = normalized.includes('mutton')
    ? 'لحم غنم'
    : normalized.includes('lamb')
      ? 'لحم ضأن'
      : normalized.includes('goat')
        ? 'لحم ماعز'
        : normalized.includes('chicken')
          ? 'دجاج'
          : normalized.includes('beef')
            ? 'لحم بقر'
            : normalized.includes('liver')
              ? 'كبد'
              : '';

  const origin = normalized.includes('bangladesh')
    ? 'بنغلاديشي'
    : normalized.includes('karachi')
      ? 'كراتشي'
      : normalized.includes('pakistan')
        ? 'باكستاني'
        : normalized.includes('india')
          ? 'هندي'
          : normalized.includes('egypt')
            ? 'مصري'
            : normalized.includes('australia')
              ? 'أسترالي'
              : '';

  return [meat, origin].filter(Boolean).join(' ') || null;
}

function productArabicDescription(productName: ProductPdfName | null, english: string) {
  if (hasArabic(productName?.name_ar)) {
    return productName?.name_ar?.trim() ?? null;
  }

  return inferArabicDescription(english);
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
    yOffset?: number;
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

  doc.text(options.font === 'Arabic' ? rtlVisual(text) : text, x + 5, y + (options.yOffset ?? 9), {
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
  doc.font('Helvetica-Bold').fontSize(8.5).text(english, x + 3, y + 9, {
    width: width - 6,
    align: 'center',
  });
  doc.font('Arabic').fontSize(8.5).text(rtlVisual(arabic), x + 3, y + 31, {
    width: width - 6,
    align: 'center',
  });
}

function drawBilingualHeaderCompact(
  doc: PDFKit.PDFDocument,
  english: string,
  arabic: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.rect(x, y, width, height).stroke();
  doc.font('Helvetica-Bold').fontSize(7.6).text(english, x + 2, y + 7, {
    width: width - 10,
    align: 'center',
  });
  doc.font('Arabic').fontSize(7.6).text(rtlVisual(arabic), x + 2, y + 27, {
    width: width - 4,
    align: 'center',
  });
}

function drawDescriptionCell(
  doc: PDFKit.PDFDocument,
  english: string,
  arabic: string | null | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  doc.rect(x, y, width, height).stroke();
  doc.font('Helvetica').fontSize(9).text(english, x + 4, y + 8, {
    width: width - 10,
    height: arabic ? 14 : height - 10,
    align: 'center',
  });

  if (arabic) {
    doc.font('Arabic').fontSize(9).text(rtlVisual(arabic), x + 4, y + 24, {
      width: width - 8,
      height: 15,
      align: 'right',
    });
  }
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
  const outputText = options.font === 'Arabic' ? rtlVisual(text) : text;

  doc
    .font(options.font ?? 'Helvetica')
    .fontSize(options.size ?? 13)
    .text(outputText, x, y, {
      width,
      align: options.align ?? 'left',
      underline: options.underline ?? false,
      lineGap: 1,
    });
}

function drawArabicTitleWithSlash(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
) {
  const [rawLeft, rawRight] = text.split('/').map((part) => part.trim());

  if (!rawLeft || !rawRight) {
    drawTopLine(doc, text, x, y, width, {
      font: 'Arabic',
      size: 20,
      align: 'right',
      underline: true,
    });
    return;
  }

  const slashWidth = 18;
  const leftWidth = Math.floor((width - slashWidth) * 0.58);
  const rightWidth = width - slashWidth - leftWidth;
  const baselineY = y + 26;

  doc
    .font('Arabic')
    .fontSize(17)
    .text(rtlVisual(rawLeft), x, y + 4, {
      width: leftWidth,
      align: 'right',
      lineGap: 1,
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(17)
    .text('/', x + leftWidth, y + 4, {
      width: slashWidth,
      align: 'center',
      lineGap: 1,
    });
  doc
    .font('Arabic')
    .fontSize(17)
    .text(rtlVisual(rawRight), x + leftWidth + slashWidth, y, {
      width: rightWidth,
      align: 'right',
      lineGap: 1,
    });

  doc.moveTo(x + 38, baselineY).lineTo(x + width - 6, baselineY).stroke();
}

export function generateInvoicePDF(
  invoice: InvoiceWithNumber,
  items: InvoiceItem[],
  customer: Customer,
  productNames: Map<number, ProductPdfName>,
  res: Response,
  _kwdToUsdRate?: number,
) {
  const doc = new PDFDocument({
    layout: 'portrait',
    margin: 24,
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
  const pageHeight = doc.page.height;
  const letterheadPath = getLetterheadPath();
  if (letterheadPath) {
    doc.image(letterheadPath, 0, 0, { width: pageWidth, height: pageHeight });
  }

  const tableX = 26;
  const tableW = pageWidth - 52;
  const titleEnglish = clean(invoice.invoice_title, 'Cash / Credit invoice');
  const titleArabic = clean(invoice.invoice_title_ar, 'فاتورة نقدية / الحساب');
  const activityEnglish = clean(invoice.company_activity, 'Import All Kinds Of Meat');
  const activityArabic = clean(invoice.company_activity_ar, 'استيراد جميع انواع اللحوم');

  drawTopLine(doc, titleEnglish, 75, 164, 205, {
    font: 'Helvetica-BoldOblique',
    size: 15,
    align: 'right',
    underline: true,
  });
  drawArabicTitleWithSlash(doc, titleArabic, 318, 164, 230);

  doc.moveTo(tableX, 192).lineTo(tableX + tableW, 192).stroke();
  drawTopLine(doc, `${activityEnglish} /`, 93, 199, 188, {
    font: 'Helvetica-BoldOblique',
    size: 13,
    align: 'right',
  });
  drawTopLine(doc, activityArabic, 334, 198, 210, {
    font: 'Arabic',
    size: 13,
    align: 'right',
  });

  let y = 224;
  const customerRowH = 42;
  const customerCols = [142, 170, 150, tableW - 462];
  let x = tableX;
  drawCell(doc, 'Customer Name /', x, y, customerCols[0], customerRowH, {
    align: 'left',
    bold: true,
    size: 9,
    yOffset: 8,
  });
  doc.font('Arabic').fontSize(9).text(rtlVisual('اسم الزبون'), x + 77, y + 9, {
    width: 60,
    align: 'right',
  });
  x += customerCols[0];
  drawCell(doc, clean(customer.name, '-').toUpperCase(), x, y, customerCols[1], customerRowH, {
    bold: true,
    size: 12,
    yOffset: 8,
  });
  x += customerCols[1];
  drawCell(doc, 'Mobile Number /', x, y, customerCols[2], customerRowH, {
    align: 'left',
    bold: true,
    size: 9,
    yOffset: 8,
  });
  doc.font('Arabic').fontSize(9).text(rtlVisual('رقم الهاتف'), x + 86, y + 9, {
    width: 58,
    align: 'right',
  });
  x += customerCols[2];
  drawCell(doc, customer.mobile ?? '', x, y, customerCols[3], customerRowH, {
    bold: true,
    size: 12,
  });

  y += customerRowH;
  doc.rect(tableX, y, tableW, 10).stroke();
  y += 10;

  const headerH = 50;
  const cols = [45, 76, 110, 62, 70, 72, tableW - 435];
  x = tableX;
  drawBilingualHeaderCompact(doc, 'Serial', 'الرقم\nالتسلسلي', x, y, cols[0], headerH);
  x += cols[0];
  drawBilingualHeaderCompact(doc, 'Date\n(DD/MM/YY)', 'تاريخ', x, y, cols[1], headerH);
  x += cols[1];
  drawBilingualHeaderCompact(doc, 'Description', 'وصف', x, y, cols[2], headerH);
  x += cols[2];
  drawBilingualHeaderCompact(doc, 'Piece\n(No.)', 'قطع', x, y, cols[3], headerH);
  x += cols[3];
  drawBilingualHeaderCompact(doc, 'Weight\n(kg)', 'وزن', x, y, cols[4], headerH);
  x += cols[4];
  drawBilingualHeaderCompact(doc, 'Price\n(per kg)', 'سعر', x, y, cols[5], headerH);
  x += cols[5];
  drawBilingualHeaderCompact(doc, 'Amount\n(K.D)', 'كمية', x, y, cols[6], headerH);

  y += headerH;
  const rowH = 42;
  const invoiceDate = formatDate(invoice.date);
  let totalPieces = 0;
  let totalWeight = 0;

  items.forEach((item, index) => {
    const productName = item.product_id ? productNames.get(item.product_id) : null;
    const description = productName?.name ?? (item.product_id ? `Product #${item.product_id}` : 'Counter item');
    const descriptionArabic = productArabicDescription(productName ?? null, description);
    const pieces = Number(item.pieces ?? 0);
    const weight = Number(item.weight ?? 0);
    totalPieces += pieces;
    totalWeight += weight;

    x = tableX;
    drawCell(doc, String(index + 1), x, y, cols[0], rowH, { size: 11, yOffset: 8 });
    x += cols[0];
    drawCell(doc, invoiceDate, x, y, cols[1], rowH, { size: 10, yOffset: 8 });
    x += cols[1];
    drawDescriptionCell(doc, description, descriptionArabic, x, y, cols[2], rowH);
    x += cols[2];
    drawCell(doc, pieces ? String(pieces) : '', x, y, cols[3], rowH, { size: 11, yOffset: 8 });
    x += cols[3];
    drawCell(doc, formatAmount(weight, 2), x, y, cols[4], rowH, { size: 11, yOffset: 8 });
    x += cols[4];
    drawCell(doc, formatAmount(item.price_per_kg), x, y, cols[5], rowH, { size: 11, yOffset: 8 });
    x += cols[5];
    drawCell(doc, formatAmount(item.amount), x, y, cols[6], rowH, { size: 11, yOffset: 8 });
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

  const totalH = 42;
  doc.save().fillColor('#d9d9d9').rect(tableX, y, tableW, totalH).fill().restore();
  x = tableX;
  drawCell(doc, '', x, y, cols[0], totalH, { bold: true });
  x += cols[0];
  drawCell(doc, 'TOTAL', x, y, cols[1] + cols[2], totalH, {
    align: 'right',
    bold: true,
    size: 11,
    yOffset: 8,
  });
  x += cols[1] + cols[2];
  drawCell(doc, String(totalPieces), x, y, cols[3], totalH, { bold: true, size: 11, yOffset: 8 });
  x += cols[3];
  drawCell(doc, formatAmount(totalWeight, 2), x, y, cols[4], totalH, {
    bold: true,
    size: 11,
    yOffset: 8,
  });
  x += cols[4];
  drawCell(doc, '', x, y, cols[5], totalH, { bold: true });
  x += cols[5];
  drawCell(doc, formatAmount(invoice.total), x, y, cols[6], totalH, {
    bold: true,
    size: 11,
    yOffset: 8,
  });
  y += totalH;

  const previousBalance = Number(invoice.previous_balance ?? 0);
  const showPreviousBalance =
    invoice.include_previous_balance === true && previousBalance !== 0;

  if (showPreviousBalance) {
    doc.save().fillColor('#d9d9d9').rect(tableX, y, tableW, totalH).fill().restore();
    x = tableX;
    drawCell(doc, '', x, y, cols[0], totalH, { bold: true });
    x += cols[0];
    drawCell(doc, 'PREVIOUS BALANCE', x, y, cols[1] + cols[2] + cols[3] + cols[4] + cols[5], totalH, {
      align: 'right',
      bold: true,
      size: 14,
    });
    x += cols[1] + cols[2] + cols[3] + cols[4] + cols[5];
    drawCell(doc, formatAmount(previousBalance), x, y, cols[6], totalH, {
      bold: true,
      size: 14,
    });
    y += totalH;

    doc.save().fillColor('#d9d9d9').rect(tableX, y, tableW, totalH).fill().restore();
    x = tableX;
    drawCell(doc, '', x, y, cols[0], totalH, { bold: true });
    x += cols[0];
    drawCell(doc, 'TOTAL BILLS', x, y, cols[1] + cols[2] + cols[3] + cols[4] + cols[5], totalH, {
      align: 'right',
      bold: true,
      size: 14,
    });
    x += cols[1] + cols[2] + cols[3] + cols[4] + cols[5];
    drawCell(doc, formatAmount(invoice.grand_total), x, y, cols[6], totalH, {
      bold: true,
      size: 14,
    });
  }

  doc.end();
}
