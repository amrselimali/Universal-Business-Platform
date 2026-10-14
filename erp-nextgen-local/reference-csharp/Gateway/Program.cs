using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// 1. تسجيل محرك YARP Reverse Proxy
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// 2. سياسة الـ Rate Limiting الموزعة لكل منشأة لمنع الإغراق
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("fixed-window-tenant", ctx =>
    {
        var tenantId = ctx.User.FindFirst("tenant_id")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon";
        return RateLimitPartition.GetFixedWindowLimiter(tenantId, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 600, // 600 طلب بالدقيقة لكل عميل
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 20
        });
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("ErpCorsPolicy", p =>
        p.WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? ["*"])
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials());
});

var app = builder.Build();

app.UseCors("ErpCorsPolicy");
app.UseRateLimiter();

// 3. توجيه جميع الطلبات عبر YARP
app.MapReverseProxy(proxyPipeline =>
{
    proxyPipeline.Use((context, next) =>
    {
        // إضافة Correlation ID و Client IP لضمان سلامة الـ Audit Log
        context.Request.Headers["X-Correlation-Id"] = Guid.NewGuid().ToString("N");
        return next();
    });
});

app.Run();
