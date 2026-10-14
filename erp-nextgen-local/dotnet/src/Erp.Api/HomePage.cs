namespace Erp.Api;

/// <summary>صفحة بداية بسيطة توضّح نقاط النهاية المتاحة أثناء التطوير المحلي.</summary>
public static class HomePage
{
    public const string Html = """
        <!doctype html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>ERP NextGen API — محلي</title>
          <style>
            body { font-family: system-ui, "Segoe UI", Tahoma, sans-serif; background:#0f172a; color:#e2e8f0; margin:0; padding:40px; }
            .wrap { max-width: 900px; margin: 0 auto; }
            h1 { color:#38bdf8; margin-bottom:4px; }
            p.sub { color:#94a3b8; margin-top:0; }
            table { width:100%; border-collapse: collapse; margin-top:24px; background:#1e293b; border-radius:10px; overflow:hidden; }
            th, td { padding:10px 14px; text-align:right; border-bottom:1px solid #334155; font-size:14px; }
            th { background:#334155; color:#f1f5f9; }
            code { background:#0b1220; color:#7dd3fc; padding:2px 6px; border-radius:5px; font-family: ui-monospace, Consolas, monospace; direction:ltr; display:inline-block; }
            .m { color:#fbbf24; font-weight:bold; }
            .ok { color:#4ade80; }
            a { color:#38bdf8; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <h1>ERP NextGen API</h1>
            <p class="sub">معمارية YARP + .NET 10 + PostgreSQL RLS + SignalR — تعمل محلياً</p>

            <table>
              <tr><th>الطريقة</th><th>المسار</th><th>الوصف</th></tr>
              <tr><td class="m">GET</td><td><code>/api/v1/system/health</code></td><td>فحص الاتصال بقاعدة البيانات</td></tr>
              <tr><td class="m">GET</td><td><code>/api/v1/system/tables</code></td><td>عرض كل الجداول الحقيقية في الداتابيز</td></tr>
              <tr><td class="m">GET</td><td><code>/api/v1/system/entities</code></td><td>الكيانات المسجّلة في الـ Metadata</td></tr>
              <tr><td class="m">GET</td><td><code>/api/v1/system/actions</code></td><td>سجل الأفعال (Action Registry)</td></tr>
              <tr><td class="m">POST</td><td><code>/api/v1/auth/login</code></td><td>تسجيل الدخول (DEMO / admin@demo.local / Admin@123)</td></tr>
              <tr><td class="m">GET</td><td><code>/api/v1/generic/core.branch</code></td><td>قراءة الفروع (يحتاج Token)</td></tr>
              <tr><td class="m">PUT</td><td><code>/api/v1/generic/core.branch</code></td><td>تحديث فرع (Optimistic Concurrency)</td></tr>
              <tr><td class="m">GET</td><td><code>/openapi/v1.json</code></td><td>مواصفة OpenAPI</td></tr>
            </table>

            <p style="margin-top:24px" class="ok">✓ الخادم يعمل. ابدأ بـ /api/v1/system/health</p>
          </div>
        </body>
        </html>
        """;
}
