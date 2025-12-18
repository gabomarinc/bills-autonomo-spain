-- =====================================================
-- AGREGAR CAMPOS PARA FACTURACIÓN MULTIMONEDA
-- =====================================================

-- Moneda de facturación
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS invoice_currency TEXT DEFAULT 'EUR';

-- Conversión a EUR (para declaración fiscal)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS base_amount_eur NUMERIC;

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS exchange_rate_bce NUMERIC;

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;

-- Pago real recibido
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS payment_received_eur NUMERIC;

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS payment_received_original NUMERIC;

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS payment_exchange_rate NUMERIC;

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS payment_date DATE;

-- Diferencia de cambio (gasto financiero deducible)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS exchange_difference NUMERIC;

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(user_id, invoice_currency);
CREATE INDEX IF NOT EXISTS idx_invoices_exchange_date ON invoices(user_id, exchange_rate_date);

-- Comentarios:
-- - invoice_currency: Moneda en que se factura (EUR, USD, GBP, etc.)
-- - base_amount_eur: Importe convertido a EUR usando tipo de cambio oficial del BCE
-- - exchange_rate_bce: Tipo de cambio oficial del BCE usado para la conversión
-- - exchange_rate_date: Fecha del tipo de cambio (fecha de factura o anterior)
-- - payment_received_eur: Lo que realmente llegó al banco en EUR
-- - payment_received_original: Lo que llegó en moneda original
-- - payment_exchange_rate: Tipo de cambio que aplicó el banco
-- - payment_date: Fecha en que se recibió el pago
-- - exchange_difference: Diferencia entre factura y pago (base_amount_eur - payment_received_eur)
--   Esta diferencia se registra como gasto financiero deducible
