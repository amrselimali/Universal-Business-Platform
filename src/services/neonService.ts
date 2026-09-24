import { neon } from '@neondatabase/serverless';
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
        const patRes = await sql`SELECT COUNT(*)::int as c FROM patients`;
        counts['patients'] = patRes && patRes[0] ? Number(patRes[0].c) : 0;
      } catch {
        counts['patients'] = 0;
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
      patients: Patient[];
      parties?: Party[];
      appointments?: Appointment[];
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

      await sql`
        CREATE TABLE IF NOT EXISTS patients (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          file_number VARCHAR(50) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          date_of_birth DATE,
          gender VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

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

      // 7. Sync Patients
      for (const pat of data.patients) {
        await sql`
          INSERT INTO patients (id, tenant_id, file_number, full_name, phone, gender)
          VALUES (${pat.id}, ${data.tenant.id}, ${pat.fileNumber}, ${pat.fullName}, ${pat.phone}, ${pat.gender})
          ON CONFLICT (id) DO NOTHING;
        `;
        totalSynced++;
      }

      // 8. Sync Parties if provided
      if (data.parties) {
        for (const pr of data.parties) {
          await sql`
            INSERT INTO parties (id, tenant_id, name, name_en, type, phone, email, balance)
            VALUES (${pr.id}, ${data.tenant.id}, ${pr.name}, ${pr.nameEn}, ${pr.type}, ${pr.phone}, ${pr.email || ''}, ${pr.balance})
            ON CONFLICT (id) DO UPDATE SET balance = EXCLUDED.balance, name = EXCLUDED.name;
          `;
          totalSynced++;
        }
      }

      // 9. Sync Appointments if provided
      if (data.appointments) {
        for (const apt of data.appointments) {
          await sql`
            INSERT INTO appointments (id, tenant_id, branch_id, patient_id, patient_name, doctor_name, service_name_ar, price, appointment_date, appointment_time, status)
            VALUES (${apt.id}, ${data.tenant.id}, ${apt.branchId}, ${apt.patientId}, ${apt.patientName}, ${apt.doctorName}, ${apt.serviceNameAr}, ${apt.price}, ${apt.date}, ${apt.time}, ${apt.status})
            ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
          `;
          totalSynced++;
        }
      }

      // 10. Sync Journal Entries if provided
      if (data.journalEntries) {
        for (const jv of data.journalEntries) {
          await sql`
            INSERT INTO journal_entries (id, tenant_id, branch_id, entry_number, date, description, is_posted)
            VALUES (${jv.id}, ${data.tenant.id}, ${jv.branchId}, ${jv.entryNumber}, ${jv.date}, ${jv.description}, ${jv.isPosted})
            ON CONFLICT (id) DO NOTHING;
          `;
          totalSynced++;
        }
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
        INSERT INTO patients (id, tenant_id, file_number, full_name, phone, gender)
        VALUES (${patient.id}, ${tenantId}, ${patient.fileNumber}, ${patient.fullName}, ${patient.phone}, ${patient.gender})
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
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
        CREATE TABLE IF NOT EXISTS patients (
          id VARCHAR(100) PRIMARY KEY,
          tenant_id VARCHAR(100) NOT NULL,
          file_number VARCHAR(50),
          full_name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          gender VARCHAR(20)
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
          price NUMERIC(15, 2) DEFAULT 0.00,
          appointment_date VARCHAR(50),
          appointment_time VARCHAR(50),
          status VARCHAR(50)
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
      await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_pos_collection_only BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE branches ADD COLUMN IF NOT EXISTS default_pos_collection_only BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS default_collection_only BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS is_collection_only BOOLEAN DEFAULT FALSE;`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_fee_percentage NUMERIC(5, 2) DEFAULT 0.00;`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_fee_amount NUMERIC(15, 2) DEFAULT 0.00;`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS total_with_fee NUMERIC(15, 2) DEFAULT 0.00;`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS branch_id VARCHAR(100);`;
      await sql`ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS payment_method_id VARCHAR(100);`;

      return { success: true, message: 'تم تحديث وترحيل هيكل الجداول في Neon بنجاح تام وبأمان 100% دون أي مساس بالبيانات الحالية!' };
    } catch (err: any) {
      return { success: false, message: 'فشل في تحديث هيكل الجداول: ' + (err.message || String(err)) };
    }
  }
}
