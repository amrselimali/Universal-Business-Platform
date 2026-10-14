using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Npgsql;

namespace Erp.Services.Realtime;

public class PostgresRealtimeBridge : BackgroundService
{
    private readonly IHubContext<ErpNotificationHub> _hub;
    private readonly string _connectionString;
    private readonly ILogger<PostgresRealtimeBridge> _logger;

    public PostgresRealtimeBridge(
        IHubContext<ErpNotificationHub> hub,
        IConfiguration config,
        ILogger<PostgresRealtimeBridge> logger)
    {
        _hub = hub;
        _connectionString = config.GetConnectionString("Postgres")!;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("بدء الاستماع لقناة البث اللحظي PostgreSQL LISTEN...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync(stoppingToken);

                conn.Notification += async (o, e) =>
                {
                    try
                    {
                        var json = JsonDocument.Parse(e.Payload);
                        var tenantId = json.RootElement.GetProperty("tenant_id").GetString();

                        // البث الفوري لمجموعة المنشأة فقط لضمان العزل التام والسرعة القصوى
                        if (!string.IsNullOrEmpty(tenantId))
                        {
                            await _hub.Clients.Group($"tenant_{tenantId}")
                                .SendAsync("RecordUpdated", e.Payload, stoppingToken);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "خطأ في تحليل وتوزيع إشعار البث اللحظي");
                    }
                };

                await using var cmd = new NpgsqlCommand("LISTEN table_changes;", conn);
                await cmd.ExecuteNonQueryAsync(stoppingToken);

                while (!stoppingToken.IsCancellationRequested)
                {
                    // استهلاك شبه منعدم للـ CPU (Non-blocking I/O Wait)
                    await conn.WaitAsync(stoppingToken);
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "انقطع اتصال الـ Postgres Listener، إعادة المحاولة بعد 3 ثواني...");
                await Task.Delay(3000, stoppingToken);
            }
        }
    }
}
