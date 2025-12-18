-- =====================================================
-- KÔNSUL BILLS - BASE DE DATOS ESPAÑA
-- Script completo de creación de tablas
-- Adaptado para autónomos españoles
-- =====================================================

-- =====================================================
-- 1. TABLA: USERS (Usuarios/Autónomos)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('FREELANCE', 'COMPANY')),
  profile_data JSONB DEFAULT '{}',
  stripe_customer_id TEXT,
  plan_name TEXT DEFAULT 'Free' CHECK (plan_name IN ('Free', 'Emprendedor Pro', 'Empresa Scale')),
  renewal_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- =====================================================
-- 2. TABLA: INVOICES (Facturas y Cotizaciones)
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_tax_id TEXT, -- NIF/CIF del cliente
  client_email TEXT,
  client_address TEXT,
  total NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'Borrador', 'Creada', 'Enviada', 'Seguimiento', 
    'Negociacion', 'Aceptada', 'Rechazada', 'Pagada', 
    'Abonada', 'Incobrable', 'PendingSync'
  )),
  date TEXT NOT NULL, -- ISO string
  type TEXT NOT NULL CHECK (type IN ('Invoice', 'Quote', 'Expense')),
  currency TEXT DEFAULT 'EUR',
  -- Datos completos del documento en JSONB
  data JSONB NOT NULL DEFAULT '{}',
  -- Campos adicionales para España (también en data pero redundantes para queries)
  iva_amount NUMERIC DEFAULT 0,
  iva_repercutido NUMERIC DEFAULT 0,
  irpf_retention NUMERIC DEFAULT 0, -- Porcentaje de retención IRPF
  irpf_amount NUMERIC DEFAULT 0, -- Cantidad retenida
  discount_rate NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para invoices
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON invoices(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(user_id, type);
CREATE INDEX IF NOT EXISTS idx_invoices_client_name ON invoices(user_id, client_name);

-- =====================================================
-- 3. TABLA: EXPENSES (Gastos)
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  provider_tax_id TEXT, -- NIF/CIF del proveedor
  date TEXT NOT NULL, -- ISO string
  total NUMERIC NOT NULL,
  currency TEXT DEFAULT 'EUR',
  category TEXT,
  receipt_url TEXT,
  status TEXT DEFAULT 'Borrador',
  -- IVA soportado (pagado al proveedor)
  iva_soportado NUMERIC DEFAULT 0,
  -- Deducibilidad del gasto
  expense_deductibility TEXT DEFAULT 'FULL' CHECK (expense_deductibility IN ('FULL', 'NONE', 'PARTIAL')),
  -- Datos completos en JSONB
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para expenses
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(user_id, category);

-- =====================================================
-- 4. TABLA: CLIENTS (Clientes)
-- =====================================================
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_id TEXT, -- NIF/CIF
  email TEXT,
  address TEXT,
  phone TEXT,
  tags TEXT, -- Comma separated
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para clients
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(user_id, name);
CREATE INDEX IF NOT EXISTS idx_clients_tax_id ON clients(user_id, tax_id) WHERE tax_id IS NOT NULL;

-- =====================================================
-- 5. TABLA: PROSPECTS (Prospectos)
-- =====================================================
CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_id TEXT, -- NIF/CIF
  email TEXT,
  address TEXT,
  phone TEXT,
  tags TEXT, -- Comma separated
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para prospects
CREATE INDEX IF NOT EXISTS idx_prospects_user_id ON prospects(user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_name ON prospects(user_id, name);

-- =====================================================
-- 6. TABLA: PROVIDERS (Proveedores)
-- =====================================================
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_id TEXT, -- NIF/CIF
  email TEXT,
  address TEXT,
  phone TEXT,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para providers
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_name ON providers(user_id, name);
CREATE INDEX IF NOT EXISTS idx_providers_category ON providers(user_id, category) WHERE category IS NOT NULL;

-- =====================================================
-- 7. TABLA: CATALOG_ITEMS (Catálogo de Servicios/Productos)
-- =====================================================
CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  description TEXT,
  sku TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para catalog_items
CREATE INDEX IF NOT EXISTS idx_catalog_user_id ON catalog_items(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_name ON catalog_items(user_id, name);

-- =====================================================
-- 8. TABLA: AUDIT_LOG (Log de Auditoría)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para audit_log
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(user_id, action);

-- =====================================================
-- 9. TABLA: AUTONOMO_QUOTAS (Cuotas de Autónomo) - NUEVA
-- =====================================================
CREATE TABLE IF NOT EXISTS autonomo_quotas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  año INTEGER NOT NULL,
  base_cotizacion NUMERIC NOT NULL,
  cuota_mensual NUMERIC NOT NULL,
  pagado BOOLEAN DEFAULT FALSE,
  fecha_pago TIMESTAMP,
  fecha_vencimiento DATE NOT NULL,
  tipo_reduccion TEXT CHECK (tipo_reduccion IN ('TARIFA_PLANA', 'REDUCCION_50', 'REDUCCION_25', 'NINGUNA')),
  desglose JSONB, -- {contingenciasComunes, desempleo, formacionProfesional}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, mes, año)
);

-- Índices para autonomo_quotas
CREATE INDEX IF NOT EXISTS idx_quotas_user_year ON autonomo_quotas(user_id, año);
CREATE INDEX IF NOT EXISTS idx_quotas_user_month_year ON autonomo_quotas(user_id, año, mes);
CREATE INDEX IF NOT EXISTS idx_quotas_vencimiento ON autonomo_quotas(fecha_vencimiento) WHERE pagado = FALSE;
CREATE INDEX IF NOT EXISTS idx_quotas_pagado ON autonomo_quotas(user_id, pagado);

-- =====================================================
-- 10. TABLA: TRIMESTRAL_DECLARATIONS (Declaraciones Trimestrales) - NUEVA
-- =====================================================
CREATE TABLE IF NOT EXISTS trimestral_declarations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  trimestre INTEGER NOT NULL CHECK (trimestre IN (1, 2, 3, 4)),
  año INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('MODELO_130', 'MODELO_131', 'MODELO_303')),
  fecha_vencimiento DATE NOT NULL,
  presentada BOOLEAN DEFAULT FALSE,
  fecha_presentacion TIMESTAMP,
  -- Datos específicos del modelo (varía según tipo)
  datos JSONB NOT NULL DEFAULT '{}',
  -- Resultado: cantidad a ingresar (positivo) o devolver (negativo)
  resultado NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, trimestre, año, tipo)
);

