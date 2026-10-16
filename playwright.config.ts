import { defineConfig, devices } from '@playwright/test';

/**
 * إعداد اختبارات End-to-End
 * ---------------------------------------------------------------------------
 * التشغيل:  npm run e2e
 *
 * ملاحظات:
 *   • نستخدم Chromium فقط (الأسرع والأخف) — التطبيق SPA واحد.
 *   • الخادم يُشغَّل تلقائياً من نسخة الإنتاج (`vite preview`) لاختبار
 *     ما يُنشَر فعلاً، لا نسخة التطوير.
 *   • عامل واحد فقط (workers: 1) لتجنّب استهلاك ذاكرة عالٍ.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
