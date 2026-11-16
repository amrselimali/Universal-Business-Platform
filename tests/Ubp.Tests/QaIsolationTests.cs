using Microsoft.Extensions.Logging.Abstractions;
using Ubp.Application.Services;
using Ubp.Infrastructure.Data;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// مركز الجودة يعمل الآن على قاعدة البيانات الحقيقية: لا يشترط قاعدة QA منفصلة،
/// واختبارات الكتابة تُنفَّذ داخل معاملة تُلغى دائمًا.
/// </summary>
public sealed class QaIsolationTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public QaIsolationTests(TestDb db) => _db = db;

    [Fact]
    public async Task Qa_run_uses_the_application_database_when_no_qa_database_is_configured()
    {
        var options = new DatabaseOptions
        {
            ConnectionString = TestDb.AdminConnection,
            MigrationConnectionString = TestDb.AdminConnection,
            QaConnectionString = ""
        };
        var service = new QaService(_db.QaRepo, _db.Permissions(),
            new QaConnectionFactory(options), options, NullLogger<QaService>.Instance);
        var actor = await _db.AdminActorAsync();

        var summary = await service.RunAsync(actor, Array.Empty<string>());

        Assert.Equal("Completed", summary.Status);
        Assert.Equal(summary.TotalCount, summary.PassedCount);
    }

    [Fact]
    public async Task Qa_test_registry_is_discoverable()
    {
        var actor = await _db.AdminActorAsync();
        var options = new DatabaseOptions { QaConnectionString = TestDb.AdminConnection };
        var service = new QaService(_db.QaRepo, _db.Permissions(),
            new QaConnectionFactory(options), options, NullLogger<QaService>.Instance);
        var matrix = await service.GetMatrixAsync(actor);
        Assert.True(matrix.Count >= 8);
        Assert.Contains(matrix, x => x.Definition.Code == "PERMISSIONS_DEFAULT_DENY");
    }
}
