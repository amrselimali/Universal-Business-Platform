# رفع المشروع بملفين فقط — بدون Git وبدون أوامر

الطريقة دي بتخلي **GitHub Actions** يفك ضغط المشروع وينشره كامل تلقائياً.
مش محتاج ترفع 200 ملف، ومش محتاج Git ولا GitHub Desktop.

---

## المطلوب

1. ملف ZIP للمشروع.
2. ملف workflow صغير.
3. الـ Repo الجديد فاضي.

---

## الخطوة 1 — نزّل ملف المشروع

**تحميل مباشر:**

https://raw.githubusercontent.com/amrselimali/Universal-Business-Platform/v2-standalone/Universal-Business-Platform-v2-source.zip

- الحجم: 205 KB تقريباً
- **متفكش الضغط** — هترفعه ZIP زي ما هو.

---

## الخطوة 2 — ارفع الـ ZIP في الـ Repo الجديد

افتح الرابط ده مباشرة:

https://github.com/amrselimali/Universal-Business-Platform-v2/upload/main

1. اسحب ملف `Universal-Business-Platform-v2-source.zip` إلى الصفحة.
2. اكتب Commit message: `chore: add source archive`
3. اضغط **Commit changes**.

> لو الصفحة قالت إن الـ branch `main` غير موجود، افتح:
> https://github.com/amrselimali/Universal-Business-Platform-v2
> ثم **Add file → Upload files**.

---

## الخطوة 3 — أنشئ ملف الـ workflow

افتح الرابط ده مباشرة:

https://github.com/amrselimali/Universal-Business-Platform-v2/new/main?filename=.github/workflows/bootstrap.yml

1. اسم الملف سيكون جاهز: `.github/workflows/bootstrap.yml`
2. افتح محتوى الملف من هنا:

   https://raw.githubusercontent.com/amrselimali/Universal-Business-Platform/v2-standalone/ci/bootstrap-extract.yml

3. انسخ **كل** المحتوى، والصقه في مربع الملف.
4. Commit message: `ci: bootstrap source extraction`
5. اضغط **Commit changes**.

> لو GitHub رفض إنشاء مجلد `.github/workflows`، استخدم:
> **Add file → Create new file** واكتب المسار كامل:
> `.github/workflows/bootstrap.yml`

---

## الخطوة 4 — استنى GitHub Actions

1. افتح:
   https://github.com/amrselimali/Universal-Business-Platform-v2/actions
2. ستجد Workflow اسمه **Bootstrap Universal Business Platform v2**.
3. اضغط عليه → **Run workflow** لو لم يبدأ تلقائياً.
4. استنى 1–2 دقيقة حتى تظهر علامة ✅ خضراء.

الـ workflow سيقوم تلقائياً بـ:

- فك ضغط المشروع في جذر الـ Repo
- إضافة `src/` و`tests/` و`docs/` وكل الملفات
- حذف ملف ZIP
- حذف ملف الـ workflow نفسه بعد الانتهاء

---

## الخطوة 5 — تأكد من النتيجة

افتح الـ Repo:

https://github.com/amrselimali/Universal-Business-Platform-v2

لازم تشوف:

```
src/
tests/
docs/
ci/
db/
README.md
Dockerfile
docker-compose.yml
UniversalBusinessPlatform.slnx
```

وتأكد:

- **Settings → General → Default branch = main**
- عدد الملفات 200 تقريباً، وليس ملف ZIP فقط.

---

## الخطوة 6 — تفعيل CI (اختياري)

بعد نجاح الخطوات:

1. افتح:
   https://github.com/amrselimali/Universal-Business-Platform-v2/new/main?filename=.github/workflows/ci.yml
2. افتح:
   https://raw.githubusercontent.com/amrselimali/Universal-Business-Platform-v2/main/ci/ci.yml
   (بعد ما يكون الملف موجوداً في الـ Repo الجديد)
3. انسخ المحتوى والصقه، ثم Commit.

---

## لو حصلت مشكلة

| المشكلة | الحل |
|---|---|
| Workflow فشل: `Source archive not found` | ارفع ZIP أولاً في جذر الـ Repo، ثم أعد تشغيل الـ workflow |
| `Resource not accessible by integration` | في **Settings → Actions → General** اختر **Read and write permissions** ثم أعد التشغيل |
| لا يوجد زر Run workflow | تأكد أن الملف في `.github/workflows/bootstrap.yml` على فرع `main` |
| ظهر `src/src` أو `tests/tests` | احذف المجلد المكرر، وأعد رفع ZIP جديد أو أعد التشغيل |
| الـ ZIP موجود لكن لا شيء يحدث | افتح **Actions** واضغط على الـ workflow ثم **Run workflow** |

---

## ملاحظة أمان

الـ workflow يستخدم `GITHUB_TOKEN` الخاص بالـ Repo نفسه فقط، بصلاحية `contents: write`،
ويحذف نفسه بعد نجاح فك الضغط. لا يحتاج أي Token خارجي ولا صلاحيات على مستودعات أخرى.
