/**
 * SEGURIDAD SOCIAL SERVICE - Gestión de cuotas de autónomo
 * Calcula y gestiona las cuotas de autónomo según la base de cotización
 */

export interface CuotaAutonomo {
  baseMinima: number;
  baseMaxima: number;
  baseActual: number;
  cuotaMensual: number;
  desglose: {
    contingenciasComunes: number;
    desempleo: number;
    formacionProfesional: number;
  };
  fechaVencimiento: string; // Primer día del mes siguiente
}

export interface ConfiguracionAutonomo {
  baseCotizacion: number; // Base elegida por el usuario
  fechaAlta: string; // Fecha de alta como autónomo
  bonificacionReduccion: boolean; // Si aplica tarifa plana o reducción
  tipoReduccion?: 'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA';
}

/**
 * Bases de cotización 2024 (actualizar según año)
 */
const BASES_COTIZACION_2024 = {
  minima: 1134.0, // Base mínima
  maxima: 4507.2,  // Base máxima
};

/**
 * Tipos de IVA para cálculo de cuotas
 */
const TIPOS_CUOTA = {
  contingenciasComunes: 28.3, // 28.3% sobre la base
  desempleo: 1.55,            // 1.55% sobre la base
  formacionProfesional: 0.1,  // 0.1% sobre la base
  total: 30.0                  // Total aproximado (redondeado)
};

/**
 * Calcula la cuota mensual de autónomo
 */
export const calcularCuotaAutonomo = (
  baseCotizacion: number,
  tieneBonificacion: boolean = false,
  tipoReduccion?: 'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA'
): CuotaAutonomo => {
  // Validar que la base esté dentro del rango
  const base = Math.max(
    BASES_COTIZACION_2024.minima,
    Math.min(baseCotizacion, BASES_COTIZACION_2024.maxima)
  );

  // Calcular componentes
  const contingenciasComunes = (base * TIPOS_CUOTA.contingenciasComunes) / 100;
  const desempleo = (base * TIPOS_CUOTA.desempleo) / 100;
  const formacionProfesional = (base * TIPOS_CUOTA.formacionProfesional) / 100;

  let cuotaMensual = contingenciasComunes + desempleo + formacionProfesional;

  // Aplicar bonificaciones/reducciones
  if (tieneBonificacion) {
    if (tipoReduccion === 'TARIFA_PLANA') {
      // Tarifa plana: 60€/mes primeros 12 meses, 80€/mes meses 13-24
      // Simplificado: asumimos primeros 12 meses
      cuotaMensual = 60.0;
    } else if (tipoReduccion === 'REDUCCION_50') {
      cuotaMensual = cuotaMensual * 0.5;
    } else if (tipoReduccion === 'REDUCCION_25') {
      cuotaMensual = cuotaMensual * 0.75;
    }
  }

  // Calcular fecha de vencimiento (primer día del mes siguiente)
  const hoy = new Date();
  const mesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  const fechaVencimiento = mesSiguiente.toISOString().split('T')[0];

  return {
    baseMinima: BASES_COTIZACION_2024.minima,
    baseMaxima: BASES_COTIZACION_2024.maxima,
    baseActual: base,
    cuotaMensual: Math.round(cuotaMensual * 100) / 100,
    desglose: {
      contingenciasComunes: Math.round(contingenciasComunes * 100) / 100,
      desempleo: Math.round(desempleo * 100) / 100,
      formacionProfesional: Math.round(formacionProfesional * 100) / 100,
    },
    fechaVencimiento
  };
};

/**
 * Calcula el total de cuotas pagadas en un año
 */
export const calcularCuotasAnuales = (
  baseCotizacion: number,
  tieneBonificacion: boolean = false,
  tipoReduccion?: 'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA'
): number => {
  const cuota = calcularCuotaAutonomo(baseCotizacion, tieneBonificacion, tipoReduccion);
  return cuota.cuotaMensual * 12;
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
    
    const cuota = calcularCuotaAutonomo(
      config.baseCotizacion,
      tieneBonificacion,
      config.tipoReduccion
    );
    
    historial.push(cuota);
    
    // Siguiente mes
    fechaActual.setMonth(fechaActual.getMonth() + 1);
  }
  
  return historial;
};
