import { suggestCatalogItems, AI_ERROR_BLOCKED } from '../services/geminiService';

export default async function handler(req, res) {
  // Asegurar que siempre devolvemos JSON
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessDescription, apiKeys } = req.body;

  if (!businessDescription || !businessDescription.trim()) {
    return res.status(400).json({ error: 'businessDescription is required', items: [] });
  }

  try {
    // Usar API keys del usuario si están disponibles, sino usar process.env.API_KEY
    const items = await suggestCatalogItems(businessDescription.trim(), apiKeys, true);
    
    if (!items || items.length === 0) {
      return res.status(200).json({ 
        error: 'No se pudieron generar servicios. Intenta con una descripción más detallada.',
        items: [] 
      });
    }
    
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Generate Catalog Error:', error);
    
    // Manejar errores específicos
    if (error.message === AI_ERROR_BLOCKED || error.message?.includes('API key')) {
      return res.status(503).json({ 
        error: 'API Key de IA no configurada. Configura tu API Key en Ajustes o contacta a soporte.',
        items: [],
        requiresApiKey: true
      });
    }
    
    // Error genérico
    return res.status(500).json({ 
      error: 'Error generando catálogo. Intenta más tarde o verifica tu conexión.',
      items: [] 
    });
  }
}
