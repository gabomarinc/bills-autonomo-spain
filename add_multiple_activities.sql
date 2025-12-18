-- =====================================================
-- AGREGAR SOPORTE PARA MÚLTIPLES ACTIVIDADES
-- =====================================================

-- Agregar columna para guardar múltiples subcategorías como JSON array
ALTER TABLE autonomo_config 
ADD COLUMN IF NOT EXISTS activity_subcategories JSONB;

-- Comentario:
-- - activity_subcategories: Array JSON de IDs de subcategorías (ej: ["desarrollo-web", "desarrollo-movil"])
-- - Se mantiene activity_subcategory para compatibilidad hacia atrás (primera subcategoría del array)
-- - El sistema calculará iva_article como 'MIXTO' si hay múltiples artículos diferentes
