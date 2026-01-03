import { neon } from '@neondatabase/serverless';
import { Invoice, UserProfile, DbClient, DbProvider, CatalogItem, TrimestralDeclaration } from '../types';
import * as bcrypt from 'bcryptjs';

// Helper for Browser/Edge compatible SHA-256
async function computeSha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * NEON DATABASE CONFIGURATION
 */

const getDbClient = () => {
  try {
    // Priority: VITE_DATABASE_URL > DATABASE_URL > Hardcoded (Emergency Fallback)
    const url = import.meta.env?.VITE_DATABASE_URL ||
      process.env?.DATABASE_URL ||
      process.env?.VITE_DATABASE_URL ||
      'postgresql://neondb_owner:npg_8KpMkHIF2aqB@ep-morning-glade-ab2v6wo5-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'; // Emergency fallback for Vercel

    if (!url) {
      console.error("❌ CRITICAL: DATABASE_URL is not set. The app cannot connect to Neon DB.");
      console.log("Debug Info:", {
        viteEnv: !!import.meta.env?.VITE_DATABASE_URL,
        processEnv: !!process.env?.DATABASE_URL,
        processViteEnv: !!process.env?.VITE_DATABASE_URL
      });
      return null;
    }

    // Validate URL format simply
    if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
      console.warn("Invalid Database URL format. Must start with postgres://");
      return null;
    }

    return neon(url);
  } catch (error) {
    console.error("Error initializing DB Client:", error);
    return null;
  }
};

/**
 * AUDIT LOGGING SYSTEM (OPTIMIZED)
 */
/**
 * AUDIT LOGGING SYSTEM (OPTIMIZED)
 */
export const logAuditAction = async (userId: string, action: string, details: any) => {
  const sql = getDbClient();
  if (!sql) return;

  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Use RETURNING id to check if update happened
    const updateRes = await sql(
      `UPDATE audit_log SET action = $1, details = $2, created_at = NOW() WHERE user_id = $3 RETURNING id`,
      [action, JSON.stringify(details), userId]
    );

    if (updateRes.length === 0) {
      await sql(
        `INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3)`,
        [userId, action, JSON.stringify(details)]
      );
    } else if (updateRes.length > 1) {
      // Cleanup duplicates if any
      await sql(`DELETE FROM audit_log WHERE user_id = $1`, [userId]);
      await sql(
        `INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3)`,
        [userId, action, JSON.stringify(details)]
      );
    }
  } catch (e) {
    console.error("Audit Log Optimization Failed:", e);
  }
};

/**
 * SECURITY HELPERS
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

export const comparePassword = async (plain: string, hashed: string): Promise<boolean> => {
  return bcrypt.compareSync(plain, hashed);
};

/**
 * CHECK IF EMAIL EXISTS
 */
export const checkEmailExists = async (email: string): Promise<boolean> => {
  const sql = getDbClient();
  if (!sql) return true; // Fallback for safety in demo

  try {
    const rows = await sql('SELECT id FROM users WHERE email = $1', [email]);
    return rows.length > 0;
  } catch (error) {
    console.error("Check Email Error:", error);
    return false;
  }
};

/**
 * HELPER: Map DB Row to UserProfile
 */
const mapUserRowToProfile = (row: any): UserProfile => {
  const profileSettings = row.profile_data || {};

  const fiscalConfig = profileSettings.fiscalConfig || {
    entityType: row.type === 'COMPANY' ? 'JURIDICA' : 'FISICA',
    nif: row.taxId || '',
    regimenFiscal: 'GENERAL',
    actividadPrincipal: '',
    ivaRegimen: 'GENERAL',
    prorrateoIVA: false
  };

  // Compatibility Layer: Map legacy feeRules property names to new ones
  if (profileSettings.paymentIntegration?.feeRules) {
    profileSettings.paymentIntegration.feeRules = profileSettings.paymentIntegration.feeRules.map((rule: any) => ({
      ...rule,
      type: rule.type || rule.feeType,
      percentage: rule.percentage !== undefined ? rule.percentage : rule.value,
      fixedAmount: rule.fixedAmount !== undefined ? rule.fixedAmount : rule.fixedValue,
    }));
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    type: row.type === 'COMPANY' ? 'Empresa (SL/SA)' : 'Autónomo',
    bankAccountType: profileSettings.bankAccountType || 'Ahorro',
    fiscalConfig: fiscalConfig,
    stripeCustomerId: row.stripe_customer_id || profileSettings.stripeCustomerId,
    plan: row.plan_name || profileSettings.plan || 'Free',
    renewalDate: row.renewal_date || profileSettings.renewalDate,
    ...profileSettings,
    isOnboardingComplete: true
  } as UserProfile;
};

