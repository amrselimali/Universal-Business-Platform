using Dapper;
using Npgsql;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// بوابة «تأجيل الترحيل داخل الشفت» (0220): أثناء وجود شفت مفتوح للفرع لا يُرحَّل أي قيد إلى
/// الأستاذ — يُنشأ مسودة تُربط بالشفت (shift_id) وتُعتمد كلها عند «اعتماد المراجعة».
/// حركات نقاط البيع/التحصيل/التنفيذ تؤجَّل أيضًا بين **إغلاق الشفت واعتماد مراجعته**
/// (اختياريًا عبر <c>includeAwaitingReview</c>) حتى لا تتسرّب حركة قبل الاعتماد.
/// </summary>
internal static class ShiftPostingGate
{
    /// <summary>
    /// الشفت الذي تُعلَّق عليه الحركة: المفتوح أولًا، وإذا طُلب <paramref name="includeAwaitingReview"/>
    /// يُقبل أيضًا الشفت المغلق الذي لم تُعتمد مراجعته بعد (فترة الانتظار قبل اعتماد المحاسب).
    /// </summary>
    public static async Task<Guid?> DeferralShiftIdAsync(NpgsqlConnection connection,
        NpgsqlTransaction? tx, Guid branchId, CancellationToken ct,
        bool includeAwaitingReview = false) =>
        await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM cashier_shifts
            WHERE branch_id = @branchId
              AND (status = 'open'
                   OR (@includeAwaitingReview AND status = 'closed'
                       AND review_status = 'pending'))
            ORDER BY (status = 'open') DESC, opened_at DESC
            LIMIT 1
            """, new { branchId, includeAwaitingReview }, tx, cancellationToken: ct));

    /// <summary>
    /// يُلحق القيد المسودة بالشفت ويمنع ترحيله الآن (يعيد true).
    /// إن لم يوجد شفت مفتوح (أو مغلق بانتظار المراجعة عند طلبه) يعيد false ليُكمل الترحيل الفوري.
    /// </summary>
    public static async Task<bool> TryDeferAsync(NpgsqlConnection connection,
        NpgsqlTransaction? tx, Guid branchId, Guid entryId, CancellationToken ct,
        bool includeAwaitingReview = false)
    {
        var shiftId = await DeferralShiftIdAsync(connection, tx, branchId, ct,
            includeAwaitingReview);
        if (shiftId is null) return false;
        await connection.ExecuteAsync(new CommandDefinition("""
            UPDATE journal_entries SET shift_id = @shiftId
            WHERE id = @entryId AND status = 'draft'
            """, new { shiftId, entryId }, tx, cancellationToken: ct));
        return true;
    }

    /// <summary>يرحّل كل قيود الشفت المسودة (بترتيب الإنشاء) — عند اعتماد المراجعة.</summary>
    public static async Task<int> PostDeferredAsync(NpgsqlConnection connection,
        NpgsqlTransaction tx, Guid shiftId, Guid userId, CancellationToken ct)
    {
        var ids = (await connection.QueryAsync<Guid>(new CommandDefinition("""
            SELECT id FROM journal_entries
            WHERE shift_id = @shiftId AND status = 'draft'
            ORDER BY created_at, entry_date, id
            FOR UPDATE
            """, new { shiftId }, tx, cancellationToken: ct))).ToList();
        foreach (var id in ids)
            await connection.ExecuteAsync(new CommandDefinition(
                "SELECT fn_gl_post_entry(@id, @userId)", new { id, userId }, tx,
                cancellationToken: ct));
        return ids.Count;
    }
}
