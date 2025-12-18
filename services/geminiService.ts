import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { CatalogItem, FinancialAnalysisResult, DeepDiveReport, ParsedInvoiceData, PriceAnalysisResult, UserProfile } from "../types";

export const AI_ERROR_BLOCKED = 'AI_BLOCKED_MISSING_KEYS';
const GEMINI_MODEL_ID = 'gemini-3-flash-preview';
const GEMINI_VISION_MODEL_ID = 'gemini-2.5-flash';
const TIMEOUT_MS = 25000; // 25 seconds timeout

export interface AiKeys {
  gemini?: string;
  openai?: string;
}

// --- UTILS ---

// Wrapper to enforce timeout on AI calls
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = TIMEOUT_MS): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error("Tiempo de espera agotado. La IA tardó demasiado en responder.")), timeoutMs)
        )
    ]);
};

// Helper to get API key: user keys first, then fallback to process.env.API_KEY
const getApiKey = (keys?: AiKeys): string | null => {
  // Prioridad 1: API key del usuario (Gemini)
  if (keys?.gemini && keys.gemini.trim()) {
    return keys.gemini.trim();
  }
  
  // Prioridad 2: API key del sistema (variable de entorno)
  if (process.env.API_KEY) {
    return process.env.API_KEY;
  }
  
  return null;
};

// Get AI client using user API keys or fallback to process.env.API_KEY
const getAiClient = (keys?: AiKeys) => {
  const apiKey = getApiKey(keys);
  
  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }
  
  console.error("Gemini AI Error: No API key found. Configure your API key in Settings or set process.env.API_KEY.");
  throw new Error(AI_ERROR_BLOCKED);
};

// Helper to sanitize JSON response from LLM
const cleanJson = (text: string) => {
  if (!text) return "{}";
  
  // 1. Try to extract JSON from Markdown code blocks first
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
      return jsonBlockMatch[1].trim();
  }

  // 2. Fallback: Cleanup common markdown artifacts
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // 3. Find brackets to strip introductory text
  const firstOpen = cleaned.indexOf('{');
  const lastClose = cleaned.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1) {
      cleaned = cleaned.substring(firstOpen, lastClose + 1);
  }

  return cleaned.trim();
};

// --- APP FEATURES (Strict Mode: process.env.API_KEY Only) ---

export const parseExpenseImage = async (
  imageBase64: string, 
  mimeType: string, 
  keys?: AiKeys
): Promise<ParsedInvoiceData | null> => {
  
  try {
    const ai = getAiClient(keys);

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        clientName: { type: Type.STRING },
        amount: { type: Type.NUMBER },
        currency: { type: Type.STRING },
        date: { type: Type.STRING },
        concept: { type: Type.STRING }
      },
      required: ["clientName", "amount", "currency", "concept"]
    };

    const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
      model: GEMINI_VISION_MODEL_ID,
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: mimeType } },
          { text: "Extrae: Proveedor (clientName), Total (amount), Moneda (currency), Fecha YYYY-MM-DD (date), Concepto breve (concept)." }
        ]
      },
      config: { responseMimeType: "application/json", responseSchema: schema }
    }));

    if (response.text) {
       const cleaned = cleanJson(response.text);
       const data = JSON.parse(cleaned);
       return { ...data, detectedType: 'Expense' } as ParsedInvoiceData;
    }
    return null;

  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return null;
  }
};

export const parseInvoiceRequest = async (input: string, keys?: AiKeys): Promise<ParsedInvoiceData | null> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                clientName: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                concept: { type: Type.STRING },
                detectedType: { type: Type.STRING, enum: ['Invoice', 'Quote'] }
            },
            required: ['clientName', 'amount', 'currency', 'concept', 'detectedType']
        };

        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: input,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));

        if (response.text) {
            const cleaned = cleanJson(response.text);
            return JSON.parse(cleaned);
        }
        return null;
    } catch (e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null;
    }
};

export const askSupportBot = async (message: string, keys?: AiKeys): Promise<string> => {
    try {
        const ai = getAiClient(keys);
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: message,
            config: { systemInstruction: "Eres un asistente de soporte técnico amigable y servicial para la plataforma Kônsul Bills." }
        }));
        return response.text || "No entendí, ¿puedes repetir?";
    } catch(e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) return "Por favor configura tu API Key de IA en Ajustes para hablar conmigo.";
        return "Lo siento, estoy teniendo problemas de conexión. Intenta más tarde.";
    }
};

