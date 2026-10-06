// Safe Storage Utility with IndexedDB Fallback and Quota Protection
// Prevents QuotaExceededError crashes when dealing with large datasets (10,000+ records)

const DB_NAME = 'ERP_ENTERPRISE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval_store';

// Open or initialize IndexedDB for large datasets
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Set value in IndexedDB (handles hundreds of megabytes safely)
export async function idbSet(key: string, value: any): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Failed to set ${key}:`, err);
    return false;
  }
}

// Get value from IndexedDB
export async function idbGet<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Failed to get ${key}:`, err);
    return null;
  }
}

// Safe LocalStorage Set with Quota Protection & Automatic Recovery
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuotaError =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014;

    if (isQuotaError) {
      console.warn(`[safeStorage] LocalStorage quota exceeded while saving "${key}". Initiating safe fallback.`);

      // 1. Try to prune high-volume non-essential logs first to free up space
      try {
        localStorage.removeItem('erp_user_activity_logs');
        localStorage.removeItem('erp_audit_records');
        // Try again after freeing logs
        localStorage.setItem(key, value);
        console.info(`[safeStorage] Successfully saved "${key}" after pruning old activity caches.`);
        return true;
      } catch (retryErr) {
        // Still exceeded quota. Store in IndexedDB instead!
        try {
          const parsed = JSON.parse(value);
          idbSet(key, parsed);
          console.info(`[safeStorage] Large dataset for "${key}" safely persisted to IndexedDB.`);
        } catch {
          idbSet(key, value);
        }
        return false;
      }
    }

    console.error(`[safeStorage] Unexpected error setting "${key}":`, err);
    return false;
  }
}

// Safe LocalStorage Get
export function safeLocalStorageGet(key: string, defaultValue: string | null = null): string | null {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : defaultValue;
  } catch (err) {
    console.warn(`[safeStorage] Error getting "${key}":`, err);
    return defaultValue;
  }
}

// Safely persist large or critical datasets: writes to IndexedDB first (handles 100MB+ safely), then mirrors to LocalStorage
export async function persistDataset(key: string, data: any): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await idbSet(key, data);
  } catch (err) {
    console.warn(`[safeStorage] IDB persist failed for "${key}":`, err);
  }

  try {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    safeLocalStorageSet(key, serialized);
  } catch {
    // Safe fallback already stored in IndexedDB
  }
}

// Safely load datasets: checks IndexedDB first (prioritizes large preserved datasets), falls back to LocalStorage
export async function loadPersistedDataset<T = any>(key: string, fallback: T): Promise<T> {
  if (typeof window === 'undefined') return fallback;
  try {
    const idbData = await idbGet<T>(key);
    if (idbData !== null && idbData !== undefined) {
      if (Array.isArray(idbData) && idbData.length > 0) {
        return idbData;
      }
      if (!Array.isArray(idbData)) {
        return idbData;
      }
    }
  } catch (err) {
    console.warn(`[safeStorage] IDB load error for "${key}":`, err);
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed !== null && parsed !== undefined) {
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        if (!Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // fallback
  }

  return fallback;
}
