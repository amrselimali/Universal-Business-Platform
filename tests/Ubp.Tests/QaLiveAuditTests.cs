using Dapper;
using Microsoft.Extensions.Logging.Abstractions;
using Ubp.Application.Services;
using Ubp.Infrastructure.Data;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// الفحص المباشر: يجب أن يقرأ من قاعدة البيانات الفعلية، يقيس الاستعلامات ودورات العمل،
/// وألا يغيّر أي بيانات إطلاقًا (معاملة READ ONLY).
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
        var options = new DatabaseOptions
        {
            ConnectionString = TestDb.AdminConnection,
            MigrationConnectionString = TestDb.AdminConnection,
            QaConnectionString = QaConnection
        };
        var service = new QaService(_db.QaRepo, _db.Permissions(),
            new QaConnectionFactory(options), options, NullLogger<QaService>.Instance);
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
        // كل استعلام مقاس له زمن فعلي ومصدر خطة.
        Assert.All(report.Queries, q => Assert.True(q.DurationMs >= 0));
        // أي محاولة كتابة داخل الفحص تفشل: لا تغيّر أي عدّاد في الجداول.
        Assert.Equal(before, after);
    }

    private async Task<(long Audit, long Bookings, long Journals)> CountsAsync()
    {
        await using var connection = new Npgsql.NpgsqlConnection(TestDb.AdminConnection);
        await connection.OpenAsync();
        var audit = await connection.ExecuteScalarAsync<long>("SELECT count(*) FROM audit_log");
        var bookings = await connection.ExecuteScalarAsync<long>("SELECT count(*) FROM bookings");
        var journals = await connection.ExecuteScalarAsync<long>("SELECT count(*) FROM journal_entries");
        return (audit, bookings, journals);
    }
}