// --- ONBOARDING FEATURES (process.env.API_KEY Only) ---

export const suggestCatalogItems = async (businessDescription: string, keys?: AiKeys, _useSystemKey: boolean = false): Promise<CatalogItem[]> => {
    try {
        const ai = getAiClient(keys);
        
        const schema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    description: { type: Type.STRING }
                },
                required: ['name', 'price', 'description']
            }
        };
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Sugiere 3-5 servicios o productos con precios estimados para: ${businessDescription}. Precios en EUR (Euros).`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));
        
        const text = response.text || "[]";
        const cleaned = cleanJson(text);
        const items = JSON.parse(cleaned);
        
        return items.map((i: any) => ({ ...i, id: Date.now().toString() + Math.random(), isRecurring: false }));
    } catch (e) {
        console.error("Suggest Catalog Error:", e);
        return [];
    }
};

export const generateEmailTemplate = async (tone: 'Formal' | 'Casual', keys?: AiKeys, _useSystemKey: boolean = false): Promise<string> => {
    try {
        const ai = getAiClient(keys);
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Genera un ejemplo CORTO (máximo 3 líneas) de correo ${tone === 'Formal' ? 'corporativo y profesional' : 'cercano y amigable'} para enviar una factura. Solo el ejemplo, sin explicaciones.`,
        }));
        const text = response.text || "";
        // Limitar a las primeras 3 líneas o 200 caracteres
        const lines = text.split('\n').slice(0, 3).join('\n');
        return lines.length > 200 ? lines.substring(0, 200) + '...' : lines;
    } catch(e) {
        return tone === 'Formal' 
            ? "Estimado cliente,\n\nAdjunto encontrará la factura correspondiente.\n\nSaludos cordiales." 
            : "¡Hola!\n\nAquí tienes tu factura. Cualquier duda, avísame.\n\n¡Un abrazo!";
    }
};

// --- APP FEATURES (Strict Mode Continued) ---

export const testAiConnection = async (provider: 'gemini' | 'openai', key: string): Promise<boolean> => {
    if (provider === 'gemini') {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            await withTimeout(ai.models.generateContent({ model: GEMINI_MODEL_ID, contents: "Hi" }), 5000);
            return true;
        } catch { return false; }
    }
    return true; 
};

export const generateFinancialAnalysis = async (summary: string, keys?: AiKeys): Promise<FinancialAnalysisResult | null> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                healthScore: { type: Type.NUMBER },
                // Use standard string to avoid validation strictness, prompt will enforce values
                healthStatus: { type: Type.STRING },
                diagnosis: { type: Type.STRING },
                actionableTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                projection: { type: Type.STRING }
            },
            required: ['healthScore', 'healthStatus', 'diagnosis', 'actionableTips', 'projection']
        };
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Eres un Auditor Financiero Senior (CFO Virtual) para autónomos y empresas en España.
            Tu misión es analizar la salud financiera comparando los RESULTADOS REALES contra las METAS DEFINIDAS por el usuario.
            
            DATOS DE LA EMPRESA:
            ${summary}
            
            INSTRUCCIONES CRÍTICAS:
            1. Compara explícitamente lo facturado contra la "Meta Mensual Definida". Si está por debajo, sé severo.
            2. Revisa si los "Gastos Totales" superan a los "Costos Fijos" (incluyendo cuotas de autónomo).
            3. Ajusta el tono según si es "Persona Física/Autónomo" (más personal) o "Persona Jurídica" (más corporativo).
            4. Considera las obligaciones fiscales españolas: IVA, IRPF, cuotas de autónomo.
            5. 'healthStatus' DEBE ser exactamente una de estas palabras: 'Excelente', 'Buena', 'Regular', 'Crítica'.
            6. 'healthScore' es un número de 0 a 100 basado en el cumplimiento de metas y salud financiera.
            7. 'projection': Una predicción corta basada en la tendencia actual y contexto español.
            
            Responde SOLO en JSON válido.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));
        
        const cleaned = cleanJson(response.text || "{}");
        const result = JSON.parse(cleaned);
        
        // Safety Fallback for Enums
        const validStatuses = ['Excelente', 'Buena', 'Regular', 'Crítica'];
        if (!validStatuses.includes(result.healthStatus)) {
            result.healthStatus = 'Regular'; 
        }
        
        return result;
    } catch (e) { 
        console.error("Analysis Error:", e);
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null; 
    }
};

