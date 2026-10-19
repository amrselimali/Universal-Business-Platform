# رفع المشروع يدوياً إلى Repository جديد

> النسخة الكاملة موجودة في ملف ZIP واحد. اتبع الخطوات بالترتيب.

---

## 0. الملفات والروابط

| البند | القيمة |
|---|---|
| ملف المشروع | `Universal-Business-Platform-v2-source.zip` |
| تحميل مباشر | https://raw.githubusercontent.com/amrselimali/Universal-Business-Platform/v2-standalone/Universal-Business-Platform-v2-source.zip |
| صفحة الملف على GitHub | https://github.com/amrselimali/Universal-Business-Platform/blob/v2-standalone/Universal-Business-Platform-v2-source.zip |
| الـ Repo الجديد | https://github.com/amrselimali/Universal-Business-Platform-v2 |
| SHA-256 | `588a10359ed2cd2fd06112067feb7d8f6a040c99a8f34d8e024c8efa9a68e3d7` |

**مهم:** الـ Repo الجديد لازم يكون **فاضي تماماً** (بدون README أو .gitignore).

---

## 1. نزّل الملف وفك الضغط

- نزّل الـ ZIP من الرابط المباشر.
- اضغط عليه بزر الماوس الأيمن → **Extract All**.
- ستحصل على مجلد اسمه تقريباً:
  ```
  Universal-Business-Platform-v2-source
  ```
- افتحه؛ لازم تشوف مباشرة:
  ```
  src/
  tests/
  docs/
  ci/
  README.md
  Dockerfile
  docker-compose.yml
  UniversalBusinessPlatform.slnx
  ```

> لو لقيت مجلداً واحداً فقط بداخل ZIP، افتحه حتى تصل للملفات أعلاه.

اختياري للتحقق من سلامة الملف على Windows PowerShell:

```powershell
Get-FileHash .\Universal-Business-Platform-v2-source.zip -Algorithm SHA256
```

لازم يظهر نفس الـ SHA-256 الموجود بالأعلى.

---

## الطريقة (أ) — الأسهل: GitHub Desktop

1. نزّل **GitHub Desktop** من https://desktop.github.com
2. سجّل الدخول بحسابك.
3. من القائمة: **File → Add local repository**.
4. اختار مجلد المشروع الذي فككت الضغط عنه.
5. لو ظهرت رسالة أنه ليس Git repository، اضغط **create a repository**:
   - Name: `Universal-Business-Platform-v2`
   - Local path: نفس المجلد
   - اضغط **Create repository**
6. اضغط **Publish repository**:
   - **Uncheck** `Keep this code private` (لأنه Public)
   - اضغط **Publish repository**
7. في GitHub افتح الـ Repo → **Settings → General → Default branch** = `main`.

---

## الطريقة (ب) — سطر أوامر (4 أوامر فقط)

من جهازك، في Terminal / PowerShell:

```bash
git clone --branch v2-standalone --single-branch https://github.com/amrselimali/Universal-Business-Platform.git ubp-v2
cd ubp-v2
git remote set-url origin https://github.com/amrselimali/Universal-Business-Platform-v2.git
git push -u origin HEAD:main
```

بعدها:

```bash
git branch -u origin/main
```

> لو طلب تسجيل الدخول، سجّل بحسابك على GitHub. لا تستخدم أي Token في الأوامر.

---

## الطريقة (ج) — رفع يدوي من موقع GitHub (بدون أي برامج)

موقع GitHub يقبل **100 ملف في كل عملية رفع**، والمشروع أكبر من ذلك، لذلك ارفعه على **3 دفعات**.
الترتيب مهم: ارفع الملفات الجذرية أولاً حتى يوجد `README.md` والـ solution، ثم باقي المجلدات.

### الدفعة 1 — الملفات الأساسية

1. افتح الـ Repo الجديد → **Add file → Upload files**.
2. من مجلد المشروع المفكوك، اسحب **الملفات التالية فقط** (وليس المجلدات):
   ```
   .dockerignore
   .env.example
   .gitignore
   README.md
   PROJECT_STATE.md
   CHANGELOG.md
   Directory.Build.props
   UniversalBusinessPlatform.slnx
   Dockerfile
   docker-compose.yml
   UPLOAD-MANUAL-AR.md
   ```
   > الملفات التي تبدأ بنقطة مثل `.gitignore` قد تكون مخفية في Windows:
   > View → Show → Hidden items.
