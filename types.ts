
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  WIZARD = 'WIZARD', // New AI Flow
  INVOICES = 'INVOICES',
  CLIENTS = 'CLIENTS', // New Clients View
  CLIENT_DETAIL = 'CLIENT_DETAIL', // New View
  SETTINGS = 'SETTINGS',
  INVOICE_DETAIL = 'INVOICE_DETAIL', // New View
  REPORTS = 'REPORTS', // New Reports View
  CATALOG = 'CATALOG', // New Catalog View
  EXPENSES = 'EXPENSES', // New Expenses View
  EXPENSE_WIZARD = 'EXPENSE_WIZARD', // New Expense Creation Flow
  CLIENT_WIZARD = 'CLIENT_WIZARD', // New Client Creation Flow
  QUOTA_CALCULATOR = 'QUOTA_CALCULATOR', // New: Cuotas Autónomo
  TRIMESTRAL = 'TRIMESTRAL', // New: Declaraciones Trimestrales
}

export enum ProfileType {
  FREELANCE = 'Autónomo',
  COMPANY = 'Empresa (SL/SA)',
}

// NEW: Database Client Structure
export interface DbClient {
  id?: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  tags?: string; // Comma separated string
  notes?: string;
  status?: 'CLIENT' | 'PROSPECT';
}

// NEW: Database Provider Structure
export interface DbProvider {
  id?: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  notes?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  description?: string; // Added optional description
  sku?: string; // Added optional SKU
  isRecurring?: boolean; // New: Monthly/Recurring flag
}

export interface BrandingConfig {
  primaryColor: string;
  templateStyle: 'Modern' | 'Classic' | 'Minimal';
  logoUrl?: string;
}

export interface EmailConfig {
  provider: 'SYSTEM' | 'GMAIL' | 'SMTP' | 'RESEND'; // Added RESEND
  email?: string;
  // SMTP (Sending)
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  // IMAP (Receiving)
  imapHost?: string;
  imapPort?: number;
  useSSL?: boolean;
}

export interface DocumentSequences {
  invoicePrefix: string;
  invoiceNextNumber: number;
  quotePrefix: string;
  quoteNextNumber: number;
}

export interface PaymentIntegration {
  provider: 'STRIPE' | 'PAYPAL' | 'BIZUM' | 'BOTH';
  enabled: boolean;
  // Stripe
  stripePublicKey?: string;
  stripeSecretKey?: string;
  // PayPal
  paypalClientId?: string;
  paypalSecret?: string;
  // Bizum
  bizumPhone?: string;
}

// New: Configuration for the Hourly Rate Calculator
export interface HourlyRateConfig {
  targetIncome: number;
  monthlyCosts: number;
  billableHours: number;
  calculatedRate: number;
}

// NEW: Advanced Fiscal Configuration for Spain
export interface SpanishFiscalConfig {
  entityType: 'FISICA' | 'JURIDICA';
  nif: string; // NIF/CIF del autónomo
  regimenFiscal: 'GENERAL' | 'SIMPLIFICADO' | 'AGRICOLA' | 'GANADERO' | 'FORESTAL';
  actividadPrincipal: string; // Código CNAE o descripción
  codigoCnae?: string; // Código CNAE específico
  fechaAltaAutonomo?: string; // Para calcular tarifa plana
  baseCotizacionSS?: number; // Base de cotización Seguridad Social
  bonificacionReduccion?: 'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA';
  tipoReduccion?: 'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA';
  ivaRegimen?: 'GENERAL' | 'SIMPLIFICADO' | 'AGRICULTURA' | 'EXENTO';
  prorrateoIVA?: boolean; // Si tiene actividad mixta
  porcentajeProrrateo?: number; // % de actividad sujeta a IVA
}

export interface UserProfile {
  id: string;
  name: string;
  legalName?: string; // New: Razón Social separate from Commercial Name
  email?: string; // Added email property for authentication and messaging
  type: ProfileType;
  taxId: string; // NIF, RFC, CUIT
  address?: string;
  country?: string;
  fiscalRegime?: string; // Legacy string, kept for backward compat
  
  // NEW: Structured Fiscal Profile (Spain)
  fiscalConfig?: SpanishFiscalConfig;

  // Branding
  branding?: BrandingConfig;
  
  // Finance
  bankName?: string; // New: Bank Name
  bankAccount?: string; // IBAN / CBU / CLABE
  bankAccountType?: 'Ahorro' | 'Corriente'; // New: Account Type
  defaultCurrency?: string; // New: Default currency for user (EUR for Spain)
  paymentTermsDays?: number;
  acceptsOnlinePayment?: boolean; // Legacy flag, migrating to paymentIntegration
  paymentIntegration?: PaymentIntegration; // New: PagueloFacil/Yappy Config
  hourlyRateConfig?: HourlyRateConfig; // New: Persisted calculator settings

  // Catalog
  defaultServices?: CatalogItem[];

  // Sequencing
  documentSequences?: DocumentSequences;

  // Comms
  toneOfVoice?: 'Formal' | 'Casual';
  emailTemplates?: {
    invoiceNew: string;
    invoiceOverdue: string;
  };
  emailConfig?: EmailConfig; // New: Email configuration
  whatsappNumber?: string;   // New: WhatsApp for sending
  whatsappCountryCode?: string; // New: Prefix

