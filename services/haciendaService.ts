/**
 * HACIENDA SERVICE - Validación NIF/CIF para España
 * Servicio para validar y consultar datos fiscales españoles
 */

export interface ContribuyenteHacienda {
  nif: string;
  nombre: string;
  tipoPersona: 'FISICA' | 'JURIDICA';
  direccion?: string;
  codigoPostal?: string;
  provincia?: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'NO_LOCALIZADO';
  email?: string;
}

// Base de datos mock para demostración
const HACIENDA_DATABASE_MOCK: ContribuyenteHacienda[] = [
  {
    nif: '12345678Z',
    nombre: 'JUAN PÉREZ GARCÍA',
    tipoPersona: 'FISICA',
    direccion: 'CALLE GRAN VÍA, 123',
    codigoPostal: '28013',
    provincia: 'Madrid',
    estado: 'ACTIVO'
  },
  {
    nif: 'B12345678',
    nombre: 'TECNOLOGÍA SOLUTIONS S.L.',
    tipoPersona: 'JURIDICA',
    direccion: 'AVENIDA DE LA INNOVACIÓN, 45',
    codigoPostal: '08028',
    provincia: 'Barcelona',
    estado: 'ACTIVO',
    email: 'facturacion@techsolutions.es'
  },
  {
    nif: 'A87654321',
    nombre: 'CONSULTORÍA EMPRESARIAL S.A.',
    tipoPersona: 'JURIDICA',
    direccion: 'PLAZA MAYOR, 10',
    codigoPostal: '41001',
    provincia: 'Sevilla',
    estado: 'ACTIVO'
  },
  {
    nif: '45678912K',
    nombre: 'MARÍA GONZÁLEZ LÓPEZ',
    tipoPersona: 'FISICA',
    direccion: 'CALLE ALAMEDA, 78',
    codigoPostal: '46010',
    provincia: 'Valencia',
    estado: 'ACTIVO'
  }
];

/**
 * Valida el formato de un NIF/CIF español
 */
export const validarNIF = (nif: string): { valido: boolean; tipo?: 'NIF' | 'CIF' | 'NIE'; error?: string } => {
  const cleanNif = nif.trim().toUpperCase().replace(/[-\s]/g, '');
  
  if (!cleanNif || cleanNif.length < 8 || cleanNif.length > 9) {
    return { valido: false, error: 'El NIF/CIF debe tener entre 8 y 9 caracteres' };
  }

  // NIF (Persona Física): 8 dígitos + 1 letra
  const nifPattern = /^[0-9]{8}[A-Z]$/;
  if (nifPattern.test(cleanNif)) {
    const numero = cleanNif.substring(0, 8);
    const letra = cleanNif.substring(8);
    const letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const resto = parseInt(numero) % 23;
    
    if (letras[resto] === letra) {
      return { valido: true, tipo: 'NIF' };
    }
    return { valido: false, error: 'Letra de control incorrecta' };
  }

  // CIF (Persona Jurídica): Letra + 7 dígitos + dígito/letra de control
  const cifPattern = /^[A-Z][0-9]{7}[0-9A-Z]$/;
  if (cifPattern.test(cleanNif)) {
    // Validación simplificada de CIF (en producción usar algoritmo completo)
    return { valido: true, tipo: 'CIF' };
  }

  // NIE (Extranjeros): X/Y/Z + 7 dígitos + letra
  const niePattern = /^[XYZ][0-9]{7}[A-Z]$/;
  if (niePattern.test(cleanNif)) {
    return { valido: true, tipo: 'NIE' };
  }

  return { valido: false, error: 'Formato de NIF/CIF/NIE no válido' };
};

/**
 * Consulta datos de un contribuyente en Hacienda (simulado)
 */
export const consultarNIFHacienda = async (nifInput: string): Promise<ContribuyenteHacienda | null> => {
  const cleanNif = nifInput.trim().toUpperCase().replace(/[-\s]/g, '');
  
  // Validar formato primero
  const validacion = validarNIF(cleanNif);
  if (!validacion.valido) {
    return null;
  }

  // Simular delay de red
  await new Promise(resolve => setTimeout(resolve, 1200));

  // Buscar en base de datos mock
  const found = HACIENDA_DATABASE_MOCK.find(c => {
    const cleanNifDb = c.nif.replace(/[-\s]/g, '');
    return cleanNifDb === cleanNif || cleanNifDb.includes(cleanNif) || cleanNif.includes(cleanNifDb);
  });

  if (found) return found;

  // Si tiene formato válido pero no está en BD, retornar genérico
  if (validacion.valido) {
    return {
      nif: cleanNif,
      nombre: validacion.tipo === 'CIF' ? 'EMPRESA DEMOSTRACIÓN S.L.' : 'CONTRIBUYENTE DEMOSTRACIÓN',
      tipoPersona: validacion.tipo === 'CIF' ? 'JURIDICA' : 'FISICA',
      direccion: 'DIRECCIÓN GENÉRICA, ESPAÑA',
      codigoPostal: '28001',
      provincia: 'Madrid',
      estado: 'ACTIVO'
    };
  }

  return null;
};
