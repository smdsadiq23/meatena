import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { drawCleanJcmFooter, drawJcmLetterheadPage } from './jcm-letterhead';

export type StatementCurrency = 'KWD' | 'USD';

export type PartnerLedgerRow = {
  date: string;
  description: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
};

type PartnerLedgerPdfOptions = {
  filename: string;
  title?: string;
  partnerName: string;
  partnerAccount: string;
  startDate?: string;
  endDate?: string;
  rows: PartnerLedgerRow[];
  currency: StatementCurrency;
  kwdToUsdRate?: number;
  footerText?: string;
};

const page = {
  marginX: 22,
  headerTop: 34,
  tableX: 22,
  tableTopFirst: 255,
  tableTopNext: 132,
  tableBottom: 512,
  rowHeight: 22,
};

const tableWidth = 798;
const columns = [
  { key: 'date', label: 'ACCOUNTING DATE', x: 22, width: 132, align: 'left' as const },
  { key: 'description', label: 'DESCRIPTION', x: 154, width: 238, align: 'left' as const },
  { key: 'ref', label: 'REF', x: 392, width: 140, align: 'left' as const },
  { key: 'debit', label: 'DEBIT', x: 532, width: 88, align: 'right' as const },
  { key: 'credit', label: 'CREDIT', x: 620, width: 88, align: 'right' as const },
  { key: 'balance', label: 'BALANCE', x: 708, width: 112, align: 'right' as const },
];

function getArabicFontPath() {
  const fontPaths = [
    '/usr/share/fonts/google-noto/NotoSansArabic-Regular.ttf',
    '/usr/share/fonts/google-noto/NotoNaskhArabic-Regular.ttf',
    '/usr/share/fonts/google-noto-naskh-arabic/NotoNaskhArabic-Regular.ttf',
    '/usr/share/fonts/google-noto-sans-arabic/NotoSansArabic-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/Library/Fonts/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/GeezaPro.ttc',
    path.join(process.cwd(), 'src/assets/fonts/arabic.ttf'),
    path.join(process.cwd(), 'dist/assets/fonts/arabic.ttf'),
    path.join(__dirname, '../../assets/fonts/arabic.ttf'),
  ];

  return fontPaths.find((fontPath) => fs.existsSync(fontPath)) ?? fontPaths[0];
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

function normalizeDate(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function moneyValue(value: number | string, currency: StatementCurrency, rate = 3.25) {
  const kwd = Number(value ?? 0);
  return currency === 'USD' ? kwd * rate : kwd;
}

function formatMoney(value: number | string, currency: StatementCurrency, rate = 3.25) {
  const amount = moneyValue(value, currency, rate);
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: currency === 'KWD' ? 3 : 2,
    maximumFractionDigits: currency === 'KWD' ? 3 : 2,
  })} ${currency}`;
}

function drawText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: PDFKit.Mixins.TextOptions = {},
) {
  doc.text(text || '', x, y, {
    width,
    lineBreak: false,
    ellipsis: true,
    ...options,
  });
}

function drawPageHeader(doc: PDFKit.PDFDocument, options: PartnerLedgerPdfOptions) {
  drawJcmLetterheadPage(doc);

  doc
    .rect(page.tableX, 150, tableWidth, 22)
    .fillAndStroke('#0f8f8a', '#111827')
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(options.title ?? 'Partner Ledger', page.tableX, 154, {
      width: tableWidth,
      align: 'center',
      lineBreak: false,
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#4b5563')
    .text(`Partner's Account : ${options.partnerAccount}`, page.tableX, 194, {
      width: 330,
      lineBreak: false,
    })
    .text(`Start Date : ${options.startDate ?? '-'}`, page.tableX, 208, {
      width: 330,
      lineBreak: false,
    })
    .text('Target Moves : All Posted Entries', 420, 194, {
      width: 330,
      lineBreak: false,
    })
    .text(`End Date : ${options.endDate ?? '-'}`, 420, 208, {
      width: 330,
      lineBreak: false,
    });
}

