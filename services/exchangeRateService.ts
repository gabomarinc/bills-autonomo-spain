/**
 * Servicio para obtener y gestionar tipos de cambio del Banco Central Europeo (BCE)
 * 
 * Fuentes:
 * - BCE XML: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml
 * - API alternativa: https://api.exchangerate-api.com/v4/latest/EUR
 */

import { Client } from '@neondatabase/serverless';

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

export interface ExchangeRate {
  id?: number;
  currency: string; // USD, GBP, CHF, etc.
  rateToEur: number; // Tipo de cambio a EUR (ej: 1 USD = 0.92 EUR)
  rateDate: string; // Fecha del tipo de cambio (YYYY-MM-DD)
  source: string; // 'BCE', 'AEAT', etc.
  createdAt?: string;
}

/**
 * Obtener tipo de cambio del BCE para una fecha específica
 * Primero busca en la base de datos, si no existe, lo obtiene del BCE y lo guarda
 */
export const getExchangeRate = async (
  currency: string, 
  date: string
): Promise<ExchangeRate | null> => {
  // Normalizar moneda
  const normalizedCurrency = currency.toUpperCase();
  
  // Si es EUR, retornar 1.0
  if (normalizedCurrency === 'EUR') {
    return {
      currency: 'EUR',
      rateToEur: 1.0,
      rateDate: date,
      source: 'BCE'
    };
  }

  const client = getDbClient();
  if (!client) {
    console.error('No database client available');
    return null;
  }

  try {
    await client.connect();

    // 1. Buscar en base de datos primero
    const dbResult = await client.query(
      'SELECT * FROM exchange_rates WHERE currency = $1 AND rate_date = $2 ORDER BY created_at DESC LIMIT 1',
      [normalizedCurrency, date]
    );

    if (dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      await client.end();
      return {
        id: row.id,
        currency: row.currency,
        rateToEur: parseFloat(row.rate_to_eur),
        rateDate: row.rate_date,
        source: row.source || 'BCE',
        createdAt: row.created_at
      };
    }

    // 2. Si no existe, obtener del BCE
    const rate = await fetchFromBCE(normalizedCurrency, date);
    
    if (rate) {
      // Guardar en base de datos para futuras consultas
      await client.query(
        `INSERT INTO exchange_rates (currency, rate_to_eur, rate_date, source) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (currency, rate_date) DO NOTHING`,
        [normalizedCurrency, rate.rateToEur, date, 'BCE']
      );
    }

    await client.end();
    return rate;
  } catch (error) {
    console.error('Error getting exchange rate:', error);
    try {
      await client.end();
    } catch (e) {
      // Ignorar errores al cerrar
    }
    return null;
  }
};

/**
 * Obtener tipo de cambio del BCE para la fecha más reciente disponible
 * Si la fecha solicitada es futura o no hay datos, usa el más reciente disponible
 */
export const getLatestExchangeRate = async (
  currency: string
): Promise<ExchangeRate | null> => {
  const normalizedCurrency = currency.toUpperCase();
  
  if (normalizedCurrency === 'EUR') {
    return {
      currency: 'EUR',
      rateToEur: 1.0,
      rateDate: new Date().toISOString().split('T')[0],
      source: 'BCE'
    };
  }

  const client = getDbClient();
  if (!client) return null;

  try {
    await client.connect();
    
    // Buscar el más reciente en la base de datos
    const dbResult = await client.query(
      'SELECT * FROM exchange_rates WHERE currency = $1 ORDER BY rate_date DESC LIMIT 1',
      [normalizedCurrency]
    );

    if (dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      await client.end();
      return {
        id: row.id,
        currency: row.currency,
        rateToEur: parseFloat(row.rate_to_eur),
        rateDate: row.rate_date,
        source: row.source || 'BCE',
        createdAt: row.created_at
      };
    }

    // Si no hay en BD, obtener del BCE (último disponible)
    const today = new Date().toISOString().split('T')[0];
    const rate = await fetchFromBCE(normalizedCurrency, today);
    
    await client.end();
    return rate;
  } catch (error) {
    console.error('Error getting latest exchange rate:', error);
    try {
      await client.end();
    } catch (e) {
      // Ignorar errores al cerrar
    }
    return null;
  }
};

/**
 * Obtener tipo de cambio del BCE desde su API XML
 * Si no está disponible, usa API alternativa
 * 
 * NOTA: El BCE proporciona tipos de cambio desde EUR hacia otras monedas
 * Ejemplo: 1 EUR = 1.08 USD, entonces 1 USD = 0.9259 EUR
 */
