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
  const currency = invoiceCurrency(invoice);
  const letterheadPath = getLetterheadPath();
  if (letterheadPath) {
    doc.image(letterheadPath, 0, 0, { width: pageWidth, height: pageHeight });
  }

  const leftX = 22;
  const rightX = pageWidth - 22;
  const contentW = rightX - leftX;
  const titleEnglish = clean(invoice.invoice_title, 'Cash / Credit Invoice');
  const titleArabic = clean(invoice.invoice_title_ar, 'فاتورة نقدا / بالحساب');
  const activityEnglish = clean(invoice.company_activity, 'Import All Kinds of Meat');
  const activityArabic = clean(invoice.company_activity_ar, 'استيراد جميع انواع اللحوم');
  const formTop = 116;

  doc.fillColor('#000000');
  doc.font('Helvetica-Bold').fontSize(11);
  [
    ['Abdul Basat', '96684998'],
    ['Zahoor Ellahi', '94942708'],
    ['Abu Bakar', '50289040'],
  ].forEach(([name, phone], index) => {
    doc.text(`${name} :`, leftX, formTop + index * 16, { width: 78 });
    doc.fontSize(12).text(phone, leftX + 86, formTop + index * 16, { width: 70 });
    doc.fontSize(11);
  });

  doc.font('Arabic').fontSize(10).text(rtlVisual(activityArabic), 210, formTop - 8, {
    width: 170,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(10).text(activityEnglish, 206, formTop + 12, {
    width: 178,
    align: 'center',
  });
  doc.font('Arabic').fontSize(10).text(rtlVisual(titleArabic), 210, formTop + 36, {
    width: 170,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(10).text(titleEnglish, 218, formTop + 55, {
    width: 155,
    align: 'center',
    underline: true,
  });

  [
    ['عبدالباسط', '٩٦٦٨٤٩٩٨'],
    ['ظهور الاهلي', '٩٤٩٤٢٧٠٨'],
    ['ابوبكر', '٥٠٢٨٩٠٤٠'],
  ].forEach(([name, phone], index) => {
    doc.font('Arabic').fontSize(12).text(rtlVisual(`${name} : ${phone}`), 412, formTop + index * 16, {
      width: 150,
      align: 'right',
    });
  });

  doc.font('Helvetica-Bold').fontSize(14).text('No.:', leftX, 182, { width: 42 });
  doc.fillColor('#c01822').font('Helvetica').fontSize(18).text(clean(invoice.invoice_number, String(invoice.id)), leftX + 42, 180, {
    width: 92,
  });
  doc.fillColor('#000000');
  doc.font('Helvetica-Bold').fontSize(12).text('Date', 383, 184, { width: 42 });
  doc.font('Helvetica').fontSize(13).text(formatDate(invoice.date), 426, 184, { width: 76, align: 'center' });
  doc.font('Arabic').fontSize(12).text(rtlVisual('التاريخ :'), 506, 184, {
    width: 56,
    align: 'right',
  });

  const partyY = 210;
  doc.roundedRect(leftX, partyY, contentW, 42, 12).stroke();
  doc.font('Helvetica-Bold').fontSize(14).text('Mr./Messers', leftX + 12, partyY + 14, { width: 112 });
  doc.font('Helvetica').fontSize(12).text(clean(customer.name, ''), leftX + 122, partyY + 15, {
    width: 285,
    align: 'center',
  });
  doc.dash(1.5, { space: 2 });
  doc.moveTo(leftX + 122, partyY + 29).lineTo(rightX - 154, partyY + 29).stroke();
  doc.undash();
  doc.font('Arabic').fontSize(10).text(rtlVisual('المطلوب من السيد / السادة'), rightX - 190, partyY + 16, {
    width: 176,
    align: 'right',
  });

  const tableX = leftX;
  const tableY = 258;
  const tableW = contentW;
  const tableBottom = 690;
  const headerH = 78;
  const footerH = 34;
  const bodyTop = tableY + headerH;
  const bodyBottom = tableBottom - footerH;
  const rowH = 31;
  const cols = {
    desc: 225,
    beef: 36,
    mutton: 40,
    qty: 48,
    unitK: 55,
    unitF: 35,
    amountK: 62,
    amountF: tableW - 501,
  };
  const colXs = [
    tableX,
    tableX + cols.desc,
    tableX + cols.desc + cols.beef,
    tableX + cols.desc + cols.beef + cols.mutton,
    tableX + cols.desc + cols.beef + cols.mutton + cols.qty,
    tableX + cols.desc + cols.beef + cols.mutton + cols.qty + cols.unitK,
    tableX + cols.desc + cols.beef + cols.mutton + cols.qty + cols.unitK + cols.unitF,
    tableX + cols.desc + cols.beef + cols.mutton + cols.qty + cols.unitK + cols.unitF + cols.amountK,
  ];

  doc.roundedRect(tableX, tableY, tableW, tableBottom - tableY, 12).stroke();
  for (const xLine of colXs.slice(1)) {
    const startsBelowMergedHeader = xLine === colXs[5] || xLine === colXs[7];
    doc
      .moveTo(xLine, startsBelowMergedHeader ? tableY + 37 : tableY)
      .lineTo(xLine, tableBottom)
      .stroke();
  }
  doc.moveTo(tableX, bodyTop).lineTo(tableX + tableW, bodyTop).stroke();
  doc.moveTo(tableX, bodyBottom).lineTo(tableX + tableW, bodyBottom).stroke();
  doc.moveTo(colXs[4], tableY + 37).lineTo(tableX + tableW, tableY + 37).stroke();

  const headerCenterY = tableY + 14;
  doc.font('Helvetica-Bold').fontSize(13).text('Description', tableX + 8, headerCenterY + 3, {
    width: cols.desc - 16,
    align: 'center',
  });
  doc.font('Arabic').fontSize(11).text(rtlVisual('التفاصيل'), tableX + 126, headerCenterY + 23, {
    width: 95,
    align: 'center',
  });
  doc.font('Arabic').fontSize(8).text(rtlVisual('لحم بقر\nمستورد'), colXs[1] + 3, tableY + 5, {
    width: cols.beef - 6,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(6).text('Beef\nImported', colXs[1] + 2, tableY + 40, {
    width: cols.beef - 4,
    align: 'center',
  });
  doc.font('Arabic').fontSize(8).text(rtlVisual('لحم غنم\nمستورد'), colXs[2] + 3, tableY + 5, {
    width: cols.mutton - 6,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(6).text('Mutton\nImported', colXs[2] + 2, tableY + 40, {
    width: cols.mutton - 4,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(9).text('Qty.', colXs[3] + 4, tableY + 26, {
    width: cols.qty - 8,
    align: 'center',
  });
  doc.font('Arabic').fontSize(9).text(rtlVisual('الكمية'), colXs[3] + 4, tableY + 48, {
    width: cols.qty - 8,
    align: 'center',
  });
  doc.font('Arabic').fontSize(8).text(rtlVisual('سعر'), colXs[4] + 4, tableY + 3, {
    width: cols.unitK + cols.unitF - 8,
    align: 'center',
  });
  doc.font('Arabic').fontSize(8).text(rtlVisual('الوحدة'), colXs[4] + 4, tableY + 13, {
    width: cols.unitK + cols.unitF - 8,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(8).text('Unit Price', colXs[4] + 4, tableY + 27, {
    width: cols.unitK + cols.unitF - 8,
    align: 'center',
  });
  doc.font('Arabic').fontSize(8).text(rtlVisual('المبلغ'), colXs[6] + 4, tableY + 3, {
    width: cols.amountK + cols.amountF - 8,
    align: 'center',
  });
  doc.font('Arabic').fontSize(8).text(rtlVisual('الإجمالي'), colXs[6] + 4, tableY + 13, {
    width: cols.amountK + cols.amountF - 8,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(8).text('Total Amount', colXs[6] + 4, tableY + 27, {
    width: cols.amountK + cols.amountF - 8,
    align: 'center',
  });
  doc.font('Arabic').fontSize(8).text(rtlVisual('دينار'), colXs[4] + 3, tableY + 43, { width: cols.unitK - 6, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(7).text(moneyMajorLabel(currency), colXs[4] + 3, tableY + 58, { width: cols.unitK - 6, align: 'center' });
  doc.font('Arabic').fontSize(8).text(rtlVisual('فلس'), colXs[5] + 3, tableY + 43, { width: cols.unitF - 6, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(7).text(moneyMinorLabel(currency), colXs[5] + 3, tableY + 58, { width: cols.unitF - 6, align: 'center' });
  doc.font('Arabic').fontSize(8).text(rtlVisual('دينار'), colXs[6] + 3, tableY + 43, { width: cols.amountK - 6, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(7).text(moneyMajorLabel(currency), colXs[6] + 3, tableY + 58, { width: cols.amountK - 6, align: 'center' });
  doc.font('Arabic').fontSize(8).text(rtlVisual('فلس'), colXs[7] + 3, tableY + 43, { width: cols.amountF - 6, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(7).text(moneyMinorLabel(currency), colXs[7] + 3, tableY + 58, { width: cols.amountF - 6, align: 'center' });

  for (let lineY = bodyTop + rowH; lineY < bodyBottom; lineY += rowH) {
    doc.dash(1.5, { space: 2 });
    doc.moveTo(tableX, lineY).lineTo(tableX + tableW, lineY).stroke();
    doc.undash();
  }

  const invoiceDate = formatDate(invoice.date);
  let totalPieces = 0;
  let totalWeight = 0;
  const maxRows = Math.floor((bodyBottom - bodyTop) / rowH);

  items.slice(0, maxRows).forEach((item, index) => {
    const productName = item.product_id ? productNames.get(item.product_id) : null;
    const description = productName?.name ?? (item.product_id ? `Product #${item.product_id}` : 'Counter item');
    const descriptionArabic = productArabicDescription(productName ?? null, description);
    const pieces = Number(item.pieces ?? 0);
    const weight = Number(item.weight ?? 0);
    const displayPrice = displayMoneyValue(item.price_per_kg, invoice);
    const displayAmount = displayMoneyValue(item.amount, invoice);
    const priceParts = splitMoney(displayPrice, currency);
    const amountParts = splitMoney(displayAmount, currency);
    const productType = description.toLowerCase();
    const beefQty = productType.includes('beef') ? formatAmount(weight, 2) : '';
    const muttonQty =
      productType.includes('mutton') || productType.includes('lamb')
        ? formatAmount(weight, 2)
        : '';
    const y = bodyTop + index * rowH + 8;

    totalPieces += pieces;
    totalWeight += weight;

    doc.font('Helvetica').fontSize(10).text(description, tableX + 8, y, {
      width: cols.desc - 16,
      align: 'left',
    });
    if (descriptionArabic) {
      doc.font('Arabic').fontSize(9).text(rtlVisual(descriptionArabic), tableX + 8, y + 8, {
        width: cols.desc - 16,
        align: 'right',
      });
    }
    doc.font('Helvetica').fontSize(10);
    doc.text(beefQty, colXs[1] + 3, y + 3, { width: cols.beef - 6, align: 'center' });
    doc.text(muttonQty, colXs[2] + 3, y + 3, { width: cols.mutton - 6, align: 'center' });
    doc.text(pieces ? String(pieces) : '', colXs[3] + 3, y + 3, { width: cols.qty - 6, align: 'center' });
    doc.text(priceParts.major, colXs[4] + 3, y + 3, { width: cols.unitK - 6, align: 'center' });
    doc.text(priceParts.minor, colXs[5] + 3, y + 3, { width: cols.unitF - 6, align: 'center' });
    doc.text(amountParts.major, colXs[6] + 3, y + 3, { width: cols.amountK - 6, align: 'center' });
    doc.text(amountParts.minor, colXs[7] + 3, y + 3, { width: cols.amountF - 6, align: 'center' });
  });

  const totalParts = splitMoney(displayMoneyValue(invoice.total, invoice), currency);
  doc.font('Helvetica-Bold').fontSize(11).text(`Total ${moneyMajorLabel(currency)}`, tableX + 8, bodyBottom + 12, {
    width: 95,
  });
  doc.font('Arabic').fontSize(10).text('المجموع فقط', colXs[4] + 2, bodyBottom + 9, {
    width: cols.unitK + cols.unitF - 4,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(12).text(totalParts.major, colXs[6] + 3, bodyBottom + 11, {
    width: cols.amountK - 6,
    align: 'center',
  });
  doc.text(totalParts.minor, colXs[7] + 3, bodyBottom + 11, {
    width: cols.amountF - 6,
    align: 'center',
  });

  doc.font('Helvetica-Bold').fontSize(10).text('Sign.', leftX + 14, 713, { width: 44 });
  doc.dash(1.5, { space: 2 });
  doc.moveTo(leftX + 58, 724).lineTo(leftX + 200, 724).stroke();
  doc.moveTo(320, 724).lineTo(502, 724).stroke();
  doc.undash();
  doc.font('Arabic').fontSize(10).text(rtlVisual('توقيع'), leftX + 202, 711, { width: 36, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(10).text('Receiver Sign.', 262, 713, { width: 78 });
  doc.font('Arabic').fontSize(10).text(rtlVisual('المستلم'), 506, 711, { width: 52, align: 'right' });
  doc.font('Arabic').fontSize(10).text(rtlVisual('توقيع'), 506, 723, { width: 52, align: 'right' });

  const previousBalance = Number(invoice.previous_balance ?? 0);
  const showPreviousBalance =
    invoice.include_previous_balance === true && previousBalance !== 0;

  if (showPreviousBalance) {
    const previousParts = splitMoney(displayMoneyValue(previousBalance, invoice), currency);
    const grandParts = splitMoney(displayMoneyValue(invoice.grand_total, invoice), currency);
    doc.font('Helvetica-Bold').fontSize(9).text('Previous Balance', 386, 710, {
      width: 86,
      align: 'right',
    });
    doc.text(`${previousParts.major}.${previousParts.minor}`, 476, 710, { width: 74, align: 'right' });
    doc.text('Total Bills', 386, 722, { width: 86, align: 'right' });
    doc.text(`${grandParts.major}.${grandParts.minor}`, 476, 722, { width: 74, align: 'right' });
  }

  if (items.length > maxRows) {
    doc.font('Helvetica').fontSize(8).text(`+${items.length - maxRows} more items`, tableX + 8, bodyBottom - 14, {
      width: 120,
    });
  }

  doc.end();
}