function drawCompactHeader(doc: PDFKit.PDFDocument) {
  drawJcmLetterheadPage(doc);
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc
    .rect(page.tableX, y, tableWidth, 19)
    .fillAndStroke('#ffffff', '#374151')
    .fillColor('#111827')
    .font('Helvetica-Bold')
    .fontSize(8.5);

  columns.forEach((column) => {
    drawText(doc, column.label, column.x + 5, y + 5, column.width - 10, {
      align: column.align,
    });
  });

  let x = page.tableX;
  doc.strokeColor('#374151').lineWidth(0.8);
  columns.forEach((column) => {
    doc
      .moveTo(x, y)
      .lineTo(x, y + 19)
      .stroke();
    x += column.width;
  });
  doc.moveTo(page.tableX + tableWidth, y).lineTo(page.tableX + tableWidth, y + 19).stroke();
}

function drawPartnerRows(doc: PDFKit.PDFDocument, y: number, options: PartnerLedgerPdfOptions) {
  doc
    .rect(page.tableX, y, tableWidth, 26)
    .fillAndStroke('#ffffff', '#374151')
    .fillColor('#4b5563')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(options.partnerName.toUpperCase(), page.tableX + 5, y + 8, {
      width: tableWidth - 10,
      lineBreak: false,
    });

  doc
    .rect(page.tableX, y + 26, tableWidth, 22)
    .fillAndStroke('#f2eee7', '#374151')
    .fillColor('#374151')
    .fontSize(9)
    .text(options.currency, page.tableX + 5, y + 33, {
      width: tableWidth - 10,
      lineBreak: false,
    });
}

function drawRow(
  doc: PDFKit.PDFDocument,
  row: PartnerLedgerRow,
  y: number,
  options: PartnerLedgerPdfOptions,
) {
  doc.rect(page.tableX, y, tableWidth, page.rowHeight).fillAndStroke('#ffffff', '#4b5563');
  doc.fillColor('#4b5563').font('Helvetica').fontSize(8.5);

  drawText(doc, normalizeDate(row.date), columns[0].x + 5, y + 6, columns[0].width - 10);
  drawText(doc, row.description, columns[1].x + 5, y + 6, columns[1].width - 10);
  drawText(doc, row.ref, columns[2].x + 5, y + 6, columns[2].width - 10);
  drawText(
    doc,
    formatMoney(row.debit, options.currency, options.kwdToUsdRate),
    columns[3].x + 5,
    y + 6,
    columns[3].width - 10,
    { align: 'right' },
  );
  drawText(
    doc,
    formatMoney(row.credit, options.currency, options.kwdToUsdRate),
    columns[4].x + 5,
    y + 6,
    columns[4].width - 10,
    { align: 'right' },
  );
  drawText(
    doc,
    formatMoney(row.balance, options.currency, options.kwdToUsdRate),
    columns[5].x + 5,
    y + 6,
    columns[5].width - 10,
    { align: 'right' },
  );

  let x = page.tableX;
  doc.strokeColor('#4b5563').lineWidth(0.7);
  columns.forEach((column) => {
    doc.moveTo(x, y).lineTo(x, y + page.rowHeight).stroke();
    x += column.width;
  });
  doc.moveTo(page.tableX + tableWidth, y).lineTo(page.tableX + tableWidth, y + page.rowHeight).stroke();
}

function drawPreviousBalance(
  doc: PDFKit.PDFDocument,
  y: number,
  balance: number,
  options: PartnerLedgerPdfOptions,
) {
  doc.rect(page.tableX, y, tableWidth, 20).fillAndStroke('#ffffff', '#4b5563');
  doc
    .fillColor('#4b5563')
    .font('Helvetica-Oblique')
    .fontSize(9.5)
    .text('Previous Balance', page.tableX + 5, y + 5, {
      width: 300,
      lineBreak: false,
    })
    .fillColor('#dc2626')
    .font('Helvetica-BoldOblique')
    .text(formatMoney(balance, options.currency, options.kwdToUsdRate), page.tableX + tableWidth - 180, y + 5, {
      width: 172,
      align: 'right',
      lineBreak: false,
    });
}

