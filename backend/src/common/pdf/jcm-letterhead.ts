import fs from 'node:fs';
import path from 'node:path';

export function getArabicFontPath() {
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
    path.join(__dirname, '../../assets/fonts/arabic.ttf'),
  ];

  return fontPaths.find((fontPath) => fs.existsSync(fontPath)) ?? fontPaths[0];
}

export function registerArabicFont(doc: PDFKit.PDFDocument) {
  const arabicFontPath = getArabicFontPath();

  if (fs.existsSync(arabicFontPath)) {
    doc.registerFont('Arabic', arabicFontPath);
  }
}

export function getJcmLetterheadPath() {
  const imagePaths = [
    path.join(process.cwd(), 'src/assets/letterheads/jcm-letterhead.jpeg'),
    path.join(process.cwd(), 'dist/assets/letterheads/jcm-letterhead.jpeg'),
    path.join(__dirname, '../../assets/letterheads/jcm-letterhead.jpeg'),
  ];

  return imagePaths.find((imagePath) => fs.existsSync(imagePath)) ?? null;
}

export function drawJcmLetterheadPage(doc: PDFKit.PDFDocument) {
  const letterheadPath = getJcmLetterheadPath();

  if (!letterheadPath) {
    return;
  }

  doc.image(letterheadPath, 0, 0, {
    width: doc.page.width,
    height: doc.page.height,
  });
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

export function drawCleanJcmFooter(doc: PDFKit.PDFDocument) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const footerTop = pageHeight - 102;
  const lineBlueY = footerTop + 7;
  const lineRedY = footerTop + 10;
  const textWidth = pageWidth - 40;

  doc.save();
  doc.rect(0, footerTop, pageWidth, pageHeight - footerTop).fill('#ffffff');

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
    .text('Shuwaikh Industrial Area 3, Block No.1, Street No.71, Building No.222, Shop No.06', 20, footerTop + 18, {
      width: textWidth,
      align: 'center',
      lineBreak: false,
    });

  doc
    .fillColor('#c01822')
    .font('Arabic')
    .fontSize(9)
    .text(rtlVisual('منطقة الشويخ الصناعية ٣، قطعة رقم ١، شارع رقم ٧١، مبنى رقم ٢٢٢، محل رقم ٠٦'), 20, footerTop + 32, {
      width: textWidth,
      align: 'center',
      lineBreak: false,
    });

  doc
    .fillColor('#1b2f6b')
    .font('Times-Roman')
    .fontSize(8.4)
    .text('javedmeatsupply@gmail.com', 20, footerTop + 52, {
      width: textWidth,
      align: 'center',
      lineBreak: false,
    });

  doc.restore();
}
