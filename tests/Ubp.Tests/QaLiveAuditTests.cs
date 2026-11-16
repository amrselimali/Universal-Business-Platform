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

    [Fact]
    public async Task Full_audit_merges_basic_and_smart_tests_and_reports_resources()
    {
        var report = await Service().RunFullAuditAsync(await _db.AdminActorAsync());

        Assert.True(report.IsolationVerified);
        Assert.Equal(report.Database, report.QaDatabase);

        // الاختبارات الأساسية المسجلة سابقًا صارت داخل نفس الدورة.
        Assert.Contains(report.Tests, t => t.Code == "PERMISSIONS_DEFAULT_DENY");
        Assert.Contains(report.Tests, t => t.Code == "AUDIT_IMMUTABLE");
        // الاختبارات الذكية تُشتق من الكود والمخطط الفعليين.
        Assert.Contains(report.Tests, t => t.Code == "SMART_MIGRATIONS_COMPLETE");
        Assert.Contains(report.Tests, t => t.Code == "SMART_TABLE_PK");
        Assert.Contains(report.Tests, t => t.Code == "SMART_COVERAGE_FINGERPRINT");
        // فحوص الأمان والترحيل المحاسبي.
        Assert.Contains(report.Tests, t => t.Code == "SEC_SSL");
        Assert.Contains(report.Tests, t => t.Code == "SEC_SENSITIVE_COLUMNS");
        Assert.Contains(report.Tests, t => t.Code == "ACC_ALL_POSTED_HAVE_JOURNAL");
        // لا تكرار لأكواد الاختبارات.
        Assert.Equal(report.Tests.Count, report.Tests.Select(t => t.Code).Distinct().Count());

        // موارد السيرفر والمتبقي غير المستخدم.
        Assert.Contains(report.Resources, r => r.Category == "Memory" && r.Total > 0);
        Assert.Contains(report.Resources, r => r.Category == "Cpu");
        Assert.Contains(report.Resources, r => r.Category == "Database");
        Assert.NotEmpty(report.Slices);

        // حالة صحية لكل جدول.
        Assert.All(report.Tables, t => Assert.Contains(t.Health, new[] { "ok", "attention", "critical" }));
        Assert.All(report.Tables, t => Assert.False(string.IsNullOrWhiteSpace(t.HealthReason)));
    }

    [Fact]
    public async Task Full_audit_runs_on_the_live_database_without_a_separate_qa_database()
    {
        var options = new DatabaseOptions
        {
            ConnectionString = TestDb.AdminConnection,
            MigrationConnectionString = TestDb.AdminConnection,
            QaConnectionString = ""
        };
        var service = new QaService(_db.QaRepo, _db.Permissions(),
            new QaConnectionFactory(options), options, NullLogger<QaService>.Instance);

        var report = await service.RunFullAuditAsync(await _db.AdminActorAsync());

        Assert.True(report.IsolationVerified);
        Assert.Equal(report.Database, report.QaDatabase);
        Assert.NotEmpty(report.Tests);
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