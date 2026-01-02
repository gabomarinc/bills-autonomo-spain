/**
 * SEGURIDAD SOCIAL SERVICE - Gestión de cuotas de autónomo
 * Calcula y gestiona las cuotas de autónomo según la base de cotización
 */

export interface CuotaAutonomo {
  baseMinima: number;
  baseMaxima: number;
  baseActual: number;
  cuotaMensual: number;
  mes?: number; // Mes (1-12) para el historial
  desglose: {
    contingenciasComunes: number;
    desempleo: number; // Cese de actividad
    formacionProfesional: number;
    contingenciasProfesionales: number;
    mei: number;
  };
  fechaVencimiento: string; // Primer día del mes siguiente
}

export interface ConfiguracionAutonomo {
  baseCotizacion: number; // Base elegida por el usuario
  fechaAlta: string; // Fecha de alta como autónomo
  bonificacionReduccion: boolean; // Si aplica tarifa plana o reducción
  tipoReduccion?: 'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA';
  ingresosReales?: number; // Ingresos netos mensuales estimados (Nuevo 2026)
  tramoSeleccionado?: number; // Índice del tramo seleccionado
}

/**
 * Bases de cotización 2024 (Legado)
 */
const BASES_COTIZACION_2024 = {
  minima: 1134.0, // Base mínima antigua
  maxima: 4507.2,  // Base máxima
};

/**
 * TRAMOS RENDIMIENTOS NETOS 2025/2026
 * Sistema de cotización por ingresos reales
 */
export const TRAMOS_2026 = [
  { id: 1, min: 0, max: 670, baseMin: 200.00, baseMax: 670.00 },
  { id: 2, min: 670, max: 900, baseMin: 220.00, baseMax: 900.00 },
  { id: 3, min: 900, max: 1166.70, baseMin: 260.00, baseMax: 1166.70 },
  { id: 4, min: 1166.70, max: 1300, baseMin: 290.84, baseMax: 1300.00 },
  { id: 5, min: 1300, max: 1500, baseMin: 294.00, baseMax: 1500.00 },
  { id: 6, min: 1500, max: 1700, baseMin: 294.00, baseMax: 1700.00 },
  { id: 7, min: 1700, max: 1850, baseMin: 310.00, baseMax: 1850.00 },
  { id: 8, min: 1850, max: 2030, baseMin: 315.00, baseMax: 2030.00 },
  { id: 9, min: 2030, max: 2330, baseMin: 320.00, baseMax: 2330.00 },
  { id: 10, min: 2330, max: 2760, baseMin: 325.00, baseMax: 2760.00 },
  { id: 11, min: 2760, max: 3190, baseMin: 340.00, baseMax: 3190.00 },
  { id: 12, min: 3190, max: 3620, baseMin: 355.00, baseMax: 3620.00 },
  { id: 13, min: 3620, max: 4050, baseMin: 370.00, baseMax: 4050.00 },
  { id: 14, min: 4050, max: 6000, baseMin: 390.00, baseMax: 4507.00 }, // Max base genérica aprox
  { id: 15, min: 6000, max: 99999, baseMin: 415.00, baseMax: 4507.00 },
];

/**
 * Tipos de cotización 2026 (Desglose)
 * Total: 31.5%
 */
export const TIPOS_COTIZACION_2026 = {
  contingenciasComunes: 28.3,
  contingenciasProfesionales: 1.3,
  ceseActividad: 0.9, // Desempleo
  formacionProfesional: 0.1,
  mei: 0.9, // Mecanismo de Equidad Intergeneracional
  total: 31.5
};

// Constantes Tarifa Plana 2026
const TARIFA_PLANA_AMOUNT = 88.56; // 80€ Base + MEI (Calculado sobre 950.98€)
const BASE_MINIMA_MEI = 950.98;

/**
 * Obtiene el tramo correspondiente a unos ingresos
 */
export const obtenerTramoPorIngresos = (ingresos: number) => {
  return TRAMOS_2026.find(t => ingresos >= t.min && ingresos < t.max) || TRAMOS_2026[TRAMOS_2026.length - 1];
};

/**
 * Calcula la cuota mensual de autónomo
 */
