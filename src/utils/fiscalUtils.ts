import QRCode from 'qrcode';

// Tafqeet in Arabic (تفقيط الأرقام وتحويلها إلى حروف باللغة العربية)
const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const teens = [
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];
const hundreds = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

function convertGroup(num: number): string {
  let result = '';
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const o = num % 10;

  if (h > 0) {
    result += hundreds[h];
  }

  if (t === 1) {
    if (result) result += ' و';
    result += teens[o];
  } else {
    if (o > 0) {
      if (result) result += ' و';
      result += ones[o];
    }
    if (t > 1) {
      if (result) result += ' و';
      result += tens[t];
    }
  }

  return result;
}

export function tafqeetArabic(amount: number, currency: 'EGP' | 'SAR' | 'USD' | 'AED' | string = 'EGP'): string {
  if (isNaN(amount) || amount === 0) {
    return 'صفر';
  }

  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);

  let parts: string[] = [];

  // Millions
  const millions = Math.floor(integerPart / 1000000);
  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroup(millions)} ملايين`);
    else parts.push(`${convertGroup(millions)} مليون`);
  }

  // Thousands
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroup(thousands)} آلاف`);
    else parts.push(`${convertGroup(thousands)} ألف`);
  }

  // Remainder
  const rem = integerPart % 1000;
  if (rem > 0) {
    parts.push(convertGroup(rem));
  }

  const mainText = parts.filter(Boolean).join(' و');

  // يتم تفقيط القيمة دائماً بالجنيه المصري (جنيه مصري / قرش) في التطبيق بالكامل حسب طلب المستخدم
  const currencyName = 'جنيه مصري';
  const subunitName = 'قرش';

  let finalPhrase = `فقط ${mainText || 'صفر'} ${currencyName}`;

  if (decimalPart > 0) {
    finalPhrase += ` و${convertGroup(decimalPart)} ${subunitName}`;
  }

  finalPhrase += ' لا غير';
  return finalPhrase;
}

/**
 * Generate ZATCA compliant TLV Base64 String for QR Code
 * Tag 1: Seller's Name
 * Tag 2: Seller's VAT Number (15 digits)
 * Tag 3: Invoice Timestamp (YYYY-MM-DDTHH:mm:ssZ)
 * Tag 4: Invoice Total (with VAT)
 * Tag 5: VAT Total
 */
export function generateZatcaTlvBase64(
  sellerName: string,
  vatNumber: string,
  timestamp: string,
  totalAmount: number,
  vatAmount: number
): string {
  const enc = new TextEncoder();

  const getTlv = (tagNum: number, value: string): Uint8Array => {
    const valBytes = enc.encode(value);
    const tagBytes = new Uint8Array([tagNum, valBytes.length]);
    const res = new Uint8Array(tagBytes.length + valBytes.length);
    res.set(tagBytes, 0);
    res.set(valBytes, tagBytes.length);
    return res;
  };

  const tag1 = getTlv(1, sellerName || 'Clinic/Center');
  const tag2 = getTlv(2, vatNumber || '300000000000003');
  const tag3 = getTlv(3, timestamp || new Date().toISOString());
  const tag4 = getTlv(4, (totalAmount || 0).toFixed(2));
  const tag5 = getTlv(5, (vatAmount || 0).toFixed(2));

  const totalLen = tag1.length + tag2.length + tag3.length + tag4.length + tag5.length;
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  [tag1, tag2, tag3, tag4, tag5].forEach((t) => {
    combined.set(t, offset);
    offset += t.length;
  });

  // Base64 encoding
  let binary = '';
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

/**
 * Generate QR Data URL from text or ZATCA TLV Base64
 */
export async function generateQrDataUrl(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 160,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}
