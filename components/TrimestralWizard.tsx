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
    // Para el cálculo de declaraciones necesitamos TODAS las facturas del año (YTD)
    // No filtramos por trimestre aquí, eso lo hace el servicio internamente

    // Mapeamos todas las facturas disponibles
    const facturasAnuales = invoices.map(f => {
      // Determinamos la base imponible y el IVA
      // Usamos baseAmountEur si existe (multidivisa) o el total menos IVA si es EUR
      // Simplificación: base = total - ivaAmount (si no hay iva, base = total)

      let base = f.baseAmountEur || f.total;
      if (f.currency === 'EUR' && f.ivaAmount) {
        base = f.total - f.ivaAmount;
      }

      return {
        fecha: f.date,
        total: f.total,
        base: base,
        iva: f.ivaAmount || 0,
        irpf: f.irpfAmount || 0, // Pasamos la retención
        tipo: f.type as 'Invoice' | 'Expense'
      };
    });

    return calcularDeclaracionesDesdeFacturas(facturasAnuales, trimestre, año);
  }, [invoices, trimestre, año]);

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

  import { createPortal } from 'react-dom';

  // --- ELI5 Explanations ---
  const [showExplainModal, setShowExplainModal] = useState<'MODELO_130' | 'MODELO_131' | 'MODELO_303' | null>(null);

  const getExplanation = (model: 'MODELO_130' | 'MODELO_131' | 'MODELO_303') => {
    if (model === 'MODELO_130') {
      return {
        title: '¿Qué es el Modelo 130?',
        emoji: '🐷',
        text: 'Imagina que tienes una hucha. Cada vez que ganas dinero (beneficio), Hacienda quiere que guardes un trocito (el 20%) en esa hucha. Cada 3 meses, le das esa hucha a Hacienda.',
        example: 'Ejemplo: Si este trimestre has ganado 1.000€ (ingresos - gastos), tienes que apartar 200€ para Hacienda. Si ya te retuvieron 50€ en tus facturas, entonces solo tienes que poner 150€ más en la hucha.'
      };
    }
    if (model === 'MODELO_131') {
      return {
        title: '¿Qué es el Modelo 131?',
        emoji: '📏',
        text: 'Aquí Hacienda no mira cuánto ganas realmente. Ellos han calculado (por el tamaño de tu local, luz que gastas, etc.) cuánto "deberías" ganar. Pagas una cantidad fija cada trimestre, ganes mucho o poco.',
        example: 'Ejemplo: Tienes una cafetería pequeña. Hacienda dice que por tus mesas y barra debes pagar 300€ al trimestre. Da igual si vendes 1.000 cafés o ninguno, pagarás esos 300€ fijos.'
      };
    }
    return {
      title: '¿Qué es el Modelo 303?',
      emoji: '🤝',
      text: 'Tú eres un recaudador del Rey. Cuando cobras una factura con IVA, ese dinero extra NO es tuyo, es del Rey (Hacienda). Tú solo lo guardas. Cada 3 meses, le das todo el dinero que has guardado.',
      example: 'Ejemplo: Cobras 100€ + 21€ de IVA. Esos 21€ NO son tuyos. Son "dinero caliente". Si gastaste 10€ de IVA comprando papel, se lo restas. Al final le das al Rey: 21€ (recudado) - 10€ (pagado) = 11€.'
    };
  };

  const ExplainModal = () => {
    if (!showExplainModal) return null;
    const content = getExplanation(showExplainModal);

    // Usamos Portal para que el modal salga por encima de TODO (incluido el sidebar)
    return createPortal(
      <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 font-sans" onClick={() => setShowExplainModal(null)}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

          {/* Header con gradiente suave */}
          <div className="bg-gradient-to-r from-slate-50 to-white p-6 border-b border-slate-100 flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="text-5xl shadow-sm bg-white p-2 rounded-2xl border border-slate-100">{content.emoji}</div>
              <div>
                <h3 className="text-2xl font-black text-[#1c2938] leading-tight">{content.title}</h3>
                <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mt-1">Explicación simple</p>
              </div>
            </div>
            <button onClick={() => setShowExplainModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <p className="text-[#334155] text-lg leading-relaxed font-medium">
              {content.text}
            </p>

            {/* Ejemplo Visual */}
            <div className="bg-[#f0fdfa] p-5 rounded-2xl border border-[#ccfbf1] flex gap-4 items-start">
              <div className="bg-[#27bea5]/20 p-2 rounded-lg mt-1">
                <Info className="w-5 h-5 text-[#0d9488]" />
              </div>
              <div className="space-y-1">
                <p className="text-[#0f766e] text-xs font-black uppercase tracking-wide">Ejemplo práctico</p>
                <p className="text-[#134e4a] text-sm leading-relaxed">
                  {content.example}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setShowExplainModal(null)}
              className="px-8 py-3 bg-[#1c2938] text-white rounded-xl font-bold hover:bg-[#2c3e50] shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 transition-all transform hover:-translate-y-0.5"
            >
              ¡Entendido, gracias!
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
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
              <h2 className="text-3xl font-black">Tu Dinero Limpio</h2>
              <p className="text-slate-400 text-sm max-w-sm">
                Esto es lo que realmente te queda en el bolsillo tras apartar lo que es para Hacienda y pagar tus gastos y comisiones.
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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50 relative group hover:shadow-md transition-shadow">
            <button
              onClick={() => setShowExplainModal('MODELO_130')}
              className="absolute top-4 right-4 text-slate-400 hover:text-[#27bea5] transition-all
                         hover:bg-[#27bea5]/10 p-2 rounded-full
                         hover:shadow-[0_0_15px_rgba(39,190,165,0.4)] hover:scale-110 active:scale-95"
              title="¿Qué es esto?"
            >
              <Info className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1c2938]">Modelo 130</h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded mr-6">IRPF</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">Pago fraccionado IRPF (Estimación Directa)</p>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Rendimiento Neto (YTD)</span>
                <span className="font-bold">€{declaraciones.modelo130.rendimientoNeto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Cuota Líquida (20%)</span>
                <span className="font-bold">€{declaraciones.modelo130.cuotaLiquida.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-amber-600">
                <span className="">- Retenciones Acumuladas</span>
                <span className="font-bold">-€{declaraciones.modelo130.retencionesAcumuladas.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span className="">- Pagos Anteriores</span>
                <span className="font-bold">-€{declaraciones.modelo130.pagosFraccionadosAnteriores.toFixed(2)}</span>
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

            {/* Conversational Insight */}
            {declaraciones.modelo130.resultado > 0 && (
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  ⚠️ <span className="font-bold">Hucha de impuestos</span>: Guarda estos <span className="font-bold">€{declaraciones.modelo130.resultado.toFixed(2)}</span>. Es un adelanto para tu declaración de la Renta.
                </p>
              </div>
            )}

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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50 relative group hover:shadow-md transition-shadow">
            <button
              onClick={() => setShowExplainModal('MODELO_131')}
              className="absolute top-4 right-4 text-slate-400 hover:text-[#27bea5] transition-all
                         hover:bg-[#27bea5]/10 p-2 rounded-full
                         hover:shadow-[0_0_15px_rgba(39,190,165,0.4)] hover:scale-110 active:scale-95"
              title="¿Qué es esto?"
            >
              <Info className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1c2938]">Modelo 131</h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded mr-6">IRPF</span>
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

            {/* Conversational Insight */}
            {declaraciones.modelo131.resultado > 0 && (
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  ⚠️ <span className="font-bold">Aviso preventivo</span>: Debes reservar <span className="font-bold">€{declaraciones.modelo131.resultado.toFixed(2)}</span> para cumplir con el pago fraccionado de tu actividad.
                </p>
              </div>
            )}

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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-50 relative group hover:shadow-md transition-shadow">
            <button
              onClick={() => setShowExplainModal('MODELO_303')}
              className="absolute top-4 right-4 text-slate-400 hover:text-[#27bea5] transition-all
                         hover:bg-[#27bea5]/10 p-2 rounded-full
                         hover:shadow-[0_0_15px_rgba(39,190,165,0.4)] hover:scale-110 active:scale-95"
              title="¿Qué es esto?"
            >
              <Info className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1c2938]">Modelo 303</h3>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded mr-6">IVA</span>
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

            {/* Conversational Insight */}
            {declaraciones.modelo303.resultadoLiquido > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                  💳 <span className="font-bold">El IVA no es tuyo</span>: Estos <span className="font-bold">€{declaraciones.modelo303.resultadoLiquido.toFixed(2)}</span> son el impuesto que has recaudado de tus clientes y que ahora debes devolver.
                </p>
              </div>
            )}
            {declaraciones.modelo303.resultadoLiquido < 0 && (
              <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-100">
                <p className="text-xs text-green-800 leading-relaxed font-medium">
                  ✨ <span className="font-bold">Hacienda te debe</span>: Has pagado más IVA del que has cobrado. Estos <span className="font-bold">€{Math.abs(declaraciones.modelo303.resultadoLiquido).toFixed(2)}</span> se quedarán a tu favor.
                </p>
              </div>
            )}

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

      {/* Renderizar Modal */}
      <ExplainModal />

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