export const calcularCuotaAutonomo = (
  baseCotizacion: number,
  tieneBonificacion: boolean = false,
  tipoReduccion?: 'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA'
): CuotaAutonomo => {

  // Si aplica Tarifa Plana, la cuota es fija con MEI incluído
  if (tipoReduccion === 'TARIFA_PLANA' && tieneBonificacion) {
    return {
      baseMinima: 0,
      baseMaxima: 0,
      baseActual: BASE_MINIMA_MEI,
      cuotaMensual: TARIFA_PLANA_AMOUNT,
      desglose: {
        contingenciasComunes: 80.00, // Conceptualmente los 80€ cubren contingencias comunes y profesionales
        desempleo: 0,
        formacionProfesional: 0,
        contingenciasProfesionales: 0,
        mei: 8.56, // MEI (0.9% de 950.98)
      },
      fechaVencimiento: getFechaVencimiento()
    };
  }

  // Cálculo por Ingresos Reales / Base
  // Calcular componentes
  const contingenciasComunes = (baseCotizacion * TIPOS_COTIZACION_2026.contingenciasComunes) / 100;
  const contingenciasProfesionales = (baseCotizacion * TIPOS_COTIZACION_2026.contingenciasProfesionales) / 100;
  const ceseActividad = (baseCotizacion * TIPOS_COTIZACION_2026.ceseActividad) / 100;
  const formacionProfesional = (baseCotizacion * TIPOS_COTIZACION_2026.formacionProfesional) / 100;
  const mei = (baseCotizacion * TIPOS_COTIZACION_2026.mei) / 100;

  let cuotaMensual = contingenciasComunes + contingenciasProfesionales + ceseActividad + formacionProfesional + mei;

  // Aplicar reducciones (Legacy o casos especiales)
  if (tipoReduccion === 'REDUCCION_50') {
    cuotaMensual = cuotaMensual * 0.5;
  } else if (tipoReduccion === 'REDUCCION_25') {
    cuotaMensual = cuotaMensual * 0.75;
  }

  return {
    baseMinima: 200, // Referencia mínima absoluta
    baseMaxima: 4507.2,
    baseActual: baseCotizacion,
    cuotaMensual: Math.round(cuotaMensual * 100) / 100,
    desglose: {
      contingenciasComunes: Math.round(contingenciasComunes * 100) / 100,
      contingenciasProfesionales: Math.round(contingenciasProfesionales * 100) / 100,
      desempleo: Math.round(ceseActividad * 100) / 100, // Mapeado a desempleo/cese
      formacionProfesional: Math.round(formacionProfesional * 100) / 100,
      mei: Math.round(mei * 100) / 100
    },
    fechaVencimiento: getFechaVencimiento()
  };
};

const getFechaVencimiento = () => {
  const hoy = new Date();
  const mesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  return mesSiguiente.toISOString().split('T')[0];
};

/**
 * Determina si aplica tarifa plana (primeros 12 meses desde alta)
 */
export const aplicaTarifaPlana = (fechaAlta: string): boolean => {
  const alta = new Date(fechaAlta);
  const hoy = new Date();
  const mesesTranscurridos = (hoy.getFullYear() - alta.getFullYear()) * 12 +
    (hoy.getMonth() - alta.getMonth());
  return mesesTranscurridos < 12;
};

/**
 * Obtiene el historial de cuotas para un período
 */
export const obtenerHistorialCuotas = (
  fechaInicio: string,
  fechaFin: string,
  config: ConfiguracionAutonomo
): CuotaAutonomo[] => {
  const historial: CuotaAutonomo[] = [];
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  let fechaActual = new Date(inicio);

  while (fechaActual <= fin) {
    const tieneBonificacion = aplicaTarifaPlana(config.fechaAlta) &&
      config.tipoReduccion === 'TARIFA_PLANA';

    // Aquí podríamos ajustar la base según el tramo si tuviéramos histórico de ingresos
    // Por simplicidad usamos la configuración actual
    const cuota = calcularCuotaAutonomo(
      config.baseCotizacion,
      tieneBonificacion,
      config.tipoReduccion
    );

    historial.push({
      ...cuota,
      mes: fechaActual.getMonth() + 1
    });

    fechaActual.setMonth(fechaActual.getMonth() + 1);
  }

  return historial;
};

