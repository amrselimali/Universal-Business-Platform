using Dapper;
using Microsoft.Extensions.Logging.Abstractions;
using Ubp.Application.Services;
using Ubp.Infrastructure.Data;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// الفحص المباشر: يقرأ من قاعدة البيانات الفعلية، يقيس الاستعلامات ودورات العمل،
/// ولا يغيّر أي بيانات (معاملة READ ONLY). ويتأكد أن قيود المخطط وفهارس المفاتيح
/// الأجنبية مكتملة بعد ترحيل 0105.
/// </summary>
public sealed class QaLiveAuditTests : IClassFixture<TestDb>
{
    private static readonly string QaConnection =
        Environment.GetEnvironmentVariable("UBP_QA_CONNECTION")
        ?? "Host=localhost;Port=5432;Database=ubp_qa;Username=postgres";

    private readonly TestDb _db;

    public QaLiveAuditTests(TestDb db) => _db = db;

    [Fact]
    public async Task Live_audit_reads_real_database_and_writes_nothing()
    {
        var service = Service();
        var actor = await _db.AdminActorAsync();

        var before = await CountsAsync();
        var report = await service.RunLiveAuditAsync(actor);
        var after = await CountsAsync();

        Assert.True(report.ReadOnly);
        Assert.False(string.IsNullOrWhiteSpace(report.Database));
        Assert.InRange(report.HealthScore, 0, 100);
        Assert.NotEmpty(report.Grade);
        Assert.NotEmpty(report.Queries);
        Assert.NotEmpty(report.Workflows);
        Assert.NotEmpty(report.Tables);
        Assert.All(report.Queries, q => Assert.True(q.DurationMs >= 0));
        // لا تغيير في أي عدّاد: الفحص قراءة فقط بالفعل.
        Assert.Equal(before, after);
    }

    [Fact]
    public async Task Live_audit_finds_no_missing_guards_or_fk_indexes()
    {
        var report = await Service().RunLiveAuditAsync(await _db.AdminActorAsync());
        var codes = report.Findings.Select(f => f.Code).ToHashSet(StringComparer.Ordinal);

        // حارس سجل الأنشطة موجود بمشغّلين (تحديث/حذف) وليس باسم ثابت.
        Assert.DoesNotContain("MISSING_AUDIT_GUARD", codes);
        Assert.DoesNotContain("MISSING_VERSION_TRIGGER", codes);
        // كل مفتاح أجنبي له فهرس مطابق بعد 0105.
        Assert.DoesNotContain("FK_WITHOUT_INDEX", codes);
    }

    private QaService Service()
    {
        var options = new DatabaseOptions
        {
            ConnectionString = TestDb.AdminConnection,
            MigrationConnectionString = TestDb.AdminConnection,
            QaConnectionString = QaConnection
        };
        return new QaService(_db.QaRepo, _db.Permissions(),
            new QaConnectionFactory(options), options, NullLogger<QaService>.Instance);
    }

    private static async Task<(long Audit, long Bookings, long Journals)> CountsAsync()
    {
        await using var connection = new Npgsql.NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var audit = await connection.ExecuteScalarAsync<long>("SELECT count(*) FROM audit_log");
        var bookings = await connection.ExecuteScalarAsync<long>("SELECT count(*) FROM bookings");
        var journals = await connection.ExecuteScalarAsync<long>("SELECT count(*) FROM journal_entries");
        return (audit, bookings, journals);
    }
}