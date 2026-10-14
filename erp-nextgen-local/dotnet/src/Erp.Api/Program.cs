using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Erp.Api;
using Erp.Api.Auth;
using Erp.Api.Endpoints;
using Erp.Common.Metadata;
using Erp.Common.Security;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------
// 1. الاتصال بقاعدة البيانات (NpgsqlDataSource = Connection Pool مُدار)
// ---------------------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException(
        "ConnectionStrings:Postgres غير مضبوط في appsettings.json");

var dataSource = new NpgsqlDataSourceBuilder(connectionString).Build();
builder.Services.AddSingleton(dataSource);

// ---------------------------------------------------------------------
// 2. الـ Metadata Registry وفلتر الصلاحيات
// ---------------------------------------------------------------------
builder.Services.AddSingleton<IMetadataRegistry, MetadataRegistry>();
builder.Services.AddSingleton<RequireActionFilter>();
builder.Services.AddSingleton<ITokenService, TokenService>();

// ---------------------------------------------------------------------
// 3. المصادقة بـ JWT
// ---------------------------------------------------------------------
var signingKey = builder.Configuration["Jwt:SigningKey"]
    ?? throw new InvalidOperationException("Jwt:SigningKey غير مضبوط في appsettings.json");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.Name,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();

// ---------------------------------------------------------------------
// 4. OpenAPI + CORS
// ---------------------------------------------------------------------
builder.Services.AddOpenApi();

builder.Services.AddCors(options => options.AddPolicy("ErpCorsPolicy", policy => policy
    .WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                 ?? ["http://localhost:3000", "http://localhost:5173"])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

// ---------------------------------------------------------------------
// 5. تحميل الـ Metadata من الداتابيز عند الإقلاع
// ---------------------------------------------------------------------
await using (var scope = app.Services.CreateAsyncScope())
{
    var registry = scope.ServiceProvider.GetRequiredService<IMetadataRegistry>();
    try
    {
        await registry.LoadAsync(dataSource);
        app.Logger.LogInformation("تم تحميل {Count} كيان من الـ Metadata Registry.", registry.All.Count);
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex,
            "تعذّر تحميل الـ Metadata من قاعدة البيانات. سيُستخدم الكتالوج المدمج. " +
            "تأكد من تشغيل الـ Migrations وأن ConnectionStrings:Postgres صحيح.");
    }
}

app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    context.Response.ContentType = "application/problem+json";
    await context.Response.WriteAsJsonAsync(new
    {
        title = "خطأ غير متوقع في الخادم",
        status = 500,
        traceId = context.TraceIdentifier
    });
}));

// Correlation ID لكل طلب (يُستخدم في سجل التدقيق)
app.Use(async (context, next) =>
{
    var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
                        ?? Guid.NewGuid().ToString("N");
    context.Items["CorrelationId"] = correlationId;
    context.Response.Headers["X-Correlation-Id"] = correlationId;
    await next();
});

app.UseCors("ErpCorsPolicy");
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();

// ---------------------------------------------------------------------
// 6. صفحة البداية (توثيق سريع)
// ---------------------------------------------------------------------
app.MapGet("/", () => Results.Content(HomePage.Html, "text/html; charset=utf-8"))
   .AllowAnonymous();

// ---------------------------------------------------------------------
// 7. نقاط النهاية
// ---------------------------------------------------------------------
app.MapAuthRoutes();
app.MapSystemRoutes();
app.MapGenericDataRoutes();

app.Run();