/**
 * GET USER BY ID
 */
/**
 * GET USER BY ID
 */
export const getUserById = async (userId: string): Promise<UserProfile | null> => {
  if (userId === 'user_demo_es') {
    return {
      id: 'user_demo_es',
      name: 'Juan Pérez (Demo)',
      email: 'juan@konsulbills.es',
      type: 'Autónomo' as any,
      taxId: '12345678Z',
      avatar: '',
      isOnboardingComplete: true,
      defaultCurrency: 'EUR',
      plan: 'Emprendedor Pro',
      country: 'España',
      bankAccountType: 'Corriente',
      branding: { primaryColor: '#27bea5', templateStyle: 'Modern' },
      apiKeys: { gemini: '', openai: '' },
      fiscalConfig: {
        entityType: 'FISICA',
        nif: '12345678Z',
        regimenFiscal: 'GENERAL',
        actividadPrincipal: 'Servicios profesionales',
        ivaRegimen: 'GENERAL',
        prorrateoIVA: false
      }
    } as UserProfile;
  }

  const sql = getDbClient();
  if (!sql) {
    throw new Error("DB Client configuration missing");
  }

  try {
    const query = `
      SELECT id, name, email, type, profile_data, stripe_customer_id, plan_name, renewal_date 
      FROM users WHERE id = $1
    `;
    const rows = await sql(query, [userId]);

    if (rows.length > 0) {
      return mapUserRowToProfile(rows[0]);
    }
    return null;
  } catch (error) {
    console.error("Neon Get User Error:", error);
    throw error;
  }
};

/**
 * AUTHENTICATION
 */
export const authenticateUser = async (email: string, password: string): Promise<UserProfile | null> => {
  const sql = getDbClient();

  if (sql) {
    try {
      const query = `
        SELECT id, name, email, password, type, profile_data, stripe_customer_id, plan_name, renewal_date 
        FROM users WHERE email = $1
      `;
      const rows = await sql(query, [email]);

      if (rows.length > 0) {
        const userRow = rows[0];
        const storedPassword = userRow.password || '';
        let isMatch = false;

        if (email === 'juan@konsulbills.es' && password === 'password123') {
          isMatch = true;
        } else {
          if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
            isMatch = await comparePassword(password, storedPassword).catch(() => false);
          } else {
            isMatch = storedPassword === password;
          }
        }

        if (isMatch) {
          logAuditAction(userRow.id, 'LOGIN', { email: userRow.email });
          return mapUserRowToProfile(userRow);
        }
      }
    } catch (error) {
      console.error("Neon Auth Error:", error);
    }
  }

  // Fallback Demo
  if (email === 'juan@konsulbills.es' && password === 'password123') {
    return {
      id: 'user_demo_es',
      name: 'Juan Pérez (Demo)',
      email: 'juan@konsulbills.es',
      type: 'Autónomo' as any,
      taxId: '12345678Z',
      avatar: '',
      isOnboardingComplete: true,
      defaultCurrency: 'EUR',
      plan: 'Emprendedor Pro',
      country: 'España',
      bankAccountType: 'Corriente',
      branding: { primaryColor: '#27bea5', templateStyle: 'Modern' },
      apiKeys: { gemini: '', openai: '' },
      fiscalConfig: {
        entityType: 'FISICA',
        nif: '12345678Z',
        regimenFiscal: 'GENERAL',
        actividadPrincipal: 'Servicios profesionales',
        ivaRegimen: 'GENERAL',
        prorrateoIVA: false
      }
    } as UserProfile;
  }
  return null;
};

/**
 * CREATE USER
 */
/**
 * CREATE USER
 */
export const createUserInDb = async (profile: Partial<UserProfile>, password: string, email: string): Promise<boolean> => {
  const sql = getDbClient();
  if (!sql) return false;

  try {
    const checkRes = await sql('SELECT id FROM users WHERE email = $1', [email]);
    if (checkRes.length > 0) {
      throw new Error('El correo ya está registrado');
    }

    const hashedPassword = await hashPassword(password);
    const userId = profile.id || `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const profileData = { ...profile };
    delete (profileData as any).id;
    delete (profileData as any).name;
    delete (profileData as any).email;
    delete (profileData as any).type;
    delete (profileData as any).password;
    delete (profileData as any).stripeCustomerId;
    delete (profileData as any).plan;
    delete (profileData as any).renewalDate;

    const dbType = (profile.type || '').includes('Empresa') ? 'COMPANY' : 'FREELANCE';

    await sql(
      `INSERT INTO users (id, name, email, password, type, profile_data, stripe_customer_id, plan_name, renewal_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        profile.name,
        email,
        hashedPassword,
        dbType,
        JSON.stringify(profileData),
        profile.stripeCustomerId || null,
        profile.plan || 'Free',
        profile.renewalDate || null
      ]
    );

    logAuditAction(userId, 'REGISTER_USER', { email });
    return true;
  } catch (error: any) {
    console.error("Create User Error:", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    return false;
  }
};