3. اكتب في Commit message: `chore: root project files`
4. اضغط **Commit changes**.

### الدفعة 2 — `src` و`docs`

1. ارجع للـ Repo → **Add file → Upload files**.
2. اسحب مجلدات:
   ```
   src/
   docs/
   ci/
   db/
   ```
   (اسحب المجلدات نفسها؛ GitHub يحافظ على المسارات)
3. Commit message: `feat: application source and docs`
4. **Commit changes**.

> لو ظهر خطأ أن العدد أكبر من 100 ملف، ارفع `src/Ubp.Core` و`src/Ubp.Infrastructure`
> في دفعة، ثم `src/Ubp.Application` و`src/Ubp.Web` في دفعة أخرى.

### الدفعة 3 — `tests`

1. **Add file → Upload files**.
2. اسحب مجلد:
   ```
   tests/
   ```
3. Commit message: `test: automated test suite`
4. **Commit changes**.

### بعد انتهاء الدفعات — تأكد من الشكل التالي

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

لو ظهر مسار مكرر مثل `src/src/...` أو `tests/tests/...`، احذف المجلد المكرر
من GitHub وأعد رفع المجلد بطريقة السحب الصحيحة.

---

## 2. بعد الرفع: تأكد أن `main` هو الـ Default

- افتح الـ Repo → **Settings → General**
- **Default branch** = `main`
- لو الـ branch اسمه مختلف، اضغط أيقونة التبديل واختر `main`.

---

## 3. تشغيل المشروع محلياً

```bash
docker compose up -d postgres
dotnet run --project src/Ubp.Web
```

- الرابط: `http://localhost:5080`
- الدخول الأول: `admin` / `Admin@123`
- **غيّر كلمة المرور فوراً.**

قواعد البيانات المطلوبة:
- `ubp` (التطبيق)
- `ubp_qa` (مركز الجودة)

يمكن إنشاء `ubp_qa` بأمر:

```bash
createdb -h localhost -U postgres ubp_qa
```

أو باستخدام Docker:

```bash
docker compose up -d postgres
docker exec -it ubp-postgres createdb -U postgres ubp_qa
```

---

## 4. تفعيل CI

الـ workflow موجود في:

```
ci/ci.yml
```

من GitHub:

1. **Add file → Create new file**
2. اسم الملف:
   ```
   .github/workflows/ci.yml
   ```
3. افتح `ci/ci.yml` من الـ Repo، انسخ كل المحتوى، والصقه.
4. Commit.

> إن رفض GitHub إنشاء الملف، يكون الـ App المستخدم بلا صلاحية Workflows.
> استخدم حسابك من واجهة GitHub مباشرة، أو فعّل الصلاحية من إعدادات الـ App.

---

## 5. التحقق النهائي

- Repo جديد Public ✅
- `main` هو الـ Default ✅
- `README.md` ظاهر في الصفحة الرئيسية ✅
- `src/` و`tests/` في الجذر مباشرة ✅
- Build يعمل:
  ```bash
  dotnet build UniversalBusinessPlatform.slnx
  dotnet test tests/Ubp.Tests/Ubp.Tests.csproj
  ```

**النتيجة المتوقعة للاختبارات:** `Passed: 25`

---

## 6. لو حصلت مشكلة

| المشكلة | الحل |
|---|---|
| `Repository not found` | تأكد أن الـ Repo فاضي وأن الرابط صحيح |
| رفع 100 ملف فقط | قسّم `src` إلى دفعتين كما هو موضح |
| ملفات مخفية لا تظهر | View → Show → Hidden items |
| `src/src` أو `tests/tests` | احذف المجلد المكرر وأعد الرفع |
| `README` لا يظهر | تأكد أن الملف في الجذر وليس داخل مجلد |
| `dotnet` غير موجود | ثبّت .NET 10 SDK |
| فشل الاتصال بقاعدة البيانات | شغّل PostgreSQL وأنشئ `ubp` و`ubp_qa` |
| الصفحة تفتح 500 | راجع `logs/` أو شغّل بـ `ASPNETCORE_ENVIRONMENT=Development` |

---

## ملاحظة

هذا الملف والـ ZIP موجودان على فرع `v2-standalone` داخل المستودع الحالي.
بعد نقل المشروع للـ Repo الجديد، يمكنك حذف `Universal-Business-Platform-v2-source.zip`
و`UPLOAD-MANUAL-AR.md` من الـ Repo الجديد إن لم تحتاجهما.
