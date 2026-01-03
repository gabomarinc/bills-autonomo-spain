
/**
 * Service to fetch company data (Entity Name, Address) based on CIF.
 * This is currently a MOCK implementation for demonstration purposes.
 * In production, this would connect to an API like Axesor, eInforma, or VIES.
 */

export interface CompanyData {
    name: string;
    address: string;
    city?: string;
    province?: string;
    zipCode?: string;
}

export const fetchCompanyData = async (cif: string): Promise<CompanyData | null> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const cleanCif = cif.toUpperCase().trim();

    // Basic validation format for Spanish CIF (Letter + 8 digits/letters)
    const cifRegex = /^[A-HJ-NP-SUVW][0-9]{7}[0-9A-J]$/;

    if (!cifRegex.test(cleanCif)) {
        console.warn(`Invalid CIF format: ${cleanCif}`);
        return null;
    }

    // Mocked Database of Companies
    const mockDb: Record<string, CompanyData> = {
        'B12345678': {
            name: 'ACME IBERICA S.L.',
            address: 'Calle del Progreso 123, Polígono Industrial',
            city: 'Madrid',
            province: 'Madrid',
            zipCode: '28001'
        },
        'A87654321': {
            name: 'INDUSTRIAS STARK S.A.',
            address: 'Avenida de la Innovación 45, Torre Norte',
            city: 'Barcelona',
            province: 'Barcelona',
            zipCode: '08005'
        },
        'B88888888': {
            name: 'WAYNE ENTERPRISES ESPAÑA S.L.',
            address: 'Paseo de la Castellana 250',
            city: 'Madrid',
            province: 'Madrid',
            zipCode: '28046'
        }
    };

    // Return specific mock or a generaic one for valid-looking CIFs if not in specific list
    if (mockDb[cleanCif]) {
        return mockDb[cleanCif];
    }

    // Fallback for demo: If it starts with B and looks valid, return a generic placeholder
    // This helps when the user tries a random but valid-looking CIF
    if (cleanCif.startsWith('B')) {
        return {
            name: `EMPRESA DEMO DEL CIF ${cleanCif} S.L.`,
            address: 'Calle Ejemplo 1, 1º A',
            city: 'Madrid',
            province: 'Madrid',
            zipCode: '28000'
        };
    }

    return null;
};