/**
 * UPDATE USER PROFILE
 */
export const updateUserProfileInDb = async (profile: UserProfile): Promise<boolean> => {
  const sql = getDbClient();
  if (!sql) {
    throw new Error('No se pudo conectar a la base de datos. Verifica DATABASE_URL.');
  }

  try {
    const profileData = { ...profile };

    delete (profileData as any).id;
    delete (profileData as any).name;
    delete (profileData as any).email;
    delete (profileData as any).type;
    delete (profileData as any).password;
    delete (profileData as any).stripeCustomerId;
    delete (profileData as any).plan;
    delete (profileData as any).renewalDate;

    const dbType = (profile.type || '').includes('Empresa') ? 'COMPANY' : 'FREELANCE';

    await sql(
      `UPDATE users 
       SET name = $1, type = $2, profile_data = $3, stripe_customer_id = $4, plan_name = $5, renewal_date = $6, updated_at = NOW() 
       WHERE id = $7`,
      [
        profile.name,
        dbType,
        JSON.stringify(profileData),
        profile.stripeCustomerId || null,
        profile.plan || 'Free',
        profile.renewalDate || null,
        profile.id
      ]
    );

    return true;
  } catch (error: any) {
    console.error("Update User Error:", error);
    // Lanzar el error para que el componente pueda manejarlo
    throw new Error(error.message || 'Error al actualizar el perfil en la base de datos');
  }
};

/**
 * UPDATE USER PASSWORD
 */
export const updateUserPasswordInDb = async (userId: string, newPassword: string): Promise<boolean> => {
  const sql = getDbClient();
  if (!sql) return false;

  try {
    const hashedPassword = await hashPassword(newPassword);
    await sql(
      `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`,
      [hashedPassword, userId]
    );
    logAuditAction(userId, 'PASSWORD_CHANGE', { timestamp: new Date().toISOString() });
    return true;
  } catch (error) {
    console.error("Update Password Error:", error);
    return false;
  }
};

/**
 * CATALOG MANAGEMENT
 */
export const fetchCatalogItemsFromDb = async (userId: string): Promise<CatalogItem[]> => {
  const sql = getDbClient();
  if (!sql) return [];

  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS catalog_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price NUMERIC NOT NULL,
        description TEXT,
        is_recurring BOOLEAN DEFAULT FALSE,
        sku TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    try {
      await sql(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS sku TEXT;`);
      await sql(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;`);
      await sql(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS description TEXT;`);
      await sql(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`);
    } catch (migError) { }

    const rows = await sql('SELECT * FROM catalog_items WHERE user_id = $1 ORDER BY created_at DESC', [userId]);

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      price: parseFloat(row.price),
      description: row.description,
      isRecurring: row.is_recurring,
      sku: row.sku
    }));
  } catch (error) {
    console.error("Fetch Catalog Error:", error);
    return [];
  }
};

export const saveCatalogItemToDb = async (item: CatalogItem, userId: string): Promise<{ success: boolean, error?: string }> => {
  const sql = getDbClient();
  if (!sql) return { success: false, error: 'Database client not initialized.' };

  try {
    const query = `
      INSERT INTO catalog_items (id, user_id, name, price, description, is_recurring, sku, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        description = EXCLUDED.description,
        is_recurring = EXCLUDED.is_recurring,
        sku = EXCLUDED.sku,
        updated_at = NOW();
    `;

    await sql(query, [item.id, userId, item.name, item.price, item.description || null, item.isRecurring || false, item.sku || null]);
    return { success: true };
  } catch (error: any) {
    console.error("Save Catalog Item Error:", error);
    return { success: false, error: error.message };
  }
};

export const deleteCatalogItemFromDb = async (itemId: string, userId: string): Promise<boolean> => {
  const sql = getDbClient();
  if (!sql) return false;
  try {
    await sql('DELETE FROM catalog_items WHERE id = $1 AND user_id = $2', [itemId, userId]);
    return true;
  } catch (error) {
    console.error("Delete Catalog Item Error:", error);
    return false;
  }
};

/**
 * FETCH INVOICES & EXPENSES
 */
/**
 * FETCH INVOICES & EXPENSES
 */