export const generateDeepDiveReport = async (title: string, context: string, keys?: AiKeys): Promise<DeepDiveReport | null> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                chartTitle: { type: Type.STRING },
                executiveSummary: { type: Type.STRING },
                keyMetrics: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: {
                            label: { type: Type.STRING },
                            value: { type: Type.STRING },
                            trend: { type: Type.STRING, enum: ['up', 'down', 'neutral'] }
                        }
                    }
                },
                strategicInsight: { type: Type.STRING },
                recommendation: { type: Type.STRING }
            },
            required: ['chartTitle', 'executiveSummary', 'keyMetrics', 'strategicInsight', 'recommendation']
        };

        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Actúa como Analista Financiero Senior. Genera un reporte profundo para el gráfico: "${title}".
            
            CONTEXTO DE DATOS:
            ${context}
            
            INSTRUCCIONES:
            - 'executiveSummary': Resumen de 1 párrafo.
            - 'keyMetrics': 3 métricas clave.
            - 'strategicInsight': Análisis de tendencias.
            - 'recommendation': Acción táctica.
            - Idioma: Español (excepto 'trend').
            - IMPORTANTE: 'trend' debe ser obligatoriamente 'up', 'down' o 'neutral'.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));
        
        const cleaned = cleanJson(response.text || "{}");
        const parsed = JSON.parse(cleaned);
        if (!parsed.chartTitle) return null;
        return parsed;
    } catch (e) {
        console.error("Deep Dive Error:", e);
        return null; 
    }
};

export const analyzePriceMarket = async (
    itemName: string, 
    country: string, 
    keys?: AiKeys,
    userContext?: UserProfile
): Promise<PriceAnalysisResult | null> => {
    try {
        const ai = getAiClient(keys);
        
        let contextPrompt = `Ubicación: ${country}.`;
        if (userContext) {
            contextPrompt += ` Perfil: ${userContext.type}.`;
        }

        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                minPrice: { type: Type.NUMBER },
                maxPrice: { type: Type.NUMBER },
                avgPrice: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                reasoning: { type: Type.STRING }
            },
            required: ['minPrice', 'maxPrice', 'avgPrice', 'currency', 'reasoning']
        };

        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Actúa como experto en precios. ${contextPrompt} Analiza: "${itemName}". Devuelve rangos en EUR (Euros).`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));

        const cleaned = cleanJson(response.text || "{}");
        return JSON.parse(cleaned);
    } catch (e) {
        if ((e as Error).message === AI_ERROR_BLOCKED) throw e;
        return null; 
    }
};

export const enhanceProductDescription = async (desc: string, name: string, format: 'paragraph' | 'bullets', keys?: AiKeys): Promise<string> => {
    try {
        const ai = getAiClient(keys);
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Mejora esta descripción de venta para "${name}": "${desc}". Formato: ${format}. Idioma: Español.`,
        }));
        return response.text || desc;
    } catch (e) {
        return desc; 
    }
};

export const getDiscountRecommendation = async (
    amount: number, 
    clientName: string, 
    keys?: AiKeys
): Promise<{ recommendedRate: number, reasoning: string } | null> => {
    try {
        const ai = getAiClient(keys);
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                recommendedRate: { type: Type.NUMBER },
                reasoning: { type: Type.STRING }
            },
            required: ['recommendedRate', 'reasoning']
        };
        
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Recomienda un descuento para venta de €${amount} a "${clientName}". Prioriza rentabilidad.`,
            config: { responseMimeType: "application/json", responseSchema: schema }
        }));
        
        const cleaned = cleanJson(response.text || "{}");
        return JSON.parse(cleaned);
    } catch (e) {
        return null;
    }
};

export const generateRevenueInsight = async (
    currentRevenue: number, 
    prevRevenue: number, 
    percentChange: number,
    keys?: AiKeys
): Promise<string | null> => {
    try {
        const ai = getAiClient(keys);
        const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
            model: GEMINI_MODEL_ID,
            contents: `Eres un CFO. Datos: Mes Actual €${currentRevenue}, Anterior €${prevRevenue}, Var ${percentChange}%.
            Genera una frase ESTRATÉGICA y CORTA (max 10 palabras).`,
        }));
        return response.text?.trim() || null;
    } catch (e) {
        return null;
    }
};