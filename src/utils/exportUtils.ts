/**
 * Export and Sharing Utilities for Egyptian Arabic Business Data & ETA Invoices
 */

function processCell(cell: string | number | undefined | null): string {
  if (cell === null || cell === undefined) return '""';
  const str = String(cell).replace(/"/g, '""');
  return `"${str}"`;
}

function triggerDownload(filename: string, csvContent: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([`${BOM}${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCsv(
  param1: string | Record<string, any>[],
  param2?: string | string[],
  param3?: (string | number | undefined | null)[][]
): void {
  // Case A: exportToCsv(objectsArray, filename)
  if (Array.isArray(param1) && typeof param2 === 'string') {
    const objects = param1 as Record<string, any>[];
    const filename = param2;
    if (objects.length === 0) return;
    const headers = Object.keys(objects[0]);
    const rows = objects.map((obj) => headers.map((h) => obj[h]));
    const headerLine = headers.map(processCell).join(',');
    const rowLines = rows.map((row) => row.map(processCell).join(',')).join('\r\n');
    triggerDownload(filename, `${headerLine}\r\n${rowLines}`);
    return;
  }

  // Case B: exportToCsv(filename, headers, rows)
  if (typeof param1 === 'string' && Array.isArray(param2) && Array.isArray(param3)) {
    const filename = param1;
    const headers = param2;
    const rows = param3;
    const headerLine = headers.map(processCell).join(',');
    const rowLines = rows.map((row) => row.map(processCell).join(',')).join('\r\n');
    triggerDownload(filename, `${headerLine}\r\n${rowLines}`);
    return;
  }
}

export function formatEgyptianPhone(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('00')) {
    clean = clean.substring(2);
  }
  if (clean.startsWith('01') && clean.length === 11) {
    clean = `2${clean}`;
  }
  return clean;
}

export function shareViaWhatsApp(phone: string, message: string): void {
  const cleanPhone = formatEgyptianPhone(phone);
  const encodedText = encodeURIComponent(message);
  const url = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(url, '_blank');
}

export interface InvoiceWhatsAppPayload {
  businessName?: string;
  companyName?: string;
  clinicName?: string;
  customerName: string;
  invoiceNumber: string;
  date: string;
  itemsCount?: number;
  totalAmount?: number;
  netTotal?: number;
  vatAmount?: number;
  currency?: string;
  paymentMethod?: string;
}

export function generateInvoiceWhatsAppText(data: InvoiceWhatsAppPayload): string {
  const brand = data.clinicName || data.businessName || data.companyName || 'المركز الطبي';
  const curr = data.currency || 'ج.م';
  const amount = data.totalAmount !== undefined ? data.totalAmount : data.netTotal !== undefined ? data.netTotal : 0;
  
  return `عزيزنا العميل/ة: ${data.customerName} ✨
شكراً لثقتكم واختياركم *${brand}*!

📄 تفاصيل الفاتورة الضريبية:
• رقم الفاتورة: ${data.invoiceNumber}
• التاريخ: ${data.date}
${data.itemsCount !== undefined ? `• عدد البنود: ${data.itemsCount}\n` : ''}• الإجمالي المستحق: ${amount.toLocaleString('ar-EG')} ${curr}
${data.vatAmount !== undefined ? `• ضريبة القيمة المضافة (14%): ${data.vatAmount.toLocaleString('ar-EG')} ${curr}\n` : ''}${data.paymentMethod ? `• طريقة السداد: ${data.paymentMethod}\n` : ''}
نسعد بخدمتكم دائماً ونتمنى لكم دوام الصحة والعافية! 🌟`;
}

export interface AppointmentWhatsAppPayload {
  businessName?: string;
  clinicName?: string;
  patientName: string;
  serviceName: string;
  doctorName?: string;
  date: string;
  time: string;
  branchName?: string;
  phone?: string;
}

export function generateAppointmentWhatsAppText(data: AppointmentWhatsAppPayload): string {
  const brand = data.clinicName || data.businessName || 'المركز الطبي';
  return `عزيزنا العميل/ة: ${data.patientName} 🌸
نذكركم بموعدكم القادم في *${brand}*:

🗓 تفاصيل الموعد:
• الخدمة / الجلسة: ${data.serviceName}
${data.doctorName ? `• الطبيب / الأخصائي: ${data.doctorName}\n` : ''}• التاريخ: ${data.date}
• التوقيت: ${data.time}
${data.branchName ? `• الفرع: ${data.branchName}\n` : ''}${data.phone ? `• للاستفسار: ${data.phone}\n` : ''}
نسعد باستقبالكم دائماً ونرجو الحضور قبل الموعد بـ 10 دقائق 🌺`;
}

export const generateBookingWhatsAppText = generateAppointmentWhatsAppText;
