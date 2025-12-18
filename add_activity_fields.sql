-- =====================================================
-- AGREGAR CAMPOS DE ACTIVIDAD ECONÓMICA
-- =====================================================

-- Agregar campos de actividad económica a la tabla users (en profile_data se guarda, pero también en autonomo_config)
-- Ya tenemos actividad_principal en autonomo_config, pero vamos a agregar campos más específicos

-- Agregar campo activity_sector (rubro principal) a autonomo_config
ALTER TABLE autonomo_config 
ADD COLUMN IF NOT EXISTS activity_sector TEXT;

-- Agregar campo activity_subcategory (subcategoría específica) a autonomo_config
ALTER TABLE autonomo_config 
ADD COLUMN IF NOT EXISTS activity_subcategory TEXT;

-- Agregar campo iva_article (artículo de IVA aplicable según actividad) a autonomo_config
-- Valores posibles: 'ART_21', 'ART_69_70', 'ART_69', 'ART_70', 'MIXTO'
ALTER TABLE autonomo_config 
ADD COLUMN IF NOT EXISTS iva_article TEXT;

-- Comentario: 
-- - activity_sector: Rubro principal (ej: "Tecnología y Software", "Diseño y Creatividad")
-- - activity_subcategory: Subcategoría específica (ej: "Desarrollo Web", "Diseño Gráfico")
-- - iva_article: Artículo de la Ley del IVA que aplica según la actividad
--   - ART_21: Exportación de bienes físicos
--   - ART_69_70: Servicios digitales/profesionales (regla de localización)
--   - ART_69: Servicios prestados a empresarios/profesionales
--   - ART_70: Servicios prestados a particulares
--   - MIXTO: Actividades que pueden requerir ambos artículos según el caso

