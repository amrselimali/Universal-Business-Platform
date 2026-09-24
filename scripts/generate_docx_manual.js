import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ShadingType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
} from 'docx';

// Colors
const COLOR_PRIMARY = '3730A3'; // Indigo 800
const COLOR_SECONDARY = '4F46E5'; // Indigo 600
const COLOR_ACCENT = '0D9488'; // Teal 600
const COLOR_TEXT = '1E293B'; // Slate 800
const COLOR_MUTED = '64748B'; // Slate 500
const COLOR_BG_LIGHT = 'F8FAFC'; // Slate 50
const COLOR_BORDER = 'E2E8F0'; // Slate 200

// Helper functions for Word elements
function createHeading1(textAr, textEn) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 150 },
      children: [
        new TextRun({
          text: textAr,
          bold: true,
          size: 32, // 16pt
          color: COLOR_PRIMARY,
          font: 'Calibri',
        }),
        new TextRun({
          text: ` | ${textEn}`,
          bold: true,
          size: 26,
          color: COLOR_SECONDARY,
          font: 'Calibri',
        }),
      ],
    }),
  ];
}

function createHeading2(textAr, textEn) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 250, after: 100 },
      children: [
        new TextRun({
          text: textAr,
          bold: true,
          size: 26, // 13pt
          color: COLOR_SECONDARY,
          font: 'Calibri',
        }),
        new TextRun({
          text: ` (${textEn})`,
          bold: false,
          size: 22,
          color: COLOR_MUTED,
          font: 'Calibri',
        }),
      ],
    }),
  ];
}

function createParagraph(arText, enText) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 320 },
    children: [
      new TextRun({
        text: arText + ' ',
        size: 22, // 11pt
        color: COLOR_TEXT,
        font: 'Calibri',
      }),
      new TextRun({
        text: `\n[EN] ${enText}`,
        italics: true,
        size: 19,
        color: COLOR_MUTED,
        font: 'Calibri',
      }),
    ],
  });
}

function createBullet(arText, enText) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 50, after: 50 },
    children: [
      new TextRun({
        text: arText + ' ',
        bold: true,
        size: 21,
        color: COLOR_TEXT,
        font: 'Calibri',
      }),
      new TextRun({
        text: `— ${enText}`,
        size: 19,
        color: COLOR_MUTED,
        font: 'Calibri',
      }),
    ],
  });
}

function createTable(rowsData) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
    },
    rows: rowsData.map((row, rIdx) => {
      const isHeader = rIdx === 0;
      return new TableRow({
        tableHeader: isHeader,
        children: row.map((cellText) => {
          return new TableCell({
            shading: {
              type: ShadingType.CLEAR,
              color: 'auto',
              fill: isHeader ? COLOR_PRIMARY : rIdx % 2 === 1 ? COLOR_BG_LIGHT : 'FFFFFF',
            },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [
              new Paragraph({
                alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: cellText,
                    bold: isHeader,
                    size: isHeader ? 20 : 19,
                    color: isHeader ? 'FFFFFF' : COLOR_TEXT,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          });
        }),
      });
    }),
  });
}