function drawTotalRow(
  doc: PDFKit.PDFDocument,
  y: number,
  debitTotal: number,
  creditTotal: number,
  balance: number,
  options: PartnerLedgerPdfOptions,
) {
  doc.rect(page.tableX, y, tableWidth, 23).fillAndStroke('#ffffff', '#4b5563');
  doc
    .fillColor('#4b5563')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('TOTAL', page.tableX + 5, y + 7, { width: 220, lineBreak: false });

  drawText(doc, formatMoney(debitTotal, options.currency, options.kwdToUsdRate), columns[3].x + 5, y + 7, columns[3].width - 10, {
    align: 'right',
  });
  drawText(doc, formatMoney(creditTotal, options.currency, options.kwdToUsdRate), columns[4].x + 5, y + 7, columns[4].width - 10, {
    align: 'right',
  });
  drawText(doc, formatMoney(balance, options.currency, options.kwdToUsdRate), columns[5].x + 5, y + 7, columns[5].width - 10, {
    align: 'right',
    underline: true,
  });
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber: number, totalPages: number, _footerText?: string) {
  drawCleanJcmFooter(doc);
  const y = doc.page.height - 24;

  doc
    .fillColor('#4b5563')
    .font('Helvetica')
    .fontSize(8)
    .text(`Page: ${pageNumber} / ${totalPages}`, page.marginX, y, {
      width: tableWidth,
      align: 'center',
      lineBreak: false,
    });
}

function rowsPerPage(isFirstPage: boolean) {
  const top = isFirstPage ? page.tableTopFirst + 19 + 48 + 20 : page.tableTopNext + 19;
  return Math.max(1, Math.floor((page.tableBottom - top) / page.rowHeight));
}

export function generatePartnerLedgerPDF(options: PartnerLedgerPdfOptions, res: Response) {
  const doc = new PDFDocument({
    margin: 0,
    size: 'A4',
    layout: 'landscape',
    bufferPages: true,
  });
  const arabicFontPath = getArabicFontPath();
  if (fs.existsSync(arabicFontPath)) {
    doc.registerFont('Arabic', arabicFontPath);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${options.filename}`);
  doc.pipe(res);

  const firstRow = options.rows[0];
  const previousBalance = firstRow
    ? Number(firstRow.balance) - Number(firstRow.debit) + Number(firstRow.credit)
    : 0;
  const debitTotal = options.rows.reduce((sum, row) => sum + Number(row.debit), 0);
  const creditTotal = options.rows.reduce((sum, row) => sum + Number(row.credit), 0);
  const closingBalance = options.rows.at(-1)?.balance ?? previousBalance;
  const totalRows = options.rows.length;
  const firstPageRows = rowsPerPage(true);
  const nextPageRows = rowsPerPage(false);
  const totalPages =
    totalRows <= firstPageRows
      ? 1
      : 1 + Math.ceil((totalRows - firstPageRows) / nextPageRows);

  let rowIndex = 0;
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    if (pageNumber > 1) {
      doc.addPage();
    }

    const isFirstPage = pageNumber === 1;
    const currentRows = isFirstPage ? firstPageRows : nextPageRows;
    if (isFirstPage) {
      drawPageHeader(doc, options);
    } else {
      drawCompactHeader(doc);
    }

    let y = isFirstPage ? page.tableTopFirst : page.tableTopNext;
    drawTableHeader(doc, y);
    y += 19;

    if (isFirstPage) {
      drawPartnerRows(doc, y, options);
      y += 48;
      drawPreviousBalance(doc, y, previousBalance, options);
      y += 20;
    }

    for (let i = 0; i < currentRows && rowIndex < totalRows; i += 1) {
      drawRow(doc, options.rows[rowIndex], y, options);
      y += page.rowHeight;
      rowIndex += 1;
    }

    if (pageNumber === totalPages) {
      drawTotalRow(doc, y, debitTotal, creditTotal, closingBalance, options);
    }

    drawFooter(doc, pageNumber, totalPages, options.footerText);
  }

  doc.end();
}
