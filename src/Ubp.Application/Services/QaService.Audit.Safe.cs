using Dapper;
using Npgsql;

namespace Ubp.Application.Services;

public sealed partial class QaService
{
    /// <summary>
    /// تنفيذ استعلام داخل SAVEPOINT: أي خطأ في فحص واحد لا يُجهض معاملة الفحص كلها
    /// (PostgreSQL يرفض بقية الأوامر بعد أي خطأ داخل نفس المعاملة).
    /// </summary>
    private static async Task<T?> SafeScalarAsync<T>(NpgsqlConnection connection,
        NpgsqlTransaction tx, string sql, object? args, CancellationToken ct)
    {
        await connection.ExecuteAsync(new CommandDefinition(
            "SAVEPOINT qa_check", transaction: tx, cancellationToken: ct));
        try
        {
            var value = await connection.ExecuteScalarAsync<T>(new CommandDefinition(
                sql, args, tx, cancellationToken: ct));
            await connection.ExecuteAsync(new CommandDefinition(
                "RELEASE SAVEPOINT qa_check", transaction: tx, cancellationToken: ct));
            return value;
        }
        catch
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "ROLLBACK TO SAVEPOINT qa_check", transaction: tx, cancellationToken: ct));
            throw;
        }
    }

    /// <summary>قراءة قائمة داخل SAVEPOINT بنفس منطق الحماية.</summary>
    private static async Task<IReadOnlyList<T>> SafeQueryAsync<T>(NpgsqlConnection connection,
        NpgsqlTransaction tx, string sql, object? args, CancellationToken ct)
    {
        await connection.ExecuteAsync(new CommandDefinition(
            "SAVEPOINT qa_query", transaction: tx, cancellationToken: ct));
        try
        {
            var rows = (await connection.QueryAsync<T>(new CommandDefinition(
                sql, args, tx, cancellationToken: ct))).ToList();
            await connection.ExecuteAsync(new CommandDefinition(
                "RELEASE SAVEPOINT qa_query", transaction: tx, cancellationToken: ct));
            return rows;
        }
        catch
        {
            await connection.ExecuteAsync(new CommandDefinition(
                "ROLLBACK TO SAVEPOINT qa_query", transaction: tx, cancellationToken: ct));
            throw;
        }
    }
}