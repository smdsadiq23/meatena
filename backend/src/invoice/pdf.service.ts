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

function invoiceCurrency(invoice: InvoiceWithNumber) {
  return (invoice.transaction_currency ?? 'KWD').toUpperCase() === 'USD'
    ? 'USD'
    : 'KWD';
}

function displayMoneyValue(value: number | string | null | undefined, invoice: InvoiceWithNumber) {
  const amount = Number(value ?? 0);
  const currency = invoiceCurrency(invoice);
  const rate = Number(invoice.exchange_rate ?? 3.25);

  if (currency === 'USD') {
    return amount * (Number.isFinite(rate) && rate > 0 ? rate : 3.25);
  }

  return amount;
}

function splitMoney(value: number, currency: 'KWD' | 'USD') {
  const [major, minor = ''] = value.toFixed(currency === 'KWD' ? 3 : 2).split('.');
  return { major, minor };
}

function moneyMajorLabel(currency: 'KWD' | 'USD') {
  return currency === 'KWD' ? 'K.D.' : 'USD';
}

function moneyMinorLabel(currency: 'KWD' | 'USD') {
  return currency === 'KWD' ? 'Fils' : 'Cents';
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

function drawArabicPhoneDigits(
  doc: PDFKit.PDFDocument,
  phone: string,
  x: number,
  y: number,
) {
  const digitWidth = 7.2;

  phone.split('').forEach((digit, index) => {
    doc.font('Arabic').fontSize(12).text(digit, x + index * digitWidth, y, {
      width: digitWidth,
      align: 'center',
      lineBreak: false,
    });
  });
}

function drawArabicSlashPhrase(
  doc: PDFKit.PDFDocument,
  rightText: string,
  leftText: string,
  x: number,
  y: number,
  width: number,
  size = 10,
) {
  const slashGap = 3;
  const slashWidth = 6;
  const rightVisual = rtlVisual(rightText);
  const leftVisual = rtlVisual(leftText);

  doc.font('Arabic').fontSize(size);
  const rightWords = rightVisual.split(/\s+/).filter(Boolean);
  const wordGap = 5;
  const rightWordWidths = rightWords.map((word) => doc.widthOfString(word));
  const rightWidth =
    rightWordWidths.reduce((total, wordWidth) => total + wordWidth, 0) +
    wordGap * Math.max(0, rightWords.length - 1);
  const leftWidth = doc.widthOfString(leftVisual) + 4;
  const totalWidth = rightWidth + slashGap * 2 + slashWidth + leftWidth;
  const startX = x + width - totalWidth;

  doc.font('Arabic').fontSize(size).text(leftVisual, startX, y, {
    width: leftWidth,
    align: 'right',
    lineBreak: false,
  });
  doc.font('Helvetica').fontSize(size).text('/', startX + leftWidth + slashGap, y, {
    width: slashWidth,
    align: 'center',
    lineBreak: false,
  });
  let rightCursor = startX + leftWidth + slashGap + slashWidth + slashGap;
  rightWords.forEach((word, index) => {
    const wordWidth = rightWordWidths[index];
    doc.font('Arabic').fontSize(size).text(word, rightCursor, y, {
      width: wordWidth,
      align: 'right',
      lineBreak: false,
    });
    rightCursor += wordWidth + wordGap;
  });
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
  const currency = invoiceCurrency(invoice);
  const letterheadPath = getLetterheadPath();
  if (letterheadPath) {
    doc.image(letterheadPath, 0, 0, { width: pageWidth, height: pageHeight });
  }

  const leftX = 24;
  const tableX = leftX;
  const tableW = pageWidth - leftX * 2;
  const titleY = 232;
  const tableY = 290;
  const customerH = 54;
  const separatorH = 12;
  const headerH = 72;
  const rowH = 52;
  const minBodyRows = 2;
  const totalH = 40;
  const currencyLabel = moneyMajorLabel(currency);
  const titleEnglish = clean(invoice.invoice_title, 'Cash / Credit Invoice');
  const titleArabic = clean(invoice.invoice_title_ar, 'فاتورة نقدا / بالحساب');
  const activityEnglish = clean(invoice.company_activity, 'Import All Kinds of Meat');
  const activityArabic = clean(invoice.company_activity_ar, 'استيراد جميع انواع اللحوم');
  const invoiceDate = formatDate(invoice.date);
  const previousBalance = Number(invoice.previous_balance ?? 0);
  const showPreviousBalance =
    invoice.include_previous_balance === true && previousBalance !== 0;
  const extraBalanceRows = showPreviousBalance ? 2 : 0;
  const bodyRows = Math.max(minBodyRows, Math.min(items.length, 6));
  const tableH =
    customerH + separatorH + headerH + bodyRows * rowH + totalH + extraBalanceRows * totalH;
  const cols = [52, 90, 130, 64, 76, 80, tableW - 492];
  const colX = cols.reduce<number[]>(
    (positions, width) => [...positions, positions[positions.length - 1] + width],
    [tableX],
  );

  const drawRect = (x: number, y: number, width: number, height: number, fill?: string) => {
    if (fill) {
      doc.rect(x, y, width, height).fillAndStroke(fill, '#000000');
      doc.fillColor('#000000');
      return;
    }

    doc.rect(x, y, width, height).stroke();
  };

  const drawCentered = (
    text: string,
    x: number,
    y: number,
    width: number,
    options: {
      font?: 'Helvetica' | 'Helvetica-Bold' | 'Arabic';
      size?: number;
      arabic?: boolean;
      height?: number;
    } = {},
  ) => {
    doc
      .font(options.font ?? 'Helvetica')
      .fontSize(options.size ?? 11)
      .text(options.arabic ? rtlVisual(text) : text, x + 4, y, {
        width: width - 8,
        height: options.height,
        align: 'center',
      });
  };

  const drawHeader = (
    english: string,
    arabic: string,
    x: number,
    y: number,
    width: number,
  ) => {
    drawCentered(english, x, y + 14, width, {
      font: 'Helvetica-Bold',
      size: 10,
      height: 26,
    });
    drawCentered(arabic, x, y + 44, width, {
      font: 'Arabic',
      size: 10,
      arabic: true,
      height: 20,
    });
  };

  doc.fillColor('#000000');
  doc.font('Helvetica-BoldOblique').fontSize(16).text(titleEnglish, leftX, titleY, {
    width: tableW / 2,
    align: 'center',
    underline: true,
  });
  doc.font('Arabic').fontSize(17).text(rtlVisual(titleArabic), leftX + tableW / 2, titleY - 2, {
    width: tableW / 2,
    align: 'center',
    underline: true,
  });
  doc.moveTo(leftX, titleY + 28).lineTo(leftX + tableW, titleY + 28).stroke();
  doc.font('Helvetica-BoldOblique').fontSize(13).text(`${activityEnglish} /`, leftX, titleY + 34, {
    width: tableW / 2,
    align: 'right',
  });
  doc.font('Arabic').fontSize(13).text(rtlVisual(activityArabic), leftX + tableW / 2, titleY + 34, {
    width: tableW / 2,
    align: 'left',
  });

  doc.lineWidth(1.2);
  drawRect(tableX, tableY, tableW, tableH);

  const customerY = tableY;
  const customerCols = [150, 190, 135, tableW - 475];
  const customerX = customerCols.reduce<number[]>(
    (positions, width) => [...positions, positions[positions.length - 1] + width],
    [tableX],
  );
  customerX.slice(1, -1).forEach((x) =>
    doc.moveTo(x, customerY).lineTo(x, customerY + customerH).stroke(),
  );
  doc.font('Helvetica-Bold').fontSize(10).text('Customer Name /', customerX[0] + 5, customerY + 13, {
    width: 95,
  });
  doc.font('Arabic').fontSize(10).text(rtlVisual('اسم الزبون'), customerX[0] + 96, customerY + 16, {
    width: customerCols[0] - 102,
    align: 'right',
  });
  drawCentered(clean(customer.name, ''), customerX[1], customerY + 12, customerCols[1], {
    font: 'Helvetica-Bold',
    size: 14,
  });
  doc.font('Helvetica-Bold').fontSize(10).text('Mobile Number /', customerX[2] + 5, customerY + 13, {
    width: 92,
  });
  doc.font('Arabic').fontSize(10).text(rtlVisual('رقم الهاتف'), customerX[2] + 96, customerY + 16, {
    width: customerCols[2] - 102,
    align: 'right',
  });
  drawCentered(clean(customer.mobile, ''), customerX[3], customerY + 14, customerCols[3], {
    font: 'Helvetica-Bold',
    size: 10,
  });

  const separatorY = customerY + customerH;
  doc.moveTo(tableX, separatorY).lineTo(tableX + tableW, separatorY).stroke();
  doc.moveTo(tableX, separatorY + separatorH).lineTo(tableX + tableW, separatorY + separatorH).stroke();

  const headerY = separatorY + separatorH;
  colX.slice(1, -1).forEach((x) =>
    doc.moveTo(x, headerY).lineTo(x, tableY + tableH).stroke(),
  );
  doc.moveTo(tableX, headerY + headerH).lineTo(tableX + tableW, headerY + headerH).stroke();
  drawHeader('Serial', 'الرقم\nالتسلسلي', colX[0], headerY, cols[0]);
  drawHeader('Date\n(DD/MM/YY)', 'تاريخ', colX[1], headerY, cols[1]);
  drawHeader('Description', 'وصف', colX[2], headerY, cols[2]);
  drawHeader('Piece\n(No.)', 'قطع', colX[3], headerY, cols[3]);
  drawHeader('Weight\n(kg)', 'وزن', colX[4], headerY, cols[4]);
  drawHeader('Price\n(per kg)', 'سعر', colX[5], headerY, cols[5]);
  drawHeader(`Amount\n(${currencyLabel})`, 'كمية', colX[6], headerY, cols[6]);

  const bodyTop = headerY + headerH;
  const renderedItems = items.slice(0, bodyRows);
  let totalPieces = 0;
  let totalWeight = 0;

  renderedItems.forEach((item, index) => {
    const y = bodyTop + index * rowH;
    const productName = item.product_id ? productNames.get(item.product_id) : null;
    const description = productName?.name ?? (item.product_id ? `Product #${item.product_id}` : 'Counter item');
    const descriptionArabic = productArabicDescription(productName ?? null, description);
    const pieces = Number(item.pieces ?? 0);
    const weight = Number(item.weight ?? 0);
    const displayPrice = displayMoneyValue(item.price_per_kg, invoice);
    const displayAmount = displayMoneyValue(item.amount, invoice);

    totalPieces += pieces;
    totalWeight += weight;

    doc.moveTo(tableX, y + rowH).lineTo(tableX + tableW, y + rowH).stroke();
    drawCentered(String(index + 1), colX[0], y + 13, cols[0], { size: 12 });
    drawCentered(invoiceDate, colX[1], y + 13, cols[1], { size: 12 });
    drawCentered(description, colX[2], y + 10, cols[2], { size: 11 });
    if (descriptionArabic) {
      drawCentered(descriptionArabic, colX[2], y + 30, cols[2], {
        font: 'Arabic',
        size: 10,
        arabic: true,
      });
    }
    drawCentered(pieces ? String(pieces) : '', colX[3], y + 13, cols[3], { size: 12 });
    drawCentered(formatAmount(weight, 2), colX[4], y + 13, cols[4], { size: 12 });
    drawCentered(formatAmount(displayPrice, currency === 'KWD' ? 3 : 2), colX[5], y + 13, cols[5], {
      size: 12,
    });
    drawCentered(formatAmount(displayAmount, currency === 'KWD' ? 3 : 2), colX[6], y + 13, cols[6], {
      size: 12,
    });
  });

  for (let index = renderedItems.length; index < bodyRows; index += 1) {
    const y = bodyTop + index * rowH;
    doc.moveTo(tableX, y + rowH).lineTo(tableX + tableW, y + rowH).stroke();
  }

  const totalY = bodyTop + bodyRows * rowH;
  drawRect(tableX, totalY, tableW, totalH, '#d9d9d9');
  colX.slice(1, -1).forEach((x) =>
    doc.moveTo(x, totalY).lineTo(x, tableY + tableH).stroke(),
  );
  doc.font('Helvetica-Bold').fontSize(12).text('TOTAL', colX[0] + 4, totalY + 13, {
    width: cols[0] + cols[1] + cols[2] - 8,
    align: 'right',
  });
  drawCentered(String(totalPieces), colX[3], totalY + 12, cols[3], {
    font: 'Helvetica-Bold',
    size: 12,
  });
  drawCentered(formatAmount(totalWeight, 2), colX[4], totalY + 12, cols[4], {
    font: 'Helvetica-Bold',
    size: 12,
  });
  drawCentered(formatAmount(displayMoneyValue(invoice.total, invoice), currency === 'KWD' ? 3 : 2), colX[6], totalY + 12, cols[6], {
    font: 'Helvetica-Bold',
    size: 12,
  });

  if (showPreviousBalance) {
    const previousY = totalY + totalH;
    const grandY = previousY + totalH;
    drawRect(tableX, previousY, tableW, totalH, '#d9d9d9');
    drawRect(tableX, grandY, tableW, totalH, '#d9d9d9');
    colX.slice(1, -1).forEach((x) =>
      doc.moveTo(x, previousY).lineTo(x, tableY + tableH).stroke(),
    );
    doc.font('Helvetica-Bold').fontSize(11).text('PREVIOUS BALANCE', colX[0] + 4, previousY + 12, {
      width: colX[6] - colX[0] - 8,
      align: 'right',
    });
    drawCentered(formatAmount(displayMoneyValue(previousBalance, invoice), currency === 'KWD' ? 3 : 2), colX[6], previousY + 11, cols[6], {
      font: 'Helvetica-Bold',
      size: 12,
    });
    doc.font('Helvetica-Bold').fontSize(11).text('TOTAL BILLS', colX[0] + 4, grandY + 12, {
      width: colX[6] - colX[0] - 8,
      align: 'right',
    });
    drawCentered(formatAmount(displayMoneyValue(invoice.grand_total, invoice), currency === 'KWD' ? 3 : 2), colX[6], grandY + 11, cols[6], {
      font: 'Helvetica-Bold',
      size: 12,
    });
  }

  if (items.length > bodyRows) {
    doc.font('Helvetica').fontSize(8).text(`+${items.length - bodyRows} more items`, tableX + 8, totalY - 14, {
      width: 120,
    });
  }

  drawCleanLetterheadFooter(doc);

  doc.end();
}
