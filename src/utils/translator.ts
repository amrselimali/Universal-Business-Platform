/**
 * Smart Arabic-to-English Auto-Translation & Phonetic Transliteration Engine
 * Converts Arabic names, products, job titles, payment methods, and medical services into English.
 */

// Common direct dictionary mappings
const DICTIONARY: Record<string, string> = {
  // Medical & Clinical
  'كشف': 'Consultation',
  'استشارة': 'Specialist Consultation',
  'كشف استشاري': 'Consultant Examination',
  'جلسة': 'Session',
  'جلسات': 'Sessions',
  'ليزر': 'Laser',
  'علاج طبيعي': 'Physiotherapy',
  'عظام': 'Orthopedics',
  'جلدية': 'Dermatology',
  'تجميل': 'Aesthetics',
  'أسنان': 'Dental',
  'عيادة': 'Clinic',
  'مركز': 'Center',
  'حجز': 'Booking',
  'متابعة': 'Follow-up',
  'مريض': 'Patient',
  'عميل': 'Client / Customer',
  'مورد': 'Supplier / Vendor',
  'طبيب': 'Doctor',
  'دكتور': 'Dr.',
  'دكتورة': 'Dr.',
  'أخصائي': 'Specialist',
  'أخصائية': 'Specialist',
  'استشاري': 'Consultant',
  'تكنيشن': 'Technician',
  'فني': 'Technician',
  'فنية': 'Technician',
  'ممرض': 'Nurse',
  'ممرضة': 'Nurse',
  'استقبال': 'Receptionist',
  'محاسب': 'Accountant',
  'مدير': 'Manager',
  'كاشير': 'Cashier',
  'موظف': 'Employee',
  'أجهزة': 'Devices',
  'مستلزمات': 'Supplies',
  'جهاز': 'Device',
  'بلسات': 'Pulses',
  'نبضات': 'Pulses',
  'إزالة شعر بالليزر': 'Laser Hair Removal',
  'نضارة': 'Facial Glow / Hydrafacial',
  'فراكشنال': 'Fractional Laser',
  'حقن': 'Injection',
  'بوتوكس': 'Botox',
  'فيلر': 'Filler',
  'تقشير كيميائي': 'Chemical Peel',
  'تنظيف بشرة': 'Skin Cleansing / Facial',

  // Payment Methods
  'نقدي': 'Cash',
  'كاش': 'Cash',
  'فيزا': 'Visa / Card',
  'كارت': 'Card',
  'بطاقة ائتمان': 'Credit Card',
  'ماستركارد': 'Mastercard',
  'تحويل بنكي': 'Bank Transfer',
  'محفظة الكترونية': 'E-Wallet',
  'فودافون كاش': 'Vodafone Cash',
  'انستاباي': 'InstaPay',
  'شيك': 'Bank Check',
  'آجل': 'Credit / On Account',
  'تقسيط': 'Installments',

  // Lead Sources (عرفنا منين)
  'فيسبوك': 'Facebook Ads',
  'انستجرام': 'Instagram',
  'تيك توك': 'TikTok',
  'جوجل': 'Google Search',
  'ترشيح صديق': 'Friend Referral',
  'مرور بالصدفة': 'Walk-in',
  'لافتة المركز': 'Signboard',
  'طبيب محول': 'Doctor Referral',
};

// Common Arabic first & family names mapping
const ARABIC_NAMES: Record<string, string> = {
  'محمد': 'Mohamed',
  'أحمد': 'Ahmed',
  'احمد': 'Ahmed',
  'محمود': 'Mahmoud',
  'مصطفى': 'Mostafa',
  'علي': 'Ali',
  'على': 'Ali',
  'حسن': 'Hassan',
  'حسين': 'Hussein',
  'إبراهيم': 'Ibrahim',
  'ابراهيم': 'Ibrahim',
  'يوسف': 'Youssef',
  'عمر': 'Omar',
  'عمرو': 'Amr',
  'خالد': 'Khaled',
  'طارق': 'Tarek',
  'كريم': 'Karim',
  'حازم': 'Hazem',
  'ياسر': 'Yasser',
  'وائل': 'Wael',
  'سامح': 'Sameh',
  'أيمن': 'Ayman',
  'ايمن': 'Ayman',
  'رامي': 'Ramy',
  'هاني': 'Hany',
  'مروان': 'Marwan',
  'زياد': 'Ziad',
  'سيف': 'Seif',
  'شريف': 'Sherif',
  'وليد': 'Walid',
  'عادل': 'Adel',
  'هشام': 'Hesham',
  'ماجد': 'Maged',
  'أشرف': 'Ashraf',
  'اشرف': 'Ashraf',
  'عصام': 'Essam',
  'تامر': 'Tamer',
  'مدحت': 'Medhat',
  'علاء': 'Alaa',
  'سعيد': 'Saeed',
  'رضا': 'Reda',
  'نادر': 'Nader',
  'سامي': 'Samy',
  'عماد': 'Emad',
  'سارة': 'Sara',
  'ساره': 'Sara',
  'مريم': 'Maryam',
  'فاطمة': 'Fatima',
  'فاطمه': 'Fatima',
  'نور': 'Nour',
  'منى': 'Mona',
  'منار': 'Manar',
  'رنا': 'Rana',
  'هدى': 'Hoda',
  'دينا': 'Dina',
  'نهى': 'Noha',
  'ياسمين': 'Yasmin',
  'مي': 'May',
  'ميار': 'Mayar',
  'إسراء': 'Esraa',
  'اسراء': 'Esraa',
  'آية': 'Aya',
  'اية': 'Aya',
  'ريهام': 'Reham',
  'رانيا': 'Rania',
  'شيماء': 'Shaimaa',
  'هبة': 'Heba',
  'هبه': 'Heba',
  'أميرة': 'Amira',
  'اميرة': 'Amira',
  'ندى': 'Nada',
  'داليا': 'Dalia',
  'سلمى': 'Salma',
  'حنان': 'Hanan',
  'أمل': 'Amal',
  'امل': 'Amal',
  'إيمان': 'Eman',
  'ايمان': 'Eman',
  'زينب': 'Zeinab',
  'سلوى': 'Salwa',
  'جهاد': 'Gehad',
  'شهد': 'Shahd',
  'روان': 'Rawan',
  'فريدة': 'Farida',
  'ليلى': 'Laila',
  'حبيبة': 'Habiba',
  'نجلاء': 'Naglaa',
  'سمر': 'Samar',
  'شروق': 'Shorouk',
  'النجار': 'El-Naggar',
  'الشريف': 'El-Sherif',
  'القاضي': 'El-Kady',
  'الشناوي': 'El-Shenawy',
  'العوضي': 'El-Awady',
  'المصري': 'El-Masry',
  'السيد': 'El-Sayed',
  'الباز': 'El-Baz',
  'الحداد': 'El-Haddad',
  'عثمان': 'Osman',
  'منصور': 'Mansour',
  'توفيق': 'Tawfik',
  'فاروق': 'Farouk',
  'صلاح': 'Salah',
  'جمال': 'Gamal',
  'سالم': 'Salem',
  'عزام': 'Azzam',
  'غانم': 'Ghanem',
  'شحاتة': 'Shehata',
  'بدوي': 'Badawi',
  'متولي': 'Metwally',
  'جابر': 'Gaber',
  'عطية': 'Attia',
  'راضي': 'Rady',
  'سليمان': 'Soliman',
  'خميس': 'Khamis',
  'رمضان': 'Ramadan',
  'شعبان': 'Shaaban',
};

