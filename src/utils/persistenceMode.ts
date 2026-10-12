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

let neonOnly = true;

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
