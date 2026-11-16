namespace Ubp.Core.Models;

/// <summary>مستويات خطورة نتائج الفحص المباشر.</summary>
public static class QaSeverity
{
    public const string Critical = "critical";
    public const string High = "high";
    public const string Medium = "medium";
    public const string Low = "low";
    public const string Info = "info";

    public static int Weight(string severity) => severity switch
    {
        Critical => 25, High => 12, Medium => 6, Low => 2, _ => 0
    };
}

/// <summary>ملاحظة واحدة: أين المشكلة وما الدليل والمقترح.</summary>
public sealed class QaFinding
{
    public string Area { get; set; } = "";
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string Detail { get; set; } = "";
    public string Severity { get; set; } = QaSeverity.Info;
    public string Metric { get; set; } = "";
    public string Suggestion { get; set; } = "";
}

/// <summary>قياس زمن استعلام فعلي على قاعدة البيانات الحقيقية.</summary>
public sealed class QaQueryProfile
{
    public string Name { get; set; } = "";
    public double DurationMs { get; set; }
    public long Rows { get; set; }
    public long SharedHitBlocks { get; set; }
    public long SharedReadBlocks { get; set; }
    public string? Plan { get; set; }
    public string? Hotspot { get; set; }
}

/// <summary>استهلاك جدول واحد مع حكم الصحة.</summary>
public sealed class QaTableProfile
{
    public string Table { get; set; } = "";
    public long Rows { get; set; }
    public string TotalSize { get; set; } = "";
    public long TotalBytes { get; set; }
    public string IndexSize { get; set; } = "";
    public long SeqScans { get; set; }
    public long IndexScans { get; set; }
    public long DeadTuples { get; set; }
    public string? Hotspot { get; set; }
    /// <summary>حالة الجدول وقت الفحص: ok / attention / critical.</summary>
    public string Health { get; set; } = "ok";
    public string HealthReason { get; set; } = "";
}

/// <summary>اختبار واحد ضمن دورة الفحص الموحدة (أساسي أو ذكي).</summary>
public sealed class QaTestRunRow
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string Criticality { get; set; } = "medium";
    public string Status { get; set; } = "";
    public string Message { get; set; } = "";
    public int DurationMs { get; set; }
}

/// <summary>مورد سيرفر: مستخدم/إجمالي/نسبة/تفصيل.</summary>
public sealed class QaServerResource
{
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public double Used { get; set; }
    public double Total { get; set; }
    public string Unit { get; set; } = "MB";
    public string Detail { get; set; } = "";
    public double Percent => Total <= 0 ? 0 : Math.Round(Used / Total * 100, 1);
}

/// <summary>استهلاك مورد مجزأ حسب جدول/صفحة/دورة عمل.</summary>
public sealed class QaResourceSlice
{
    public string Name { get; set; } = "";
    public string Kind { get; set; } = "";
    public double CpuMs { get; set; }
    public long DbBlocks { get; set; }
    public string Size { get; set; } = "";
    public string Note { get; set; } = "";
}

/// <summary>فحص دورة عمل حية: عدد المستندات في كل حالة.</summary>
public sealed class QaWorkflowProbe
{
    public string Name { get; set; } = "";
    public long Count { get; set; }
    public string Status { get; set; } = "ok";
    public string Detail { get; set; } = "";
}

/// <summary>تقرير الفحص الشامل: قراءة فقط على قاعدة البيانات الفعلية + اختبارات معزولة.</summary>
public sealed class QaAuditReport
{
    public DateTimeOffset GeneratedAt { get; set; } = DateTimeOffset.UtcNow;
    public double DurationMs { get; set; }
    public int HealthScore { get; set; } = 100;
    public string Grade { get; set; } = "A";
    public string Database { get; set; } = "";
    public string ServerVersion { get; set; } = "";
    public bool ReadOnly { get; set; } = true;
    public List<QaFinding> Findings { get; set; } = new();
    public List<QaQueryProfile> Queries { get; set; } = new();
    public List<QaTableProfile> Tables { get; set; } = new();
    public List<QaWorkflowProbe> Workflows { get; set; } = new();
    public List<QaTestRunRow> Tests { get; set; } = new();
    public List<QaServerResource> Resources { get; set; } = new();
    public List<QaResourceSlice> Slices { get; set; } = new();
    public bool IsolationVerified { get; set; }
    public string QaDatabase { get; set; } = "";
    public string CoverageFingerprint { get; set; } = "";

    public int CriticalCount => Findings.Count(f => f.Severity == QaSeverity.Critical);
    public int HighCount => Findings.Count(f => f.Severity == QaSeverity.High);
    public int MediumCount => Findings.Count(f => f.Severity == QaSeverity.Medium);
    public int PassedTests => Tests.Count(t => t.Status == "Passed");
    public int FailedTests => Tests.Count(t => t.Status is not ("Passed" or "Skipped"));
    public double SlowestMs => Queries.Count == 0 ? 0 : Queries.Max(q => q.DurationMs);
    public string? SlowestQuery => Queries.OrderByDescending(q => q.DurationMs).FirstOrDefault()?.Name;
}