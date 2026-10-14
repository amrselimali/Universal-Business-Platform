using Dapper;
using Npgsql;

namespace Erp.Common.Metadata;

/// <summary>
/// سجل الكيانات (Entity Registry). هو المصدر الوحيد لأسماء الجداول والأعمدة
/// المسموح للـ Generic Data API بالوصول إليها (Allow-list صارم).
/// </summary>
public interface IMetadataRegistry
{
    IReadOnlyCollection<EntityDefinition> All { get; }
    EntityDefinition? Find(string module, string entity);
    EntityDefinition GetEntity(string module, string entity);
    Task LoadAsync(NpgsqlDataSource dataSource, CancellationToken cancellationToken = default);
}

public sealed class MetadataRegistry : IMetadataRegistry
{
    private readonly Dictionary<string, EntityDefinition> _entities = new(StringComparer.OrdinalIgnoreCase);

    public MetadataRegistry()
    {
        // كتالوج احتياطي مدمج حتى تعمل الواجهة قبل تحميل البيانات من الداتابيز.
        foreach (var entity in DefaultCatalog.Entities)
            _entities[entity.Code] = entity;
    }

    public IReadOnlyCollection<EntityDefinition> All => _entities.Values.ToArray();

    public EntityDefinition? Find(string module, string entity)
        => _entities.TryGetValue($"{module}.{entity}", out var found) ? found : null;

    public EntityDefinition GetEntity(string module, string entity)
        => Find(module, entity) ?? throw new KeyNotFoundException(
            $"الكيان [{module}.{entity}] غير مسجل في الـ Metadata Registry. " +
            "كل كيان يجب أن يُسجَّل في core.entities أولاً.");

    /// <summary>
    /// يُحمّل الكيانات من core.entities، والأعمدة الفعلية من information_schema،
    /// ثم يُثريها بالتسميات وخصائص القراءة من core.entity_fields.
    /// الهدف: لا نعتمد على قائمة أعمدة مكتوبة يدوياً في الكود.
    /// </summary>
    public async Task LoadAsync(NpgsqlDataSource dataSource, CancellationToken cancellationToken = default)
    {
        await using var conn = await dataSource.OpenConnectionAsync(cancellationToken);

        var entityRows = (await conn.QueryAsync<EntityRow>(new CommandDefinition(@"
            SELECT e.code            AS Code,
                   e.module_code     AS Module,
                   e.table_name      AS TableName,
                   e.display_name_ar AS DisplayNameAr
            FROM core.entities e
            ORDER BY e.code;", cancellationToken: cancellationToken))).ToArray();

        if (entityRows.Length == 0)
            return; // نُبقي الكتالوج المدمج

        var fieldRows = (await conn.QueryAsync<FieldRow>(new CommandDefinition(@"
            SELECT entity_code, column_name, label_ar, label_en, data_type, is_readonly
            FROM core.entity_fields;", cancellationToken: cancellationToken))).ToArray();

        var fields = fieldRows
            .GroupBy(f => f.EntityCode, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToArray(), StringComparer.OrdinalIgnoreCase);

        var schemas = entityRows
            .Select(e => ParseSchema(e.TableName))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var columnRows = (await conn.QueryAsync<ColumnRow>(new CommandDefinition(@"
            SELECT table_schema, table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = ANY(@schemas)
            ORDER BY table_schema, table_name, ordinal_position;",
            new { schemas }, cancellationToken: cancellationToken))).ToArray();

        foreach (var row in entityRows)
        {
            var schema = ParseSchema(row.TableName);
            var table = ParseTable(row.TableName);
            var key = $"{schema}.{table}";

            var columns = columnRows
                .Where(c => $"{c.TableSchema}.{c.TableName}".Equals(key, StringComparison.OrdinalIgnoreCase))
                .Select(c => BuildColumn(c, fields.TryGetValue(row.Code, out var f) ? f : []))
                .ToArray();

            if (columns.Length == 0)
                continue; // الجدول غير موجود بعد

            var definition = new EntityDefinition
            {
                Module = row.Module,
                Entity = row.Code.Contains('.') ? row.Code[(row.Code.IndexOf('.') + 1)..] : row.Code,
                Schema = schema,
                Table = table,
                DisplayNameAr = row.DisplayNameAr,
                Columns = columns
            };

            _entities[definition.Code] = definition;
        }
    }

    private static ColumnDefinition BuildColumn(ColumnRow column, FieldRow[] metadata)
    {
        var meta = metadata.FirstOrDefault(m =>
            m.ColumnName.Equals(column.ColumnName, StringComparison.OrdinalIgnoreCase));

        return new ColumnDefinition
        {
            Name = column.ColumnName,
            LabelAr = meta?.LabelAr ?? column.ColumnName,
            LabelEn = meta?.LabelEn ?? column.ColumnName,
            DataType = meta?.DataType ?? MapDataType(column.DataType),
            IsReadOnly = meta?.IsReadOnly ?? SqlIdentifier.SystemColumns.Contains(column.ColumnName),
            IsPrimaryKey = column.ColumnName.Equals("id", StringComparison.OrdinalIgnoreCase)
        };
    }

    private static string MapDataType(string informationSchemaType) => informationSchemaType switch
    {
        "boolean" => "boolean",
        "integer" or "bigint" or "smallint" => "number",
        "numeric" or "real" or "double precision" => "currency",
        "date" or "timestamp with time zone" or "timestamp without time zone" => "date",
        "jsonb" or "json" => "json",
        _ => "string"
    };

    private static string ParseSchema(string qualified) =>
        qualified.Contains('.') ? qualified.Split('.')[0] : "public";

    private static string ParseTable(string qualified) =>
        qualified.Contains('.') ? qualified.Split('.')[1] : qualified;

    private sealed record EntityRow
    {
        public string Code { get; init; } = string.Empty;
        public string Module { get; init; } = string.Empty;
        public string TableName { get; init; } = string.Empty;
        public string? DisplayNameAr { get; init; }
    }

    private sealed record FieldRow
    {
        public string EntityCode { get; init; } = string.Empty;
        public string ColumnName { get; init; } = string.Empty;
        public string LabelAr { get; init; } = string.Empty;
        public string LabelEn { get; init; } = string.Empty;
        public string DataType { get; init; } = "string";
        public bool IsReadOnly { get; init; }
    }

    private sealed record ColumnRow
    {
        public string TableSchema { get; init; } = string.Empty;
        public string TableName { get; init; } = string.Empty;
        public string ColumnName { get; init; } = string.Empty;
        public string DataType { get; init; } = string.Empty;
        public string IsNullable { get; init; } = string.Empty;
    }
}
