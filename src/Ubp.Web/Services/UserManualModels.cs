namespace Ubp.Web.Services;

public sealed record ManualButtonDoc(
    string Label,
    string Permission,
    string Handler,
    string Behavior,
    string Destination)
{
    /// <summary>ما يظهر عند الضغط: حوار/تأكيد/انتقال/تنزيل.</summary>
    public string Appears { get; init; } = "";

    /// <summary>القيود التي تمنع أو تغيّر نتيجة الزر.</summary>
    public string Limits { get; init; } = "";

    /// <summary>ما يُسجَّل في سجل التدقيق عند نجاح العملية.</summary>
    public string Audit { get; init; } = "";
}

public sealed record ManualScreenDoc(
    string Code,
    string Route,
    string Title,
    string GroupKey,
    string GroupTitle,
    string Purpose,
    IReadOnlyList<string> Columns,
    IReadOnlyList<ManualButtonDoc> Buttons,
    IReadOnlyList<string> Actions,
    bool SourceAvailable)
{
    /// <summary>الحقول والفلاتر الظاهرة على الشاشة.</summary>
    public IReadOnlyList<string> Fields { get; init; } = [];

    /// <summary>ملاحظات على ما يظهر فعليًا في الشاشة.</summary>
    public IReadOnlyList<string> Notes { get; init; } = [];

    /// <summary>قيود الصفحة والصلاحيات المطبقة على مستوى الشاشة.</summary>
    public IReadOnlyList<string> Limits { get; init; } = [];

    /// <summary>التبويبات الظاهرة في الشاشة إن وجدت.</summary>
    public IReadOnlyList<string> Tabs { get; init; } = [];
}

public sealed record UserManualGeneration(
    string Markdown,
    DateTimeOffset GeneratedAt,
    int ScreenCount,
    int ButtonCount,
    int TableCount,
    bool SchemaAvailable,
    bool SourceAvailable)
{
    /// <summary>بيانات كل شاشة لمعرض الصور والشرح المكتوب على اللقطات.</summary>
    public IReadOnlyList<ManualScreenDoc> Screens { get; init; } = [];
}

public sealed record ManualColumnDoc(string Name, string DataType, bool Nullable);
public sealed record ManualTableDoc(string Name, long RowCount, IReadOnlyList<ManualColumnDoc> Columns);

public sealed record ManualDialogDoc(string Name, string Purpose, IReadOnlyList<ManualButtonDoc> Buttons)
{
    /// <summary>الحقول الظاهرة داخل الحوار.</summary>
    public IReadOnlyList<string> Fields { get; init; } = [];

    /// <summary>التبويبات داخل الحوار إن وجدت.</summary>
    public IReadOnlyList<string> Tabs { get; init; } = [];

    /// <summary>نوع الحوار: نموذج/تأكيد/مكوّن.</summary>
    public string Kind { get; init; } = "";
}

/// <summary>نتيجة التقاط صورة الشاشة من JavaScript وحفظها على الخادم.</summary>
public sealed record ManualShotSaveResult(
    [property: System.Text.Json.Serialization.JsonPropertyName("ok")] bool Ok,
    [property: System.Text.Json.Serialization.JsonPropertyName("url")] string? Url,
    [property: System.Text.Json.Serialization.JsonPropertyName("error")] string? Error);
