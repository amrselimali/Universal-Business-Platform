/**
 * نقطة تشغيل الـ API
 * ---------------------------------------------------------------------------
 * المنطق كله في `app.ts` (دالة `buildApp`) — وهذا الملف مسؤول فقط عن:
 *   1. قراءة الإعدادات من متغيرات البيئة.
 *   2. توصيل طبقة قاعدة البيانات الحقيقية.
 *   3. تشغيل الخادم.
 *
 * هذا الفصل يجعل الأمان (الصلاحيات وعزل المستأجرين) قابلاً للاختبار
 * عبر `buildApp` بدوال قاعدة بيانات وهمية — بلا خادم ولا شبكة.
 */

import { buildApp } from './app.js';
import { one, withTenant, rawQuery } from './db.js';

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

const app = await buildApp({
  db: { one, withTenant, rawQuery },
  jwtSecret: JWT_SECRET,
  jwtExpiresIn: JWT_EXPIRES_IN,
  corsOrigins: CORS_ORIGINS,
});

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`API listening on :${PORT}`);