export const fetchInvoicesFromDb = async (userId: string): Promise<Invoice[] | null> => {
  const sql = getDbClient();
  if (!sql) return null;

  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        client_name TEXT,
        client_tax_id TEXT,
        total NUMERIC,
        status TEXT,
        date TEXT,
        type TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        provider_name TEXT,
        date TEXT,
        total NUMERIC,
        currency TEXT,
        category TEXT,
        receipt_url TEXT,
        status TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const invoicesPromise = sql(`SELECT * FROM invoices WHERE user_id = $1 OR data->>'userId' = $1`, [userId]);
    const expensesPromise = sql(`SELECT * FROM expenses WHERE data->>'userId' = $1`, [userId]);

    const [invoicesRes, expensesRes] = await Promise.allSettled([invoicesPromise, expensesPromise]);

    let allDocs: Invoice[] = [];

    if (invoicesRes.status === 'fulfilled') {
      const rows = invoicesRes.value;
      const mappedInvoices = rows.map((row: any) => ({
        ...row.data,
        id: row.id,
        userId: row.user_id || userId,
        clientName: row.client_name,
        clientTaxId: row.client_tax_id,
        clientCountry: row.client_country || row.data?.clientCountry || 'España',
        operationType: row.operation_type || row.data?.operationType || 'NACIONAL',
        legalMention: row.legal_mention || row.data?.legalMention,
        total: parseFloat(row.total),
        status: row.status,
        date: row.date,
        type: row.type,
        amountPaid: row.data?.amountPaid ? parseFloat(row.data.amountPaid) : 0,
        // Multicurrency fields
        invoiceCurrency: row.invoice_currency || row.data?.invoiceCurrency || row.currency || 'EUR',
        baseAmountEur: row.base_amount_eur ? parseFloat(row.base_amount_eur) : (row.data?.baseAmountEur ? parseFloat(row.data.baseAmountEur) : undefined),
        exchangeRateBce: row.exchange_rate_bce ? parseFloat(row.exchange_rate_bce) : (row.data?.exchangeRateBce ? parseFloat(row.data.exchangeRateBce) : undefined),
        exchangeRateDate: row.exchange_rate_date || row.data?.exchangeRateDate,
        paymentReceivedEur: row.payment_received_eur ? parseFloat(row.payment_received_eur) : (row.data?.paymentReceivedEur ? parseFloat(row.data.paymentReceivedEur) : undefined),
        paymentReceivedOriginal: row.payment_received_original ? parseFloat(row.payment_received_original) : (row.data?.paymentReceivedOriginal ? parseFloat(row.data.paymentReceivedOriginal) : undefined),
        paymentExchangeRate: row.payment_exchange_rate ? parseFloat(row.payment_exchange_rate) : (row.data?.paymentExchangeRate ? parseFloat(row.data.paymentExchangeRate) : undefined),
        paymentDate: row.payment_date || row.data?.paymentDate,
        exchangeDifference: row.exchange_difference ? parseFloat(row.exchange_difference) : (row.data?.exchangeDifference ? parseFloat(row.data.exchangeDifference) : undefined),
        // Quote-Invoice Relationship & Payment Plan
        parentQuoteId: row.parent_quote_id || row.data?.parentQuoteId,
        parentInvoiceId: row.parent_invoice_id || row.data?.parentInvoiceId,
        paymentPlan: (() => {
          try {
            const plan = row.payment_plan && Object.keys(row.payment_plan).length > 0 ? row.payment_plan : (row.data?.paymentPlan || undefined);
            if (!plan) return undefined;
            // Asegurar que todas las fechas en el plan sean strings
            if (plan.payments && Array.isArray(plan.payments)) {
              return {
                ...plan,
                payments: plan.payments.map((p: any) => ({
                  ...p,
                  dueDate: typeof p.dueDate === 'string' ? p.dueDate.split('T')[0] : (p.dueDate ? new Date(p.dueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                  paidDate: p.paidDate ? (typeof p.paidDate === 'string' ? p.paidDate.split('T')[0] : new Date(p.paidDate).toISOString().split('T')[0]) : undefined
                }))
              };
            }
            return plan;
          } catch (e) {
            console.error('Error normalizando paymentPlan desde BD:', e);
            return undefined;
          }
        })()
      }));
      allDocs = [...allDocs, ...mappedInvoices];
    }

    if (expensesRes.status === 'fulfilled') {
      const rows = expensesRes.value;
      const mappedExpenses = rows.map((row: any) => ({
        ...row.data,
        id: row.id,
        userId: userId,
        clientName: row.provider_name,
        total: parseFloat(row.total),
        status: row.status,
        date: row.date,
        type: 'Expense',
        receiptUrl: row.receipt_url
      }));
      allDocs = [...allDocs, ...mappedExpenses];
    }

    return allDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.warn("Neon DB Fetch Error:", error);
    return null;
  }
};

/**
 * FETCH CLIENTS
 */
export const fetchClientsFromDb = async (userId: string): Promise<DbClient[]> => {
  const sql = getDbClient();
  if (!sql) return [];
  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tax_id TEXT,
        email TEXT,
        address TEXT,
        phone TEXT,
        tags TEXT,
        notes TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS prospects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tax_id TEXT,
        email TEXT,
        address TEXT,
        phone TEXT,
        tags TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Add contact_name and country columns if they don't exist
    try {
      await sql('ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name TEXT;');
      await sql('ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_name TEXT;');
      await sql('ALTER TABLE clients ADD COLUMN IF NOT EXISTS country TEXT DEFAULT \'España\';');
      await sql('ALTER TABLE prospects ADD COLUMN IF NOT EXISTS country TEXT DEFAULT \'España\';');
    } catch (e) {
      // Column might already exist, ignore
    }
    const query = `
      SELECT id, name, contact_name, tax_id, email, address, phone, country, tags, notes, 'CLIENT' as status FROM clients WHERE user_id = $1
      UNION ALL
      SELECT id, name, contact_name, tax_id, email, address, phone, country, tags, notes, 'PROSPECT' as status FROM prospects WHERE user_id = $1
    `;
    const rows = await sql(query, [userId]);
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      contactName: row.contact_name,
      taxId: row.tax_id,
      email: row.email,
      address: row.address,
      phone: row.phone,
      country: row.country || 'España',
      tags: row.tags,
      notes: row.notes,
      status: row.status as 'CLIENT' | 'PROSPECT'
    }));
  } catch (error) {
    console.error("Error fetching clients:", error);
    return [];
  }
};

