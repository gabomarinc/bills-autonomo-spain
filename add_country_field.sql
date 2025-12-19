-- Agregar campo country a las tablas clients y prospects
-- Este campo facilitará el manejo de IVA según el país del cliente

ALTER TABLE clients ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'España';
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'España';

-- Crear índice para búsquedas por país
CREATE INDEX IF NOT EXISTS idx_clients_country ON clients(user_id, country);
CREATE INDEX IF NOT EXISTS idx_prospects_country ON prospects(user_id, country);

-- Comentario: El campo country se usa para:
-- 1. Determinar automáticamente el tipo de operación (NACIONAL, INTRACOMUNITARIA, EXPORTACION)
-- 2. Aplicar las reglas de IVA correctas según el país
-- 3. Autocompletar el país cuando se crea una factura/cotización para ese cliente
