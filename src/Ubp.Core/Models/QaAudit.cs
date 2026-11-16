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

/// <summary>ملاحظة واحدة من الفحص المباشر: أين المشكلة وما الدليل والمقترح.</summary>
public sealed class QaFinding
{
    public string Area { get; set; } = "";
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string Detail { get; set; } = "";
    public string Severity { get; set; } = QaSeverity.Info;
    /// <summary>الرقم المقاس الذي بُني عليه الحكم (زمن/نسبة/عدد).</summary>
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
    /// <summary>خنق محتمل: مسح كامل لجدول كبير أو زمن مرتفع.</summary>
    public string? Hotspot { get; set; }
}

/// <summary>استهلاك جدول واحد: حجم وأعداد مسح وصفوف ميتة.</summary>
public sealed class QaTableProfile
{
    public string Table { get; set; } = "";
    public long Rows { get; set; }
    public string TotalSize { get; set; } = "";
    public string IndexSize { get; set; } = "";
    public long SeqScans { get; set; }
    public long IndexScans { get; set; }
    public long DeadTuples { get; set; }
    public string? Hotspot { get; set; }
}

/// <summary>فحص دورة عمل حية: عدد المستندات في كل حالة.</summary>
public sealed class QaWorkflowProbe
{
    public string Name { get; set; } = "";
    public long Count { get; set; }
    public string Status { get; set; } = "ok";
    public string Detail { get; set; } = "";
}

/// <summary>تقرير الفحص المباشر: قراءة فقط على قاعدة البيانات الفعلية.</summary>
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

    public int CriticalCount => Findings.Count(f => f.Severity == QaSeverity.Critical);
    public int HighCount => Findings.Count(f => f.Severity == QaSeverity.High);
    public int MediumCount => Findings.Count(f => f.Severity == QaSeverity.Medium);
    public double SlowestMs => Queries.Count == 0 ? 0 : Queries.Max(q => q.DurationMs);
    public string? SlowestQuery => Queries.OrderByDescending(q => q.DurationMs)
        .FirstOrDefault()?.Name;
}