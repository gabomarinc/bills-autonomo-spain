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
  ingresosAcumulados: number; // Ingresos desde Enero 1 hasta fin del trimestre
  gastosAcumulados: number;  // Gastos desde Enero 1 hasta fin del trimestre
  rendimientoNeto: number;   // Ingresos - Gastos
  retencionesAcumuladas: number; // IRPF retenido en facturas desde Enero 1
  cuotaLiquida: number; // 20% del rendimiento neto
  pagosFraccionadosAnteriores: number; // Suma de resultados a ingresar de trimestres anteriores (del mismo año)
  resultado: number; // (CuotaLiquida - Retenciones - PagosAnteriores)
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
 * Calcula el Modelo 130 (IRPF estimado) - ACUMULATIVO ANUAL (YTD)
 * Fórmula oficial: (Rendimiento Neto Acumulado * 20%) - Retenciones Acumuladas - Pagos Fraccionados Anteriores
 */
export const calcularModelo130 = (
  trimestre: number,
  año: number,
  ingresosAcumulados: number,
  gastosAcumulados: number,
  retencionesAcumuladas: number,
  pagosFraccionadosAnteriores: number = 0
): Modelo130 => {
  const rendimientoNeto = ingresosAcumulados - gastosAcumulados;

  // Si el rendimiento es negativo, la cuota es 0 (no se paga si hay pérdidas acumuladas)
  let cuotaLiquida = 0;
  if (rendimientoNeto > 0) {
    cuotaLiquida = rendimientoNeto * 0.20; // 20%
  }

  // Resultado = Cuota (20%) - Retenciones soportadas - Lo ya pagado en trimestres anteriores
  let resultado = cuotaLiquida - retencionesAcumuladas - pagosFraccionadosAnteriores;

  // El Modelo 130 puede salir negativo (a deducir en siguientes trimestres)
  // Pero para simplificar en esta versión, mostraremos el resultado matemático

  const fechas = obtenerFechasVencimiento(trimestre as 1 | 2 | 3 | 4, año);

  return {
    trimestre,
    año,
    ingresosAcumulados: Math.round(ingresosAcumulados * 100) / 100,
    gastosAcumulados: Math.round(gastosAcumulados * 100) / 100,
    rendimientoNeto: Math.round(rendimientoNeto * 100) / 100,
    retencionesAcumuladas: Math.round(retencionesAcumuladas * 100) / 100,
    cuotaLiquida: Math.round(cuotaLiquida * 100) / 100,
    pagosFraccionadosAnteriores: Math.round(pagosFraccionadosAnteriores * 100) / 100,
    resultado: Math.round(resultado * 100) / 100,
    fechaVencimiento: fechas.modelo130
  };
};

/**
 * Calcula el Modelo 131 (IRPF actividad económica)
 * Este modelo NO es acumulativo, es por módulos trimestrales fijos.
 */
export const calcularModelo131 = (
  trimestre: number,
  año: number,
  ingresos: number, // Del trimestre
  gastos: number, // Del trimestre
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
 * El IVA NO es acumulativo anual para el cálculo del resultado, se liquida lo del trimestre.
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
 * ESTA FUNCIÓN AHORA DEBE RECIBIR TODAS LAS FACTURAS DEL AÑO PARA EL MODELO 130
 */
export const calcularDeclaracionesDesdeFacturas = (
  facturasAnuales: Array<{ fecha: string; total: number; base: number; iva: number; irpf: number; tipo: 'Invoice' | 'Expense' }>,
  trimestre: number,
  año: number
): {
  modelo130: Modelo130;
  modelo131: Modelo131;
  modelo303: Modelo303;
} => {
  // Fechas límite del trimestre actual
  const inicioTrimestre = new Date(año, (trimestre - 1) * 3, 1);
  const finTrimestre = new Date(año, trimestre * 3, 0);

  // Fechas límite YTD (Year To Date) - Desde 1 de Enero hasta fin del trimestre actual
  const inicioAño = new Date(año, 0, 1);

  // --- DATOS PARA MODELO 130 (ACUMULADO ANUAL) ---
  const facturasYTD = facturasAnuales.filter(f => {
    const fecha = new Date(f.fecha);
    return fecha >= inicioAño && fecha <= finTrimestre && f.tipo === 'Invoice';
  });

  const gastosYTD = facturasAnuales.filter(f => {
    const fecha = new Date(f.fecha);
    return fecha >= inicioAño && fecha <= finTrimestre && f.tipo === 'Expense';
  });

  const ingresosYTD = facturasYTD.reduce((sum, f) => sum + (f.base || f.total), 0); // Usar BASE imponible
  const gastosTotalYTD = gastosYTD.reduce((sum, g) => sum + (g.base || g.total), 0); // Usar BASE imponible

  // Retenciones acumuladas (solo de facturas de ingreso)
  const retencionesYTD = facturasYTD.reduce((sum, f) => sum + (f.irpf || 0), 0);

  // Pagos a cuenta anteriores (simulado por ahora, debería venir de BBDD)
  // En una implementación real, aquí sumaríamos los resultados POSITIVOS de los M130 de trimestres anteriores del mismo año
  const pagosFraccionadosAnteriores = 0;

  const modelo130 = calcularModelo130(trimestre, año, ingresosYTD, gastosTotalYTD, retencionesYTD, pagosFraccionadosAnteriores);


  // --- DATOS PARA MODELO 303 (SOLO TRIMESTRE ACTUAL) ---
  const facturasTrimestre = facturasAnuales.filter(f => {
    const fecha = new Date(f.fecha);
    return fecha >= inicioTrimestre && fecha <= finTrimestre && f.tipo === 'Invoice';
  });

  const gastosTrimestre = facturasAnuales.filter(f => {
    const fecha = new Date(f.fecha);
    return fecha >= inicioTrimestre && fecha <= finTrimestre && f.tipo === 'Expense';
  });

  // IVA se calcula sobre la cuota de IVA, no sobre la base
  const ivaRepercutido = facturasTrimestre.reduce((sum, f) => sum + f.iva, 0);
  const ivaSoportado = gastosTrimestre.reduce((sum, g) => sum + g.iva, 0);
  const ingresosTrimestre = facturasTrimestre.reduce((sum, f) => sum + (f.base || f.total), 0);
  const gastosTotalTrimestre = gastosTrimestre.reduce((sum, g) => sum + (g.base || g.total), 0);


  const modelo303 = calcularModelo303(trimestre, año, ivaRepercutido, ivaSoportado);

  // Modelo 131 usa datos trimestrales (aprox)
  const modelo131 = calcularModelo131(trimestre, año, ingresosTrimestre, gastosTotalTrimestre);

  return { modelo130, modelo131, modelo303 };
};

