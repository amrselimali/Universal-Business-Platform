import { neon } from '@neondatabase/serverless';
import { APP_DOCUMENTS_DDL, APP_DOCUMENTS_HISTORY_DDL, APP_DOCUMENTS_HISTORY_INDEX_DDL, NEON_SCHEMA_TABLES, NeonTableSchema, buildAlterTableSql, buildCreateTableSql } from './neonSchema';
import {
  Product,
  Account,
  SalesInvoice,
  Patient,
  StockLevel,
  Tenant,
  Branch,
  Warehouse,
  Party,
  Appointment,
  PatientFollowUp,
  JournalEntry,
} from '../types';

export class NeonService {
  private static getClient(connectionString: string) {
    const cleanUrl = connectionString.trim();
    return neon(cleanUrl);
  }

  static async testLiveConnection(
    connectionString: string
  ): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      const sql = this.getClient(connectionString);
      const res = await sql`SELECT NOW() as current_time, version() as pg_version`;
      if (res && res.length > 0) {
        return {
          success: true,
          message: 'تم الاتصال بقاعدة بيانات Neon السحابية بنجاح!',
          version: String(res[0].pg_version).split(' ')[0] + ' ' + String(res[0].pg_version).split(' ')[1],
        };
      }
      return { success: false, message: 'لم يتم إرجاع استجابة من الخادم' };
    } catch (err: any) {
      console.error('Neon test error:', err);
      return { success: false, message: err.message || 'خطأ في الاتصال بقاعدة البيانات' };
    }
  }

  static async fixSchemaTypes(connectionString: string): Promise<{ success: boolean; message: string }> {
    try {
      const sql = this.getClient(connectionString);
      // Execute each drop statement individually because PostgreSQL prepared statements allow only one command
      await sql`DROP TABLE IF EXISTS patient_follow_ups CASCADE`;
      await sql`DROP TABLE IF EXISTS appointments CASCADE`;
      await sql`DROP TABLE IF EXISTS journal_lines CASCADE`;
      await sql`DROP TABLE IF EXISTS journal_entries CASCADE`;
      await sql`DROP TABLE IF EXISTS sales_invoices CASCADE`;
      await sql`DROP TABLE IF EXISTS stock_levels CASCADE`;
      await sql`DROP TABLE IF EXISTS products CASCADE`;
      await sql`DROP TABLE IF EXISTS accounts CASCADE`;
      await sql`DROP TABLE IF EXISTS patients CASCADE`;
      await sql`DROP TABLE IF EXISTS parties CASCADE`;
      await sql`DROP TABLE IF EXISTS warehouses CASCADE`;
      await sql`DROP TABLE IF EXISTS branches CASCADE`;
      await sql`DROP TABLE IF EXISTS tenants CASCADE`;

      return { success: true, message: 'تمت إعادة تهيئة وتنظيف الجداول في Neon بنجاح! جاهزة الآن لاستقبال البيانات.' };
    } catch (err: any) {
      return { success: false, message: 'فشل في إعادة التهيئة: ' + (err.message || String(err)) };
    }
  }

  static async fetchTableCounts(connectionString: string): Promise<{ [key: string]: number }> {
    try {
      const sql = this.getClient(connectionString);
      const counts: { [key: string]: number } = {};

      try {
        const pRes = await sql`SELECT COUNT(*)::int as c FROM products`;
        counts['products'] = pRes && pRes[0] ? Number(pRes[0].c) : 0;
      } catch {
        counts['products'] = 0;
      }

      try {
        const aRes = await sql`SELECT COUNT(*)::int as c FROM accounts`;
        counts['accounts'] = aRes && aRes[0] ? Number(aRes[0].c) : 0;
      } catch {
        counts['accounts'] = 0;
      }

      try {
        const sRes = await sql`SELECT COUNT(*)::int as c FROM sales_invoices`;
        counts['sales_invoices'] = sRes && sRes[0] ? Number(sRes[0].c) : 0;
      } catch {
        counts['sales_invoices'] = 0;
      }

      try {
        const aptRes = await sql`SELECT COUNT(*)::int as c FROM appointments`;
        counts['appointments'] = aptRes && aptRes[0] ? Number(aptRes[0].c) : 0;
      } catch {
        counts['appointments'] = 0;
      }

      try {
        const fupRes = await sql`SELECT COUNT(*)::int as c FROM patient_follow_ups`;
        counts['patient_follow_ups'] = fupRes && fupRes[0] ? Number(fupRes[0].c) : 0;
      } catch {
        counts['patient_follow_ups'] = 0;
      }

      return counts;
    } catch {
      return {};
    }
  }

  // Fetch all products live from Neon Cloud
  static async fetchProductsFromNeon(connectionString: string): Promise<Product[]> {
    try {
      const sql = this.getClient(connectionString);
      const rows = await sql`
        SELECT id, tenant_id, sku, barcode, name_ar, name_en, category, 
               purchase_price::numeric, selling_price::numeric, min_stock_level, is_service
        FROM products
        ORDER BY name_ar ASC
      `;

      return rows.map((r: any) => ({
        id: String(r.id),
        tenantId: String(r.tenant_id),
        sku: String(r.sku || ''),
        barcode: String(r.barcode || ''),
        nameAr: String(r.name_ar || ''),
        nameEn: String(r.name_en || r.name_ar || ''),
        category: String(r.category || 'عام'),
        purchasePrice: Number(r.purchase_price) || 0,
        sellingPrice: Number(r.selling_price) || 0,
        minStockLevel: Number(r.min_stock_level) || 5,
        unit: 'قطعة',
        isService: Boolean(r.is_service),
      }));
    } catch (err) {
      console.warn('Neon fetch products failed:', err);
      return [];
    }
  }

  // Delete product live from Neon Cloud
  static async deleteProductDirect(connectionString: string, productId: string): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`DELETE FROM products WHERE id = ${productId}`;
      await sql`DELETE FROM stock_levels WHERE product_id = ${productId}`;
      return true;
    } catch (err) {
      console.warn('Neon product delete failed:', err);
      return false;
    }
  }

  static async syncAllData(
    connectionString: string,
    data: {
      tenant: Tenant;
      branches: Branch[];
      warehouses: Warehouse[];
      products: Product[];
      stockLevels: StockLevel[];
      accounts: Account[];
      invoices: SalesInvoice[];
      parties?: Party[];
      appointments?: Appointment[];
      patientFollowUps?: PatientFollowUp[];
      journalEntries?: JournalEntry[];
    }
  ): Promise<{ success: boolean; insertedCount: number; message: string }> {
    try {
      const sql = this.getClient(connectionString);

      // 1. Create tables with flexible string IDs
      await sql`
        CREATE TABLE IF NOT EXISTS tenants (
          id VARCHAR(100) PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255) NOT NULL,
          plan VARCHAR(50) DEFAULT 'Enterprise',
          currency VARCHAR(10) DEFAULT 'EGP',
          tax_rate NUMERIC(5, 4) DEFAULT 0.1400,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS branches (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          code VARCHAR(50) NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          city VARCHAR(100),
          phone VARCHAR(50),
          is_main BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS warehouses (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          code VARCHAR(50) NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          location TEXT
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          sku VARCHAR(100) NOT NULL,
          barcode VARCHAR(100),
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          category VARCHAR(100),
          purchase_price NUMERIC(15, 2) DEFAULT 0.00,
          selling_price NUMERIC(15, 2) DEFAULT 0.00,
          min_stock_level NUMERIC(12, 2) DEFAULT 5.00,
          is_service BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS stock_levels (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          product_id VARCHAR(100) NOT NULL,
          warehouse_id VARCHAR(100) NOT NULL,
          quantity_on_hand NUMERIC(15, 3) DEFAULT 0.000
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS accounts (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          code VARCHAR(50) NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          account_type VARCHAR(50) NOT NULL,
          parent_id VARCHAR(100),
          balance NUMERIC(18, 2) DEFAULT 0.00,
          level INT DEFAULT 1
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS sales_invoices (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          warehouse_id VARCHAR(100),
          invoice_number VARCHAR(100) NOT NULL,
          customer_id VARCHAR(100),
          customer_name VARCHAR(255),
          subtotal NUMERIC(15, 2) NOT NULL,
          discount_amount NUMERIC(15, 2) DEFAULT 0.00,
          tax_amount NUMERIC(15, 2) DEFAULT 0.00,
          net_amount NUMERIC(15, 2) NOT NULL,
          payment_method VARCHAR(50) DEFAULT 'Cash',
          cashier_name VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // The legacy `patients` table is removed: `parties` is now the single source
      // for customers / patients.
      await sql`DROP TABLE IF EXISTS patients CASCADE`;

      await sql`
        CREATE TABLE IF NOT EXISTS parties (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          name VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          type VARCHAR(50) NOT NULL,
          phone VARCHAR(50),
          email VARCHAR(100),
          balance NUMERIC(15, 2) DEFAULT 0.00
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS appointments (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          patient_id VARCHAR(100),
          patient_name VARCHAR(255),
          doctor_name VARCHAR(255),
          service_name_ar VARCHAR(255),
          price NUMERIC(12, 2) DEFAULT 0.00,
          appointment_date VARCHAR(50),
          appointment_time VARCHAR(50),
          status VARCHAR(50) DEFAULT 'Scheduled'
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS journal_entries (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          entry_number VARCHAR(100) NOT NULL,
          date VARCHAR(50),
          description TEXT,
          is_posted BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      let totalSynced = 0;

      // 2. Insert or update tenant
      await sql`
        INSERT INTO tenants (id, code, name_ar, name_en, plan, currency, tax_rate)
        VALUES (${data.tenant.id}, ${data.tenant.code}, ${data.tenant.name}, ${data.tenant.name}, 'Enterprise', ${data.tenant.currency}, ${data.tenant.taxRate})
        ON CONFLICT (id) DO UPDATE SET
          name_ar = EXCLUDED.name_ar,
          currency = EXCLUDED.currency,
          tax_rate = EXCLUDED.tax_rate;
      `;
      totalSynced++;

      // 3. Sync Branches & Warehouses
      for (const b of data.branches) {
        await sql`
          INSERT INTO branches (id, tenant_id, code, name_ar, name_en, city, phone, is_main)
          VALUES (${b.id}, ${data.tenant.id}, ${b.code}, ${b.name}, ${b.nameEn}, ${b.city}, ${b.phone}, ${b.isMain})
          ON CONFLICT (id) DO NOTHING;
        `;
        totalSynced++;
      }

      for (const w of data.warehouses) {
        await sql`
          INSERT INTO warehouses (id, tenant_id, branch_id, code, name_ar, name_en, location)
          VALUES (${w.id}, ${data.tenant.id}, ${w.branchId}, ${w.code}, ${w.name}, ${w.nameEn}, ${w.location})
          ON CONFLICT (id) DO NOTHING;
        `;
        totalSynced++;
      }

      // 4. Sync Products
      for (const p of data.products) {
        await sql`
          INSERT INTO products (id, tenant_id, sku, barcode, name_ar, name_en, category, purchase_price, selling_price, min_stock_level, is_service)
          VALUES (
            ${p.id}, ${data.tenant.id}, ${p.sku}, ${p.barcode || ''}, ${p.nameAr}, ${p.nameEn},
            ${p.category}, ${p.purchasePrice}, ${p.sellingPrice}, ${p.minStockLevel}, ${p.isService}
          )
          ON CONFLICT (id) DO UPDATE SET
            name_ar = EXCLUDED.name_ar,
            purchase_price = EXCLUDED.purchase_price,
            selling_price = EXCLUDED.selling_price,
            category = EXCLUDED.category;
        `;
        totalSynced++;
      }

      // 5. Sync Accounts
      for (const a of data.accounts) {
        await sql`
          INSERT INTO accounts (id, tenant_id, code, name_ar, name_en, account_type, parent_id, balance, level)
          VALUES (${a.id}, ${data.tenant.id}, ${a.code}, ${a.nameAr}, ${a.nameEn}, ${a.type}, ${a.parentId || null}, ${a.balance}, ${a.level})
          ON CONFLICT (id) DO UPDATE SET
            balance = EXCLUDED.balance,
            name_ar = EXCLUDED.name_ar;
        `;
        totalSynced++;
      }

      // 6. Sync Invoices
      for (const inv of data.invoices) {
        await sql`
          INSERT INTO sales_invoices (
            id, tenant_id, branch_id, warehouse_id, invoice_number, customer_id,
            customer_name, subtotal, discount_amount, tax_amount, net_amount, payment_method, cashier_name
          )
          VALUES (
            ${inv.id}, ${data.tenant.id}, ${inv.branchId}, ${inv.warehouseId}, ${inv.invoiceNumber},
            ${inv.customerId || ''}, ${inv.customerName || ''}, ${inv.subtotal}, ${inv.discountAmount},
            ${inv.taxAmount}, ${inv.netAmount}, ${inv.paymentMethod}, ${inv.cashierName}
          )
          ON CONFLICT (id) DO NOTHING;
        `;
        totalSynced++;
      }

      // 8. Sync Parties if provided
      try {
      if (data.parties) {
          totalSynced += await NeonService.insertRowsInBatches(
            sql, 'parties',
            ['id', 'tenant_id', 'name', 'name_en', 'type', 'phone', 'email', 'balance'],
            data.parties.map((pr) => [pr.id, data.tenant.id, pr.name, pr.nameEn, pr.type, pr.phone, pr.email || '', pr.balance]),
            'ON CONFLICT (id) DO UPDATE SET balance = EXCLUDED.balance, name = EXCLUDED.name'
          );
      }

      } catch (sectionError) {
        console.warn(`Neon sync section failed (${"8. Sync Parties if provided"}):`, sectionError);
      }

      // 9. Sync Appointments if provided
      try {
      if (data.appointments) {
          totalSynced += await NeonService.insertRowsInBatches(
            sql, 'appointments',
            ['id', 'tenant_id', 'branch_id', 'patient_id', 'patient_name', 'patient_phone',
              'paper_code', 'system_code', 'customer_code', 'doctor_name', 'service_name_ar',
              'price', 'deposit', 'remaining_balance', 'appointment_date', 'appointment_time',
              'status', 'lead_source', 'notes'],
            data.appointments.map((apt) => [
              apt.id, data.tenant.id, apt.branchId, apt.patientId, apt.patientName,
              apt.patientPhone || '', apt.paperCode || '', apt.systemCode || '',
              apt.customerCode || '', apt.doctorName, apt.serviceNameAr,
              apt.price, apt.deposit || 0, apt.remainingBalance || 0, apt.date, apt.time,
              apt.status, apt.leadSource || '', apt.notes || '',
            ]),
            'ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes'
          );
      }

      } catch (sectionError) {
        console.warn(`Neon sync section failed (${"9. Sync Appointments if provided"}):`, sectionError);
      }

      // 9.1 Sync Patient Follow-ups if provided
      try {
      if (data.patientFollowUps) {
          totalSynced += await NeonService.insertRowsInBatches(
            sql, 'patient_follow_ups',
            ['id', 'tenant_id', 'branch_id', 'patient_id', 'patient_name', 'patient_phone',
              'paper_code', 'system_code', 'customer_code', 'follow_up_date', 'follow_up_time',
              'reason', 'type', 'status', 'notes', 'created_by'],
            data.patientFollowUps.map((fup) => [
              fup.id, data.tenant.id, fup.branchId, fup.patientId, fup.patientName,
              fup.patientPhone || '', fup.paperCode || '', fup.systemCode || '',
              fup.customerCode || '', fup.followUpDate, fup.followUpTime || '',
              fup.reason, fup.type, fup.status, fup.notes || '', fup.createdBy || '',
            ]),
            'ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes'
          );
      }

      } catch (sectionError) {
        console.warn(`Neon sync section failed (${"9.1 Sync Patient Follow-ups if provided"}):`, sectionError);
      }

      // 10. Sync Journal Entries if provided
      try {
      if (data.journalEntries) {
          totalSynced += await NeonService.insertRowsInBatches(
            sql, 'journal_entries',
            ['id', 'tenant_id', 'branch_id', 'entry_number', 'date', 'description', 'is_posted'],
            data.journalEntries.map((jv) => [jv.id, data.tenant.id, jv.branchId, jv.entryNumber, jv.date, jv.description, jv.isPosted]),
            'ON CONFLICT (id) DO NOTHING'
          );
      }

      } catch (sectionError) {
        console.warn(`Neon sync section failed (${"10. Sync Journal Entries if provided"}):`, sectionError);
      }

      return {
        success: true,
        insertedCount: totalSynced,
        message: `تم رفع ومزامنة ${totalSynced} سجل إلى قاعدة بيانات Neon السحابية بنجاح! ستظهر الآن في شاشة Tables فوراً.`,
      };
    } catch (err: any) {
      console.error('Sync to Neon error:', err);
      return {
        success: false,
        insertedCount: 0,
        message: `حدث خطأ أثناء المزامنة: ${err.message || 'فشل الاتصال'}`,
      };
    }
  }

  /**
   * Inserts many rows using ONE request per batch instead of one request per row.
   * Row-by-row inserts made large datasets (tens of thousands of appointments) take
   * hours and appear stuck, because every row was a separate HTTP round-trip.
   */
  private static async insertRowsInBatches(
    sql: any,
    table: string,
    columns: string[],
    rows: unknown[][],
    onConflictSql = '',
    jsonColumns: string[] = [],
    batchSize = 300
  ): Promise<number> {
    const columnIndexes = new Map(columns.map((column, index) => [column, index]));
    const jsonIndexes = new Set(jsonColumns.map((column) => columnIndexes.get(column)).filter((index): index is number => index !== undefined));
    if (rows.length === 0) return 0;
    let inserted = 0;
    for (let start = 0; start < rows.length; start += batchSize) {
      const slice = rows.slice(start, start + batchSize);
      const params: unknown[] = [];
      const tuples = slice.map((row) => `(${row.map((value, columnIndex) => { params.push(value === undefined ? null : value); const placeholder = `$${params.length}`; return jsonIndexes.has(columnIndex) ? `${placeholder}::jsonb` : placeholder; }).join(', ')})`);
      const text = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')} ${onConflictSql}`.trim();
      await sql.query(text, params);
      inserted += slice.length;
    }
    return inserted;
  }


  /**
   * Creates (or updates) every dataset table in Neon from the shared schema definition.
   * Idempotent: safe to run repeatedly; existing tables/columns are preserved and only
   * missing ones are added. Returns a per-table report.
   */
  static async runFullSchemaMigration(connectionString: string): Promise<{
    success: boolean;
    created: number;
    updated: number;
    total: number;
    failures: string[];
    message: string;
  }> {
    const failures: string[] = [];
    let created = 0;
    let updated = 0;
    try {
      const sql = this.getClient(connectionString);

      // Unified document store first.
      try {
        await sql.query(APP_DOCUMENTS_DDL);
        created += 1;
      } catch (error: any) {
        failures.push(`app_documents: ${error?.message || String(error)}`);
      }

      for (const schema of NEON_SCHEMA_TABLES) {
        try {
          await sql.query(buildCreateTableSql(schema));
          created += 1;
        } catch (error: any) {
          failures.push(`${schema.table} (create): ${error?.message || String(error)}`);
          continue;
        }
        for (const statement of buildAlterTableSql(schema)) {
          try {
            await sql.query(statement);
            updated += 1;
          } catch (error: any) {
            failures.push(`${schema.table} (alter): ${error?.message || String(error)}`);
          }
        }
      }

      const total = NEON_SCHEMA_TABLES.length + 1;
      return {
        success: failures.length === 0,
        created,
        updated,
        total,
        failures,
        message: failures.length === 0
          ? `تم ترحيل وتحديث ${total} جدول بنجاح (${updated} عمود إضافي)`
          : `تم تنفيذ الترحيل على ${created} جدول مع ${failures.length} ملاحظة`,
      };
    } catch (error: any) {
      return {
        success: false,
        created,
        updated,
        total: NEON_SCHEMA_TABLES.length + 1,
        failures: [...failures, error?.message || String(error)],
        message: 'فشل ترحيل الهيكل: ' + (error?.message || String(error)),
      };
    }
  }

  /** Explicit column -> local field aliases where the names differ. */
  private static readonly COLUMN_ALIASES: { [column: string]: string[] } = {
    account_type: ['type', 'accountType'],
    party_type: ['type', 'partyType'],
    user_role: ['role', 'userRole'],
    staff_role: ['role', 'staffRole'],
    method_type: ['type', 'methodType'],
    movement_type: ['type', 'movementType'],
    notification_type: ['type', 'notificationType'],
    entry_date: ['date', 'entryDate'],
    invoice_date: ['createdAt', 'date', 'invoiceDate'],
    receipt_date: ['date', 'receiptDate'],
    refund_date: ['date', 'refundDate'],
    payment_date: ['date', 'paymentDate'],
    appointment_date: ['date', 'appointmentDate'],
    appointment_time: ['time', 'appointmentTime'],
    attendance_date: ['date', 'attendanceDate'],
    audit_date: ['date', 'auditDate'],
    voucher_date: ['date', 'voucherDate'],
    performed_at: ['timestamp', 'performedAt'],
    logged_at: ['timestamp', 'loggedAt'],
    total_amount: ['totalWithFee', 'total', 'netAmount', 'totalAmount'],
    name_ar: ['nameAr', 'name'],
    name_en: ['nameEn'],
  };

  /** Resolves the value of one table column from a local record. */
  private static resolveColumnValue(record: any, columnName: string, tenantId: string): unknown {
    if (columnName === 'tenant_id') return record?.tenantId || tenantId;
    const camel = columnName.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    const candidates = [
      ...(NeonService.COLUMN_ALIASES[columnName] || []),
      camel,
      columnName,
    ];
    for (const candidate of candidates) {
      const value = record?.[candidate];
      if (value !== undefined && value !== null) return value;
    }
    return null;
  }

  /** Mirrors ONE dataset into its matching typed table (one request per 300 rows). */
  static async mirrorDataset(
    sql: any,
    tenantId: string,
    schema: NeonTableSchema,
    records: unknown[]
  ): Promise<number> {
    if (!Array.isArray(records) || records.length === 0) return 0;
    // Legacy tables may miss the payload column or require columns the mirror does not
    // fill in; make the table accept the mirrored rows.
    for (const column of [...schema.columns, { name: 'payload', type: 'JSONB' }]) {
      try {
        await sql.query(`ALTER TABLE ${schema.table} ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`, []);
      } catch {
        /* column already exists or cannot be altered */
      }
    }
    try {
      const notNull = await sql.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_nullable='NO' AND column_default IS NULL`,
        [schema.table]
      );
      for (const row of notNull as any[]) {
        if (row.column_name === 'id') continue;
        try { await sql.query(`ALTER TABLE ${schema.table} ALTER COLUMN ${row.column_name} DROP NOT NULL`, []); } catch { /* ignore */ }
      }
    } catch {
      /* ignore */
    }

    const insertColumns = [...schema.columns.map((column) => column.name), 'payload'];
    const rows = records.map((record: any, index: number) => {
      const values = schema.columns.map((column) => {
        const value = NeonService.resolveColumnValue(record, column.name, tenantId);
        if (column.name === 'id' && (value === null || value === undefined)) {
          return `${schema.table}-${index}`;
        }
        return value;
      });
      return [...values, JSON.stringify(record ?? {})];
    });
    // Full replace keeps the mirror identical to the document store.
    await sql.query(`DELETE FROM ${schema.table}`, []);
    return NeonService.insertRowsInBatches(
      sql,
      schema.table,
      insertColumns,
      rows,
      '',
      ['payload']
    );
  }

  /** Mirrors EVERY dataset into its typed table (so no table stays empty). */
  static async mirrorAllTables(
    connectionString: string,
    tenantId: string,
    documents: { [key: string]: unknown }
  ): Promise<{ mirroredTables: number; mirroredRows: number; failures: string[] }> {
    const failures: string[] = [];
    let mirroredTables = 0;
    let mirroredRows = 0;
    try {
      const sql = this.getClient(connectionString);
      for (const schema of NEON_SCHEMA_TABLES) {
        const records = documents[schema.sourceKey];
        if (!Array.isArray(records) || records.length === 0) continue;
        try {
          const rows = await NeonService.mirrorDataset(sql, tenantId, schema, records);
          if (rows > 0) {
            mirroredTables += 1;
            mirroredRows += rows;
          }
        } catch (tableError: any) {
          failures.push(`${schema.table}: ${tableError?.message || String(tableError)}`);
        }
      }
    } catch (error: any) {
      failures.push(error?.message || String(error));
    }
    return { mirroredTables, mirroredRows, failures };
  }

  /** Reads the tenant identity from the `tenants` table (used when a tenant is missing locally). */
  static async fetchTenantIdentity(
    connectionString: string,
    tenantId: string
  ): Promise<{ code: string; name: string; currency: string; taxRate: number } | null> {
    try {
      const sql = this.getClient(connectionString);
      const rows = await sql`SELECT code, name_ar, currency, tax_rate FROM tenants WHERE id = ${tenantId} LIMIT 1`;
      const row = (rows as any[])[0];
      if (!row) return null;
      return {
        code: String(row.code || tenantId),
        name: String(row.name_ar || row.code || tenantId),
        currency: String(row.currency || 'EGP'),
        taxRate: Number(row.tax_rate ?? 0.14),
      };
    } catch (error) {
      console.warn('fetchTenantIdentity failed:', error);
      return null;
    }
  }

  /** Per-dataset record counts in Neon (used to verify the app matches the database). */
  static async fetchDatasetCounts(
    connectionString: string,
    tenantId: string
  ): Promise<{ success: boolean; counts: { [key: string]: number }; message: string }> {
    try {
      const sql = this.getClient(connectionString);
      const counts: { [key: string]: number } = {};
      const plain = await sql`
        SELECT doc_key, jsonb_array_length(payload)::int AS items
        FROM app_documents
        WHERE tenant_id = ${tenantId} AND jsonb_typeof(payload) = 'array'`;
      (plain as any[]).forEach((row) => { counts[row.doc_key] = Number(row.items); });
      const chunks = await sql`
        SELECT split_part(doc_key, '#', 1) AS base, SUM(jsonb_array_length(payload))::int AS items
        FROM app_documents
        WHERE tenant_id = ${tenantId} AND doc_key LIKE '%#%' AND jsonb_typeof(payload) = 'array'
        GROUP BY 1`;
      (chunks as any[]).forEach((row) => { counts[row.base] = Number(row.items); });
      return { success: true, counts, message: `تم قراءة ${Object.keys(counts).length} مجموعة من Neon` };
    } catch (err: any) {
      return { success: false, counts: {}, message: 'فشل قراءة الأعداد من Neon: ' + (err?.message || String(err)) };
    }
  }

  /**
   * Resolves the tenant that actually holds the data in Neon.
   * The `tenants` table wins when it matches a tenant that also has documents;
   * otherwise the tenant with the most documents is used.
   */
  static async resolveActiveTenantId(connectionString: string): Promise<string> {
    try {
      const sql = this.getClient(connectionString);
      let tenantsTableId = '';
      try {
        const rows = await sql`SELECT id FROM tenants ORDER BY created_at ASC NULLS LAST LIMIT 1`;
        tenantsTableId = String((rows as any[])[0]?.id ?? '');
      } catch (error) {
        console.warn('resolveActiveTenantId (tenants) failed:', error);
      }

      const counts = await sql`
        SELECT tenant_id, COUNT(*)::int AS docs
        FROM app_documents GROUP BY tenant_id ORDER BY docs DESC`;
      const list = counts as any[];
      if (tenantsTableId && list.some((row) => String(row.tenant_id) === tenantsTableId)) {
        return tenantsTableId;
      }
      if (list.length > 0) return String(list[0].tenant_id);
      return tenantsTableId;
    } catch (error) {
      console.warn('resolveActiveTenantId failed:', error);
      return '';
    }
  }

  /** Resolves a tenant id straight from Neon (used on a fresh device with no local state). */
  static async fetchFirstTenantId(connectionString: string): Promise<string> {
    try {
      const sql = this.getClient(connectionString);
      const rows = await sql`SELECT tenant_id FROM app_documents LIMIT 1`;
      const first = (rows as any[])[0];
      if (first?.tenant_id) return String(first.tenant_id);
    } catch (error) {
      console.warn('fetchFirstTenantId failed:', error);
    }
    try {
      const sql = this.getClient(connectionString);
      const rows = await sql`SELECT id FROM tenants LIMIT 1`;
      const first = (rows as any[])[0];
      if (first?.id) return String(first.id);
    } catch (error) {
      console.warn('fetchFirstTenantId (tenants) failed:', error);
    }
    return '';
  }


  /**
   * Fetches ONE dataset (with its chunks) using several small requests so no single
   * Neon response exceeds the 64 MB HTTP limit.
   */
  static async fetchDocumentByKey(
    connectionString: string,
    tenantId: string,
    key: string
  ): Promise<{ success: boolean; value?: unknown; message: string }> {
    try {
      const sql = this.getClient(connectionString);
      const rows = await sql`
        SELECT payload FROM app_documents WHERE tenant_id = ${tenantId} AND doc_key = ${key}
      `;
      const payload: any = (rows as any[])[0]?.payload;
      if (payload === undefined) return { success: true, value: undefined, message: 'غير موجود' };

      if (payload && typeof payload === 'object' && (payload as any).__chunked) {
        const count = Number((payload as any).count) || 0;
        const merged: unknown[] = [];
        const CHUNKS_PER_REQUEST = 4;
        for (let start = 0; start < count; start += CHUNKS_PER_REQUEST) {
          const names: string[] = [];
          for (let index = start; index < Math.min(start + CHUNKS_PER_REQUEST, count); index += 1) {
            names.push(`${key}#${index}`);
          }
          const params: unknown[] = [tenantId];
          const conditions = names.map((name) => {
            params.push(name);
            return `doc_key = $${params.length}`;
          });
          const chunkRows: any = await (sql as any).query(
            `SELECT doc_key, payload FROM app_documents WHERE tenant_id = $1 AND (${conditions.join(' OR ')})`,
            params
          );
          names.forEach((name) => {
            const found = (chunkRows as any[]).find((row) => row.doc_key === name);
            if (Array.isArray(found?.payload)) merged.push(...found.payload);
          });
        }
        return { success: true, value: merged, message: `تم تجميع ${merged.length} سجل` };
      }

      return { success: true, value: payload, message: '' };
    } catch (err: any) {
      return { success: false, message: `فشل تحميل (${key}): ` + (err?.message || String(err)) };
    }
  }
  /** Lightweight metadata only (doc_key + updated_at) used to diff against the local cache. */
  static async fetchDocumentMetadata(
    connectionString: string,
    tenantId: string
  ): Promise<{ success: boolean; metadata: { [key: string]: string }; message: string }> {
    try {
      const sql = this.getClient(connectionString);
      const rows = await sql`
        SELECT doc_key, updated_at FROM app_documents WHERE tenant_id = ${tenantId}
      `;
      const metadata: { [key: string]: string } = {};
      (rows as any[]).forEach((row) => {
        const raw = row.updated_at;
        metadata[row.doc_key] = raw instanceof Date ? raw.toISOString() : String(raw ?? '');
      });
      return { success: true, metadata, message: `تم قراءة ${Object.keys(metadata).length} مفتاح` };
    } catch (err: any) {
      return { success: false, metadata: {}, message: 'فشل قراءة بيانات المزامنة: ' + (err?.message || String(err)) };
    }
  }

  /** Fetches the requested datasets one-by-one (each in its own small request). */
  static async fetchDocumentsByKeys(
    connectionString: string,
    tenantId: string,
    keys: string[]
  ): Promise<{ success: boolean; documents: { [key: string]: unknown }; message: string }> {
    if (keys.length === 0) return { success: true, documents: {}, message: 'لا توجد اختلافات' };
    const documents: { [key: string]: unknown } = {};
    for (const key of keys) {
      const result = await NeonService.fetchDocumentByKey(connectionString, tenantId, key);
      if (!result.success) {
        return { success: false, documents, message: result.message };
      }
      if (result.value !== undefined) documents[key] = result.value;
    }
    return { success: true, documents, message: `تم تحميل ${Object.keys(documents).length} مجموعة محدّثة` };
  }
  // --- Realtime Direct Insertion Methods ---

  static async insertProductDirect(connectionString: string, tenantId: string, product: Product): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`
        INSERT INTO products (id, tenant_id, sku, barcode, name_ar, name_en, category, purchase_price, selling_price, min_stock_level, is_service)
        VALUES (
          ${product.id}, ${tenantId}, ${product.sku}, ${product.barcode || ''}, ${product.nameAr}, ${product.nameEn},
          ${product.category}, ${product.purchasePrice}, ${product.sellingPrice}, ${product.minStockLevel}, ${product.isService}
        )
        ON CONFLICT (id) DO UPDATE SET
          name_ar = EXCLUDED.name_ar,
          selling_price = EXCLUDED.selling_price;
      `;
      return true;
    } catch (err) {
      console.warn('Neon product insert failed:', err);
      return false;
    }
  }

  static async insertInvoiceDirect(connectionString: string, tenantId: string, invoice: SalesInvoice): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`
        INSERT INTO sales_invoices (
          id, tenant_id, branch_id, warehouse_id, invoice_number, customer_id,
          customer_name, subtotal, discount_amount, tax_amount, net_amount, payment_method, cashier_name
        )
        VALUES (
          ${invoice.id}, ${tenantId}, ${invoice.branchId}, ${invoice.warehouseId}, ${invoice.invoiceNumber},
          ${invoice.customerId || ''}, ${invoice.customerName || ''}, ${invoice.subtotal}, ${invoice.discountAmount},
          ${invoice.taxAmount}, ${invoice.netAmount}, ${invoice.paymentMethod}, ${invoice.cashierName}
        )
        ON CONFLICT (id) DO NOTHING;
      `;
      return true;
    } catch (err) {
      console.warn('Neon invoice insert failed:', err);
      return false;
    }
  }

  static async insertPatientDirect(connectionString: string, tenantId: string, patient: Patient): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`
        INSERT INTO parties (id, tenant_id, name, phone, balance)
        VALUES (${patient.id}, ${tenantId}, ${patient.fullName || patient.name || ''}, ${patient.phone || ''}, 0)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone;
      `;
      return true;
    } catch (err) {
      console.warn('Neon patient insert failed:', err);
      return false;
    }
  }

  static async insertAppointmentDirect(connectionString: string, tenantId: string, appointment: Appointment): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`
        INSERT INTO appointments (id, tenant_id, branch_id, patient_id, patient_name, doctor_name, service_name_ar, price, appointment_date, appointment_time, status)
        VALUES (${appointment.id}, ${tenantId}, ${appointment.branchId}, ${appointment.patientId}, ${appointment.patientName}, ${appointment.doctorName}, ${appointment.serviceNameAr}, ${appointment.price}, ${appointment.date}, ${appointment.time}, ${appointment.status})
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status;
      `;
      return true;
    } catch (err) {
      console.warn('Neon appointment insert failed:', err);
      return false;
    }
  }

  static async updateAppointmentStatusDirect(connectionString: string, id: string, status: string): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`
        UPDATE appointments SET status = ${status} WHERE id = ${id};
      `;
      return true;
    } catch (err) {
      console.warn('Neon appointment update failed:', err);
      return false;
    }
  }

  static async insertPartyDirect(connectionString: string, tenantId: string, party: Party): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`
        INSERT INTO parties (id, tenant_id, name, name_en, type, phone, email, balance)
        VALUES (${party.id}, ${tenantId}, ${party.name}, ${party.nameEn}, ${party.type}, ${party.phone}, ${party.email || ''}, ${party.balance})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          balance = EXCLUDED.balance;
      `;
      return true;
    } catch (err) {
      console.warn('Neon party insert failed:', err);
      return false;
    }
  }

  static async insertJournalEntryDirect(connectionString: string, tenantId: string, entry: JournalEntry): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`
        INSERT INTO journal_entries (id, tenant_id, branch_id, entry_number, date, description, is_posted)
        VALUES (${entry.id}, ${tenantId}, ${entry.branchId}, ${entry.entryNumber}, ${entry.date}, ${entry.description}, ${entry.isPosted})
        ON CONFLICT (id) DO NOTHING;
      `;
      return true;
    } catch (err) {
      console.warn('Neon journal entry insert failed:', err);
      return false;
    }
  }

  static async updateStockDirect(connectionString: string, tenantId: string, productId: string, warehouseId: string, qty: number): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`
        INSERT INTO stock_levels (id, tenant_id, product_id, warehouse_id, quantity_on_hand)
        VALUES (${'stock-' + productId + '-' + warehouseId}, ${tenantId}, ${productId}, ${warehouseId}, ${qty})
        ON CONFLICT (id) DO UPDATE SET
          quantity_on_hand = EXCLUDED.quantity_on_hand;
      `;
      return true;
    } catch (err) {
      console.warn('Neon stock update failed:', err);
      return false;
    }
  }

  // Safe schema migration - creates tables if not present and adds new columns if they do not exist without losing any data
  static async runSchemaMigrations(connectionString: string): Promise<{ success: boolean; message: string }> {
    try {
      const sql = this.getClient(connectionString);

      // 1. Ensure all base tables exist safely (CREATE TABLE IF NOT EXISTS never touches existing data)
      await sql`
        CREATE TABLE IF NOT EXISTS tenants (
          id VARCHAR(100) PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255) NOT NULL,
          plan VARCHAR(50) DEFAULT 'Enterprise',
          currency VARCHAR(10) DEFAULT 'EGP',
          tax_rate NUMERIC(5, 4) DEFAULT 0.1400,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS branches (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          code VARCHAR(50) NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          city VARCHAR(100),
          phone VARCHAR(50),
          is_main BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS warehouses (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          code VARCHAR(50) NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          location TEXT
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          sku VARCHAR(100) NOT NULL,
          barcode VARCHAR(100),
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          category VARCHAR(100),
          purchase_price NUMERIC(15, 2) DEFAULT 0.00,
          selling_price NUMERIC(15, 2) DEFAULT 0.00,
          min_stock_level NUMERIC(12, 2) DEFAULT 5.00,
          is_service BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS stock_levels (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          product_id VARCHAR(100) NOT NULL,
          warehouse_id VARCHAR(100) NOT NULL,
          quantity_on_hand NUMERIC(15, 3) DEFAULT 0.000
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS accounts (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          code VARCHAR(50) NOT NULL,
          name_ar VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          account_type VARCHAR(50) NOT NULL,
          parent_id VARCHAR(100),
          balance NUMERIC(18, 2) DEFAULT 0.00,
          level INT DEFAULT 1
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS sales_invoices (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          warehouse_id VARCHAR(100),
          invoice_number VARCHAR(100) NOT NULL,
          customer_id VARCHAR(100),
          customer_name VARCHAR(255),
          subtotal NUMERIC(15, 2) NOT NULL,
          discount_amount NUMERIC(15, 2) DEFAULT 0.00,
          tax_amount NUMERIC(15, 2) DEFAULT 0.00,
          net_amount NUMERIC(15, 2) NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          cashier_name VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS parties (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          name VARCHAR(255) NOT NULL,
          name_en VARCHAR(255),
          type VARCHAR(50),
          phone VARCHAR(50),
          email VARCHAR(100),
          balance NUMERIC(15, 2) DEFAULT 0.00
        );
      `;


      await sql`
        CREATE TABLE IF NOT EXISTS appointments (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          patient_id VARCHAR(100),
          patient_name VARCHAR(255),
          patient_phone VARCHAR(50),
          paper_code VARCHAR(50),
          system_code VARCHAR(50),
          customer_code VARCHAR(50),
          doctor_name VARCHAR(255),
          service_name_ar VARCHAR(255),
          price NUMERIC(15, 2) DEFAULT 0.00,
          deposit NUMERIC(15, 2) DEFAULT 0.00,
          remaining_balance NUMERIC(15, 2) DEFAULT 0.00,
          appointment_date VARCHAR(50),
          appointment_time VARCHAR(50),
          status VARCHAR(50),
          lead_source VARCHAR(100),
          notes TEXT
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS patient_follow_ups (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          patient_id VARCHAR(100),
          patient_name VARCHAR(255),
          patient_phone VARCHAR(50),
          paper_code VARCHAR(50),
          system_code VARCHAR(50),
          customer_code VARCHAR(50),
          follow_up_date VARCHAR(50),
          follow_up_time VARCHAR(50),
          reason VARCHAR(255),
          type VARCHAR(50),
          status VARCHAR(50) DEFAULT 'Pending',
          notes TEXT,
          created_by VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS journal_entries (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          entry_number VARCHAR(100),
          date VARCHAR(50),
          description TEXT,
          is_posted BOOLEAN DEFAULT TRUE
        );
      `;

      // 2. Safe Column Additions (Adds new schema fields if not already present)
      await sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_phone VARCHAR(50);`;
      await sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paper_code VARCHAR(50);`;
      await sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS system_code VARCHAR(50);`;
      await sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50);`;
      await sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit NUMERIC(15, 2) DEFAULT 0.00;`;
      await sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(15, 2) DEFAULT 0.00;`;
      await sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100);`;
      await sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;`;
      await sql`ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS paper_code VARCHAR(50);`;
      await sql`ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS system_code VARCHAR(50);`;
      await sql`ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50);`;
      await sql`ALTER TABLE patient_follow_ups ADD COLUMN IF NOT EXISTS notes TEXT;`;
      await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_pos_collection_only BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS default_pos_collection_only BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS default_collection_only BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_account_id VARCHAR(100);`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_account_name_ar VARCHAR(255);`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS expense_account_id VARCHAR(100);`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS expense_account_name_ar VARCHAR(255);`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_account_id VARCHAR(100);`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_account_name_ar VARCHAR(255);`;
      await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS branch_id VARCHAR(100);`;
      await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS branch_name_ar VARCHAR(255);`;
      await sql`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS branch_id VARCHAR(100);`;
      await sql`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS branch_name_ar VARCHAR(255);`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS is_collection_only BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_fee_percentage NUMERIC(5, 2) DEFAULT 0.00;`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_fee_amount NUMERIC(15, 2) DEFAULT 0.00;`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS total_with_fee NUMERIC(15, 2) DEFAULT 0.00;`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS branch_id VARCHAR(100);`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(100);`;

      // 3. Create stock_movements table if not exists (سجل حركات المخازن والاستهلاك لكل فرع)
      await sql`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          branch_id VARCHAR(100),
          branch_name_ar VARCHAR(255),
          product_id VARCHAR(100) NOT NULL,
          product_name_ar VARCHAR(255),
          warehouse_id VARCHAR(100) NOT NULL,
          warehouse_name_ar VARCHAR(255),
          type VARCHAR(50) NOT NULL,
          quantity NUMERIC(15, 3) NOT NULL,
          unit_cost NUMERIC(15, 2) DEFAULT 0.00,
          reference_no VARCHAR(100),
          note TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      return { success: true, message: 'تم تحديث وترحيل هيكل الجداول في Neon بنجاح تام وبأمان 100% دون أي مساس بالبيانات الحالية!' };
    } catch (err: any) {
      return { success: false, message: 'فشل في تحديث هيكل الجداول: ' + (err.message || String(err)) };
    }
  }

  // ==========================================================================
  // Unified document store (مخزن البيانات الموحّد)
  // --------------------------------------------------------------------------
  // One JSONB row per dataset per tenant, so EVERY browser dataset (receipts,
  // refunds, shifts, payroll, ...) can live in Neon without lossy column mapping.
  // ==========================================================================
  static async ensureDocumentsTable(connectionString: string): Promise<boolean> {
    try {
      const sql = this.getClient(connectionString);
      await sql`
        CREATE TABLE IF NOT EXISTS app_documents (
          tenant_id  VARCHAR(100) NOT NULL,
          doc_key    VARCHAR(100) NOT NULL,
          payload    JSONB        NOT NULL,
          updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          PRIMARY KEY (tenant_id, doc_key)
        );
      `;
      return true;
    } catch (err) {
      console.warn('Neon app_documents creation failed:', err);
      return false;
    }
  }

  static async saveDocuments(
    connectionString: string,
    tenantId: string,
    documents: { key: string; payload: unknown }[],
    onProgress?: (done: number, total: number, label: string) => void
  ): Promise<{ success: boolean; saved: number; message: string }> {
    if (documents.length === 0) return { success: true, saved: 0, message: 'لا توجد تغييرات للرفع' };
    try {
      const sql = this.getClient(connectionString);
      const ready = await this.ensureDocumentsTable(connectionString);
      if (!ready) {
        return { success: false, saved: 0, message: 'تعذر إنشاء جدول التخزين الموحّد app_documents' };
      }
      // Best-effort archive so an accidental overwrite can always be recovered.
      let historyReady = false;
      try {
        await sql.query(APP_DOCUMENTS_HISTORY_DDL);
        await sql.query(APP_DOCUMENTS_HISTORY_INDEX_DDL);
        historyReady = true;
      } catch (historyError) {
        console.warn('app_documents_history unavailable:', historyError);
      }

      // Large datasets are split into small chunk documents so no single HTTP request
      // becomes huge (the previous single-request-per-dataset behaviour made big
      // datasets like journals/parties take minutes).
      const tasks: { key: string; payload: unknown }[] = [];
      for (const doc of documents) {
        const serialized = JSON.stringify(doc.payload ?? []);
        if (Array.isArray(doc.payload) && serialized.length > NeonService.CHUNK_THRESHOLD_BYTES) {
          const chunks = NeonService.splitIntoChunks(doc.payload);
          tasks.push({ key: doc.key, payload: { __chunked: true, count: chunks.length } });
          chunks.forEach((chunk, index) => tasks.push({ key: `${doc.key}#${index}`, payload: chunk }));
        } else {
          tasks.push(doc);
        }
      }

      let done = 0;
      let failed: string | null = null;
      const total = tasks.length;
      let cursor = 0;
      const CONCURRENCY = 4;
      const runners = Array.from({ length: Math.min(CONCURRENCY, total) }, async () => {
        while (cursor < total && !failed) {
          const task = tasks[cursor++];
          try {
            if (historyReady) {
              try {
                await sql`
                  INSERT INTO app_documents_history (tenant_id, doc_key, payload)
                  SELECT tenant_id, doc_key, payload FROM app_documents
                  WHERE tenant_id = ${tenantId} AND doc_key = ${task.key}
                `;
              } catch (archiveError) {
                console.warn('Archive before overwrite failed:', archiveError);
              }
            }
            await sql`
              INSERT INTO app_documents (tenant_id, doc_key, payload, updated_at)
              VALUES (${tenantId}, ${task.key}, ${JSON.stringify(task.payload ?? [])}::jsonb, NOW())
              ON CONFLICT (tenant_id, doc_key) DO UPDATE SET
                payload = EXCLUDED.payload,
                updated_at = NOW();
            `;
            done += 1;
            if (onProgress) onProgress(done, total, task.key);
          } catch (taskError: any) {
            failed = `${task.key}: ${taskError?.message || String(taskError)}`;
          }
        }
      });
      await Promise.all(runners);

      if (failed) {
        return { success: false, saved: done, message: `فشل رفع (${failed})` };
      }
      return { success: true, saved: documents.length, message: `تم رفع ${documents.length} مجموعة بيانات إلى Neon` };
    } catch (err: any) {
      return { success: false, saved: 0, message: 'فشل رفع البيانات إلى Neon: ' + (err?.message || String(err)) };
    }
  }

  private static readonly CHUNK_THRESHOLD_BYTES = 900_000;
  private static readonly CHUNK_TARGET_BYTES = 700_000;

  /** Splits a large array into chunks whose JSON stays under the target size. */
  private static splitIntoChunks(items: unknown[]): unknown[][] {
    const chunks: unknown[][] = [];
    let current: unknown[] = [];
    let currentSize = 2; // brackets
    for (const item of items) {
      const itemSize = JSON.stringify(item ?? null).length + 1;
      if (current.length > 0 && currentSize + itemSize > NeonService.CHUNK_TARGET_BYTES) {
        chunks.push(current);
        current = [];
        currentSize = 2;
      }
      current.push(item);
      currentSize += itemSize;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  static async fetchDocuments(
    connectionString: string,
    tenantId: string,
    keys?: string[]
  ): Promise<{ success: boolean; documents: { [key: string]: unknown }; message: string }> {
    // Read the key list first (tiny query), then fetch each dataset separately so no
    // response can exceed Neon's 64 MB HTTP limit.
    const meta = await NeonService.fetchDocumentMetadata(connectionString, tenantId);
    if (!meta.success) return { success: false, documents: {}, message: meta.message };
    const allKeys = Object.keys(meta.metadata).filter((key) => !key.includes('#'));
    const targetKeys = keys && keys.length > 0 ? allKeys.filter((key) => keys.includes(key)) : allKeys;
    return NeonService.fetchDocumentsByKeys(connectionString, tenantId, targetKeys);
  }
}
