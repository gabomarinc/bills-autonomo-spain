// Importación dinámica para mejor compatibilidad con Vercel
const AI_ERROR_BLOCKED = 'AI_BLOCKED_MISSING_KEYS';

export default async function handler(req, res) {
  // Asegurar que siempre devolvemos JSON
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', items: [] });
  }

  const { businessDescription, apiKeys } = req.body;

  if (!businessDescription || !businessDescription.trim()) {
    return res.status(400).json({ error: 'businessDescription is required', items: [] });
  }

  try {
    // Importación dinámica para evitar problemas en Vercel
    let geminiService;
    try {
      geminiService = await import('../services/geminiService.js');
    } catch (importError) {
      console.error('Error importing geminiService:', importError);
      // Si falla la importación, devolver error pero permitir continuar
      return res.status(503).json({ 
        error: 'Servicio de IA temporalmente no disponible. Puedes continuar sin generar el catálogo automáticamente.',
        items: [],
        requiresApiKey: false,
        canContinue: true
      });
    }

    // Usar API keys del usuario si están disponibles, sino usar process.env.API_KEY
    const items = await geminiService.suggestCatalogItems(businessDescription.trim(), apiKeys, true);
    
    if (!items || items.length === 0) {
      return res.status(200).json({ 
        error: 'No se pudieron generar servicios. Intenta con una descripción más detallada.',
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
