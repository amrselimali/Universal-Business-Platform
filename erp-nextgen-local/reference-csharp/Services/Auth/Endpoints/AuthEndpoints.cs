using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Erp.Services.Auth.Security;

namespace Erp.Services.Auth.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthRoutes(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth");

        // auth.login: دخول آمن وتوليد التوكن
        group.MapPost("/login", async (
            [FromBody] LoginRequest req,
            [FromServices] ITokenService tokenService,
            [FromServices] IPasswordHasher hasher,
            [FromServices] NpgsqlDataSource db,
            HttpContext ctx) =>
        {
            await using var conn = await db.OpenConnectionAsync();
            
            var user = await conn.QuerySingleOrDefaultAsync<UserAuthDto>(@"
                SELECT u.id, u.tenant_id, u.email, u.full_name, u.password_hash, u.status
                FROM core.users u
                JOIN core.tenants t ON t.id = u.tenant_id
                WHERE t.code = @TenantCode AND u.email = @Email AND u.deleted_at IS NULL;",
                new { req.TenantCode, req.Email });

            if (user is null || !hasher.Verify(req.Password, user.Password_Hash))
                return Results.Unauthorized();

            if (user.Status != "active")
                return Results.Problem("الحساب معطل أو مقفل حالياً", statusCode: 403);

            // استخراج صلاحيات المستخدم من جدول core.permissions
            var permissions = await conn.QueryAsync<string>(@"
                SELECT action_code FROM core.permissions p
                JOIN core.user_roles ur ON ur.role_id = p.role_id AND ur.tenant_id = p.tenant_id
                WHERE ur.user_id = @UserId AND ur.tenant_id = @TenantId;",
                new { UserId = user.Id, TenantId = user.Tenant_Id });

            var accessToken = tokenService.GenerateAccessToken(user, permissions);
            var (refreshToken, familyId) = await tokenService.CreateRefreshTokenAsync(user.Tenant_Id, user.Id, conn);

            // تعيين الـ Refresh Token في HttpOnly Cookie آمنة
            ctx.Response.Cookies.Append("erp_refresh", refreshToken, new CookieOptions {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Expires = DateTimeOffset.UtcNow.AddDays(7)
            });

            return Results.Ok(new {
                token = accessToken,
                user = new { user.Id, user.Full_Name, user.Email, user.Tenant_Id }
            });
        });

        // auth.logout: إلغاء الجلسة والتوكن
        group.MapPost("/logout", async (
            [FromServices] ITokenService tokenService,
            [FromServices] NpgsqlDataSource db,
            HttpContext ctx) =>
        {
            if (ctx.Request.Cookies.TryGetValue("erp_refresh", out var refreshToken))
            {
                await tokenService.RevokeRefreshTokenAsync(refreshToken, db);
                ctx.Response.Cookies.Delete("erp_refresh");
            }
            return Results.Ok(new { message = "تم تسجيل الخروج بنجاح" });
        });
    }
}
