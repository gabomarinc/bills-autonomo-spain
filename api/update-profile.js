import { Client } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const getDbClient = () => {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.warn("DATABASE_URL environment variable is not set.");
      return null;
    }
    if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
      console.warn("Invalid Database URL format");
      return null;
    }
    return new Client(url);
  } catch (error) {
    console.error("Error initializing DB Client:", error);
    return null;
  }
};

const updateUserProfileInDb = async (profile) => {
  const client = getDbClient();
  if (!client) {
    throw new Error('No se pudo conectar a la base de datos. Verifica DATABASE_URL.');
  }

  try {
    await client.connect();
    const profileData = { ...profile };
    
    // Eliminar campos que se guardan en columnas separadas
    delete profileData.id;
    delete profileData.name;
    delete profileData.email;
    delete profileData.type;
    delete profileData.password;
    delete profileData.stripeCustomerId;
    delete profileData.plan;
    delete profileData.renewalDate;

    const dbType = (profile.type || '').includes('Empresa') ? 'COMPANY' : 'FREELANCE';

    // Verificar que el usuario existe primero
    const checkUser = await client.query('SELECT id FROM users WHERE id = $1', [profile.id]);
    if (checkUser.rows.length === 0) {
      await client.end();
      throw new Error(`Usuario con ID ${profile.id} no encontrado en la base de datos`);
    }

    const result = await client.query(
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

    // Verificar que se actualizó al menos una fila
    if (result.rowCount === 0) {
      await client.end();
      throw new Error(`No se pudo actualizar el usuario. Ninguna fila fue modificada.`);
    }

    console.log(`Usuario ${profile.id} actualizado correctamente. Filas afectadas: ${result.rowCount}`);
    
    // También guardar/actualizar en autonomo_config si hay datos de cuotas
    // Esto permite consultas más eficientes y mejor organización
    if (profile.fiscalConfig && (profile.fiscalConfig.baseCotizacionSS || profile.fiscalConfig.fechaAltaAutonomo)) {
      const fiscalConfig = profile.fiscalConfig;
      
      // Convertir bonificacionReduccion: si es string 'TARIFA_PLANA', etc., es true
      const bonificacionReduccion = fiscalConfig.bonificacionReduccion === 'TARIFA_PLANA' || 
                                    fiscalConfig.bonificacionReduccion === 'REDUCCION_50' || 
                                    fiscalConfig.bonificacionReduccion === 'REDUCCION_25' ||
                                    fiscalConfig.bonificacionReduccion === true;
      
      // Asegurar que fecha_alta tenga un valor válido
      const fechaAlta = fiscalConfig.fechaAltaAutonomo || new Date().toISOString().split('T')[0];
      
      try {
        // Add activity columns if they don't exist (migration)
        try {
          await client.query('ALTER TABLE autonomo_config ADD COLUMN IF NOT EXISTS activity_sector TEXT;');
          await client.query('ALTER TABLE autonomo_config ADD COLUMN IF NOT EXISTS activity_subcategory TEXT;');
          await client.query('ALTER TABLE autonomo_config ADD COLUMN IF NOT EXISTS activity_subcategories JSONB;');
          await client.query('ALTER TABLE autonomo_config ADD COLUMN IF NOT EXISTS iva_article TEXT;');
        } catch (e) {
          // Columns might already exist, ignore
        }

        // Guardar activitySubcategories como JSON array
        const activitySubcategoriesJson = fiscalConfig.activitySubcategories 
          ? JSON.stringify(fiscalConfig.activitySubcategories) 
          : null;

        await client.query(
          `INSERT INTO autonomo_config (
            user_id, base_cotizacion, fecha_alta, bonificacion_reduccion, tipo_reduccion,
            regimen_fiscal, actividad_principal, codigo_cnae, activity_sector, activity_subcategory, activity_subcategories, iva_article,
            iva_regimen, prorrateo_iva, porcentaje_prorrateo, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            base_cotizacion = EXCLUDED.base_cotizacion,
            fecha_alta = EXCLUDED.fecha_alta,
            bonificacion_reduccion = EXCLUDED.bonificacion_reduccion,
            tipo_reduccion = EXCLUDED.tipo_reduccion,
            regimen_fiscal = EXCLUDED.regimen_fiscal,
            actividad_principal = EXCLUDED.actividad_principal,
            codigo_cnae = EXCLUDED.codigo_cnae,
            activity_sector = EXCLUDED.activity_sector,
            activity_subcategory = EXCLUDED.activity_subcategory,
            activity_subcategories = EXCLUDED.activity_subcategories,
            iva_article = EXCLUDED.iva_article,
            iva_regimen = EXCLUDED.iva_regimen,
            prorrateo_iva = EXCLUDED.prorrateo_iva,
            porcentaje_prorrateo = EXCLUDED.porcentaje_prorrateo,
            updated_at = NOW()`,
          [
            profile.id,
            fiscalConfig.baseCotizacionSS || 1134.0,
            fechaAlta,
            bonificacionReduccion,
            fiscalConfig.tipoReduccion || 'NINGUNA',
            fiscalConfig.regimenFiscal || 'GENERAL',
            fiscalConfig.actividadPrincipal || null,
            fiscalConfig.codigoCnae || null,
            fiscalConfig.activitySector || null,
            fiscalConfig.activitySubcategory || null,
            activitySubcategoriesJson,
            fiscalConfig.ivaArticle || null,
            fiscalConfig.ivaRegimen || 'GENERAL',
            fiscalConfig.prorrateoIVA || false,
            fiscalConfig.porcentajeProrrateo || 100
          ]
        );
        console.log(`✅ Configuración de autónomo guardada en autonomo_config para usuario ${profile.id}`);
      } catch (configError) {
        console.error('Error guardando en autonomo_config:', configError);
        // No lanzar error, solo loguear - los datos ya están en profile_data
      }
    }

    // Verificar que se guardó correctamente
    const verify = await client.query('SELECT profile_data FROM users WHERE id = $1', [profile.id]);
    if (verify.rows.length > 0) {
      console.log('Datos guardados en profile_data:', JSON.stringify(verify.rows[0].profile_data).substring(0, 200));
    }

    await client.end();
    return true;
  } catch (error) {
    console.error("Update User Error:", error);
    try {
      await client.end();
    } catch (e) {
      // Ignorar errores al cerrar
    }
    throw new Error(error.message || 'Error al actualizar el perfil en la base de datos');
  }
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { profile } = req.body;

    if (!profile || !profile.id) {
      return res.status(400).json({ error: 'Profile data is required' });
    }
    
    const success = await updateUserProfileInDb(profile);
    if (!success) {
      return res.status(500).json({ error: 'Failed to update profile in database' });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Update Profile API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error updating profile';
    return res.status(500).json({ 
      error: errorMessage
    });
  }
}

