-- =====================================================
-- AGREGAR CAMPO contact_name A TABLAS clients Y prospects
-- =====================================================

-- Agregar campo contact_name a la tabla clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Agregar campo contact_name a la tabla prospects
ALTER TABLE prospects 
ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Comentario: El campo contact_name almacena el nombre de la persona de contacto
-- dentro de la empresa/cliente, diferente del nombre de la empresa (name)