  // Subscription
  plan?: 'Free' | 'Emprendedor Pro' | 'Empresa Scale';
  renewalDate?: string;
  stripeCustomerId?: string; // NEW: To link with Stripe Billing Portal

  // AI & Services Configuration
  apiKeys?: {
    gemini?: string;
    openai?: string;
  };

  avatar: string;
  isOnboardingComplete: boolean;
}

export interface InvoiceItem {
  id: string;
  description: string; // Used as Item Name/Title
  details?: string;    // New: Extended description
  quantity: number;
  price: number;
  tax: number; // IVA percentage (21, 10, 4, 0)
  taxType?: 'GENERAL' | 'REDUCIDO' | 'SUPERREDUCIDO' | 'EXENTO'; // Tipo de IVA
}

export interface TimelineEvent {
  id: string;
  type: 'CREATED' | 'SENT' | 'OPENED' | 'CLICKED' | 'APPROVED' | 'PAID' | 'REMINDER' | 'EDITED' | 'STATUS_CHANGE';
  title: string;
  description?: string;
  timestamp: string;
  icon?: string; // Optional custom icon hint
}

export type InvoiceStatus = 
  | 'Borrador'      // Draft
  | 'Creada'        // Created
  | 'Enviada'       // Sent
  | 'Seguimiento'   // Follow-up/Viewed
  | 'Negociacion'   // Negotiation (Quotes)
  | 'Aceptada'      // Accepted (Quotes) / Paid (Legacy Invoices)
  | 'Rechazada'     // Rejected
  | 'Pagada'        // Paid (New Invoices)
  | 'Abonada'       // Partially Paid (New Invoices)
  | 'Incobrable'    // Uncollectible (New Invoices)
  | 'PendingSync';  // Internal: Offline

export interface Invoice {
  id: string;
  userId?: string; // LINK TO USER PROFILE
  clientName: string;
  clientTaxId?: string;
  clientEmail?: string; // Added client email for sending
  clientAddress?: string; // New field for Client Editing
  date: string;
  items: InvoiceItem[];
  total: number;
  discountRate?: number; // New: Persisted Discount Rate
  notes?: string; // NEW: Notes visible on invoice
  amountPaid?: number; // New: Track partial payments
  status: InvoiceStatus;
  currency: string;
  type: 'Invoice' | 'Quote' | 'Expense'; 
  
  // Fiscal Logic (Spain)
  ivaAmount?: number; // IVA total de la factura
  ivaRepercutido?: number; // IVA cobrado (para Modelo 303)
  irpfRetention?: number; // Retención IRPF aplicada (15%, 7%, 0%)
  irpfAmount?: number; // Cantidad retenida de IRPF
  expenseDeductibility?: 'FULL' | 'NONE' | 'PARTIAL'; // Deducibilidad del gasto
  isValidFiscalDoc?: boolean; // True = Factura válida fiscalmente, False = Recibo simple
  prorrateoIVA?: boolean; // Si aplica prorrateo de IVA

  // Vital Signs
  timeline?: TimelineEvent[];
  successProbability?: number; // 0-100 (Only for Quotes)
  receiptUrl?: string; // New: For Expense receipts
  resendEmailId?: string; // New: Track email status via Resend
}

export interface ParsedInvoiceData {
  clientName: string;
  concept: string;
  amount: number;
  currency: string;
  detectedType: 'Invoice' | 'Quote' | 'Expense';
  date?: string; // New for Expenses
}

export interface ChartData {
  name: string;
  value: number;
}

// NEW: Structured AI Analysis for Reports
export interface FinancialAnalysisResult {
  healthScore: number; // 0-100
  healthStatus: 'Excelente' | 'Buena' | 'Regular' | 'Crítica'; // Updated to Spanish
  diagnosis: string;
  actionableTips: string[];
  projection: string;
}

// NEW: Specific Deep Dive Report for a single chart
export interface DeepDiveReport {
  chartTitle: string;
  executiveSummary: string;
  keyMetrics: { label: string; value: string; trend: 'up' | 'down' | 'neutral' }[];
  strategicInsight: string;
  recommendation: string;
}

// NEW: Price Analysis Structure
export interface PriceAnalysisResult {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  currency: string;
  reasoning: string;
}

// NEW: Deductibility Analysis for Expenses
export interface DeductibilityResult {
  isDeductible: boolean;
  likelihood: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
  categorySuggestion: string;
  warning?: string;
}

// NEW: Cuota de Autónomo Configuration
export interface AutonomoQuotaConfig {
  baseCotizacion: number;
  fechaAlta: string;
  bonificacionReduccion: boolean;
  tipoReduccion?: 'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA';
  cuotaMensual: number;
  historialPagos?: Array<{
    mes: string;
    año: number;
    cuota: number;
    pagado: boolean;
    fechaPago?: string;
  }>;
}

// NEW: Declaración Trimestral
export interface TrimestralDeclaration {
  id: string;
  userId: string;
  trimestre: 1 | 2 | 3 | 4;
  año: number;
  tipo: 'MODELO_130' | 'MODELO_131' | 'MODELO_303';
  fechaVencimiento: string;
  presentada: boolean;
  fechaPresentacion?: string;
  datos: any; // Datos específicos del modelo
  resultado: number; // A ingresar o devolver
  created_at?: string;
  updated_at?: string;
}
