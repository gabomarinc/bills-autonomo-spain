import { generateEmailTemplate } from '../services/geminiService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tone } = req.body;

  if (!tone || !['Formal', 'Casual'].includes(tone)) {
    return res.status(400).json({ error: 'tone must be "Formal" or "Casual"' });
  }

  try {
    const text = await generateEmailTemplate(tone, undefined, true);
    return res.status(200).json({ text });
  } catch (error) {
    console.error('Generate Email Template Error:', error);
    return res.status(500).json({ 
      error: 'Error generando plantilla',
      text: tone === 'Formal' 
        ? "Estimado cliente,\n\nAdjunto encontrará la factura correspondiente.\n\nSaludos cordiales." 
        : "¡Hola!\n\nAquí tienes tu factura. Cualquier duda, avísame.\n\n¡Un abrazo!"
    });
  }
}
