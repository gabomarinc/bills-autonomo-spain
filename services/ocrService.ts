
import Tesseract from 'tesseract.js';

export interface ExtractedReceiptData {
    total?: number;
    date?: string;
    nif?: string;
    merchantName?: string; // Harder to reliable extract, but we can try
    fullText: string;
}

/**
 * Clean text to make regex matching easier
 */
const cleanText = (text: string): string => {
    return text
        .replace(/\n/g, ' ') // Remove newlines
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
};

/**
 * Extract Date from text
 * Supports: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 */
const extractDate = (text: string): string | undefined => {
    // Regex for DD/MM/YYYY or DD-MM-YYYY
    const dateRegex = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/;
    const match = text.match(dateRegex);

    if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        let year = match[3];

        // Handle 2-digit years (assume 20xx)
        if (year.length === 2) {
            year = '20' + year;
        }

        // Basic validation
        const numDay = parseInt(day);
        const numMonth = parseInt(month);
        if (numDay > 31 || numMonth > 12) return undefined;

        // Return ISO format YYYY-MM-DD for form compatibility
        return `${year}-${month}-${day}`;
    }
    return undefined;
};

/**
 * Extract Total Amount
 * Looks for explicit "Total" keywords or largest currency-like number
 */
const extractTotal = (text: string): number | undefined => {
    // 1. Try to find explicit total
    // Matches: "Total: 12.30", "TOTAL 12,30", "Importe: 12.30 EUR"
    const totalKeywords = ['TOTAL', 'IMPORTE', 'PAGAR', 'SUMA'];

    for (const keyword of totalKeywords) {
        // Regex explanation:
        // Keyword (case insensitive)
        // Optional characters like : or spaces
        // The number: digits, optional dot/comma, digits
        // Optional currency symbol (EUR, €)
        const regex = new RegExp(`${keyword}[^0-9]*([0-9]+[.,][0-9]{2})`, 'i');
        const match = text.match(regex);
        if (match) {
            // Replace comma with dot for parsing
            const numStr = match[1].replace(',', '.');
            return parseFloat(numStr);
        }
    }

    // 2. Fallback: Find all money-like patterns and take the largest unique one
    // Often the total is the largest number on the receipt
    const moneyRegex = /\b\d+\s?[.,]\s?\d{2}\b/g;
    const matches = text.match(moneyRegex);

    if (matches) {
        const numbers = matches.map(m => {
            // Normalize '1.200,50' -> '1200.50' (simplified)
            // For now assume simple format without thousand separators if small
            const clean = m.replace(/\s/g, '').replace(',', '.');
            return parseFloat(clean);
        }).filter(n => !isNaN(n));

        if (numbers.length > 0) {
            return Math.max(...numbers);
        }
    }

    return undefined;
};

/**
 * Extract NIF/CIF
 * Reference: Spanish NIF formats (8 digits + char, or Char + 8 digits)
 */
const extractNif = (text: string): string | undefined => {
    // Standard NIF/NIE: 8 digits + Letter, or X/Y/Z + 7 digits + Letter
    const nifRegex = /\b([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])\b/g;

    // CIF: Letter + 8 digits/letters
    const cifRegex = /\b([ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J])\b/g;

    const nifMatches = text.match(nifRegex);
    const cifMatches = text.match(cifRegex);

    if (nifMatches) return nifMatches[0];
    if (cifMatches) return cifMatches[0];

    return undefined;
};

export const scanReceipt = async (imageFile: File): Promise<ExtractedReceiptData> => {
    try {
        const result = await Tesseract.recognize(
            imageFile,
            'spa', // Use Spanish language
            {
                logger: m => console.log(m) // Optional: log progress
            }
        );

        const fullText = result.data.text;
        const clean = cleanText(fullText);

        const data: ExtractedReceiptData = {
            fullText: fullText,
            date: extractDate(clean),
            total: extractTotal(clean),
            nif: extractNif(clean)
        };

        console.log('OCR Extracted Data:', data);
        return data;

    } catch (error) {
        console.error('OCR Processing Error:', error);
        throw new Error('No se pudo procesar la imagen del recibo.');
    }
};