async function buildDocx() {
  const doc = new Document({
    creator: 'Enterprise Solution Architect & Lead Developer',
    title: 'Universal ERP Platform - Comprehensive User Manual & Technical Architecture',
    description: 'Bilingual Complete User Manual, Business Workflows, and Engineering Blueprint',
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Universal ERP Platform | دليل المستخدم والتوثيق التقني الشامل',
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Page / صفحة ',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Cover Title Block
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 800, after: 200 },
            children: [
              new TextRun({
                text: 'منصة إدارة الأعمال والمراكز الشاملة',
                bold: true,
                size: 48, // 24pt
                color: COLOR_PRIMARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 300 },
            children: [
              new TextRun({
                text: 'UNIVERSAL ERP BUSINESS & CLINIC PLATFORM',
                bold: true,
                size: 32, // 16pt
                color: COLOR_SECONDARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 600 },
            children: [
              new TextRun({
                text: 'الدليل التشغيلي الإرشادي للمستخدم البسيط والتوثيق المعماري الهندسي الكامل (ثنائي اللغة: عربي / إنجليزي)\nComprehensive Beginner-to-Expert User Manual & Full Technical Architecture Blueprint',
                size: 22,
                italics: true,
                color: COLOR_MUTED,
                font: 'Calibri',
              }),
            ],
          }),

          // Metadata Table
          createTable([
            ['البند / Item', 'التفاصيل باللغة العربية', 'English Specification'],
            ['اسم النظام / System Name', 'منصة إدارة الأعمال والمراكز (Universal ERP)', 'Universal Business & Clinic ERP Platform'],
            ['الإصدار / Version', 'الإصدار الماسي 1.01 (Enterprise Release)', 'Version 1.01 Enterprise Cloud Edition'],
            ['لغة البرمجة / Programming Language', 'تايب سكريبت بالكامل (TypeScript 5.8)', '100% Strict Typed TypeScript 5.8'],
            ['بيئة التشغيل / Runtime Engine', 'نود جي إس (Node.js 22 LTS / ESM Engine)', 'Node.js 22 LTS Engine & Native ESM'],
            ['قاعدة البيانات / Database Architecture', 'نيون بوستجريس السحابية (Neon Serverless PostgreSQL)', 'Neon Serverless PostgreSQL (ACID & Scale-to-Zero)'],
            ['واجهة المستخدم / Frontend Architecture', 'رياكت 19 + تايلويند 4 + موشن + فيت 6', 'React 19, Tailwind CSS v4, Vite 6, Motion'],
            ['تعدد الشركات والفروع / Multi-Tenancy', 'عزل منطقي كامل للشركات والفروع والمستودعات', 'Hierarchical Multi-Tenant / Multi-Branch Isolation'],
            ['مستوى الأمان والرقابة / Security & Audit', 'مصفوفة أدوار 8 رتب وسجل رقابة لحظي لا يُمحى', '8-Level RBAC Matrix + Immutable Audit Trail'],
          ]),

          new Paragraph({ children: [new PageBreak()] }),

          // CHAPTER 1: TECHNICAL ARCHITECTURE & STACK
          ...createHeading1('الفصل الأول: المعمارية التقنية ومواصفات النظام الكاملة', 'Chapter 1: Technical Architecture & System Specifications'),
          createParagraph(
            'تم بناء هذه المنصة بأحدث المعايير الهندسية العالمية للأنظمة السحابية الموزعة (Cloud-Native Enterprise Architecture)، وتجمع بين الأداء الفائق والسهولة المطلقة في الاستخدام مع عزل بيانات الشركات والفروع.',
            'This platform is engineered using modern cloud-native distributed architecture, delivering high throughput, intuitive user experience, and robust multi-tenant data segregation.'
          ),

          ...createHeading2('1.1 الواجهة الأمامية وتجربة المستخدم (Frontend Stack)', '1.1 Frontend Stack & UX'),
          createBullet('React 19 & TypeScript 5.8:', 'الاعتماد الكامل على أحدث إصدارات رياكت والمكونات الوظيفية والـ Hooks المتخصصة مع الفحص الصارم للأخطاء وتفادي مشاكل الـ Runtime.'),
          createBullet('Vite 6 Fast Bundler:', 'محرك بناء سريع جداً يضمن سرعة التحميل وتصفح الشاشات بلمح البصر دون أي بطء أو تجميد.'),
          createBullet('Tailwind CSS v4 Engine:', 'تصميم عصري متجاوب بنسبة 100% مع الهواتف الذكية، الأجهزة اللوحية (Tablets)، وشاشات الكاشير والشاشات العريضة بدقة فائقة.'),
          createBullet('دعم ثنائي اللغة كامل (RTL / LTR):', 'المنصة تدعم العربية والإنجليزية بتبديل فوري بضغطة زر واحدة دون إعادة تحميل الصفحة، مع اتجاه كتابة وتنسيق كامل للغة العربية (RTL).'),
          createBullet('Recharts Visualizations:', 'رسوم بيانية تفاعلية حية لحركة الإيرادات، المبيعات اليومية، والمصروفات وتحليلات المخزون.'),

          ...createHeading2('1.2 الباك إند والخدمات البرمجية (Backend & API Engine)', '1.2 Backend & APIs'),
          createBullet('Express.js Micro-Architecture:', 'طبقة خدمات متكاملة وسريعة تعمل كوسيط آمن بين واجهة المستخدم وقاعدة البيانات السحابية.'),
          createBullet('Node Native ESM & CommonJS Bundling:', 'استخدام esbuild لدمج السيرفر في حزمة واحدة ذاتية التشغيل لتسريع بدء تشغيل الحاويات (Container Cold-Start < 500ms).'),
          createBullet('Universal UUID v4 Primary Keys:', 'تطبيق معيار المعرفات الفريدة عالمياً (RFC 4122) لكافة السجلات المالية والتشغيلية لتفادي أي تعارض في أرقام القيود أو الفواتير.'),

          ...createHeading2('1.3 قاعدة البيانات وحفظ البيانات (Database & Persistence)', '1.3 Database Architecture'),
          createParagraph(
            'تعتمد المنصة على قاعدة بيانات Neon Serverless PostgreSQL السحابية المتطورة مع خاصية العمل المزدوج (Cloud & Local Fallback).',
            'The platform leverages Neon Serverless PostgreSQL with dual-tier offline-resilient local caching.'
          ),
          createBullet('Neon Serverless PostgreSQL 16+:', 'قاعدة بيانات سحابية حقيقية تدعم العمليات المالية المتزامنة والـ ACID Transactions الكاملة.'),
          createBullet('Scale-to-Zero Cost Optimization:', 'توفير التكاليف بتعليق المعالجة تلقائياً عند عدم وجود مستخدمين، واستئنافها الفوري في أقل من 500 ملي ثانية.'),
          createBullet('Local Storage Fallback & Offline Mode:', 'في حالة انقطاع الإنترنت أو عدم إدخال مفتاح نيون، تعمل المنصة بكفاءة 100% محلياً على المتصفح دون توقف الكاشير أو المبيعات، مع إمكانية الترحيل السحابي بضغطة زر.'),
          createBullet('Neon Hub Sync & Migration:', 'شاشة مخصصة (Neon Cloud Database Hub) لفحص سلامة الاتصال، تهيئة الجداول بضغطة زر، وإعادة توليد البيانات التجريبية بمرونة.'),

          ...createHeading2('1.4 إمكانيات التوسع والنمو المستقبلي (Scalability & Extensibility)', '1.4 Scalability & Future Growth'),
          createBullet('Multi-Tenant & Multi-Branch:', 'الهيكل الهرمي للنظام: المؤسسة (Tenant) -> الفروع (Branches) -> المستودعات (Warehouses) -> نقاط البيع والخزن (POS & Cash Drawers).'),
          createBullet('Modular Architecture (Modules Switcher):', 'شاشة تفعيل الموديولات تتيح للمؤسسة إظهار أو إخفاء أي موديول (نقاط البيع، العيادات، الرواتب، أجهزة الليزر، أذونات المخازن) بضغطة زر دون المساس باستقرار الكود.'),
          createBullet('ZATCA Ready Architecture:', 'بنية الفواتير الضريبية مهيأة للربط والتكامل مع هيئة الزكاة والضريبة والجمارك (الفاتورة الإلكترونية المرحلة الثانية) وتوليد كود الـ QR المشفر.'),

          new Paragraph({ children: [new PageBreak()] }),

          // CHAPTER 2: BEGINNER'S GUIDE & HEADER NAVIGATION
          ...createHeading1('الفصل الثاني: دليل المستخدم المبتدئ - كيف تبدأ من الصفر', "Chapter 2: Beginner's Onboarding Guide"),
          createParagraph(
            'هذا الفصل مخصص للمستخدم الذي لا يملك أي خبرة سابقة في الأنظمة المحاسبية أو برامج الحاسوب. نشرح لك خطوة بخطوة كيف تسجل الدخول، وكيف تفهم الشاشة من النظرة الأولى.',
            'This chapter guides a completely non-technical user step-by-step from initial login to mastering top header controls and screen navigation.'
          ),

          ...createHeading2('2.1 تسجيل الدخول وتبديل الحسابات (Login & Authentication)', '2.1 Login & Authentication'),
          createParagraph(
            'عند فتح التطبيق لأول مرة، ستظهر لك شاشة الدخول الاحترافية. يمكنك الدخول بالحساب التجريبي الرئيسي أو بأي حساب وظيفي آخر:',
            'When launching the app, the secure login screen appears. You can sign in using default credentials or any assigned user role:'
          ),
          createTable([
            ['الدور الوظيفي / Role', 'اسم المستخدم / Username', 'كلمة المرور / Password', 'الصلاحيات / Access Level'],
            ['مدير النظام الشامل (Admin)', 'admin', 'admin123', 'صلاحيات مطلقة لكافة الشاشات والإعدادات والشركات'],
            ['مدير الفرع (Manager)', 'sarah', 'sarah123', 'إدارة الفرع المعين، التقارير، والعمليات والموظفين'],
            ['المحاسب المالي (Accountant)', 'khaled', 'khaled123', 'القيود المحاسبية، السندات، الضرائب، والقوائم المالية'],
            ['كاشير المبيعات (Cashier)', 'nora', 'nora123', 'شاشة نقطة البيع السريعة POS وإصدار الفواتير فقط'],
            ['موظف الاستقبال (Reception)', 'reception', 'rec123', 'حجوزات المرضى، شاشة التشغيل، وجلسات الليزر'],
            ['طبيب / أخصائي (Doctor)', 'dr_ahmed', 'doc123', 'الملفات الطبية، خطط العلاج، وحجوزات العيادة'],
            ['أمين المستودع (Storekeeper)', 'tariq', 'tariq123', 'أذونات الاستلام والصرف المخزني والجرد الفعلي'],
          ]),

          ...createHeading2('2.2 شريط الأدوات العلوي (Top Header Controls)', '2.2 Top Header Controls'),
          createParagraph(
            'الشريط العلوي موجود دائماً في أعلى الشاشة ويوفر لك معلومات حيوية وأزراراً سريعة:',
            'The persistent top header gives instant operational context and rapid actions across all views:'
          ),
          createBullet('مبدل المؤسسات والشركات (Company Switcher):', 'يعرض اسم الشركة الحالية. إذا كان لديك أكثر من شركة، اضغط على القائمة المنسدلة لاختيار الشركة التي تريد العمل عليها فوراً.'),
          createBullet('مبدل الفروع (Branch Switcher):', 'أيقونة التفرع تتيح لك اختيار الفرع (مثل: فرع الرياض، فرع جدة، فرع الخبر) لعرض عملياته فقط.'),
          createBullet('مبدل المستودعات (Warehouse Switcher):', 'أيقونة المستودع تتيح لك تحديد المخزن النشط الذي سيتم الصرف أو الاستلام منه تلقائياً.'),
          createBullet('شارة شيفت الكاشير النشط (Active POS Shift):', 'تظهر نقطة خضراء نابضة إذا كانت هناك وردية كاشير مفتوحة، وبالضغط عليها تنتقل مباشرة لنقطة البيع.'),
          createBullet('مؤشر قاعدة بيانات نيون (Neon DB Badge):', 'يظهر كلمة (متصل) باللون الأخضر/السماوي عند الاتصال السحابي، أو (محلي) باللون الكهرماني عند العمل دون إنترنت.'),
          createBullet('زر نقطة البيع السريع (Fast POS):', 'زر بارز بنفسجي ينقلك مباشرة لنقطة البيع (ويمكنك الضغط على زر F2 من لوحة المفاتيح).'),
          createBullet('ملف المستخدم وزر تسجيل الخروج (User Profile & Logout):', 'يعرض اسمك ودورك، وبجانبه زر أحمر لتسجيل الخروج بأمان عند انتهاء نوبة عملك.'),
          createBullet('زر تبديل اللغة (English / عربي):', 'يغير لغة البرنامج بالكامل وفوراً بين العربية والإنجليزية دون فقدان أي بيانات.'),

          new Paragraph({ children: [new PageBreak()] }),

          // CHAPTER 3: SCREEN BY SCREEN & BUTTON GUIDE
          ...createHeading1('الفصل الثالث: دليل الشاشات والأزرار خطوة بخطوة', 'Chapter 3: Screen-by-Screen & Button Functionality Guide'),
          createParagraph(
            'في هذا الفصل، نشرح كل شاشة من شاشات النظام، وما هي وظيفتها، وماذا يفعل كل زر فيها بالتفصيل الدقيق.',
            'This chapter documents every application screen, its functional purpose, and the exact action executed by every button and control.'
          ),

          ...createHeading2('3.1 شاشة لوحة التحكم والتحليلات (Dashboard & Analytics)', '3.1 Dashboard & Analytics'),
          createParagraph(
            'هي الشاشة الرئيسية التي تفتح تلقائياً وتمنحك ملخصاً حياً لأداء المنشأة المالي والتشغيلي.',
            'The central executive command center presenting live financial and operational indicators.'
          ),
          createBullet('بطاقات مؤشرات الأداء (KPI Cards):', 'تعرض إجمالي المبيعات اليومية، فواتير الشهر، عدد العملاء الجدد، ورصيد الخزينة المتاح.'),
          createBullet('زر فتح نقطة البيع السريعة:', 'ينقلك لصفحة الكاشير لبيع الأصناف والخدمات فوراً.'),
          createBullet('زر فتح سجل الفواتير:', 'ينقلك لقائمة فواتير المبيعات للبحث أو الطباعة.'),
          createBullet('رسوم بيانية حية:', 'رسم بياني يوضح مقارنة الإيرادات بالمصروفات شهرياً، وتوزيع المبيعات حسب التصنيفات.'),

          ...createHeading2('3.2 شاشة التشغيل اليومي وجلسات الليزر (Operations Run-Sheet)', '3.2 Operations Run-Sheet'),
          createParagraph(
            'شاشة مصممة خصيصاً للمراكز والعيادات لمتابعة تدفق العملاء والمرضى منذ لحظة دخولهم حتى مغادرتهم.',
            'Specialized clinical flow dashboard tracking patient journey from check-in to laser session completion.'
          ),
          createBullet('زر [تسجيل دخول مراجع جديد]:', 'يفتح نافذة لاختيار العميل، واختيار الخدمة أو الجلسة، وتوجيهه إلى غرفة العيادة المناسبة.'),
          createBullet('أعمدة مراحل المراجعين:', 'ثلاثة أعمدة ديناميكية: (في الانتظار -> في غرفة الجلسة / قيد التنفيذ -> تم الانتهاء والمغادرة).'),
          createBullet('زر [بدء الجلسة]:', 'ينقل حالة العميل إلى داخل غرفة الليزر أو العيادة ويبدأ احتساب وقت الجلسة.'),
          createBullet('زر [إنهاء الجلسة وتسجيل الفاتورة]:', 'يغلق الجلسة وينقل المراجع إلى مرحلة الدفع وتوليد الفاتورة في نقطة البيع.'),
          createBullet('زر [دليل أجهزة ومعدات الليزر]:', 'ينقلك لشاشة إدارة الأجهزة وجدول الصيانة وعداد الضربات (Pulses/Shots Count).'),

          ...createHeading2('3.3 شاشة نقطة البيع السريعة (Point of Sale - POS)', '3.3 Point of Sale - POS'),
          createParagraph(
            'شاشة الكاشير السريعة لإتمام عمليات البيع في ثوانٍ معدودة مع دعم أجهزة اللمس والباركود واختصارات الكيبورد (F2).',
            'High-velocity cashier interface engineered for barcode scanning, touchscreens, and split payments.'
          ),
          createBullet('زر [فتح وردية كاشير جديدة]:', 'يطلب إدخال العهدة النقدية الافتتاحية (Opening Float) لبدء البيع وتسجيل حركات الوردية باسم المستخدم.'),
          createBullet('شريط البحث وقارئ الباركود:', 'يمكنك كتابة اسم الصنف أو مسح الباركود ليضاف المنتج مباشرة إلى سلة المشتريات.'),
          createBullet('أزرار المجموعات البيعية السريعة:', 'تصنيفات ملونة (خدمات، منتجات تجارية، باقات وعروض) لسهولة الاختيار باللمس.'),
          createBullet('أزرار تعديل الكمية (+ / -) وحذف السطر:', 'تعديل الكميات المطلوبة في السلة أو حذف صنف تم إدخاله بالخطأ.'),
          createBullet('خانة خصم الفاتورة (Discount):', 'إمكانية إدخال خصم كنسبة مئوية (%) أو كمبلغ مقطوع مع احتساب الضريبة تلقائياً.'),
          createBullet('زر [الدفع والسداد المالي]:', 'يفتح نافذة السداد متعدد الطرق (نقداً، مدى، فيزا، بطاقة ائتمان، آجل، أو خصم من رصيد باقة العميل).'),
          createBullet('زر [طباعة الفاتورة الفورية]:', 'توليد فاتورة ضريبية رسمية مبسطة مع كود الاستجابة السريع QR المتوافق مع متطلبات الفاتورة الإلكترونية.'),
          createBullet('زر [إقفال وردية الكاشير - End Shift]:', 'حساب إجمالي المبيعات، ومقارنة النقدية الفعلية بالمحسوبة في النظام لإظهار أي عجز أو زيادة وترحيل الشيفت.'),

          ...createHeading2('3.4 شاشة فواتير المبيعات (Sales Invoices Log)', '3.4 Sales Invoices Log'),
          createBullet('شريط التصفية والبحث:', 'البحث برقم الفاتورة، اسم العميل، رقم الجوال، أو التاريخ وحالة السداد (مدفوعة، مسودة، ملغاة).'),
          createBullet('زر [عرض تفاصيل الفاتورة]:', 'يفتح لقطة كاملة للأصناف المباعة، الضرائب، طريقة الدفع، والفرع الصادرة منه.'),
          createBullet('زر [طباعة الفاتورة]:', 'إعادة طباعة الفاتورة الضريبية في أي وقت بدقة عالية.'),
          createBullet('زر [إلغاء / استرجاع الفاتورة]:', 'إلغاء الفاتورة وإعادة البضاعة للمخزن وقيد إشعار دائن (Credit Note) إذا سمحت الصلاحية.'),

          ...createHeading2('3.5 شاشة سندات القبض والصرف النقدية (Cash Receipts & Payments)', '3.5 Fiscal Cash Vouchers'),
          createParagraph(
            'إدارة كافة المقبوضات والمدفوعات خارج إطار فواتير البيع المباشرة (مثل: تحصيل ديون العملاء، سداد الموردين، والمصروفات النثرية).',
            'Financial cash flow instruments managing receivables collections, supplier settlements, and operating expenses.'
          ),
          createBullet('زر [سند قبض جديد]:', 'تسجيل مبلغ مقبوض نقداً أو بالبنك من عميل أو إيراد متنوع مع تحديد الحساب الدائن والمدين وترحيل القيد آلياً.'),
          createBullet('زر [سند صرف جديد]:', 'تسجيل مصروف إيجار، فواتير كهرباء، دفعات موردين، أو سلف موظفين مع طباعة السند وتوقيعه.'),
          createBullet('زر [اعتماد وترحيل السند]:', 'يقوم بتثبيت السند وإنشاء قيد اليومية المحاسبي المزدوج في دفتر الأستاذ العام تلقائياً.'),

          ...createHeading2('3.6 شاشة أذونات الاستلام والصرف المخزني (Goods Receipts & Issues)', '3.6 Goods Receipts & Issues'),
          createBullet('زر [إذن استلام مخزني جديد - GRN]:', 'إدخال بضائع مشتراة من مورد إلى مستودع معين، مع تسجيل كمياتها وتكلفتها لزيادة رصيد المستودع.'),
          createBullet('زر [إذن صرف مخزني جديد - GIN]:', 'صرف مواد مستهلكة للعيادات، أو مواد تالفة، أو عينات مع خصمها التلقائي من رصيد المستودع.'),
          createBullet('زر [ترحيل الإذن المخزني]:', 'تحديث كميات الأصناف في المخزن فوراً وتوليد قيود المخزون وحساب المشتريات/المصروفات.'),

          ...createHeading2('3.7 شاشة إدارة المنتجات والخدمات (Products & Services Management)', '3.7 Products & Services Management'),
          createBullet('زر [صنف بيعي جديد]:', 'إضافة صنف جديد مع تحديد الاسم، الكود SKU، سعر الشراء، سعر البيع، نسبة الضريبة، والمجموعة البيعية.'),
          createBullet('زر [مجموعة جديدة]:', 'إنشاء تصنيف جديد (مثل: عيادة الجلدية، منتجات العناية، جلسات الليزر).'),
          createBullet('ودجت تنبيهات نقص المخزون التلقائي:', 'شريط أعلى الشاشة يراقب الأصناف التي وصلت إلى حد الطلب أو نفدت ويقترح الكميات الواجب شراؤها.'),
          createBullet('زر [تنبيهات نقص المخزون]:', 'زر تصفية سريع يفلتر الجدول لعرض الأصناف المحتاجة للتوريد فقط بضغطة واحدة.'),
          createBullet('زر [ضبط حد الطلب]:', 'موجود بجانب كل صنف لتحديد نقطة التنبيه التلقائي (مثل: التنبيه عند وصول الرصيد إلى 5 وحدات).'),
          createBullet('زر [حذف الصنف البيعي]:', 'يفتح نافذة تأكيد آمنة تحتوي على اسم الصنف وكوده وسعره للتأكيد قبل الحذف النهائي مع قيد الحركة في سجل التدقيق.'),

          ...createHeading2('3.8 شاشة إدارة المخازن والجرد الفعلي (Warehouse & Stocktaking)', '3.8 Warehouse & Stocktaking'),
          createBullet('زر [إضافة مستودع جديد]:', 'تعريف مستودع جديد وتعيينه لفرع معين وأمين مستودع مسؤول.'),
          createBullet('زر [بدء جلسة جرد مخزني]:', 'تجميد رصيد المخزن دفترياً لإدخال الكميات الفعلية الموجودة على الأرفف.'),
          createBullet('زر [احتساب فروقات الجرد]:', 'مقارنة الكميات الفعلية بالدفتري وإظهار العجز (Deficit) أو الزيادة (Surplus).'),
          createBullet('زر [اعتماد وترحيل تسوية الجرد]:', 'تعديل الأرصدة الدفترية لتطابق الواقع وتوليد قيد أرباح/خسائر فروقات الجرد المحاسبي.'),

          ...createHeading2('3.9 شاشات العملاء والموردين والكوادر والرواتب', '3.9 CRM, Vendors, Staff & Payroll'),
          createBullet('إدارة العملاء (Parties):', 'تسجيل بيانات العميل، رقم الهوية، رصيد الحساب، كشف حساب العميل، وسجل الباقات والزيارات.'),
          createBullet('إدارة الموردين (Suppliers):', 'أرصدة الموردين، فواتير الشراء المستحقة، وسجل المدفوعات والشيكات.'),
          createBullet('إدارة الموظفين (Staff):', 'ملفات الكادر الطبي والإداري، المسميات الوظيفية، نسب العمولات، ومواعيد الدوام.'),
          createBullet('مسير الرواتب (Payroll):', 'توليد مسير الرواتب الشهري آلياً، احتساب الراتب الأساسي والبدلات، إضافة العمولات وخصم السلف والغياب مع زر الاعتماد والترحيل.'),

          ...createHeading2('3.10 شاشة إدارة الحسابات العامة (Accounting & Chart of Accounts)', '3.10 Accounting & Chart of Accounts'),
          createBullet('دليل الحسابات الشجري (Chart of Accounts):', 'تصنيف الحسابات إلى (أصول، خصوم، حقوق ملكية، إيرادات، مصروفات) مع ترقيم محاسبي قياسي.'),
          createBullet('سجل قيود اليومية (Journal Entries):', 'عرض كافة القيود المولدة آلياً من المبيعات والمخازن أو إضافة قيود تسوية يدوية مزدوجة متزنة (مدين = دائن).'),
          createBullet('ميزان المراجعة (Trial Balance):', 'ميزان مراجعة بالأرصدة والمجاميع للتأكد من توازن كافة الحسابات.'),
          createBullet('القوائم المالية الختامية:', 'قائمة الدخل (الأرباح والخسائر) والميزانية العمومية بضغطة زر مع مقارنات الفترات المالية.'),

          ...createHeading2('3.11 شاشات الرقابة وسجلات النشاط (Audit Trail & Activity Logs)', '3.11 Audit Trail & Activity Logs'),
          createBullet('سجل الرقابة والمحذوفات (Audit Trail):', 'يسجل كل حركة إضافة أو تعديل أو حذف أو أرشفة مع إظهار القيم قبل التعديل وبعد التعديل واسم المستخدم وتاريخ ووقت العملية بدقة.'),
          createBullet('سجل نشاط المستخدمين (User Activity Log):', 'متابعة لحظية لدخول وخروج الموظفين وتنقلهم بين الشاشات والعمليات التي أجروها.'),

          ...createHeading2('3.12 إدارة الشركات والفروع وخزينة الأرشيف الآمن', '3.12 Companies, Branches & Archive Vault'),
          createBullet('زر [شركة جديدة]:', 'إضافة مؤسسة أو شركة تابعة جديدة ضمن نفس المنصة.'),
          createBullet('زر [إضافة فرع جديد]:', 'تأسيس فرع جديد وربطه بالشركة وتحديد موقعه وأرقام التواصل والضريبة.'),
          createBullet('زر [خزينة الأرشيف الآمن - Archive Vault]:', 'شريط علوي بارز ينقلك لخزينة الأرشيف لعرض الفروع والشركات والمستودعات المحذوفة مؤقتاً واستعادتها بضغطة زر واحدة دون فقدان أي بيانات تاريخية.'),

          ...createHeading2('3.13 شاشة المستخدمين وتحديد الصلاحيات (Users & Permissions)', '3.13 Users & Permissions'),
          createBullet('زر [مستخدم جديد]:', 'إنشاء حساب موظف جديد وتحديد اسم الدخول وكلمة المرور واختيار الدور والصلاحية.'),
          createBullet('زر [تعديل الصلاحيات]:', 'تغيير كلمة المرور أو تعديل الصلاحيات الممنوحة للشاشات.'),
          createBullet('زر [حذف المستخدم]:', 'يفتح نافذة تأكيد مخصصة داخل التطبيق لحماية الحساب من الحذف العرضي، مع إشعار نجاح فوري وتسجيل الحركة في سجل الرقابة.'),

          new Paragraph({ children: [new PageBreak()] }),

          // CHAPTER 4: WORKFLOWS & POSTING CYCLES
          ...createHeading1('الفصل الرابع: دورات العمل ودورات الترحيل المحاسبي والمخزني', 'Chapter 4: Business Workflows & Automated Posting Lifecycles'),
          createParagraph(
            'يشرح هذا الفصل الدورات المستندية الكاملة وكيف تتحرك البيانات تلقائياً بين الشاشات والقيود المحاسبية دون الحاجة لتدخل يدوي.',
            'Detailed documentary cycles illustrating automatic ledger and inventory posting triggered across business transactions.'
          ),

          ...createHeading2('4.1 دورة المبيعات السريعة وفاتورة الكاشير (POS Sales Posting Cycle)', '4.1 POS Sales & Cashier Cycle'),
          createParagraph(
            'الخطوات العملية لدورة البيع من البداية حتى الترحيل النهائي:',
            'The end-to-end sales lifecycle from cart building to automated general ledger and stock deduction:'
          ),
          createBullet('الخطوة 1 - فتح الوردية:', 'يقوم الكاشير بفتح وردية وإدخال العهدة النقدية -> ينشأ سجل وردية بحالة (مفتوح).'),
          createBullet('الخطوة 2 - مسح الأصناف والخدمات:', 'يختار الكاشير الخدمات أو المنتجات -> يحتسب النظام السعر الإجمالي والخصم وضريبة القيمة المضافة (15% VAT) تلقائياً.'),
          createBullet('الخطوة 3 - سداد الفاتورة:', 'يختار طريقة الدفع (نقد، مدى، آجل) -> عند الضغط على تأكيد الدفع تحدث 3 عمليات تلقائية فورية:'),
          createBullet('  أ) الترحيل المخزني:', 'إذا كان الصنف منتجاً مخزنياً، يتم خصم الكمية المباعة فوراً من رصيد المستودع المعين للفرع.'),
          createBullet('  ب) الترحيل المالي الآلي:', 'ينشأ قيد يومية محاسبي مزدوج تلقائي:'),
          createBullet('     - من حـ/ الخزينة أو البنك (مدين بالصافي المقبوض) أو حـ/ العملاء في البيع الآجل.', 'Debit: Cash / Bank or Accounts Receivable.'),
          createBullet('     - إلى حـ/ إيرادات المبيعات والخدمات (دائن بقيمة المبيعات قبل الضريبة).', 'Credit: Sales Revenue Account.'),
          createBullet('     - إلى حـ/ ضريبة القيمة المضافة المستحقة (دائن بقيمة ضريبة الـ 15%).', 'Credit: Output VAT Payable Account.'),
          createBullet('  ج) إقفال الوردية والتسليم:', 'عند نهاية الدوام، يقفل الكاشير الوردية ويدخل النقدية الفعلية -> يتم مقارنة العهدة والمبيعات وتوليد تقرير العجز/الزيادة.'),

          ...createHeading2('4.2 دورة المشتريات والتوريد المخزني (Purchasing & Goods Receipt Cycle)', '4.2 Purchasing & Goods Receipt Cycle'),
          createBullet('الخطوة 1 - استلام البضاعة من المورد:', 'يقوم أمين المستودع بفتح شاشة أذونات الاستلام المخزني (GRN).'),
          createBullet('الخطوة 2 - إدخال الأصناف وتكلفتها:', 'يحدد المورد، والمستودع، والكميات الواردة وسعر تكلفة الوحدة.'),
          createBullet('الخطوة 3 - الترحيل المخزني والمالي:', 'عند اعتماد إذن الاستلام المخزني:'),
          createBullet('     - تزيد أرصدة الأصناف في المستودع المحدد فوراً وتتحدث متوسطات التكلفة (Weighted Average Cost).', 'Stock balance increases instantly.'),
          createBullet('     - ينشأ قيد محاسبي آلي: من حـ/ المخزون (مدين) إلى حـ/ الموردين أو البنك (دائن).', 'Debit: Inventory Asset | Credit: Accounts Payable / Bank.'),

          ...createHeading2('4.3 دورة الصرف الداخلي والاستهلاك للعيادات (Internal Clinic Consumption Cycle)', '4.3 Internal Clinic Consumption Cycle'),
          createBullet('الخطوة 1 - طلب مواد مستهلكة للعيادة:', 'تطلب عيادة الليزر مستلزمات (مثل: جيل تبريد، قفازات، شاش، عدسات).'),
          createBullet('الخطوة 2 - إصدار إذن صرف مخزني (GIN):', 'يقوم أمين المخزن باختيار المستودع والعيادة المستفيدة والكميات المنصرفة.'),
          createBullet('الخطوة 3 - الترحيل التلقائي:', 'يتم خصم المواد من رصيد المستودع، وتوليد قيد يومية:'),
          createBullet('     - من حـ/ مصروفات تشغيل العيادات والمستهلكات (مدين).', 'Debit: Clinic Operational Supplies Expense.'),
          createBullet('     - إلى حـ/ بضاعة المخزون (دائن).', 'Credit: Inventory Asset Account.'),

          ...createHeading2('4.4 دورة الجرد والتسوية المخزنية (Stocktaking & Adjustment Cycle)', '4.4 Stocktaking & Inventory Adjustment'),
          createBullet('الخطوة 1 - فتح محضر الجرد:', 'يقوم المراجع أو أمين المخزن باختيار المستودع وبدء الجرد.'),
          createBullet('الخطوة 2 - إدخال الكميات المعدودة فعلياً:', 'يتم إدخال الجرد الفعلي للمواد والأصناف على الرفوف.'),
          createBullet('الخطوة 3 - اعتماد محضر التسوية المخزنية:', 'يقوم النظام بحساب الفروقات وترحيلها محاسبياً:'),
          createBullet('     - في حالة العجز: من حـ/ خسائر عجز المخزون (مدين) إلى حـ/ المخزون (دائن).', 'Deficit: Debit Inventory Loss | Credit Inventory.'),
          createBullet('     - في حالة الزيادة: من حـ/ المخزون (مدين) إلى حـ/ أرباح زيادات الجرد (دائن).', 'Surplus: Debit Inventory | Credit Inventory Gain.'),

          new Paragraph({ children: [new PageBreak()] }),

          // CHAPTER 5: PERMISSIONS & SECURITY MATRIX
          ...createHeading1('الفصل الخامس: مصفوفة الصلاحيات والأمان وحوكمة النظام', 'Chapter 5: Roles & Security Governance Matrix'),
          createParagraph(
            'تعتمد المنصة على نظام تحكم صارم بالصلاحيات (Role-Based Access Control - RBAC) مقسم على 8 أدوار وظيفية لضمان الأمان وفصل المهام المحاسبية والتشغيلية.',
            'Granular 8-tier Role-Based Access Control matrix enforcing segregation of duties and audit compliance.'
          ),

          createTable([
            ['الشاشة / الموديول', 'Admin', 'Manager', 'Accountant', 'Cashier', 'Reception', 'Doctor', 'Storekeeper'],
            ['لوحة التحكم والتحليلات', 'كاملة', 'كاملة', 'مالي فقط', 'محدودة', 'تشغيلي', 'عيادي', 'مخزني'],
            ['شاشة التشغيل وحجوزات المرضى', 'كاملة', 'كاملة', 'قراءة فقط', 'قراءة فقط', 'كاملة', 'عيادي', 'لا يوجد'],
            ['نقطة البيع السريعة POS', 'كاملة', 'كاملة', 'إشراف', 'كاملة (بيع)', 'قراءة فقط', 'لا يوجد', 'لا يوجد'],
            ['فواتير المبيعات وسجلها', 'كاملة', 'كاملة', 'كاملة', 'فواتير ورديته', 'فواتير ورديته', 'لا يوجد', 'لا يوجد'],
            ['سندات القبض والصرف النقدية', 'كاملة', 'كاملة', 'كاملة', 'سندات قبض', 'لا يوجد', 'لا يوجد', 'لا يوجد'],
            ['إدارة المخازن وأذونات الاستلام والصرف', 'كاملة', 'كاملة', 'قيد ومطابقة', 'لا يوجد', 'لا يوجد', 'صرف داخلي', 'كاملة'],
            ['إدارة المنتجات وتعديل الأسعار وحد الطلب', 'كاملة', 'كاملة', 'قراءة فقط', 'عرض فقط', 'عرض فقط', 'عرض فقط', 'تعديل أرصدة'],
            ['إدارة الحسابات ودفتر الأستاذ والقوائم', 'كاملة', 'قراءة فقط', 'كاملة', 'لا يوجد', 'لا يوجد', 'لا يوجد', 'لا يوجد'],
            ['الرواتب ومسير الأجور', 'كاملة', 'كاملة', 'كاملة', 'لا يوجد', 'لا يوجد', 'لا يوجد', 'لا يوجد'],
            ['الشركات والفروع والأرشيف الآمن', 'كاملة', 'عرض فرعه', 'لا يوجد', 'لا يوجد', 'لا يوجد', 'لا يوجد', 'لا يوجد'],
            ['المستخدمين والصلاحيات والنيون', 'كاملة', 'لا يوجد', 'لا يوجد', 'لا يوجد', 'لا يوجد', 'لا يوجد', 'لا يوجد'],
          ]),

          new Paragraph({ children: [new PageBreak()] }),

          // CHAPTER 6: TROUBLESHOOTING & FAQS
          ...createHeading1('الفصل السادس: الأسئلة الشائعة واستكشاف الأخطاء وإصلاحها', 'Chapter 6: Troubleshooting & Frequently Asked Questions'),
          createParagraph(
            'إجابات عملية ومباشرة على أكثر الاستفسارات والمواقف التي قد تواجه المستخدم أثناء العمل اليومي.',
            'Direct troubleshooting solutions for common real-world operational scenarios.'
          ),

          ...createHeading2('س1: ماذا أفعل إذا انقطع الإنترنت فجأة أثناء عمل الكاشير؟', 'Q1: What happens if internet disconnects during POS cashiering?'),
          createParagraph(
            'ج: لا تقلق إطلاقاً! النظام مزود بتقنية الحفظ المحلي التلقائي (Local Fallback Resilience). يمكنك الاستمرار في البيع وإصدار الفواتير وطباعتها للعملاء بشكل طبيعي 100%. وعند عودة الاتصال، اضغط على شاشة قاعدة بيانات نيون (Neon Hub) لمزامنة البيانات سحابياً بضغطة زر.',
            'Answer: Continue business as usual! The app features offline-first local state caching. Invoices, cash shifts, and inventory remain 100% operational locally and sync seamlessly to the cloud once reconnected.'
          ),

          ...createHeading2('س2: حذفت فرعاً أو مستودعاً بالخطأ، كيف أستعيده؟', 'Q2: How do I restore an accidentally deleted branch or warehouse?'),
          createParagraph(
            'ج: النظام يطبق سياسة الأرشفة الآمنة (Soft Delete). ادخل على شاشة "إدارة الشركات والفروع"، واضغط على زر "خزينة الأرشيف الآمن" في الشريط العلوي، ستجد الفرع أو المستودع المؤرشف وبجانبه زر أخضر [استعادة]، اضغط عليه ليعود فوراً بكامل عملياته وسجلاته التاريخية.',
            'Answer: Open "Companies & Branches", click the prominent "Archive Vault" top bar button, find your item, and click [Restore] to instantly bring back the branch or warehouse without any data loss.'
          ),

          ...createHeading2('س3: كيف أعدل حد الطلب لصنف معين لتصلني تنبيهات عند اقتراب نفاذه؟', 'Q3: How do I configure low-stock alerts and reorder threshold for an item?'),
          createParagraph(
            'ج: ادخل على شاشة "إدارة المنتجات والخدمات"، وفي جدول الأصناف ستجد عمود المخزون وبه مؤشر "/ حد X" وزر [ضبط حد الطلب]. اضغط عليه واختر القيمة المطلوبة (مثل: 5 أو 10 وحدات) واضغط حفظ. سيقوم النظام تلقائياً بإظهار تنبيه ملون أعلى الشاشة وبطاقة تنبيه فور وصول الرصيد لهذا الحد.',
            'Answer: Navigate to "Products & Services", in the inventory column click "/ Limit X" or [Set Reorder], choose your desired minimum threshold (e.g., 5 or 10 units), and save. The automated alert system will trigger as soon as stock hits that count.'
          ),

          ...createHeading2('س4: كيف أحذف مستخدماً لم يعد يعمل في المنشأة؟', 'Q4: How do I delete a user account safely?'),
          createParagraph(
            'ج: ادخل على شاشة "المستخدمين والصلاحيات"، وابحث عن المستخدم، واضغط على أيقونة سلة المهملات الحمراء. ستظهر لك نافذة تأكيد داخلية تعرض اسم المستخدم واسم الدخول ودوره الوظيفي. اضغط على [تأكيد الحذف النهائي]، وسيتم إلغاء الحساب فوراً وإظهار إشعار تأكيد عائم وتسجيل الإجراء في سجل الرقابة.',
            'Answer: Go to "Users & Roles", locate the user, click the red trash icon, review the details in the confirmation modal, and click [Confirm Delete]. The account is revoked immediately and audited.'
          ),

          ...createHeading2('س5: هل فواتير المبيعات متوافقة مع متطلبات الفاتورة الإلكترونية وهيئة الزكاة؟', 'Q5: Are sales invoices compliant with ZATCA E-Invoicing requirements?'),
          createParagraph(
            'ج: نعم، كافة الفواتير تتضمن اسم المنشأة، الرقم الضريبي، الرقم المتسلسل الموحد، تفقيط الضرائب والخصومات، وتوليد كود الاستجابة السريع المرمز (Base64 TLV QR Code) الجاهز للمسح الضريبي.',
            'Answer: Yes, all issued invoices include company tax registration, sequential invoice numbers, tax breakdowns, and encoded cryptographic Base64 TLV QR codes compliant with regulatory authorities.'
          ),

          // Concluding Signature
          new Paragraph({
            spacing: { before: 500, after: 200 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'تم إعداد هذا التوثيق والدليل الشامل وفق أعلى معايير الجودة والاحترافية البرمجية والمحاسبية.',
                bold: true,
                size: 20,
                color: COLOR_PRIMARY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Universal ERP Solution Architecture & Enterprise Development Team | 2026',
                size: 18,
                color: COLOR_MUTED,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.resolve('public/Universal_ERP_Comprehensive_Manual_Bilingual.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Word Document generated successfully at: ${outPath} (${buffer.length} bytes)`);
}

buildDocx().catch((err) => {
  console.error('Error generating docx:', err);
  process.exit(1);
});
