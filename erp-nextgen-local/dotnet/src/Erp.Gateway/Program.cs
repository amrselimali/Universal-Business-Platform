using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// 1. محرك YARP Reverse Proxy — التوجيه يُقرأ من appsettings.json
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// 2. Rate Limiting لكل منشأة (Tenant) لمنع الإغراق
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("fixed-window-tenant", ctx =>
    {
        var tenantId = ctx.User.FindFirst("tenant_id")?.Value
                       ?? ctx.Connection.RemoteIpAddress?.ToString()
                       ?? "anon";

        return RateLimitPartition.GetFixedWindowLimiter(tenantId, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 600,               // 600 طلب بالدقيقة لكل عميل
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 20
        });
    });
});

builder.Services.AddCors(options => options.AddPolicy("ErpCorsPolicy", policy => policy
    .WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                 ?? ["http://localhost:3000", "http://localhost:5173"])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

app.UseCors("ErpCorsPolicy");
app.UseRateLimiter();

// 3. توجيه كل الطلبات عبر YARP مع إضافة Correlation ID
app.MapReverseProxy(proxyPipeline =>
{
    proxyPipeline.Use((context, next) =>
    {
        context.Request.Headers["X-Correlation-Id"] = Guid.NewGuid().ToString("N");
        return next();
    });
});

app.Run();
