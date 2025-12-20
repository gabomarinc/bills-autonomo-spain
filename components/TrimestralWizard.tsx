import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText, Calendar, Calculator, CheckCircle2, AlertTriangle,
  Download, Save, Loader2, ChevronRight, TrendingUp, TrendingDown,
  Info, X, Eye, Brain
} from 'lucide-react';
import { Invoice, UserProfile, TrimestralDeclaration } from '../types';
import {
  calcularModelo130,
  calcularModelo131,
  calcularModelo303,
  calcularDeclaracionesDesdeFacturas,
  obtenerTrimestreActual,
  obtenerFechasVencimiento
} from '../services/trimestralService';
import { useAlert } from './AlertSystem';

interface TrimestralWizardProps {
  currentUser: UserProfile;
  invoices: Invoice[];
  onSave?: (declaracion: TrimestralDeclaration) => Promise<void>;
}

const TrimestralWizard: React.FC<TrimestralWizardProps> = ({ currentUser, invoices, onSave }) => {
  const alert = useAlert();
  const { trimestre: trimestreActual, año: añoActual } = obtenerTrimestreActual();

  const [trimestre, setTrimestre] = useState<1 | 2 | 3 | 4>(trimestreActual);
  const [año, setAño] = useState(añoActual);
  const [modeloSeleccionado, setModeloSeleccionado] = useState<'MODELO_130' | 'MODELO_131' | 'MODELO_303' | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filtrar facturas y gastos del trimestre
  const datosTrimestre = useMemo(() => {
    const inicioTrimestre = new Date(año, (trimestre - 1) * 3, 1);
    const finTrimestre = new Date(año, trimestre * 3, 0);

    const facturasTrimestre = invoices.filter(inv => {
      const fecha = new Date(inv.date);
      return fecha >= inicioTrimestre && fecha <= finTrimestre && inv.type === 'Invoice';
    });

    const gastosTrimestre = invoices.filter(inv => {
      const fecha = new Date(inv.date);
      return fecha >= inicioTrimestre && fecha <= finTrimestre && inv.type === 'Expense';
    });

    const ingresos = facturasTrimestre.reduce((sum, f) => sum + (f.baseAmountEur || f.total), 0);
    const gastos = gastosTrimestre.reduce((sum, g) => sum + (g.baseAmountEur || g.total), 0);
    const ivaRepercutido = facturasTrimestre.reduce((sum, f) => sum + (f.ivaAmount || 0), 0);
    const ivaSoportado = gastosTrimestre.reduce((sum, g) => sum + (g.ivaAmount || 0), 0);

    // Calcular comisiones (diferencia entre lo facturado en EUR y lo recibido en EUR)
    const comisiones = facturasTrimestre.reduce((sum, f) => {
      if (f.status === 'Pagada' && f.paymentReceivedEur && f.baseAmountEur) {
        return sum + Math.max(0, f.baseAmountEur - f.paymentReceivedEur);
      }
      return sum;
    }, 0);

    return { facturasTrimestre, gastosTrimestre, ingresos, gastos, ivaRepercutido, ivaSoportado, comisiones };
  }, [invoices, trimestre, año]);

  // Calcular declaraciones
  const declaraciones = useMemo(() => {
    if (!datosTrimestre) return null;

    const facturas = datosTrimestre.facturasTrimestre.map(f => ({
      fecha: f.date,
      total: f.total,
      iva: f.ivaAmount || 0,
      tipo: f.type as 'Invoice' | 'Expense'
    }));

    const gastos = datosTrimestre.gastosTrimestre.map(g => ({
      fecha: g.date,
      total: g.total,
      iva: g.ivaAmount || 0
    }));

    return calcularDeclaracionesDesdeFacturas(facturas, gastos, trimestre, año);
  }, [datosTrimestre, trimestre, año]);

  const fechasVencimiento = useMemo(() => {
    return obtenerFechasVencimiento(trimestre, año);
  }, [trimestre, año]);

  const handleCalcular = () => {
    setIsCalculating(true);
    setTimeout(() => setIsCalculating(false), 500);
  };

  const handleSave = async (tipo: 'MODELO_130' | 'MODELO_131' | 'MODELO_303') => {
    if (!onSave || !declaraciones) return;

    setIsSaving(true);
    try {
      const declaracion: TrimestralDeclaration = {
        id: `trim_${currentUser.id}_${año}_${trimestre}_${tipo}`,
        userId: currentUser.id,
        trimestre,
        año,
        tipo,
        fechaVencimiento: fechasVencimiento.modelo130,
        presentada: false,
        datos: tipo === 'MODELO_130' ? declaraciones.modelo130 :
          tipo === 'MODELO_131' ? declaraciones.modelo131 :
            declaraciones.modelo303,
        resultado: tipo === 'MODELO_130' ? declaraciones.modelo130.resultado :
          tipo === 'MODELO_131' ? declaraciones.modelo131.resultado :
            declaraciones.modelo303.resultadoLiquido
      };

      await onSave(declaracion);
      alert.addToast('success', 'Declaración Guardada', 'La declaración se ha guardado correctamente.');
    } catch (error) {
      alert.addToast('error', 'Error', 'No se pudo guardar la declaración.');
    } finally {
      setIsSaving(false);
    }
  };

  const getResultadoColor = (resultado: number) => {
    if (resultado > 0) return 'text-red-600'; // A ingresar
    if (resultado < 0) return 'text-green-600'; // A devolver
    return 'text-slate-600';
  };

  const getResultadoIcon = (resultado: number) => {
    if (resultado > 0) return <TrendingUp className="w-5 h-5" />;
    if (resultado < 0) return <TrendingDown className="w-5 h-5" />;
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight flex items-center gap-3">
            <FileText className="w-8 h-8 text-[#27bea5]" />
            Declaraciones Trimestrales
          </h1>
          <p className="text-slate-500 mt-1 text-lg font-light">Calcula y gestiona tus declaraciones trimestrales</p>
        </div>
      </div>

      {/* Selector de Trimestre */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Trimestre</label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(parseInt(e.target.value) as 1 | 2 | 3 | 4)}
              className="p-3 border border-slate-200 rounded-xl font-bold text-[#1c2938] outline-none focus:ring-2 focus:ring-[#27bea5]"
            >
              <option value="1">1T - Enero a Marzo</option>
              <option value="2">2T - Abril a Junio</option>
              <option value="3">3T - Julio a Septiembre</option>
              <option value="4">4T - Octubre a Diciembre</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Año</label>
            <input
              type="number"
              value={año}
              onChange={(e) => setAño(parseInt(e.target.value) || añoActual)}
              min="2020"
              max={añoActual + 1}
              className="p-3 border border-slate-200 rounded-xl font-bold text-[#1c2938] outline-none focus:ring-2 focus:ring-[#27bea5] w-32"
            />
          </div>
          <div className="ml-auto">
            <button
              onClick={handleCalcular}
              className="px-6 py-3 bg-[#27bea5] text-white rounded-xl font-bold hover:bg-[#22a890] transition-all flex items-center gap-2"
            >
              <Calculator className="w-5 h-5" />
              Calcular
            </button>
          </div>
        </div>
      </div>

      {/* CFO Virtual - Beneficio Neto */}
      {datosTrimestre && declaraciones && (
        <div className="bg-[#1c2938] text-white p-8 rounded-3xl shadow-xl border border-slate-800 mb-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5]/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-[#27bea5]/20 transition-all duration-700"></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#27bea5] font-bold tracking-wider uppercase text-xs">
                <Brain className="w-4 h-4" />
                <span>CFO Virtual</span>
              </div>
              <h2 className="text-3xl font-black">Tu Dinero Real</h2>
              <p className="text-slate-400 text-sm max-w-md">
                Análisis de rentabilidad neta descontando impuestos previstos, gastos operativos y comisiones de pasarela.
              </p>
            </div>

            <div className="text-right">
              <div className="flex items-end justify-end gap-2">
                <span className="text-4xl md:text-5xl font-black text-[#27bea5] tracking-tighter">
                  €{(
                    datosTrimestre.ingresos -
                    datosTrimestre.gastos -
                    Math.max(0, declaraciones.modelo130.resultado) -
                    Math.max(0, declaraciones.modelo303.resultadoLiquido) -
                    datosTrimestre.comisiones
                  ).toFixed(2)}
                </span>
              </div>
              <p className="text-slate-400 text-[10px] md:text-xs mt-2 font-medium bg-white/5 py-1 px-3 rounded-full inline-block backdrop-blur-sm border border-white/10">
                €{datosTrimestre.ingresos.toFixed(2)} Ingresos -
                €{datosTrimestre.gastos.toFixed(2)} Gastos -
                €{(Math.max(0, declaraciones.modelo130.resultado) + Math.max(0, declaraciones.modelo303.resultadoLiquido)).toFixed(2)} Impuestos -
                €{datosTrimestre.comisiones.toFixed(2)} Comisiones
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resumen del Trimestre */}
      {datosTrimestre && declaraciones && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Ingresos</p>
            <p className="text-2xl font-bold text-[#1c2938]">€{datosTrimestre.ingresos.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">{datosTrimestre.facturasTrimestre.length} facturas</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Gastos</p>
            <p className="text-2xl font-bold text-red-600">€{datosTrimestre.gastos.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">{datosTrimestre.gastosTrimestre.length} gastos</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">IVA Repercutido</p>
            <p className="text-2xl font-bold text-blue-600">€{datosTrimestre.ivaRepercutido.toFixed(2)}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">IVA Soportado</p>
            <p className="text-2xl font-bold text-green-600">€{datosTrimestre.ivaSoportado.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Declaraciones */}
      {declaraciones && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Modelo 130 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1c2938]">Modelo 130</h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">IRPF</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">Pago fraccionado IRPF (Estimación Directa)</p>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Base Imponible</span>
                <span className="font-bold">€{declaraciones.modelo130.baseImponible.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Cuota (20%)</span>
                <span className="font-bold">€{declaraciones.modelo130.cuota.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t">
                <div className={`flex justify-between items-center ${getResultadoColor(declaraciones.modelo130.resultado)}`}>
                  <span className="font-bold">Resultado</span>
                  <div className="flex items-center gap-2">
                    {getResultadoIcon(declaraciones.modelo130.resultado)}
                    <span className="text-xl font-black">
                      {declaraciones.modelo130.resultado > 0 ? '+' : ''}€{declaraciones.modelo130.resultado.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <p className="text-xs text-slate-400">Vencimiento: {new Date(fechasVencimiento.modelo130).toLocaleDateString('es-ES')}</p>
              <button
                onClick={() => handleSave('MODELO_130')}
                disabled={isSaving}
                className="w-full py-2 bg-[#27bea5] text-white rounded-lg font-bold hover:bg-[#22a890] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>

          {/* Modelo 131 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1c2938]">Modelo 131</h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">IRPF</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">Pago fraccionado IRPF (Actividad Económica)</p>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Ingresos</span>
                <span className="font-bold">€{declaraciones.modelo131.ingresos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Gastos</span>
                <span className="font-bold">€{declaraciones.modelo131.gastos.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Base Imponible</span>
                <span className="font-bold">€{declaraciones.modelo131.baseImponible.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t">
                <div className={`flex justify-between items-center ${getResultadoColor(declaraciones.modelo131.resultado)}`}>
                  <span className="font-bold">Resultado</span>
                  <div className="flex items-center gap-2">
                    {getResultadoIcon(declaraciones.modelo131.resultado)}
                    <span className="text-xl font-black">
                      {declaraciones.modelo131.resultado > 0 ? '+' : ''}€{declaraciones.modelo131.resultado.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <p className="text-xs text-slate-400">Vencimiento: {new Date(fechasVencimiento.modelo131).toLocaleDateString('es-ES')}</p>
              <button
                onClick={() => handleSave('MODELO_131')}
                disabled={isSaving}
                className="w-full py-2 bg-[#27bea5] text-white rounded-lg font-bold hover:bg-[#22a890] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>

          {/* Modelo 303 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1c2938]">Modelo 303</h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">IVA</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">Declaración trimestral de IVA</p>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">IVA Repercutido</span>
                <span className="font-bold text-blue-600">€{declaraciones.modelo303.ivaRepercutido.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">IVA Soportado</span>
                <span className="font-bold text-green-600">€{declaraciones.modelo303.ivaSoportado.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t">
                <div className={`flex justify-between items-center ${getResultadoColor(declaraciones.modelo303.resultadoLiquido)}`}>
                  <span className="font-bold">Resultado</span>
                  <div className="flex items-center gap-2">
                    {getResultadoIcon(declaraciones.modelo303.resultadoLiquido)}
                    <span className="text-xl font-black">
                      {declaraciones.modelo303.resultadoLiquido > 0 ? '+' : ''}€{declaraciones.modelo303.resultadoLiquido.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <p className="text-xs text-slate-400">Vencimiento: {new Date(fechasVencimiento.modelo303).toLocaleDateString('es-ES')}</p>
              <button
                onClick={() => handleSave('MODELO_303')}
                disabled={isSaving}
                className="w-full py-2 bg-[#27bea5] text-white rounded-lg font-bold hover:bg-[#22a890] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {!declaraciones && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-50 text-center">
          <Calculator className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Selecciona un trimestre y haz clic en "Calcular" para ver las declaraciones</p>
        </div>
      )}
    </div>
  );
};

export default TrimestralWizard;

