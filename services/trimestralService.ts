/**
 * TRIMESTRAL SERVICE - Declaraciones trimestrales para autónomos
 * Modelo 130 (IRPF estimado), Modelo 131 (IRPF actividad económica), Modelo 303 (IVA)
 */

export interface DeclaracionTrimestral {
  trimestre: 1 | 2 | 3 | 4;
  año: number;
  tipo: 'MODELO_130' | 'MODELO_131' | 'MODELO_303';
  fechaVencimiento: string;
}

export interface Modelo130 {
  trimestre: number;
  año: number;
  baseImponible: number; // Ingresos - gastos deducibles
  cuota: number; // 20% de la base imponible (mínimo 0)
  cuotaAnterior: number; // Cuota del trimestre anterior
  resultado: number; // Cuota - cuotaAnterior (a ingresar o devolver)
  fechaVencimiento: string;
}

export interface Modelo131 {
  trimestre: number;
  año: number;
  ingresos: number;
  gastos: number;
  baseImponible: number;
  tipoActividad: string;
  cuota: number; // Variable según actividad
  cuotaAnterior: number;
  resultado: number;
  fechaVencimiento: string;
}

export interface Modelo303 {
  trimestre: number;
  año: number;
  ivaRepercutido: number; // IVA cobrado a clientes
  ivaSoportado: number; // IVA pagado a proveedores
  resultado: number; // IVA repercutido - IVA soportado
  regularizacion: number; // Regularizaciones
  resultadoLiquido: number; // Resultado + regularizaciones
  fechaVencimiento: string;
}

/**
 * Calcula las fechas de vencimiento de declaraciones trimestrales
 */
export const obtenerFechasVencimiento = (trimestre: 1 | 2 | 3 | 4, año: number): {
  modelo130: string;
  modelo131: string;
  modelo303: string;
} => {
  // Fechas aproximadas (en producción consultar calendario oficial)
  const fechas: Record<number, { dia: number; mes: number }> = {
    1: { dia: 20, mes: 4 }, // Abril
    2: { dia: 20, mes: 7 }, // Julio
    3: { dia: 20, mes: 10 }, // Octubre
    4: { dia: 30, mes: 1 }, // Enero siguiente
  };

  const fecha = fechas[trimestre];
  const añoVencimiento = trimestre === 4 ? año + 1 : año;
  
  const fechaVencimiento = new Date(añoVencimiento, fecha.mes - 1, fecha.dia);
  
  return {
    modelo130: fechaVencimiento.toISOString().split('T')[0],
    modelo131: fechaVencimiento.toISOString().split('T')[0],
    modelo303: fechaVencimiento.toISOString().split('T')[0],
  };
};

/**
 * Calcula el Modelo 130 (IRPF estimado)
 */
export const calcularModelo130 = (
  trimestre: number,
  año: number,
  ingresos: number,
  gastos: number,
  cuotaTrimestreAnterior: number = 0
): Modelo130 => {
  const baseImponible = Math.max(0, ingresos - gastos);
  const cuota = baseImponible * 0.20; // 20% sobre base imponible
  const resultado = cuota - cuotaTrimestreAnterior;
  
  const fechas = obtenerFechasVencimiento(trimestre as 1 | 2 | 3 | 4, año);
  
  return {
    trimestre,
    año,
    baseImponible: Math.round(baseImponible * 100) / 100,
    cuota: Math.round(cuota * 100) / 100,
    cuotaAnterior: cuotaTrimestreAnterior,
    resultado: Math.round(resultado * 100) / 100,
    fechaVencimiento: fechas.modelo130
  };
};

/**
 * Calcula el Modelo 131 (IRPF actividad económica)
 */