// Phonetic char mapping for unknown words
const CHAR_MAP: Record<string, string> = {
  'ا': 'a',
  'أ': 'a',
  'إ': 'e',
  'آ': 'aa',
  'ء': '',
  'ب': 'b',
  'ت': 't',
  'ث': 'th',
  'ج': 'g',
  'ح': 'h',
  'خ': 'kh',
  'د': 'd',
  'ذ': 'z',
  'ر': 'r',
  'ز': 'z',
  'س': 's',
  'ش': 'sh',
  'ص': 's',
  'ض': 'd',
  'ط': 't',
  'ظ': 'z',
  'ع': 'a',
  'غ': 'gh',
  'ف': 'f',
  'ق': 'q',
  'ك': 'k',
  'ل': 'l',
  'م': 'm',
  'ن': 'n',
  'ه': 'h',
  'ة': 'a',
  'و': 'w',
  'ؤ': 'o',
  'ي': 'y',
  'ى': 'a',
  'ئ': 'e',
};

function transliterateWord(word: string): string {
  if (!word) return '';

  // Clean punctuation
  const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');

  // Check direct dictionary
  if (DICTIONARY[cleanWord]) return DICTIONARY[cleanWord];
  if (ARABIC_NAMES[cleanWord]) return ARABIC_NAMES[cleanWord];

  // Handle prefix 'ال' (Al/El)
  if (cleanWord.startsWith('ال') && cleanWord.length > 3) {
    const sub = cleanWord.substring(2);
    if (ARABIC_NAMES['ال' + sub]) return ARABIC_NAMES['ال' + sub];
    if (ARABIC_NAMES[sub]) return 'El-' + ARABIC_NAMES[sub];
    return 'El-' + transliterateWord(sub);
  }

  // Handle 'عبد ' prefix
  if (cleanWord === 'عبد' || cleanWord === 'عبدالله' || cleanWord === 'عبدالرحمن') {
    if (cleanWord === 'عبدالله') return 'Abdullah';
    if (cleanWord === 'عبدالرحمن') return 'Abdelrahman';
    return 'Abdel';
  }

  // Letter by letter transliteration
  let result = '';
  for (let i = 0; i < cleanWord.length; i++) {
    const ch = cleanWord[i];
    const nextCh = cleanWord[i + 1];

    if (ch === 'و' && (i === 0 || nextCh === undefined)) {
      result += i === 0 ? 'W' : 'ou';
    } else if (ch === 'ي' && i > 0 && nextCh === undefined) {
      result += 'y';
    } else if (CHAR_MAP[ch] !== undefined) {
      result += CHAR_MAP[ch];
    } else {
      result += ch;
    }
  }

  if (result.length > 0) {
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

/**
 * Automatically translates or transliterates an Arabic string into high quality English
 */
export function autoTranslateArabic(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // If already predominantly Latin characters, return cleaned
  if (/^[a-zA-Z0-9\s\-._/]+$/.test(trimmed)) {
    return trimmed;
  }

  // Exact match from dictionary
  if (DICTIONARY[trimmed]) {
    return DICTIONARY[trimmed];
  }

  // Split into tokens
  const words = trimmed.split(/\s+/);
  const translatedWords = words.map((w) => {
    // Check direct dictionary first
    if (DICTIONARY[w]) return DICTIONARY[w];
    if (ARABIC_NAMES[w]) return ARABIC_NAMES[w];
    return transliterateWord(w);
  });

  return translatedWords.join(' ');
}