const fetchFromBCE = async (
  currency: string, 
  date: string
): Promise<ExchangeRate | null> => {
  try {
    // Intentar obtener del BCE XML (solo disponible para días hábiles)
    const bceUrl = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
    const response = await fetch(bceUrl);
    
    if (response.ok) {
      const xmlText = await response.text();
      
      // Parsear XML manualmente (DOMParser no está disponible en Node.js)
      const currencyMatch = xmlText.match(new RegExp(`currency="${currency}"\\s+rate="([^"]+)"`));
      
      if (currencyMatch && currencyMatch[1]) {
        const rateFromEur = parseFloat(currencyMatch[1]);
        // El BCE da: 1 EUR = X USD, necesitamos: 1 USD = Y EUR
        // Entonces: Y = 1 / X
        const rateToEur = 1 / rateFromEur;
        
        return {
          currency: currency,
          rateToEur: Math.round(rateToEur * 10000) / 10000, // 4 decimales
          rateDate: date,
          source: 'BCE'
        };
      }
    }
  } catch (error) {
    console.warn('Error fetching from BCE, trying alternative API:', error);
  }

  // Fallback: usar API alternativa (más confiable y siempre disponible)
  try {
    const altUrl = `https://api.exchangerate-api.com/v4/latest/EUR`;
    const response = await fetch(altUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.rates && data.rates[currency]) {
        // Esta API da: 1 EUR = X USD, necesitamos: 1 USD = Y EUR
        const rateFromEur = data.rates[currency];
        const rateToEur = 1 / rateFromEur;
        
        return {
          currency: currency,
          rateToEur: Math.round(rateToEur * 10000) / 10000, // 4 decimales
          rateDate: date,
          source: 'EXCHANGERATE_API'
        };
      }
    }
  } catch (error) {
    console.error('Error fetching from alternative API:', error);
  }

  return null;
};

/**
 * Convertir importe de una moneda a EUR usando tipo de cambio del BCE
 */
export const convertToEur = async (
  amount: number,
  fromCurrency: string,
  date: string
): Promise<{ amountEur: number; rate: ExchangeRate | null }> => {
  if (fromCurrency.toUpperCase() === 'EUR') {
    return {
      amountEur: amount,
      rate: {
        currency: 'EUR',
        rateToEur: 1.0,
        rateDate: date,
        source: 'BCE'
      }
    };
  }

  const rate = await getExchangeRate(fromCurrency, date);
  
  if (!rate) {
    console.error(`No se pudo obtener tipo de cambio para ${fromCurrency} en fecha ${date}`);
    return { amountEur: amount, rate: null };
  }

  const amountEur = amount * rate.rateToEur;
  
  return {
    amountEur: Math.round(amountEur * 100) / 100, // Redondear a 2 decimales
    rate: rate
  };
};

/**
 * Obtener tipo de cambio para fecha de factura o anterior más cercana
 * Si la fecha es futura o no hay datos, usa el más reciente disponible
 */
export const getExchangeRateForInvoiceDate = async (
  currency: string,
  invoiceDate: string
): Promise<ExchangeRate | null> => {
  const normalizedCurrency = currency.toUpperCase();
  
  if (normalizedCurrency === 'EUR') {
    return {
      currency: 'EUR',
      rateToEur: 1.0,
      rateDate: invoiceDate,
      source: 'BCE'
    };
  }

  const client = getDbClient();
  if (!client) return null;

  try {
    await client.connect();
    
    // Buscar tipo de cambio para la fecha exacta o la anterior más cercana
    const dbResult = await client.query(
      `SELECT * FROM exchange_rates 
       WHERE currency = $1 AND rate_date <= $2 
       ORDER BY rate_date DESC LIMIT 1`,
      [normalizedCurrency, invoiceDate]
    );

    if (dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      await client.end();
      return {
        id: row.id,
        currency: row.currency,
        rateToEur: parseFloat(row.rate_to_eur),
        rateDate: row.rate_date,
        source: row.source || 'BCE',
        createdAt: row.created_at
      };
    }

    // Si no hay en BD, intentar obtener del BCE
    const rate = await fetchFromBCE(normalizedCurrency, invoiceDate);
    
    if (rate) {
      // Guardar en BD
      await client.query(
        `INSERT INTO exchange_rates (currency, rate_to_eur, rate_date, source) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (currency, rate_date) DO NOTHING`,
        [normalizedCurrency, rate.rateToEur, rate.rateDate, rate.source]
      );
    }

    await client.end();
    return rate;
  } catch (error) {
    console.error('Error getting exchange rate for invoice date:', error);
    try {
      await client.end();
    } catch (e) {
      // Ignorar errores al cerrar
    }
    return null;
  }
};

/**
 * Monedas comunes soportadas
 */
export const SUPPORTED_CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£' },
  { code: 'CHF', name: 'Franco Suizo', symbol: 'CHF' },
  { code: 'JPY', name: 'Yen Japonés', symbol: '¥' },
  { code: 'CAD', name: 'Dólar Canadiense', symbol: 'CAD$' },
  { code: 'AUD', name: 'Dólar Australiano', symbol: 'AUD$' },
  { code: 'CNY', name: 'Yuan Chino', symbol: '¥' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: '$' },
  { code: 'BRL', name: 'Real Brasileño', symbol: 'R$' }
];

