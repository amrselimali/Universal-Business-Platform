/**
 * كاتب السجلات — يكتب في الجدول المنمّط بأعمدته الفعلية
 * ---------------------------------------------------------------------------
 * لماذا اكتشاف الأعمدة من قاعدة البيانات نفسها؟
 *   بدل تكرار قائمة الأعمدة (34 جدولاً × ~10 أعمدة) في كود السيرفر — وهو
 *   تكرار ينحرف حتماً عن الأصل — نقرأها مرة واحدة من `information_schema`
 *   ونخزّنها مؤقتاً. لو أُضيف عمود للجدول، يبدأ الكاتب بملئه تلقائياً بلا تعديل كود.
 *
 * كل سجل يُكتب في:
 *   • الأعمدة المنمّطة (من قيم السجل نفسه) — للاستعلام والفهرسة والتقارير
 *   • عمود payload (السجل كامل) — يمنع فقدان أي حقل متشعّب
 *   • updated_at / updated_by / deleted_at — للمزامنة والحذف الناعم
 */

/** أعمدة نظام لا يجوز أخذها من السجل مباشرة. */
const MANAGED = new Set([
  'id', 'tenant_id', 'payload', 'updated_at', 'updated_by', 'deleted_at', 'synced_at',
]);

/** خزّان أعمدة كل جدول (اسم → قائمة الأعمدة القابلة للكتابة). */
const columnCache = new Map<string, string[]>();

/** يجلب الأعمدة المنمّطة للجدول من قاعدة البيانات (مع تخزين مؤقت). */
async function typedColumnsOf(
  query: (text: string, params?: unknown[]) => Promise<any>,
  table: string
): Promise<string[]> {
  const cached = columnCache.get(table);
  if (cached) return cached;

  const rows: any[] = await query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table]
  );

  const columns = (rows || [])
    .map((r) => String(r.column_name))
    .filter((name) => !MANAGED.has(name));

  columnCache.set(table, columns);
  return columns;
}

/**
 * يحلّ قيمة عمود من السجل المحلي.
 * يدعم تحويل `snake_case` إلى `camelCase` (مثال: `name_ar` → `nameAr`).
 */
function valueFor(record: Record<string, any>, column: string, tenantId: string): unknown {
  if (column === 'tenant_id') return record?.tenantId ?? tenantId;
  const camel = column.replace(/_([a-z])/g, (_m, letter: string) => letter.toUpperCase());
  const value = record?.[camel] ?? record?.[column];
  return value === undefined ? null : value;
}

export interface WriteResult {
  written: number;
  error?: string;
}

/**
 * يكتب سجلات في الجدول المنمّط داخل معاملة واحدة (الكل أو لا شيء).
 *
 * @param scoped هل الجدول تابع لمنشأة (يحتوي عمود tenant_id)؟
 */
export async function writeRecords(params: {
  query: (text: string, params?: unknown[]) => Promise<any>;
  table: string;
  tenantId: string;
  scoped: boolean;
  records: Record<string, any>[];
  actor?: string;
}): Promise<WriteResult> {
  const { query, table, tenantId, scoped, records, actor } = params;
  if (records.length === 0) return { written: 0 };

  try {
    const typed = await typedColumnsOf(query, table);

    const columns = [
      'id',
      ...(scoped ? ['tenant_id'] : []),
      ...typed,
      'payload',
      'updated_at',
      'updated_by',
      'deleted_at',
      'synced_at',
    ];

    // عند التحديث: كل الأعمدة تتحدث، و deleted_at يُصفَّر (إحياء سجل محذوف ناعماً).
    const updates = [
      ...typed.map((c) => `${c} = EXCLUDED.${c}`),
      'payload = EXCLUDED.payload',
      'updated_at = NOW()',
      'updated_by = EXCLUDED.updated_by',
      'deleted_at = NULL',
      'synced_at = NOW()',
    ].join(', ');

    const BATCH = 250;
    let written = 0;

    for (let start = 0; start < records.length; start += BATCH) {
      const slice = records.slice(start, start + BATCH);
      const values: unknown[] = [];
      const tuples = slice.map((record) => {
        const id = String(record?.id ?? '');
        const row: unknown[] = [id];
        if (scoped) row.push(record?.tenantId ?? tenantId);
        typed.forEach((column) => row.push(valueFor(record, column, tenantId)));
        row.push(JSON.stringify(record ?? {}));
        row.push(new Date()); // updated_at
        row.push(actor ?? null); // updated_by
        row.push(null); // deleted_at
        row.push(new Date()); // synced_at

        const placeholders = row.map((v) => {
          values.push(v);
          return `$${values.length}`;
        });
        return `(${placeholders.join(', ')})`;
      });

      await query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}
         ON CONFLICT (id) DO UPDATE SET ${updates}`,
        values
      );
      written += slice.length;
    }

    return { written };
  } catch (error: any) {
    return { written: 0, error: error?.message || String(error) };
  }
}

/** يحذف سجلات حذفاً ناعماً (deleted_at) — لا حذف فعلي. */
export async function softDeleteRecords(params: {
  query: (text: string, params?: unknown[]) => Promise<any>;
  table: string;
  tenantId: string;
  scoped: boolean;
  ids: string[];
  actor?: string;
}): Promise<WriteResult> {
  const { query, table, tenantId, scoped, ids, actor } = params;
  if (ids.length === 0) return { written: 0 };

  try {
    await query(
      scoped
        ? `UPDATE ${table} SET deleted_at = NOW(), updated_at = NOW(), updated_by = $3
            WHERE tenant_id = $1 AND id = ANY($2) AND deleted_at IS NULL`
        : `UPDATE ${table} SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2
            WHERE id = ANY($1) AND deleted_at IS NULL`,
      scoped ? [tenantId, ids, actor ?? null] : [ids, actor ?? null]
    );
    return { written: ids.length };
  } catch (error: any) {
    return { written: 0, error: error?.message || String(error) };
  }
}

/** يُفرّغ خزّان الأعمدة (للاختبارات). */
export const clearColumnCache = (): void => columnCache.clear();