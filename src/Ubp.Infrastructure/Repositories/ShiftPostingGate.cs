using Dapper;
using Npgsql;

namespace Ubp.Infrastructure.Repositories;

/// <summary>
/// بوابة «تأجيل الترحيل داخل الشفت» (0220): أثناء وجود شفت مفتوح للفرع لا يُرحَّل أي قيد
/// إلى الأستاذ — يُنشأ مسودة تُربط بالشفت (shift_id) وتُعتمد كلها عند «اعتماد المراجعة».
/// خارج الشفت (لا يوجد شفت مفتوح) يستمر الترحيل الفوري كما هو.
/// </summary>
internal static class ShiftPostingGate
{
    /// <summary>معرّف الشفت المفتوح للفرع إن وُجد (شفت واحد لكل فرع).</summary>
    public static async Task<Guid?> OpenShiftIdAsync(NpgsqlConnection connection,
        NpgsqlTransaction? tx, Guid branchId, CancellationToken ct) =>
        await connection.ExecuteScalarAsync<Guid?>(new CommandDefinition("""
            SELECT id FROM cashier_shifts
            WHERE branch_id = @branchId AND status = 'open'
            ORDER BY opened_at DESC LIMIT 1
            """, new { branchId }, tx, cancellationToken: ct));

    /// <summary>
    /// يُلحق القيد المسودة بالشفت المفتوح ويمنع ترحيله الآن (يعيد true).
    /// إن لم يوجد شفت مفتوح يعيد false ليُكمل المتصل الترحيل الفوري.
    /// </summary>
    public static async Task<bool> TryDeferAsync(NpgsqlConnection connection,
        NpgsqlTransaction? tx, Guid branchId, Guid entryId, CancellationToken ct)
    {
        var shiftId = await OpenShiftIdAsync(connection, tx, branchId, ct);
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
