import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator, Calendar, TrendingUp, AlertCircle, CheckCircle2,
  Euro, Info, Save, Loader2, ChevronRight, Clock, Wallet, ShieldPercent, ArrowRight
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  calcularCuotaAutonomo,
  obtenerHistorialCuotas,
  aplicaTarifaPlana,
  TRAMOS_2026,
  obtenerTramoPorIngresos,
  TIPOS_COTIZACION_2026
} from '../services/seguridadSocialService';
import { useAlert } from './AlertSystem';

interface QuotaCalculatorProps {
  currentUser: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => Promise<void>;
}

const QuotaCalculator: React.FC<QuotaCalculatorProps> = ({ currentUser, onUpdateProfile }) => {
  const alert = useAlert();

  // Modos: TARIFA_PLANA (Simpificado) o INGRESOS_REALES (2026)
  const [calcMode, setCalcMode] = useState<'TARIFA_PLANA' | 'INGRESOS_REALES'>('TARIFA_PLANA');

  const [baseCotizacion, setBaseCotizacion] = useState(0);
  const [fechaAlta, setFechaAlta] = useState(new Date().toISOString().split('T')[0]);
  const [tipoReduccion, setTipoReduccion] = useState<'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA'>('NINGUNA');

  // Nuevos estados para Ingresos Reales
  const [ingresosNetos, setIngresosNetos] = useState<number>(0);
  const [tramoSeleccionado, setTramoSeleccionado] = useState(TRAMOS_2026[0]);

  const [isSaving, setIsSaving] = useState(false);

  // Cargar configuración existente
  useEffect(() => {
    const config = currentUser.fiscalConfig;
    if (config?.fechaAltaAutonomo) {
      setFechaAlta(config.fechaAltaAutonomo);

      // Determinar modo inicial basado en configuración guardada
      if (aplicaTarifaPlana(config.fechaAltaAutonomo) && config.tipoReduccion === 'TARIFA_PLANA') {
        setCalcMode('TARIFA_PLANA');
        setTipoReduccion('TARIFA_PLANA');
      } else {
        setCalcMode('INGRESOS_REALES');
        setTipoReduccion(config.tipoReduccion || 'NINGUNA');
      }
    }

    if (config?.baseCotizacionSS) {
      setBaseCotizacion(config.baseCotizacionSS);
    } else {
      // Default si no hay base
      setBaseCotizacion(950.98); // Base provisional común
    }

    if (config?.ingresosReales) {
      setIngresosNetos(config.ingresosReales);
      const tramo = obtenerTramoPorIngresos(config.ingresosReales);
      if (tramo) setTramoSeleccionado(tramo);
    }
  }, [currentUser]);

  // Manejar cambio de ingresos
  const handleIngresosChange = (valor: number) => {
    setIngresosNetos(valor);
    const nuevoTramo = obtenerTramoPorIngresos(valor);
    if (nuevoTramo) {
      setTramoSeleccionado(nuevoTramo);
      // Si la base actual está fuera del nuevo rango, ajustarla al mínimo del tramo
      if (baseCotizacion < nuevoTramo.baseMin || baseCotizacion > nuevoTramo.baseMax) {
        setBaseCotizacion(nuevoTramo.baseMin);
      }
    }
  };

  // Switch de modo
  const toggleMode = (mode: 'TARIFA_PLANA' | 'INGRESOS_REALES') => {
    setCalcMode(mode);
    if (mode === 'TARIFA_PLANA') {
      setTipoReduccion('TARIFA_PLANA');
    } else {
      setTipoReduccion('NINGUNA');
      // Si no tenemos ingresos definidos, poner un default
      if (ingresosNetos === 0) handleIngresosChange(1500);
    }
  };

  // Calcular cuota actual
  const cuotaActual = useMemo(() => {
    const tieneBonificacion = aplicaTarifaPlana(fechaAlta) && calcMode === 'TARIFA_PLANA';
    // Forzar tipo reducción según modo visual
    const reduccionEfectiva = calcMode === 'TARIFA_PLANA' ? 'TARIFA_PLANA' : tipoReduccion;

    return calcularCuotaAutonomo(baseCotizacion, tieneBonificacion, reduccionEfectiva);
  }, [baseCotizacion, fechaAlta, tipoReduccion, calcMode]);

  // Calcular total anual
  const totalAnual = useMemo(() => {
    return cuotaActual.cuotaMensual * 12;
  }, [cuotaActual]);

  const handleSave = async () => {
    if (!onUpdateProfile) {
      alert.addToast('error', 'Error', 'No se puede guardar: función de actualización no disponible.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = {
        ...currentUser,
        fiscalConfig: {
          ...currentUser.fiscalConfig,
          entityType: currentUser.fiscalConfig?.entityType || 'FISICA',
          nif: currentUser.fiscalConfig?.nif || currentUser.taxId || '',
          regimenFiscal: currentUser.fiscalConfig?.regimenFiscal || 'GENERAL',
          actividadPrincipal: currentUser.fiscalConfig?.actividadPrincipal || '',
          baseCotizacionSS: baseCotizacion,
          fechaAltaAutonomo: fechaAlta,
          tipoReduccion: calcMode === 'TARIFA_PLANA' ? 'TARIFA_PLANA' : tipoReduccion,
          bonificacionReduccion: (aplicaTarifaPlana(fechaAlta) && calcMode === 'TARIFA_PLANA') ? 'TARIFA_PLANA' : tipoReduccion,
          ingresosReales: ingresosNetos // Guardar ingresos estimados
        }
      };
      await onUpdateProfile(updated);
      alert.addToast('success', 'Configuración Guardada', 'Los datos de cuotas se han actualizado correctamente.');
    } catch (error: any) {
      console.error('Error guardando configuración:', error);
      alert.addToast('error', 'Error', error.message || 'No se pudo guardar la configuración. Verifica tu conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight flex items-center gap-3">
            <Calculator className="w-8 h-8 text-[#27bea5]" />
            Calculadora de Cuotas 2026
          </h1>
          <p className="text-slate-500 mt-1 text-lg font-light">Calcula tu cuota exacta según ingresos reales o tarifa plana</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 py-3 rounded-2xl font-bold transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:scale-95 disabled:opacity-70 bg-[#1c2938] text-white hover:bg-[#27bea5]"
        >
          {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</> : <><Save className="w-5 h-5" /> Guardar Configuración</>}
        </button>
      </div>

      {/* Mode Selector */}
      <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
        <button
          onClick={() => toggleMode('TARIFA_PLANA')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${calcMode === 'TARIFA_PLANA' ? 'bg-white text-[#27bea5] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Tarifa Plana (Nuevo Autónomo)
        </button>
        <button
          onClick={() => toggleMode('INGRESOS_REALES')}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${calcMode === 'INGRESOS_REALES' ? 'bg-white text-[#27bea5] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Cotización por Ingresos Reales
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Configuración */}
        <div className="lg:col-span-2 space-y-6">

          {/* SECCIÓN TARIFA PLANA */}
          {calcMode === 'TARIFA_PLANA' && (
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50 animate-in fade-in slide-in-from-left-4">
              <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-[#27bea5]" />
                Datos de Alta
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Fecha de Alta como Autónomo
                  </label>
                  <input
                    type="date"
                    value={fechaAlta}
                    onChange={(e) => setFechaAlta(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-[#1c2938] outline-none focus:ring-2 focus:ring-[#27bea5]"
                  />
                  {aplicaTarifaPlana(fechaAlta) ? (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-green-800">Tarifa Plana Disponible</p>
                        <p className="text-xs text-green-600">Aplicable durante los primeros 12 meses (Extendible a 24 si &lt; SMI)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-800">Periodo de Tarifa Plana Finalizado</p>
                        <p className="text-xs text-amber-600">Considera cambiar al modo "Ingresos Reales".</p>
                      </div>
                    </div>
                  )}
                </div>

                {aplicaTarifaPlana(fechaAlta) && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-[#1c2938]">Cuota Fija 2026</span>
                      <span className="font-black text-2xl text-[#27bea5]">€88.56<span className="text-sm text-slate-400 font-medium">/mes</span></span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Incluye la cuota base de 80,00€ más el Mecanismo de Equidad Intergeneracional (MEI) del 0,9%.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECCIÓN INGRESOS REALES */}
          {calcMode === 'INGRESOS_REALES' && (
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-2">
                <Wallet className="w-6 h-6 text-[#27bea5]" />
                Ingresos Reales 2026
              </h3>

              <div className="space-y-8">
                {/* Selector de Ingresos */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    ¿Qué ingresos netos mensuales esperas obtener?
                  </label>
                  <p className="text-xs text-slate-400 mb-3">(Ingresos - Gastos deducibles)</p>

                  <select
                    value={tramoSeleccionado.id}
                    onChange={(e) => {
                      const tramo = TRAMOS_2026.find(t => t.id === Number(e.target.value));
                      if (tramo) handleIngresosChange(tramo.min + 1); // Setear valor seguro dentro del tramo
                    }}
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold text-[#1c2938] outline-none focus:ring-2 focus:ring-[#27bea5] shadow-sm appearance-none"
                  >
                    {TRAMOS_2026.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.max > 50000
                          ? `Más de €${t.min.toLocaleString()}/mes`
                          : `De €${t.min.toLocaleString()} a €${t.max.toLocaleString()}/mes`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slider de Base de Cotización */}
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Elige tu base de cotización
                    </label>
                    <div className="text-right">
                      <span className="text-2xl font-black text-[#1c2938]">€{baseCotizacion.toFixed(2)}</span>
                      <span className="text-xs text-slate-400 font-bold ml-1">/mes</span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={tramoSeleccionado.baseMin}
                    max={tramoSeleccionado.baseMax}
                    step="0.01"
                    value={baseCotizacion}
                    onChange={(e) => setBaseCotizacion(parseFloat(e.target.value))}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#27bea5]"
                  />
                  <div className="flex justify-between mt-2 text-xs font-bold text-slate-400">
                    <span>Min: €{tramoSeleccionado.baseMin.toFixed(2)}</span>
                    <span>Max: €{tramoSeleccionado.baseMax.toLocaleString()}</span>
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-xs rounded-xl flex items-start gap-2">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p>
                      Tu cuota variará entre <strong>€{(tramoSeleccionado.baseMin * (TIPOS_COTIZACION_2026.total / 100)).toFixed(2)}</strong> y <strong>€{(tramoSeleccionado.baseMax * (TIPOS_COTIZACION_2026.total / 100)).toFixed(2)}</strong> dependiendo de la base elegida. Una base mayor implica mejores prestaciones futuras (pensión, baja, etc).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desglose de la Cuota (Universal) */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50">
            <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-2">
              <ShieldPercent className="w-6 h-6 text-[#27bea5]" />
              Desglose de la Cuota
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700">Contingencias Comunes</span>
                  <span className="text-[10px] text-slate-400">Enfermedad común, maternidad, jubilación ({calcMode === 'TARIFA_PLANA' ? 'Incluido' : '28.3%'})</span>
                </div>
                <span className="text-base font-bold text-[#1c2938]">€{cuotaActual.desglose.contingenciasComunes.toFixed(2)}</span>
              </div>

              {calcMode === 'INGRESOS_REALES' && (
                <>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">Contingencias Profesionales</span>
                      <span className="text-[10px] text-slate-400">Accidente laboral, enfermedad profesional (1.3%)</span>
                    </div>
                    <span className="text-base font-bold text-[#1c2938]">€{cuotaActual.desglose.contingenciasProfesionales?.toFixed(2) || '0.00'}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">Cese de Actividad</span>
                      <span className="text-[10px] text-slate-400">Paro del autónomo (0.9%)</span>
                    </div>
                    <span className="text-base font-bold text-[#1c2938]">€{cuotaActual.desglose.desempleo.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">Formación Profesional</span>
                      <span className="text-[10px] text-slate-400">Acceso a formación (0.1%)</span>
                    </div>
                    <span className="text-base font-bold text-[#1c2938]">€{cuotaActual.desglose.formacionProfesional.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-indigo-900">Mecanismo Equidad (MEI)</span>
                  <span className="text-[10px] text-indigo-700/70">Solidaridad intergeneracional pensiones (0.9%)</span>
                </div>
                <span className="text-base font-bold text-indigo-700">€{cuotaActual.desglose.mei?.toFixed(2) || '0.00'}</span>
              </div>

              <div className="pt-4 border-t-2 border-slate-100 flex justify-between items-end mt-4">
                <span className="text-lg font-bold text-[#1c2938]">Total Mensual</span>
                <div className="text-right">
                  <span className="text-4xl font-black text-[#27bea5] tracking-tighter">€{cuotaActual.cuotaMensual.toFixed(2)}</span>
                  <div className="text-xs text-slate-400 font-medium mt-1">Base de cálculo: €{cuotaActual.baseActual.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Resumen y Proyección */}
        <div className="space-y-6">
          {/* Resumen Card */}
          <div className="bg-gradient-to-br from-[#1c2938] to-[#27bea5] p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
              <Info className="w-5 h-5" />
              Resumen Anual 2026
            </h3>
            <div className="space-y-3 relative z-10">
              <div className="flex justify-between items-center">
                <span className="text-slate-200 text-sm">Cuota Mensual</span>
                <span className="text-xl font-bold">€{cuotaActual.cuotaMensual.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-white/20">
                <div className="flex flex-col">
                  <span className="text-slate-200 text-sm font-bold">Total Anual Estimado</span>
                  <span className="text-[10px] text-white/50">12 mensualidades</span>
                </div>
                <span className="text-2xl font-black">€{totalAnual.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Próximo Vencimiento */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Próximo Vencimiento
            </h4>
            <p className="text-2xl font-bold text-[#1c2938]">
              {new Date(cuotaActual.fechaVencimiento).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
            <p className="text-sm text-slate-500 mt-1">Primer día del mes siguiente</p>
          </div>

          {/* Info del Tramo Actual (Solo Ingresos Reales) */}
          {calcMode === 'INGRESOS_REALES' && tramoSeleccionado && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
                Tramo Aplicable
              </h4>
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Ingresos:</span>
                  <span className="font-bold text-[#1c2938]">€{tramoSeleccionado.min} - €{tramoSeleccionado.max}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Base Mínima:</span>
                  <span className="font-bold text-[#1c2938]">€{tramoSeleccionado.baseMin}</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default QuotaCalculator;
