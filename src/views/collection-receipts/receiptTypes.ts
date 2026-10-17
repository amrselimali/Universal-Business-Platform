/**
 * نوع صف الإيصال المعروض — مستخرج من CollectionReceiptsView
 */

export interface ReceiptDisplayItem {
  id: string; // row.id
  receiptNumber: string;
  sourceShiftId: string;
  shiftNumber: string;
  shiftStatus: 'Open' | 'Closed';
  branchId: string;
  branchName: string;
  shiftDate: string;
  date: string;
  dayName?: string;
  customerId?: string;
  customerCode?: string;
  customerName: string;
  patientPhone?: string;
  systemCode?: string;
  collectedAmount: number; // قيمة التحصيل
  totalRevenue: number;
  paymentMethod: string;
  serviceId?: string;
  serviceName: string;
  productId?: string;
  productName?: string;
  bookedQuantity?: number;
  description?: string;
  notes?: string;
  source: 'pos' | 'reception_ops' | 'cash_receipt';
  sourceLabelAr: string;
  isCancelled: boolean;
  isModified: boolean;
  isRefund: boolean;
  isArchived: boolean;
}
