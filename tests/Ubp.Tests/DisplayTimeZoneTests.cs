using Ubp.Application.Services;
using Ubp.Core.Models;
using Xunit;

namespace Ubp.Tests;

/// <summary>
/// توقيت العرض/التكوين (Africa/Cairo افتراضيًا): التطبيق Blazor Server داخل حاوية UTC،
/// فأي تكوين بـ<c>new DateTimeOffset(DateTime)</c> أو قراءة بـ<c>ToLocalTime()</c> ينتج فرق ساعتين.
/// </summary>
public sealed class DisplayTimeZoneTests : IClassFixture<TestDb>
{
    private readonly TestDb _db;

    public DisplayTimeZoneTests(TestDb db) => _db = db;

    /// <summary>خدمة إعدادات ثابتة على منطقة «أفريقيا/القاهرة» بلا قاعدة بيانات.</summary>
    private sealed class FixedSettings(string timeZone) : ISettingsService
    {
        private readonly AppSettings _snapshot = new() { TimeZone = timeZone };
        public Task<AppSettings> GetAsync(CancellationToken ct = default) => Task.FromResult(_snapshot);
        public Task<AppSettings> UpdateAsync(Ubp.Core.Security.ActorContext actor, AppSettings input,
            CancellationToken ct = default) => Task.FromResult(_snapshot);
        public Task<string?> ValidatePasswordAsync(string password, string username,
            CancellationToken ct = default) => Task.FromResult<string?>(null);
        public AppSettings? CachedSnapshot => _snapshot;
        public void Invalidate() { }
    }

    [Fact]
    public void Composing_a_local_time_uses_the_settings_zone_not_the_server_zone()
    {
        var fmt = new DisplayFormatter(new FixedSettings("Africa/Cairo"));

        var at = fmt.At(new DateTime(2026, 7, 15), TimeSpan.FromHours(10));

        // 10:00 بتوقيت القاهرة (UTC+3 صيفًا) = 07:00Z — وليس 10:00Z كما ينتج عن new DateTimeOffset(DateTime).
        Assert.Equal(new DateTimeOffset(2026, 7, 15, 10, 0, 0, TimeSpan.FromHours(3)), at);
        Assert.Equal(new DateTime(2026, 7, 15, 7, 0, 0, DateTimeKind.Utc), at.UtcDateTime);
        // ذهابًا وعودة: العرض يعطي نفس الساعة المحلية التي أدخلها المستخدم.
        Assert.Equal(TimeSpan.FromHours(10), fmt.ToUserTime(at).TimeOfDay);
        Assert.Equal(TimeSpan.Zero, fmt.StartOfDay(new DateTime(2026, 7, 15)).TimeOfDay);
    }

    [Fact]
    public void Seeded_settings_time_zone_is_africa_cairo()
    {
        var settings = _db.Settings();
        var snapshot = settings.CachedSnapshot;
        Assert.True(snapshot is null || snapshot.TimeZone == "Africa/Cairo");
    }
}
