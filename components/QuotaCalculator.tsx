import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, Calendar, TrendingUp, AlertCircle, CheckCircle2, 
  Euro, Info, Save, Loader2, ChevronRight, Clock
} from 'lucide-react';
import { UserProfile, AutonomoQuotaConfig } from '../types';
import { calcularCuotaAutonomo, obtenerHistorialCuotas, aplicaTarifaPlana } from '../services/seguridadSocialService';
import { useAlert } from './AlertSystem';

interface QuotaCalculatorProps {
  currentUser: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => Promise<void>;
}

const QuotaCalculator: React.FC<QuotaCalculatorProps> = ({ currentUser, onUpdateProfile }) => {
  const alert = useAlert();
  const [baseCotizacion, setBaseCotizacion] = useState(1134.0); // Base mínima 2024
  const [fechaAlta, setFechaAlta] = useState(new Date().toISOString().split('T')[0]);
  const [tipoReduccion, setTipoReduccion] = useState<'TARIFA_PLANA' | 'REDUCCION_50' | 'REDUCCION_25' | 'NINGUNA'>('NINGUNA');
  const [isSaving, setIsSaving] = useState(false);

  // Cargar configuración existente
  useEffect(() => {
    const config = currentUser.fiscalConfig;
    if (config?.fechaAltaAutonomo) {
      setFechaAlta(config.fechaAltaAutonomo);
    }
    if (config?.baseCotizacionSS) {
      setBaseCotizacion(config.baseCotizacionSS);
    }
    if (config?.tipoReduccion) {
      setTipoReduccion(config.tipoReduccion);
    }
  }, [currentUser]);

  // Calcular cuota actual
  const cuotaActual = useMemo(() => {
    const tieneBonificacion = aplicaTarifaPlana(fechaAlta) && tipoReduccion === 'TARIFA_PLANA';
    return calcularCuotaAutonomo(baseCotizacion, tieneBonificacion, tipoReduccion);
  }, [baseCotizacion, fechaAlta, tipoReduccion]);

  // Calcular total anual
  const totalAnual = useMemo(() => {
    return cuotaActual.cuotaMensual * 12;
  }, [cuotaActual]);

  // Historial del año actual
  const historialAnual = useMemo(() => {
    const año = new Date().getFullYear();
    const inicioAño = `${año}-01-01`;
    const finAño = `${año}-12-31`;
    return obtenerHistorialCuotas(inicioAño, finAño, {
      baseCotizacion,
      fechaAlta,
      bonificacionReduccion: aplicaTarifaPlana(fechaAlta) && tipoReduccion === 'TARIFA_PLANA',
      tipoReduccion
    });
  }, [baseCotizacion, fechaAlta, tipoReduccion]);

  const handleSave = async () => {
    if (!onUpdateProfile) return;
    
    setIsSaving(true);
    try {
      const updated = {
        ...currentUser,
        fiscalConfig: {
          ...currentUser.fiscalConfig,
          baseCotizacionSS: baseCotizacion,
          fechaAltaAutonomo: fechaAlta,
          tipoReduccion,
          bonificacionReduccion: aplicaTarifaPlana(fechaAlta) && tipoReduccion === 'TARIFA_PLANA'
        }
      };
      await onUpdateProfile(updated);
      alert.addToast('success', 'Configuración Guardada', 'Los datos de cuotas se han actualizado correctamente.');
    } catch (error) {
      alert.addToast('error', 'Error', 'No se pudo guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  const mesActual = new Date().getMonth() + 1;
  const añoActual = new Date().getFullYear();

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight flex items-center gap-3">
            <Calculator className="w-8 h-8 text-[#27bea5]" />
            Calculadora de Cuotas
          </h1>
          <p className="text-slate-500 mt-1 text-lg font-light">Gestiona tus cuotas de autónomo de Seguridad Social</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-8 py-3 rounded-2xl font-bold transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:scale-95 disabled:opacity-70 bg-[#1c2938] text-white hover:bg-[#27bea5]"
        >
          {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</> : <><Save className="w-5 h-5" /> Guardar Configuración</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Configuración */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50">
            <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#27bea5]" />
              Configuración
            </h3>

            <div className="space-y-6">
              {/* Base de Cotización */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Base de Cotización (€/mes)
                </label>
                <div className="relative">
                  <Euro className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    min="1134"
                    max="4507.2"
                    step="0.01"
                    value={baseCotizacion}
                    onChange={(e) => setBaseCotizacion(parseFloat(e.target.value) || 1134)}
                    className="w-full pl-12 p-3 border border-slate-200 rounded-xl font-bold text-[#1c2938] outline-none focus:ring-2 focus:ring-[#27bea5]"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Mínima: €1,134.00 | Máxima: €4,507.20 (2024)
                </p>
              </div>

              {/* Fecha de Alta */}
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
                {aplicaTarifaPlana(fechaAlta) && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-xl flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-green-800">Tarifa Plana Disponible</p>
                      <p className="text-xs text-green-600">Aplicable durante los primeros 12 meses desde el alta</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tipo de Reducción */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Bonificación / Reducción
                </label>
                <select
                  value={tipoReduccion}
                  onChange={(e) => setTipoReduccion(e.target.value as any)}
                  className="w-full p-3 border border-slate-200 rounded-xl font-bold text-[#1c2938] outline-none focus:ring-2 focus:ring-[#27bea5]"
                >
                  <option value="NINGUNA">Ninguna</option>
                  <option value="TARIFA_PLANA">Tarifa Plana (€60/mes primeros 12 meses)</option>
                  <option value="REDUCCION_50">Reducción 50%</option>
                  <option value="REDUCCION_25">Reducción 25%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Desglose de la Cuota */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50">
            <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#27bea5]" />
              Desglose Mensual
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-600">Contingencias Comunes</span>
                <span className="text-lg font-bold text-[#1c2938]">€{cuotaActual.desglose.contingenciasComunes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-600">Desempleo</span>
                <span className="text-lg font-bold text-[#1c2938]">€{cuotaActual.desglose.desempleo.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-600">Formación Profesional</span>
                <span className="text-lg font-bold text-[#1c2938]">€{cuotaActual.desglose.formacionProfesional.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t-2 border-slate-200 flex justify-between items-center">
                <span className="text-xl font-bold text-[#1c2938]">Total Mensual</span>
                <span className="text-3xl font-black text-[#27bea5]">€{cuotaActual.cuotaMensual.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Resumen y Proyección */}
        <div className="space-y-6">
          {/* Resumen Card */}
          <div className="bg-gradient-to-br from-[#1c2938] to-[#27bea5] p-6 rounded-[2rem] text-white shadow-xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Resumen Anual
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-200 text-sm">Cuota Mensual</span>
                <span className="text-xl font-bold">€{cuotaActual.cuotaMensual.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-white/20">
                <span className="text-slate-200 text-sm font-bold">Total Anual</span>
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

          {/* Historial del Año */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
              Historial {añoActual}
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {historialAnual.map((cuota, idx) => {
                const mesNombre = new Date(2024, cuota.mes - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
                return (
                  <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                    <span className="text-xs font-bold text-slate-600 capitalize">{mesNombre}</span>
                    <span className="text-sm font-bold text-[#1c2938]">€{cuota.cuotaMensual.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaCalculator;
