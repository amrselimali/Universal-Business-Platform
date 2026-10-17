/**
 * أنواع مستكشف قاعدة البيانات (Database Explorer)
 * ---------------------------------------------------------------------------
 * الشاشة مرآة حقيقية لبنية قاعدة البيانات: جداول، أعمدة، مفاتيح، صفوف.
 * كل قراءة/كتابة تمر عبر تحقق صارم من الأسماء والأنواع قبل التنفيذ.
 */

export interface DbColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isIdentity: boolean;
  maxLength?: number;
  ordinal: number;
}

export interface DbTable {
  schema: string;
  name: string;
  kind: 'table' | 'view';
  /** تقدير عدد الصفوف من pg_class (سريع، ليس دقيقاً). */
  estimatedRows: number;
  /** هل RLS مفعّل على هذا الجدول؟ (يفسّر فرق عدد الصفوف عن نيون). */
  rlsEnabled: boolean;
  columns: DbColumn[];
  primaryKey: string[];
}

export interface DbConnectionIdentity {
  user: string;
  database: string;
  host: string;
  searchPath: string;
}

export interface DbCatalog {
  tables: DbTable[];
  schemas: string[];
  error?: string;
}

export interface DbRowPage {
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  /** true إذا قُرئت الصفوف مع تجاوز RLS. */
  bypassed?: boolean;
  /** سبب فشل تجاوز RLS (الدور لا يملك الصلاحية). */
  bypassError?: string;
  error?: string;
}

export type DbColumnType =
  | 'text'
  | 'varchar'
  | 'integer'
  | 'bigint'
  | 'numeric'
  | 'boolean'
  | 'date'
  | 'timestamptz'
  | 'uuid'
  | 'jsonb';

export interface DbColumnDraft {
  name: string;
  type: DbColumnType;
  length?: number;
  nullable: boolean;
  primaryKey?: boolean;
  defaultValue?: string;
}

export interface DbOperationResult {
  ok: boolean;
  message?: string;
  affected?: number;
}