export const calcularModelo131 = (
  trimestre: number,
  año: number,
  ingresos: number,
  gastos: number,
  tipoActividad: string = 'GENERAL',
  cuotaTrimestreAnterior: number = 0
): Modelo131 => {
  const baseImponible = Math.max(0, ingresos - gastos);
  
  // Tipos de actividad con diferentes porcentajes
  const porcentajes: Record<string, number> = {
    'GENERAL': 0.20,
    'AGRICOLA': 0.15,
    'GANADERA': 0.15,
    'FORESTAL': 0.15,
  };
  
  const porcentaje = porcentajes[tipoActividad] || 0.20;
  const cuota = baseImponible * porcentaje;
  const resultado = cuota - cuotaTrimestreAnterior;
  
  const fechas = obtenerFechasVencimiento(trimestre as 1 | 2 | 3 | 4, año);
  
  return {
    trimestre,
    año,
    ingresos: Math.round(ingresos * 100) / 100,
    gastos: Math.round(gastos * 100) / 100,
    baseImponible: Math.round(baseImponible * 100) / 100,
    tipoActividad,
    cuota: Math.round(cuota * 100) / 100,
    cuotaAnterior: cuotaTrimestreAnterior,
    resultado: Math.round(resultado * 100) / 100,
    fechaVencimiento: fechas.modelo131
  };
};

/**
 * Calcula el Modelo 303 (IVA trimestral)
 */
export const calcularModelo303 = (
  trimestre: number,
  año: number,
  ivaRepercutido: number, // IVA cobrado (21%, 10%, 4%)
  ivaSoportado: number,    // IVA pagado
  regularizacion: number = 0
): Modelo303 => {
  const resultado = ivaRepercutido - ivaSoportado;
  const resultadoLiquido = resultado + regularizacion;
  
  const fechas = obtenerFechasVencimiento(trimestre as 1 | 2 | 3 | 4, año);
  
  return {
    trimestre,
    año,
    ivaRepercutido: Math.round(ivaRepercutido * 100) / 100,
    ivaSoportado: Math.round(ivaSoportado * 100) / 100,
    resultado: Math.round(resultado * 100) / 100,
    regularizacion: Math.round(regularizacion * 100) / 100,
    resultadoLiquido: Math.round(resultadoLiquido * 100) / 100,
    fechaVencimiento: fechas.modelo303
  };
};

/**
 * Obtiene el trimestre actual basado en la fecha
 */
export const obtenerTrimestreActual = (): { trimestre: 1 | 2 | 3 | 4; año: number } => {
  const hoy = new Date();
  const mes = hoy.getMonth() + 1; // 1-12
  const año = hoy.getFullYear();
  
  let trimestre: 1 | 2 | 3 | 4;
  if (mes >= 1 && mes <= 3) trimestre = 1;
  else if (mes >= 4 && mes <= 6) trimestre = 2;
  else if (mes >= 7 && mes <= 9) trimestre = 3;
  else trimestre = 4;
  
  return { trimestre, año };
};

/**
 * Calcula todas las declaraciones trimestrales desde facturas
 */
export const calcularDeclaracionesDesdeFacturas = (
  facturas: Array<{ fecha: string; total: number; iva: number; tipo: 'Invoice' | 'Expense' }>,
  gastos: Array<{ fecha: string; total: number; iva: number }>,
  trimestre: number,
  año: number
): {
  modelo130: Modelo130;
  modelo131: Modelo131;
  modelo303: Modelo303;
} => {
  // Filtrar facturas y gastos del trimestre
  const inicioTrimestre = new Date(año, (trimestre - 1) * 3, 1);
  const finTrimestre = new Date(año, trimestre * 3, 0);
  
  const facturasTrimestre = facturas.filter(f => {
    const fecha = new Date(f.fecha);
    return fecha >= inicioTrimestre && fecha <= finTrimestre && f.tipo === 'Invoice';
  });
  
  const gastosTrimestre = gastos.filter(g => {
    const fecha = new Date(g.fecha);
    return fecha >= inicioTrimestre && fecha <= finTrimestre;
  });
  
  // Calcular totales
  const ingresos = facturasTrimestre.reduce((sum, f) => sum + f.total, 0);
  const gastosTotal = gastosTrimestre.reduce((sum, g) => sum + g.total, 0);
  
  const ivaRepercutido = facturasTrimestre.reduce((sum, f) => sum + f.iva, 0);
  const ivaSoportado = gastosTrimestre.reduce((sum, g) => sum + g.iva, 0);
  
  // Calcular declaraciones
  const modelo130 = calcularModelo130(trimestre, año, ingresos, gastosTotal);
  const modelo131 = calcularModelo131(trimestre, año, ingresos, gastosTotal);
  const modelo303 = calcularModelo303(trimestre, año, ivaRepercutido, ivaSoportado);
  
  return { modelo130, modelo131, modelo303 };
};

