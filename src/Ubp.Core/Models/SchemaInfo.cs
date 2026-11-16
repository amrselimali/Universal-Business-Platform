namespace Ubp.Core.Models;

/// <summary>وصف جدول لعرض شاشة قاعدة البيانات (نُقل من طبقة المستودعات إلى النماذج).</summary>
public sealed class TableInfo
{
    public string Schema { get; set; } = "";
    public string Name { get; set; } = "";
    public long RowCount { get; set; }
    public int ColumnCount { get; set; }
}

public sealed record ColumnInfo(string Name, string DataType, bool Nullable);

public sealed record RowPage(IReadOnlyList<string> Columns, IReadOnlyList<string> RowsJson, int Total);

/// <summary>
/// صفحة بيانات جدول للاستعراض للقراءة فقط: أسماء الأعمدة الحقيقية + صفوف JSON
/// (كل صف كائن يحمل قيم الأعمدة) + الإجمالي الكلي بعد البحث.
/// </summary>
public sealed record TableRowsPage(IReadOnlyList<ColumnInfo> Columns,
    IReadOnlyList<string> RowsJson, long Total, int Page, int PageSize);

/// <summary>دفعة قراءة من جدول أثناء التصدير: صفوف JSON + مؤشر الدفعة التالية.</summary>
public sealed record TableExportBatch(IReadOnlyList<string> RowsJson, string? NextCursor,
    bool HasMore);

/// <summary>تقدم عملية تصدير Excel (نسبة، جداول، الجدول الحالي، الحالة).</summary>
public sealed record TableExportProgress(int Percent, int TablesDone, int TablesTotal,
    string CurrentTable, string Status)
{
    public const string Running = "running";
    public const string Completed = "completed";
    public const string Failed = "failed";
}

/// <summary>نتيجة كتابة ملف تصدير: عدد الصفوف والجداول وما تم قصّه لحدود Excel.</summary>
public sealed record TableExportResult(string FileName, long RowsExported,
    int TablesExported, IReadOnlyList<string> Tables, IReadOnlyList<string> TruncatedTables);
