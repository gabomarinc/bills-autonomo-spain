-- =====================================================
-- KÔNSUL BILLS - RELACIÓN COTIZACIÓN-FACTURA Y PLAN DE PAGOS
-- Script para agregar campos de relación y plan de pagos
-- =====================================================

-- Agregar campos para relación cotización-factura y plan de pagos
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS parent_quote_id TEXT,
ADD COLUMN IF NOT EXISTS parent_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS payment_plan JSONB DEFAULT '{}';

-- Índices para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_invoices_parent_quote ON invoices(parent_quote_id) WHERE parent_quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_parent_invoice ON invoices(parent_invoice_id) WHERE parent_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_payment_plan ON invoices USING GIN (payment_plan) WHERE payment_plan != '{}'::jsonb;

-- Comentarios para documentación
COMMENT ON COLUMN invoices.parent_quote_id IS 'ID de la cotización desde la cual se generó esta factura';
COMMENT ON COLUMN invoices.parent_invoice_id IS 'ID de la factura padre cuando esta factura es parte de una división de pagos';
COMMENT ON COLUMN invoices.payment_plan IS 'Plan de pagos en formato JSON: { "total_payments": N, "payments": [{ "amount": X, "due_date": "YYYY-MM-DD", "paid": boolean, "paid_date": "YYYY-MM-DD" }] }';

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