/**
 * FETCH PROVIDERS
 */
export const fetchProvidersFromDb = async (userId: string): Promise<DbProvider[]> => {
  const sql = getDbClient();
  if (!sql) return [];
  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tax_id TEXT,
        email TEXT,
        address TEXT,
        phone TEXT,
        category TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    const rows = await sql('SELECT * FROM providers WHERE user_id = $1', [userId]);

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      taxId: row.tax_id,
      email: row.email,
      address: row.address,
      phone: row.phone,
      category: row.category,
      notes: row.notes
    }));
  } catch (error) {
    console.error("Error fetching providers:", error);
    return [];
  }
};

/**
 * SAVE PROVIDER
 */
/**
 * SAVE PROVIDER
 */
export const saveProviderToDb = async (providerData: DbProvider, userId: string): Promise<{ success: boolean, error?: string }> => {
  const sql = getDbClient();
  if (!sql) return { success: false, error: 'Database connection failed' };
  const safeName = providerData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = providerData.id || `prov_${userId.substring(0, 8)}_${safeName}`;
  try {
    const upsertProvider = `
        INSERT INTO providers (id, user_id, name, tax_id, email, address, phone, category, notes, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name,
          tax_id = COALESCE(EXCLUDED.tax_id, providers.tax_id),
          email = COALESCE(EXCLUDED.email, providers.email),
          address = COALESCE(EXCLUDED.address, providers.address),
          phone = COALESCE(EXCLUDED.phone, providers.phone),
          category = COALESCE(EXCLUDED.category, providers.category),
          notes = COALESCE(EXCLUDED.notes, providers.notes),
          updated_at = NOW();
    `;
    await sql(upsertProvider, [id, userId, providerData.name, providerData.taxId, providerData.email, providerData.address, providerData.phone, providerData.category, providerData.notes]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * SAVE CLIENT OR PROSPECT
 */
export const saveClientToDb = async (clientData: DbClient, userId: string, status: 'CLIENT' | 'PROSPECT'): Promise<{ success: boolean, error?: string }> => {
  const sql = getDbClient();
  if (!sql) return { success: false, error: 'Database connection failed' };
  const safeName = clientData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = clientData.id || `cli_${userId.substring(0, 8)}_${safeName}`;
  try {
    if (status === 'CLIENT') {
      const upsertClient = `
            INSERT INTO clients (id, user_id, name, contact_name, tax_id, email, address, phone, country, tags, notes, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (id) DO UPDATE SET 
              name = EXCLUDED.name,
              contact_name = COALESCE(EXCLUDED.contact_name, clients.contact_name),
              tax_id = COALESCE(EXCLUDED.tax_id, clients.tax_id),
              email = COALESCE(EXCLUDED.email, clients.email),
              address = COALESCE(EXCLUDED.address, clients.address),
              phone = COALESCE(EXCLUDED.phone, clients.phone),
              country = COALESCE(EXCLUDED.country, clients.country, 'España'),
              tags = COALESCE(EXCLUDED.tags, clients.tags),
              notes = COALESCE(EXCLUDED.notes, clients.notes),
              updated_at = NOW();
        `;
      await sql(upsertClient, [id, userId, clientData.name, clientData.contactName || null, clientData.taxId, clientData.email, clientData.address, clientData.phone, clientData.country || 'España', clientData.tags, clientData.notes]);
      await sql('DELETE FROM prospects WHERE id = $1', [id]);
    } else {
      const checkClient = await sql('SELECT id FROM clients WHERE id = $1', [id]);
      if (checkClient.length > 0) {
        const updateClient = `UPDATE clients SET contact_name = COALESCE($1, contact_name), tax_id = COALESCE($2, tax_id), email = COALESCE($3, email), address = COALESCE($4, address), phone = COALESCE($5, phone), country = COALESCE($6, country, 'España'), updated_at = NOW() WHERE id = $7`;
        await sql(updateClient, [clientData.contactName || null, clientData.taxId, clientData.email, clientData.address, clientData.phone, clientData.country || 'España', id]);
      } else {
        const upsertProspect = `
                INSERT INTO prospects (id, user_id, name, contact_name, tax_id, email, address, phone, country, tags, notes, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                ON CONFLICT (id) DO UPDATE SET 
                  name = EXCLUDED.name,
                  contact_name = COALESCE(EXCLUDED.contact_name, prospects.contact_name),
                  tax_id = COALESCE(EXCLUDED.tax_id, prospects.tax_id),
                  email = COALESCE(EXCLUDED.email, prospects.email),
                  address = COALESCE(EXCLUDED.address, prospects.address),
                  phone = COALESCE(EXCLUDED.phone, prospects.phone),
                  country = COALESCE(EXCLUDED.country, prospects.country, 'España'),
                  tags = COALESCE(EXCLUDED.tags, prospects.tags),
                  notes = COALESCE(EXCLUDED.notes, prospects.notes),
                  updated_at = NOW();
            `;
        await sql(upsertProspect, [id, userId, clientData.name, clientData.contactName || null, clientData.taxId, clientData.email, clientData.address, clientData.phone, clientData.country || 'España', clientData.tags, clientData.notes]);
      }
    }
    logAuditAction(userId, 'SAVE_CLIENT', { name: clientData.name, status });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * SAVE DOCUMENT
 */
/**
 * SAVE DOCUMENT
 */
export const saveInvoiceToDb = async (invoice: Invoice): Promise<boolean> => {
  const sql = getDbClient();
  if (!sql) return false;
  try {
    if (invoice.type === 'Expense') {
      const query = `
        INSERT INTO expenses (id, user_id, provider_name, provider_tax_id, date, total, currency, category, receipt_url, status, iva_soportado, expense_deductibility, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET 
          user_id = EXCLUDED.user_id, provider_name = EXCLUDED.provider_name, provider_tax_id = EXCLUDED.provider_tax_id,
          total = EXCLUDED.total, date = EXCLUDED.date, currency = EXCLUDED.currency,
          category = EXCLUDED.category, receipt_url = EXCLUDED.receipt_url, status = EXCLUDED.status,
          iva_soportado = EXCLUDED.iva_soportado, expense_deductibility = EXCLUDED.expense_deductibility,
          data = EXCLUDED.data, updated_at = NOW();
      `;
      const category = invoice.items[0]?.description || 'General';
      await sql(query, [
        invoice.id, invoice.userId, invoice.clientName, invoice.clientTaxId || null,
        invoice.date, invoice.total, invoice.currency || 'EUR', category,
        invoice.receiptUrl || null, invoice.status,
        invoice.ivaAmount || 0, invoice.expenseDeductibility || 'FULL',
        JSON.stringify(invoice)
      ]);
    } else {
      // --- VERIFACTU CHAINING LOGIC ---
      if (invoice.status !== 'Borrador' && !invoice.verifactu) {
        try {
          // 1. Get Previous Hash
          const prevHashRes = await sql(
            `SELECT data->'verifactu'->>'chainHash' as hash 
                  FROM invoices 
                  WHERE user_id = $1 AND id != $2 
                  ORDER BY created_at DESC LIMIT 1`,
            [invoice.userId, invoice.id]
          );

          const previousHash = prevHashRes[0]?.hash || '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis Hash

          // 2. Compute Current Hash
          // String to sign: PreviousHash + ID + Date + Total + ClientTaxID
          const stringToSign = `${previousHash}${invoice.id}${invoice.date}${invoice.total.toFixed(2)}${invoice.clientTaxId || ''}`;
          const chainHash = await computeSha256(stringToSign);

          // 3. Attach to Invoice
          invoice.verifactu = {
            chainHash,
            previousHash,
            timestamp: new Date().toISOString()
          };

          console.log(`🔗 VeriFactu Chained: ${invoice.id} -> ${chainHash.substring(0, 8)}...`);
        } catch (err) {
          console.error("VeriFactu Error:", err);
          // Fail validation if needed, or proceed without hash (risk)
        }
      }
      // --------------------------------

      // Add columns if they don't exist (migration)
      try {
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_country TEXT DEFAULT \'España\';');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT \'NACIONAL\';');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legal_mention TEXT;');
        // Multicurrency fields
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_currency TEXT DEFAULT \'EUR\';');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS base_amount_eur NUMERIC;');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate_bce NUMERIC;');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_received_eur NUMERIC;');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_received_original NUMERIC;');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_exchange_rate NUMERIC;');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_date DATE;');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_difference NUMERIC;');
        // Quote-Invoice Relationship & Payment Plan
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS parent_quote_id TEXT;');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS parent_invoice_id TEXT;');
        await sql('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_plan JSONB DEFAULT \'{}\';');
      } catch (e) {
        // Columns might already exist, ignore
      }

      const query = `
        INSERT INTO invoices (
          id, user_id, client_name, client_tax_id, client_email, client_address, 
          client_country, operation_type, legal_mention, 
          total, status, date, type, currency, 
          invoice_currency, base_amount_eur, exchange_rate_bce, exchange_rate_date,
          payment_received_eur, payment_received_original, payment_exchange_rate, payment_date, exchange_difference,
          iva_amount, iva_repercutido, irpf_retention, irpf_amount, discount_rate, amount_paid, 
          parent_quote_id, parent_invoice_id, payment_plan, data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
        ON CONFLICT (id) DO UPDATE SET 
          user_id = EXCLUDED.user_id, client_name = EXCLUDED.client_name, client_tax_id = EXCLUDED.client_tax_id,
          client_email = EXCLUDED.client_email, client_address = EXCLUDED.client_address,
          client_country = COALESCE(EXCLUDED.client_country, invoices.client_country, 'España'),
          operation_type = COALESCE(EXCLUDED.operation_type, invoices.operation_type, 'NACIONAL'),
          legal_mention = EXCLUDED.legal_mention,
          total = EXCLUDED.total, status = EXCLUDED.status, date = EXCLUDED.date, currency = EXCLUDED.currency,
          invoice_currency = COALESCE(EXCLUDED.invoice_currency, invoices.invoice_currency, EXCLUDED.currency, 'EUR'),
          base_amount_eur = EXCLUDED.base_amount_eur,
          exchange_rate_bce = EXCLUDED.exchange_rate_bce,
          exchange_rate_date = EXCLUDED.exchange_rate_date,
          payment_received_eur = EXCLUDED.payment_received_eur,
          payment_received_original = EXCLUDED.payment_received_original,
          payment_exchange_rate = EXCLUDED.payment_exchange_rate,
          payment_date = EXCLUDED.payment_date,
          exchange_difference = EXCLUDED.exchange_difference,
          iva_amount = EXCLUDED.iva_amount, iva_repercutido = EXCLUDED.iva_repercutido,
          irpf_retention = EXCLUDED.irpf_retention, irpf_amount = EXCLUDED.irpf_amount,
          discount_rate = EXCLUDED.discount_rate, amount_paid = EXCLUDED.amount_paid,
          parent_quote_id = EXCLUDED.parent_quote_id,
          parent_invoice_id = EXCLUDED.parent_invoice_id,
          payment_plan = EXCLUDED.payment_plan,
          data = EXCLUDED.data, updated_at = NOW();
      `;
      await sql(query, [
        invoice.id, invoice.userId, invoice.clientName, invoice.clientTaxId,
        invoice.clientEmail || null, invoice.clientAddress || null,
        invoice.clientCountry || 'España', invoice.operationType || 'NACIONAL', invoice.legalMention || null,
        invoice.total, invoice.status, invoice.date, invoice.type, invoice.currency || 'EUR',
        invoice.invoiceCurrency || invoice.currency || 'EUR',
        invoice.baseAmountEur || null,
        invoice.exchangeRateBce || null,
        invoice.exchangeRateDate || null,
        invoice.paymentReceivedEur || null,
        invoice.paymentReceivedOriginal || null,
        invoice.paymentExchangeRate || null,
        invoice.paymentDate || null,
        invoice.exchangeDifference || null,
        invoice.ivaAmount || 0, invoice.ivaRepercutido || 0,
        invoice.irpfRetention || 0, invoice.irpfAmount || 0,
        invoice.discountRate || 0, invoice.amountPaid || 0,
        invoice.parentQuoteId || null,
        invoice.parentInvoiceId || null,
        invoice.paymentPlan ? JSON.stringify(invoice.paymentPlan) : '{}',
        JSON.stringify(invoice)
      ]);
    }
    console.log('✅ Invoice/Quote saved successfully to DB:', {
      id: invoice.id,
      type: invoice.type,
      clientName: invoice.clientName,
      total: invoice.total,
      status: invoice.status,
      userId: invoice.userId
    });
    return true;
  } catch (error: any) {
    console.error('❌ Error saving invoice/quote to DB:', {
      error: error.message,
      stack: error.stack,
      invoiceId: invoice.id,
      invoiceType: invoice.type,
      userId: invoice.userId
    });
    return false;
  }
};

