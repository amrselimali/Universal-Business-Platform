/**
 * ميزانية السرعة لنقاط النهاية (Speed Budget — k6)
 * ---------------------------------------------------------------------------
 * الهدف المعتمد: **p95 < 200ms** لأي نقطة نهاية، و p99 < 400ms، ومعدل فشل < 1%.
 *
 * مهم: هذا الملف **لا يعمل في الـ CI** لأنه يحتاج خدمة حقيقية تعمل فعلاً
 * (Erp.Api + قاعدة بيانات). يُشغَّل على بيئة اختبار/إنتاج staging قبل أي إصدار:
 *
 *   # 1) ثبّت k6 (مرة واحدة): https://grafana.com/docs/k6/latest/set-up/install-k6/
 *   # 2) سجّل الدخول واحصل على التوكن من Erp.Api ثم:
 *   k6 run perf/api-budget.js -e BASE_URL=http://localhost:5080 -e TOKEN=<access_token>
 *
 * المتغيرات: BASE_URL · TOKEN · MODULE (core) · ENTITY (branch) · LIMIT (50)
 * النتائج تُقرأ من مخرجات k6: http_req_duration p95/p99 + http_req_failed.
 *
 * لماذا لا يُقاس داخل التطبيق؟ لأن قياس الزمن الحقيقي يحتاج شبكة وقاعدة بيانات
 * ومتصفح — والقياس داخل المتصفح يعطي رقماً مضلِّلاً. الشاشة تفحص بدلاً من ذلك
 * الثوابت المعمارية التي تمنع البطء (نقطة نهاية واحدة، Keyset Pagination،
 * بث لحظي بلا سحب دوري، وخدمة دائمة التشغيل).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5080';
const TOKEN = __ENV.TOKEN || '';
const MODULE = __ENV.MODULE || 'core';
const ENTITY = __ENV.ENTITY || 'branch';
const LIMIT = Number(__ENV.LIMIT || 50);
const ENDPOINT = `${BASE_URL}/api/v1/generic/${MODULE}.${ENTITY}?limit=${LIMIT}`;

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200', 'p(99)<400'],
  },
};

const headers = () => ({
  headers: {
    Authorization: TOKEN ? `Bearer ${TOKEN}` : undefined,
    'Content-Type': 'application/json',
    'X-Client-Id': 'k6-budget',
  },
});

export default function readBudget() {
  const response = http.get(ENDPOINT, headers());

  check(response, {
    'الحالة 200 أو 403 (رفض صلاحيات مقبول)': (r) => r.status === 200 || r.status === 403,
    'زمن الاستجابة داخل الميزانية': (r) => r.timings.duration < 200,
    'الحمولة JSON': (r) => (r.headers['Content-Type'] || '').includes('json'),
  });

  sleep(1);
}
