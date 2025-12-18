-- =====================================================
-- AGREGAR CAMPOS PARA OPERACIONES INTERNACIONALES
-- =====================================================

-- Agregar campo client_country a la tabla invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS client_country TEXT DEFAULT 'España';

-- Agregar campo operation_type a la tabla invoices
-- Valores posibles: 'NACIONAL', 'EXPORTACION', 'INTRACOMUNITARIA'
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'NACIONAL' CHECK (operation_type IN ('NACIONAL', 'EXPORTACION', 'INTRACOMUNITARIA'));

-- Agregar campo legal_mention para almacenar menciones legales automáticas
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS legal_mention TEXT;

-- Agregar campo client_country a la tabla clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'España';

-- Agregar campo client_country a la tabla prospects
ALTER TABLE prospects 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'España';

-- Índice para búsquedas por país del cliente
CREATE INDEX IF NOT EXISTS idx_invoices_client_country ON invoices(user_id, client_country);
CREATE INDEX IF NOT EXISTS idx_invoices_operation_type ON invoices(user_id, operation_type);

