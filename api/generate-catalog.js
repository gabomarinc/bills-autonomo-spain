import { suggestCatalogItems } from '../services/geminiService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessDescription, apiKeys } = req.body;

  if (!businessDescription) {
    return res.status(400).json({ error: 'businessDescription is required' });
  }

  try {
    // Usar API keys del usuario si están disponibles, sino usar process.env.API_KEY
    const items = await suggestCatalogItems(businessDescription, apiKeys, true);
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Generate Catalog Error:', error);
    return res.status(500).json({ error: 'Error generando catálogo', items: [] });
  }
}
