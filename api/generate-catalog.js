// Constantes
const AI_ERROR_BLOCKED = 'AI_BLOCKED_MISSING_KEYS';

export default async function handler(req, res) {
  // Asegurar que siempre devolvemos JSON
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', items: [] });
  }

  const { businessDescription, apiKeys, sector, subcategories } = req.body;

  if (!businessDescription || !businessDescription.trim()) {
    return res.status(400).json({ error: 'businessDescription is required', items: [] });
  }

  try {
    // Importación dinámica - intentar con diferentes rutas según el entorno
    let geminiService;
    try {
      // En Vercel, los archivos TypeScript se compilan a .js en .vercel/output
      // Intentar importar desde la ruta compilada
      geminiService = await import('../services/geminiService.js');
    } catch (importError1) {
      try {
        // Fallback: intentar sin extensión
        geminiService = await import('../services/geminiService');
      } catch (importError2) {
        console.error('Error importing geminiService (attempt 1):', importError1);
        console.error('Error importing geminiService (attempt 2):', importError2);
        // Si falla la importación, devolver error pero permitir continuar
        return res.status(503).json({
          error: 'Servicio de IA temporalmente no disponible. Puedes continuar sin generar el catálogo automáticamente.',
          items: [],
          requiresApiKey: false,
          canContinue: true
        });
      }
    }

    // Verificar que la función existe
    if (!geminiService || !geminiService.suggestCatalogItems) {
      console.error('suggestCatalogItems no encontrado en geminiService');
      return res.status(503).json({
        error: 'Servicio de IA temporalmente no disponible. Puedes continuar sin generar el catálogo automáticamente.',
        items: [],
        requiresApiKey: false,
        canContinue: true
      });
    }

    // Verificar si hay API key antes de intentar generar
    const hasUserApiKey = apiKeys?.gemini && apiKeys.gemini.trim();
    const hasEnvApiKey = process.env.API_KEY && process.env.API_KEY.trim();

    console.log('Verificando API keys:', {
      hasUserApiKey: !!hasUserApiKey,
      hasEnvApiKey: !!hasEnvApiKey,
      hasEnvApiKey: !!hasEnvApiKey,
      businessDescription: businessDescription.trim().substring(0, 50),
      sector,
      subcategories: subcategories?.length || 0
    });

    if (!hasUserApiKey && !hasEnvApiKey) {
      console.warn('No hay API key configurada');
      return res.status(503).json({
        error: 'API Key de IA no configurada. Configura tu API Key en Ajustes o contacta a soporte para configurar la API Key del sistema.',
        items: [],
        requiresApiKey: true,
        canContinue: true
      });
    }

    // Usar API keys del usuario si están disponibles, sino usar process.env.API_KEY
    const items = await geminiService.suggestCatalogItems(businessDescription.trim(), apiKeys, true, sector, subcategories);

    console.log('Resultado de suggestCatalogItems:', {
      itemsCount: items?.length || 0,
      items: items?.slice(0, 2) // Log primeros 2 items para debugging
    });

    if (!items || items.length === 0) {
      return res.status(200).json({
        error: 'No se pudieron generar servicios. Intenta con una descripción más detallada o verifica tu API Key.',
        items: [],
        canContinue: true
      });
    }

    return res.status(200).json({ items });
  } catch (error) {
    console.error('Generate Catalog Error:', error);
    console.error('Error stack:', error?.stack);

    // Manejar errores específicos
    const errorMessage = error?.message || String(error);
    if (errorMessage === AI_ERROR_BLOCKED || errorMessage?.includes('API key') || errorMessage?.includes('API_KEY') || errorMessage?.includes('No API key')) {
      return res.status(503).json({
        error: 'API Key de IA no configurada. Puedes continuar sin generar el catálogo automáticamente.',
        items: [],
        requiresApiKey: true,
        canContinue: true
      });
    }

    // Error genérico - siempre devolver JSON válido y permitir continuar
    return res.status(500).json({
      error: 'Error generando catálogo. Puedes continuar sin generar el catálogo automáticamente.',
      items: [],
      canContinue: true,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
}

