/**
 * Persistence mode (وضع التخزين).
 *
 * When `NEON_ONLY` is enabled the app treats Neon as the ONLY source of truth:
 * business data is no longer written to (or read from) the per-dataset
 * localStorage / IndexedDB keys. The single exception is the local *cache*
 * (`erp_documents_cache`), which keeps a copy of the Neon documents purely to make
 * startup fast: at boot the cache is shown immediately, then it is compared with
 * Neon and only the datasets whose Neon `updated_at` is newer are re-fetched.
 */

// Recovery mode: when `erp_local_recovery` is '1' the app reads the previous local
// (browser) data again so it can be pushed back to Neon after an accidental overwrite.
const RECOVERY_FLAG = 'erp_local_recovery';
let neonOnly = true;
try {
  neonOnly = localStorage.getItem(RECOVERY_FLAG) !== '1';
} catch {
  neonOnly = true;
}

export const RECOVERY_STORAGE_KEY = RECOVERY_FLAG;

// Direct-DB mode: when enabled the app talks ONLY to Neon and keeps no local copy of
// the business data (no IndexedDB cache). Startup then reads every dataset directly
// from the database.
export const USE_LOCAL_CACHE = true;
export const isRecoveryMode = (): boolean => !neonOnly;
export const setRecoveryMode = (enabled: boolean): void => {
  try {
    if (enabled) localStorage.setItem(RECOVERY_FLAG, '1');
    else localStorage.removeItem(RECOVERY_FLAG);
  } catch {
    /* ignore */
  }
};

export const isNeonOnlyMode = (): boolean => neonOnly;

export const setNeonOnlyMode = (value: boolean): void => {
  neonOnly = value;
};

/** Writes a legacy per-dataset key. No-op in Neon-only mode. */
export const persistLocal = (key: string, value: string): void => {
  if (neonOnly) return;
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`persistLocal failed for ${key}`, error);
  }
};

/** Reads a legacy per-dataset key. Returns null in Neon-only mode. */
export const readLocal = (key: string): string | null => {
  if (neonOnly) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Removes a legacy per-dataset key (safe in both modes). */
export const removeLocal = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

export const DOCUMENTS_CACHE_KEY = 'erp_documents_cache';

export interface CachedDocument {
  payload: unknown;
  /** `updated_at` reported by Neon when this copy was fetched. */
  updatedAt: string;
}

export type DocumentsCache = { [key: string]: CachedDocument };

/**
 * Legacy business datasets that used to be persisted in the browser.
 * They are removed once on startup so the device never keeps a second copy of the data:
 * Neon (app_records) is the single source of truth.
 */
export const LEGACY_LOCAL_KEYS = [
  'erp_tenants', 'erp_users', 'erp_branches', 'erp_warehouses', 'erp_categories',
  'erp_products', 'erp_stock', 'erp_stock_movements', 'erp_accounts', 'erp_journals',
  'erp_parties', 'erp_parties_backup', 'erp_invoices', 'erp_cash_receipts', 'erp_cash_payments',
  'erp_customer_refunds', 'erp_reception_shifts', 'erp_pos_shifts', 'erp_payment_methods',
  'erp_tax_invoices', 'erp_goods_receipts', 'erp_goods_issues', 'erp_staff_members',
  'erp_payroll_runs', 'erp_attendance_records', 'erp_inventory_audits', 'erp_device_maintenance',
  'clinic_laser_devices', 'erp_period_locks', 'erp_audit_records', 'erp_user_activity_logs',
  'erp_notifications_history', 'erp_appointments', 'erp_patient_follow_ups', 'erp_treatment_plans',
];

/** Removes the legacy browser copies. Safe to run repeatedly. */
export const purgeLegacyLocalCopies = (): void => {
  LEGACY_LOCAL_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
};
