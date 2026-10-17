-- =========================================================================
-- قراءة القيود من قاعدة البيانات (قائمة Keyset + ملخص + تفاصيل)
-- =========================================================================
-- الغرض: إخراج `erp_journals` من حِزمة الإقلاع، وقراءة دفتر اليومية من DB.
-- المصدر: `journal_entries` (الدفتر الموحّد) مع سطوره في payload->'lines'.
-- متكرر بأمان.
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_journal_list(
  p_tenant text, p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_search text DEFAULT NULL, p_limit integer DEFAULT 100,
  p_after_date date DEFAULT NULL, p_after_id text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_items jsonb;
  v_last jsonb;
BEGIN
  WITH page AS (
    SELECT id, entry_number, COALESCE(entry_date, date) AS entry_date, description,
           is_posted, version, updated_by, branch_id, payload
      FROM journal_entries
     WHERE tenant_id = p_tenant
       AND deleted_at IS NULL
       AND (p_from IS NULL OR COALESCE(entry_date, date)::date >= p_from)
       AND (p_to IS NULL OR COALESCE(entry_date, date)::date <= p_to)
       AND (p_search IS NULL OR p_search = '' OR
            COALESCE(entry_number, '') ILIKE '%' || p_search || '%' OR
            COALESCE(description, '') ILIKE '%' || p_search || '%')
       AND (p_after_date IS NULL OR
            (COALESCE(entry_date, date)::date, id) < (p_after_date, p_after_id))
     ORDER BY COALESCE(entry_date, date) DESC, id DESC
     LIMIT v_limit
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(page)), '[]'::jsonb),
         (SELECT to_jsonb(p2) FROM page p2 ORDER BY COALESCE(p2.entry_date, '') ASC, p2.id ASC LIMIT 1)
    INTO v_items, v_last
    FROM page;

  RETURN jsonb_build_object('items', v_items,
    'nextAfterDate', v_last->>'entry_date',
    'nextAfterId', v_last->>'id',
    'limit', v_limit);
END; $$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_journal_summary(
  p_tenant text, p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_search text DEFAULT NULL
) RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'totalDebit', COALESCE(SUM(COALESCE((l.value->>'debit')::numeric, 0)), 0),
    'totalCredit', COALESCE(SUM(COALESCE((l.value->>'credit')::numeric, 0)), 0)
  )
    FROM journal_entries j
    LEFT JOIN LATERAL jsonb_array_elements(COALESCE(j.payload->'lines', '[]'::jsonb)) AS l(value) ON TRUE
   WHERE j.tenant_id = p_tenant
     AND j.deleted_at IS NULL
     AND (p_from IS NULL OR COALESCE(j.entry_date, j.date)::date >= p_from)
     AND (p_to IS NULL OR COALESCE(j.entry_date, j.date)::date <= p_to)
     AND (p_search IS NULL OR p_search = '' OR
          COALESCE(j.entry_number, '') ILIKE '%' || p_search || '%' OR
          COALESCE(j.description, '') ILIKE '%' || p_search || '%');
$$ LANGUAGE sql STABLE;

CREATE INDEX IF NOT EXISTS idx_journal_entries_keyset
  ON journal_entries (tenant_id, entry_date DESC, id DESC)
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_journal_list(text,date,date,text,integer,date,text) TO app_api';
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_journal_summary(text,date,date,text) TO app_api';
  END IF;
END $$;
