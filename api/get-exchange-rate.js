/**
 * API Route para obtener tipos de cambio
 * Resuelve problemas de CORS haciendo las peticiones desde el servidor
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { currency, date } = req.body;

    if (!currency) {
      return res.status(400).json({ error: 'Currency is required' });
    }

    const normalizedCurrency = currency.toUpperCase();
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Si es EUR, retornar directamente
    if (normalizedCurrency === 'EUR') {
      return res.status(200).json({
        currency: 'EUR',
        rateToEur: 1.0,
        rateDate: targetDate,
        source: 'BCE'
      });
    }

    // Intentar obtener del BCE primero
    try {
      const bceUrl = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
      const response = await fetch(bceUrl);
      
      if (response.ok) {
        const xmlText = await response.text();
        const currencyMatch = xmlText.match(new RegExp(`currency="${normalizedCurrency}"\\s+rate="([^"]+)"`));
        
        if (currencyMatch && currencyMatch[1]) {
          const rateFromEur = parseFloat(currencyMatch[1]);
          const rateToEur = 1 / rateFromEur;
          
          return res.status(200).json({
            currency: normalizedCurrency,
            rateToEur: Math.round(rateToEur * 10000) / 10000,
            rateDate: targetDate,
            source: 'BCE'
          });
        }
      }
    } catch (bceError) {
      console.warn('BCE fetch failed, trying alternatives:', bceError);
    }

    // Fallback 1: Exchangerate.host
    try {
      const altUrl = `https://api.exchangerate.host/latest?base=EUR`;
      const response = await fetch(altUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.rates && data.rates[normalizedCurrency]) {
          const rateFromEur = data.rates[normalizedCurrency];
          const rateToEur = 1 / rateFromEur;
          
          return res.status(200).json({
            currency: normalizedCurrency,
            rateToEur: Math.round(rateToEur * 10000) / 10000,
            rateDate: targetDate,
            source: 'EXCHANGERATE_HOST'
          });
        }
      }
    } catch (alt1Error) {
      console.warn('Exchangerate.host failed, trying currency-api:', alt1Error);
    }

    // Fallback 2: Currency-api (usa minúsculas para las claves)
    try {
      const altUrl = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/eur.json`;
      const response = await fetch(altUrl);
      
      if (response.ok) {
        const data = await response.json();
        // Esta API usa minúsculas para las claves (gbp, usd, etc.)
        const currencyKey = normalizedCurrency.toLowerCase();
        if (data.eur && data.eur[currencyKey]) {
          const rateFromEur = data.eur[currencyKey];
          const rateToEur = 1 / rateFromEur;
          
          return res.status(200).json({
            currency: normalizedCurrency,
            rateToEur: Math.round(rateToEur * 10000) / 10000,
            rateDate: targetDate,
            source: 'CURRENCY_API'
          });
        }
      }
    } catch (alt2Error) {
      console.error('All exchange rate APIs failed:', alt2Error);
    }

    return res.status(503).json({ 
      error: 'No se pudo obtener el tipo de cambio',
      currency: normalizedCurrency,
      date: targetDate
    });

  } catch (error) {
    console.error('Exchange rate API error:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
}

