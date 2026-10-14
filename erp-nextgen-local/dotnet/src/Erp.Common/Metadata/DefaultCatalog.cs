namespace Erp.Common.Metadata;

/// <summary>
/// كتالوج احتياطي مدمج. يُستخدم فقط إذا كانت جداول الـ Metadata
/// (core.entities / core.entity_fields) فارغة أو غير متاحة.
/// المصدر الحقيقي في الإنتاج هو قاعدة البيانات.
/// </summary>
public static class DefaultCatalog
{
    private static ColumnDefinition C(string name, string ar, string en, string type, bool readOnly = false) =>
        new() { Name = name, LabelAr = ar, LabelEn = en, DataType = type, IsReadOnly = readOnly };

    public static readonly EntityDefinition[] Entities =
    [
        new()
        {
            Module = "core", Entity = "branch", Schema = "core", Table = "branches",
            DisplayNameAr = "الفروع",
            Columns =
            [
                C("id", "المعرّف", "Id", "string", readOnly: true),
                C("tenant_id", "المنشأة", "Tenant", "string", readOnly: true),
                C("code", "كود الفرع", "Code", "string"),
                C("name", "اسم الفرع", "Name", "string"),
                C("address", "العنوان", "Address", "string"),
                C("is_active", "مُفعّل", "Active", "boolean"),
                C("version", "الإصدار", "Version", "number", readOnly: true),
                C("created_at", "تاريخ الإنشاء", "Created At", "date", readOnly: true),
                C("created_by", "أنشأه", "Created By", "string", readOnly: true),
                C("updated_at", "تاريخ التعديل", "Updated At", "date", readOnly: true),
                C("updated_by", "عدّله", "Updated By", "string", readOnly: true),
                C("deleted_at", "تاريخ الأرشفة", "Deleted At", "date", readOnly: true)
            ]
        },
        new()
        {
            Module = "core", Entity = "user", Schema = "core", Table = "users",
            DisplayNameAr = "المستخدمون",
            Columns =
            [
                C("id", "المعرّف", "Id", "string", readOnly: true),
                C("tenant_id", "المنشأة", "Tenant", "string", readOnly: true),
                C("email", "البريد الإلكتروني", "Email", "string"),
                C("full_name", "الاسم الكامل", "Full Name", "string"),
                C("status", "الحالة", "Status", "badge"),
                C("version", "الإصدار", "Version", "number", readOnly: true),
                C("created_at", "تاريخ الإنشاء", "Created At", "date", readOnly: true),
                C("created_by", "أنشأه", "Created By", "string", readOnly: true),
                C("updated_at", "تاريخ التعديل", "Updated At", "date", readOnly: true),
                C("updated_by", "عدّله", "Updated By", "string", readOnly: true),
                C("deleted_at", "تاريخ الأرشفة", "Deleted At", "date", readOnly: true)
            ]
        },
        new()
        {
            Module = "core", Entity = "role", Schema = "core", Table = "roles",
            DisplayNameAr = "الأدوار",
            Columns =
            [
                C("id", "المعرّف", "Id", "string", readOnly: true),
                C("tenant_id", "المنشأة", "Tenant", "string", readOnly: true),
                C("code", "كود الدور", "Code", "string"),
                C("name", "اسم الدور", "Name", "string"),
                C("is_system", "دور نظام", "System", "boolean", readOnly: true),
                C("version", "الإصدار", "Version", "number", readOnly: true),
                C("created_at", "تاريخ الإنشاء", "Created At", "date", readOnly: true),
                C("created_by", "أنشأه", "Created By", "string", readOnly: true),
                C("updated_at", "تاريخ التعديل", "Updated At", "date", readOnly: true),
                C("updated_by", "عدّله", "Updated By", "string", readOnly: true),
                C("deleted_at", "تاريخ الأرشفة", "Deleted At", "date", readOnly: true)
            ]
        }
    ];
}