/**
 * DELETE DOCUMENT
 */
export const deleteInvoiceFromDb = async (id: string, userId: string): Promise<boolean> => {
  const sql = getDbClient();
  if (!sql) return false;
  try {
    // We can rely on id being unique across tables ideally, but here we scan both
    // rowCount is not reliable in basic neon driver unless RETURNING is used?
    // Actually, DELETE without returning is fine if we just want to execute.
    // If we want to return true ONLY if it existed, we need RETURNING id
    const delInv = await sql('DELETE FROM invoices WHERE id = $1 RETURNING id', [id]);
    if (delInv.length === 0) {
      await sql('DELETE FROM expenses WHERE id = $1', [id]);
    }
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * SAVE TRIMESTRAL DECLARATION
 */
export const saveTrimestralDeclaration = async (declaracion: TrimestralDeclaration): Promise<boolean> => {
  const sql = getDbClient();
  if (!sql) return false;
  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS trimestral_declarations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        trimestre INTEGER NOT NULL CHECK (trimestre IN (1, 2, 3, 4)),
        año INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('MODELO_130', 'MODELO_131', 'MODELO_303')),
        fecha_vencimiento DATE NOT NULL,
        presentada BOOLEAN DEFAULT FALSE,
        fecha_presentacion TIMESTAMP,
        datos JSONB NOT NULL DEFAULT '{}',
        resultado NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, trimestre, año, tipo)
      );
    `);

    const query = `
      INSERT INTO trimestral_declarations (id, user_id, trimestre, año, tipo, fecha_vencimiento, presentada, fecha_presentacion, datos, resultado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        fecha_vencimiento = EXCLUDED.fecha_vencimiento,
        presentada = EXCLUDED.presentada,
        fecha_presentacion = EXCLUDED.fecha_presentacion,
        datos = EXCLUDED.datos,
        resultado = EXCLUDED.resultado,
        updated_at = NOW();
    `;

    await sql(query, [
      declaracion.id,
      declaracion.userId,
      declaracion.trimestre,
      declaracion.año,
      declaracion.tipo,
      declaracion.fechaVencimiento,
      declaracion.presentada || false,
      declaracion.fechaPresentacion || null,
      JSON.stringify(declaracion.datos),
      declaracion.resultado
    ]);

    return true;
  } catch (error) {
    console.error("Save Trimestral Error:", error);
    return false;
  }
};

/**
 * FETCH TRIMESTRAL DECLARATIONS
 */
export const fetchTrimestralDeclarations = async (userId: string): Promise<TrimestralDeclaration[]> => {
  const sql = getDbClient();
  if (!sql) return [];
  try {
    await sql(`
      CREATE TABLE IF NOT EXISTS trimestral_declarations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        trimestre INTEGER NOT NULL CHECK (trimestre IN (1, 2, 3, 4)),
        año INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('MODELO_130', 'MODELO_131', 'MODELO_303')),
        fecha_vencimiento DATE NOT NULL,
        presentada BOOLEAN DEFAULT FALSE,
        fecha_presentacion TIMESTAMP,
        datos JSONB NOT NULL DEFAULT '{}',
        resultado NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, trimestre, año, tipo)
      );
    `);

    const result = await sql(
      'SELECT * FROM trimestral_declarations WHERE user_id = $1 ORDER BY año DESC, trimestre DESC',
      [userId]
    );

    return result.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      trimestre: row.trimestre as 1 | 2 | 3 | 4,
      año: row.año,
      tipo: row.tipo as 'MODELO_130' | 'MODELO_131' | 'MODELO_303',
      fechaVencimiento: row.fecha_vencimiento,
      presentada: row.presentada,
      fechaPresentacion: row.fecha_presentacion,
      datos: row.datos,
      resultado: parseFloat(row.resultado),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error("Fetch Trimestral Error:", error);
    return [];
  }
};
