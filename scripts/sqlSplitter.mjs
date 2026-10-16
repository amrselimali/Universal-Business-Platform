/**
 * يجزّئ ملف SQL إلى أوامر منفصلة.
 * ---------------------------------------------------------------------------
 * ضروري لأن سائق Neon السحابي (HTTP) لا يسمح بأوامر متعددة في جملة واحدة:
 *   "cannot insert multiple commands into a prepared statement"
 *
 * يجب ألا يجزّئ داخل:
 *   • نص بين علامتي اقتباس مفردة  ('…')
 *   • دالة/كتلة بعلامة دولار       ($$ … $$  أو  $tag$ … $tag$)
 *   • تعليق سطري                   (-- …)
 *   • تعليق كتلة                   (/* … *​/)
 */
export function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let inSingle = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    // داخل تعليق سطري: ينتهي بنهاية السطر
    if (inLineComment) {
      current += ch;
      if (ch === '\n') inLineComment = false;
      i += 1;
      continue;
    }

    // داخل تعليق كتلة: ينتهي بـ */
    if (inBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i += 2;
        inBlockComment = false;
        continue;
      }
      i += 1;
      continue;
    }

    // داخل نص مفرد: علامة الاقتباس المزدوجة '' تعني اقتباساً حرفياً
    if (inSingle) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += next;
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i += 1;
      continue;
    }

    // داخل كتلة دولار: ننتظر نفس العلامة للإغلاق
    if (dollarTag) {
      if (ch === '$' && sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }

    // بداية تعليق سطري
    if (ch === '-' && next === '-') {
      current += ch + next;
      i += 2;
      inLineComment = true;
      continue;
    }

    // بداية تعليق كتلة
    if (ch === '/' && next === '*') {
      current += ch + next;
      i += 2;
      inBlockComment = true;
      continue;
    }

    // بداية نص مفرد
    if (ch === "'") {
      current += ch;
      i += 1;
      inSingle = true;
      continue;
    }

    // بداية كتلة دولار
    if (ch === '$') {
      const match = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    // نهاية أمر
    if (ch === ';') {
      current += ch;
      const trimmed = current.trim();
      if (trimmed.length > 1) statements.push(trimmed);
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const tail = current.trim();
  if (tail.length > 1) statements.push(tail);

  // استبعاد المقاطع التي تحتوي تعليقات فقط (لا أوامر قابلة للتنفيذ)
  return statements.filter((statement) => isExecutableSql(statement));
}

/** هل المقطع يحتوي أمراً قابلاً للتنفيذ (وليس تعليقات فقط)؟ */
export function isExecutableSql(statement) {
  return statement
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('--'))
    .join('')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim().length > 0;
}
