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
          
          console.log(`BCE: Found ${normalizedCurrency} rate: ${rateToEur}`);
          return res.status(200).json({
            currency: normalizedCurrency,
            rateToEur: Math.round(rateToEur * 10000) / 10000,
            rateDate: targetDate,
            source: 'BCE'
          });
        } else {
          console.warn(`BCE: Currency ${normalizedCurrency} not found in XML`);
        }
      } else {
        console.warn(`BCE: Response not OK, status: ${response.status}`);
      }
    } catch (bceError) {
      console.warn('BCE fetch failed, trying alternatives:', bceError.message);
    }

    // Fallback 1: Exchangerate.host
    try {
      const altUrl = `https://api.exchangerate.host/latest?base=EUR`;
      const response = await fetch(altUrl);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Exchangerate.host: Available currencies:`, Object.keys(data.rates || {}).slice(0, 10));
        if (data.rates && data.rates[normalizedCurrency]) {
          const rateFromEur = data.rates[normalizedCurrency];
          const rateToEur = 1 / rateFromEur;
          
          console.log(`Exchangerate.host: Found ${normalizedCurrency} rate: ${rateToEur}`);
          return res.status(200).json({
            currency: normalizedCurrency,
            rateToEur: Math.round(rateToEur * 10000) / 10000,
            rateDate: targetDate,
            source: 'EXCHANGERATE_HOST'
          });
        } else {
          console.warn(`Exchangerate.host: Currency ${normalizedCurrency} not found in rates`);
        }
      } else {
        console.warn(`Exchangerate.host: Response not OK, status: ${response.status}`);
      }
    } catch (alt1Error) {
      console.warn('Exchangerate.host failed, trying currency-api:', alt1Error.message);
    }

    // Fallback 2: Currency-api (usa minúsculas para las claves)
    try {
      const altUrl = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/eur.json`;
      const response = await fetch(altUrl);
      
      if (response.ok) {
        const data = await response.json();
        // Esta API usa minúsculas para las claves (gbp, usd, etc.)
        const currencyKey = normalizedCurrency.toLowerCase();
        console.log(`Currency-api: Looking for ${currencyKey} in data.eur`);
        console.log(`Currency-api: Available currencies:`, Object.keys(data.eur || {}).slice(0, 10));
        if (data.eur && data.eur[currencyKey]) {
          const rateFromEur = data.eur[currencyKey];
          const rateToEur = 1 / rateFromEur;
          
          console.log(`Currency-api: Found ${normalizedCurrency} rate: ${rateToEur}`);
          return res.status(200).json({
            currency: normalizedCurrency,
            rateToEur: Math.round(rateToEur * 10000) / 10000,
            rateDate: targetDate,
            source: 'CURRENCY_API'
          });
        } else {
          console.warn(`Currency-api: Currency ${currencyKey} not found in data.eur`);
        }
      } else {
        console.warn(`Currency-api: Response not OK, status: ${response.status}`);
      }
    } catch (alt2Error) {
      console.error('Currency-api failed:', alt2Error.message);
    }

    // Si todas las APIs fallaron, intentar con exchangerate-api.com como último recurso
    try {
      const lastResortUrl = `https://api.exchangerate-api.com/v4/latest/EUR`;
      const response = await fetch(lastResortUrl);
      
      if (response.ok) {
        const data = await response.json();
        if (data.rates && data.rates[normalizedCurrency]) {
          const rateFromEur = data.rates[normalizedCurrency];
          const rateToEur = 1 / rateFromEur;
          
          console.log(`Exchangerate-api.com (last resort): Found ${normalizedCurrency} rate: ${rateToEur}`);
          return res.status(200).json({
            currency: normalizedCurrency,
            rateToEur: Math.round(rateToEur * 10000) / 10000,
            rateDate: targetDate,
            source: 'EXCHANGERATE_API_COM'
          });
        }
      }
    } catch (lastResortError) {
      console.error('Last resort API also failed:', lastResortError.message);
    }

    console.error(`All exchange rate APIs failed for ${normalizedCurrency}`);
    return res.status(503).json({ 
      error: 'No se pudo obtener el tipo de cambio',
      currency: normalizedCurrency,
      date: targetDate,
      message: `No se encontró tipo de cambio para ${normalizedCurrency} en ninguna API disponible`
    });

  } catch (error) {
    console.error('Exchange rate API error:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
}