-- Índices para trimestral_declarations
CREATE INDEX IF NOT EXISTS idx_trimestral_user_year ON trimestral_declarations(user_id, año);
CREATE INDEX IF NOT EXISTS idx_trimestral_user_trimestre_year ON trimestral_declarations(user_id, año, trimestre);
CREATE INDEX IF NOT EXISTS idx_trimestral_tipo ON trimestral_declarations(user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_trimestral_vencimiento ON trimestral_declarations(fecha_vencimiento) WHERE presentada = FALSE;
CREATE INDEX IF NOT EXISTS idx_trimestral_presentada ON trimestral_declarations(user_id, presentada);

-- =====================================================
-- 11. TABLA: AUTONOMO_CONFIG (Configuración Autónomo) - NUEVA
-- =====================================================
CREATE TABLE IF NOT EXISTS autonomo_config (
  user_id TEXT PRIMARY KEY,
  base_cotizacion NUMERIC NOT NULL DEFAULT 1134.0, -- Base mínima 2024
  fecha_alta DATE NOT NULL,
  bonificacion_reduccion BOOLEAN DEFAULT FALSE,
  tipo_reduccion TEXT CHECK (tipo_reduccion IN ('TARIFA_PLANA', 'REDUCCION_50', 'REDUCCION_25', 'NINGUNA')),
  regimen_fiscal TEXT DEFAULT 'GENERAL' CHECK (regimen_fiscal IN ('GENERAL', 'SIMPLIFICADO', 'AGRICOLA', 'GANADERO', 'FORESTAL')),
  actividad_principal TEXT,
  codigo_cnae TEXT, -- Código CNAE de la actividad
  iva_regimen TEXT DEFAULT 'GENERAL' CHECK (iva_regimen IN ('GENERAL', 'SIMPLIFICADO', 'AGRICULTURA', 'EXENTO')),
  prorrateo_iva BOOLEAN DEFAULT FALSE,
  porcentaje_prorrateo NUMERIC DEFAULT 100, -- % de actividad sujeta a IVA
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para autonomo_config
CREATE INDEX IF NOT EXISTS idx_autonomo_config_user ON autonomo_config(user_id);

-- =====================================================
-- TRIGGERS: Actualización automática de updated_at
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON prospects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catalog_items_updated_at BEFORE UPDATE ON catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_autonomo_quotas_updated_at BEFORE UPDATE ON autonomo_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trimestral_declarations_updated_at BEFORE UPDATE ON trimestral_declarations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_autonomo_config_updated_at BEFORE UPDATE ON autonomo_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMENTARIOS EN TABLAS (Documentación)
-- =====================================================

COMMENT ON TABLE users IS 'Usuarios autónomos y empresas registradas en la plataforma';
COMMENT ON TABLE invoices IS 'Facturas, cotizaciones y documentos de venta';
COMMENT ON TABLE expenses IS 'Gastos y facturas de proveedores';
COMMENT ON TABLE clients IS 'Clientes activos del usuario';
COMMENT ON TABLE prospects IS 'Prospectos o clientes potenciales';
COMMENT ON TABLE providers IS 'Proveedores y empresas de las que se compra';
COMMENT ON TABLE catalog_items IS 'Catálogo de servicios/productos reutilizables';
COMMENT ON TABLE audit_log IS 'Registro de acciones del usuario para auditoría';
COMMENT ON TABLE autonomo_quotas IS 'Cuotas mensuales de Seguridad Social del autónomo';
COMMENT ON TABLE trimestral_declarations IS 'Declaraciones trimestrales (Modelo 130, 131, 303)';
COMMENT ON TABLE autonomo_config IS 'Configuración fiscal y de Seguridad Social del autónomo';

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
