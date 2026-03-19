
import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  Sparkles, Loader2, BrainCircuit, Lightbulb, X, Wallet, 
  Filter, Download, FileText, Target, Package, Users, DownloadCloud
} from 'lucide-react';
import { Invoice, FinancialAnalysisResult, DeepDiveReport, UserProfile, InvoiceStatus } from '../types';
import { generateFinancialAnalysis, generateDeepDiveReport } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReportsDashboardProps {
  invoices: Invoice[];
  currencySymbol: string;
  apiKey?: { gemini?: string; openai?: string };
  currentUser?: UserProfile;
}

type TimeRange = 'THIS_MONTH' | 'LAST_QUARTER' | 'THIS_YEAR';
type ReportTab = 'OVERVIEW' | 'DOCUMENTS' | 'CLIENTS' | 'FISCAL';

const ReportsDashboard = ({ invoices, currencySymbol, apiKey, currentUser }: ReportsDashboardProps) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('OVERVIEW');
  const [timeRange, setTimeRange] = useState<TimeRange>('THIS_YEAR');
  const [analysis, setAnalysis] = useState<FinancialAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [deepDiveReport, setDeepDiveReport] = useState<DeepDiveReport | null>(null);
  const [deepDiveVisual, setDeepDiveVisual] = useState<{ type: string, data: any, title: string } | null>(null);
  const [isDeepDiving, setIsDeepDiving] = useState(false);

  const analysisRef = useRef<HTMLDivElement>(null);
  const hasAiAccess = !!apiKey?.gemini || !!apiKey?.openai;

  const compactNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
  };

  const filteredInvoices = useMemo(() => {
    const now = new Date();
    let startDate = new Date(now.getFullYear(), 0, 1);
    
    if (timeRange === 'THIS_MONTH') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeRange === 'LAST_QUARTER') {
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 3);
    }

    return invoices.filter(inv => new Date(inv.date) >= startDate);
  }, [invoices, timeRange]);

  const data = useMemo(() => {
    const timelineMap = new Map<string, { ingresos: number, gastos: number, date: Date }>();
    let totalRevenue = 0; let totalExpenses = 0;
    
    filteredInvoices.forEach(inv => {
      const d = new Date(inv.date);
      const key = d.toLocaleDateString('es-ES', { month: 'short' });
      if (!timelineMap.has(key)) timelineMap.set(key, { ingresos: 0, gastos: 0, date: d });
      const entry = timelineMap.get(key)!;
      
      if (inv.type === 'Invoice') {
        let collected = inv.amountPaid || (inv.status === 'Pagada' || inv.status === 'Aceptada' ? inv.total : 0);
        entry.ingresos += collected;
        totalRevenue += collected;
      } else if (inv.type === 'Expense') {
        entry.gastos += inv.total;
        totalExpenses += inv.total;
      }
    });

    const monthlyData = Array.from(timelineMap.entries())
      .map(([name, val]) => ({ name, ingresos: val.ingresos, gastos: val.gastos, _date: val.date }))
      .sort((a, b) => a._date.getTime() - b._date.getTime());

    // --- EMBUDO FACTURAS ---
    const invs = filteredInvoices.filter(i => i.type === 'Invoice');
    const invoiceFunnelData = [
      { name: 'Enviada', value: invs.filter(i => i.status === 'Enviada').length, fill: '#0ea5e9' },
      { name: 'Seguimiento', value: invs.filter(i => i.status === 'Seguimiento').length, fill: '#3b82f6' },
      { name: 'Abonada', value: invs.filter(i => i.status === 'Abonada').length, fill: '#6366f1' },
      { name: 'Pagada', value: invs.filter(i => i.status === 'Pagada' || i.status === 'Aceptada').length, fill: '#22c55e' },
      { name: 'Incobrable', value: invs.filter(i => i.status === 'Incobrable').length, fill: '#ef4444' },
    ];

    // --- EMBUDO COTIZACIONES (Estados Solicitados) ---
    const quotes = filteredInvoices.filter(i => i.type === 'Quote');
    const quoteFunnelData = [
      { name: 'Negociacion', value: quotes.filter(q => q.status === 'Negociacion').length, fill: '#a855f7' },
      { name: 'Aceptada', value: quotes.filter(q => q.status === 'Aceptada').length, fill: '#22c55e' },
      { name: 'Rechazada', value: quotes.filter(q => q.status === 'Rechazada').length, fill: '#ef4444' },
      { name: 'Enviada', value: quotes.filter(q => q.status === 'Enviada').length, fill: '#0ea5e9' },
    ];

    const clientMap = new Map<string, number>();
    filteredInvoices.forEach(inv => {
      if (inv.type === 'Invoice') {
        clientMap.set(inv.clientName, (clientMap.get(inv.clientName) || 0) + inv.total);
      }
    });
    const ltvData = Array.from(clientMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const netMargin = totalRevenue - totalExpenses;
    const marginPercent = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

    return { monthlyData, invoiceFunnelData, quoteFunnelData, ltvData, kpis: { totalRevenue, totalExpenses, netMargin, marginPercent } };
  }, [filteredInvoices]);

  const handleAnalyze = async () => {
    if (!hasAiAccess) return;
    setIsAnalyzing(true);
    try {
      const summary = `Ingresos: ${data.kpis.totalRevenue}, Gastos: ${data.kpis.totalExpenses}, Margen: ${data.kpis.marginPercent}%`;
      const result = await generateFinancialAnalysis(summary, apiKey);
      if (result) setAnalysis(result);
    } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
  };

  const handleDeepDive = async (chartId: string, title: string, chartData: any) => {
    // 1. Prepare visual state
    setDeepDiveVisual({ type: chartId, data: chartData, title });
    setDeepDiveReport(null);
    if (!hasAiAccess) return;
    
    // 2. Start separate IA query process
    setIsDeepDiving(true);
    try {
      // Clean data before stringification (especially remove Date objects which LLMs can't parse or bloat prompt)
      let sanitizedData = chartData;
      if (chartId === 'cashflow' && Array.isArray(chartData)) {
          sanitizedData = chartData.map(item => ({
              name: item.name,
              ingresos: item.ingresos,
              gastos: item.gastos
          }));
      }

      const report = await generateDeepDiveReport(title, JSON.stringify(sanitizedData), apiKey);
      if (report) setDeepDiveReport(report);
    } catch (e) { 
      console.error("Error en reporte individual IA:", e); 
    } finally { 
      setIsDeepDiving(false); 
    }
  };

  const handleExportPdf = async (ref: React.RefObject<HTMLDivElement>, title: string) => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#FFFFFF' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    
    const imgProps = pdf.getImageProperties(imgData);
    const contentWidth = pageWidth - (2 * margin);
    const contentHeight = (imgProps.height * contentWidth) / imgProps.width;
    
    const usableHeight = 250;
    const totalPages = Math.ceil(contentHeight / usableHeight);
    
    let position = margin;

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage();
      }
      
      // Header and Page number
      pdf.setFillColor(28, 41, 56); // Default dark theme color
      pdf.rect(0, 0, pageWidth, 4, 'F');
      
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`${title} - Página ${i + 1} de ${totalPages}`, pageWidth - margin, 10, { align: 'right' });

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      
      position -= usableHeight;
    }

    pdf.save(`${title}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
        <div>
           <h1 className="text-3xl font-bold text-[#1c2938]">Centro de Inteligencia</h1>
           <p className="text-slate-500 mt-1">Analítica y salud financiera de tu negocio.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
          {(['THIS_MONTH', 'LAST_QUARTER', 'THIS_YEAR'] as const).map(tr => (
            <button 
              key={tr} 
              onClick={() => setTimeRange(tr)} 
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${timeRange === tr ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
                {tr === 'THIS_MONTH' ? 'Mes Actual' : tr === 'LAST_QUARTER' ? 'Trimestre' : 'Año'}
            </button>
          ))}
        </div>
      </div>

      {/* CFO VIRTUAL HERO */}
      <div className="bg-[#1c2938] rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-96 h-96 bg-[#27bea5] rounded-full blur-[100px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
         {!analysis ? (
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
               <div className="max-w-xl">
                  <h2 className="text-3xl font-bold mb-4">CFO Virtual</h2>
                  <p className="text-slate-300 text-lg">Analiza tus tendencias, detecta riesgos y encuentra oportunidades con IA.</p>
               </div>
               <button 
                 onClick={handleAnalyze} 
                 disabled={isAnalyzing} 
                 className="bg-white text-[#1c2938] px-8 py-4 rounded-2xl font-bold hover:bg-[#27bea5] hover:text-white transition-all flex items-center gap-3 shadow-lg disabled:opacity-50"
               >
                   {isAnalyzing ? <Loader2 className="animate-spin" /> : <BrainCircuit />} Generar Análisis
               </button>
            </div>
         ) : (
            <div ref={analysisRef} className="relative z-10 animate-in fade-in space-y-6">
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3"><BrainCircuit className="text-[#27bea5]" size={32}/><h2 className="text-2xl font-bold">Diagnóstico Ejecutivo</h2></div>
                  <button onClick={() => setAnalysis(null)} className="p-2 text-slate-400 hover:text-white"><X/></button>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                    <p className="text-6xl font-bold text-[#27bea5]">{analysis.healthScore}</p>
                    <p className="font-bold text-lg mt-2">{analysis.healthStatus}</p>
                    <p className="text-xs text-slate-400 mt-1">{analysis.projection}</p>
                  </div>
                  <div className="lg:col-span-2">
                    <p className="text-xl text-slate-200 leading-relaxed font-light italic">"{analysis.diagnosis}"</p>
                    <button onClick={() => handleExportPdf(analysisRef, 'Reporte_CFO')} className="mt-6 flex items-center gap-2 text-sm font-bold text-[#27bea5] hover:underline">
                      <Download size={16}/> Descargar Reporte PDF
                    </button>
                  </div>
               </div>
            </div>
         )}
      </div>

      {/* TABS */}
      <div className="flex justify-center">
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto max-w-full">
           {(['OVERVIEW', 'DOCUMENTS', 'CLIENTS', 'FISCAL'] as const).map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)} 
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab ? 'bg-[#1c2938] text-white shadow-md' : 'text-slate-500 hover:text-[#1c2938]'}`}
              >
                  {tab === 'OVERVIEW' ? 'Finanzas' : tab === 'DOCUMENTS' ? 'Operatividad' : tab === 'CLIENTS' ? 'Clientes' : 'Reporte Fiscal'}
              </button>
           ))}
        </div>
      </div>

      {/* BENTO GRID CONTENT */}
      <div className="space-y-10">
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-8 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ingreso Neto</p>
                    <h3 className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{data.kpis.totalRevenue.toLocaleString()}</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Margen Real</p>
                    <h3 className={`text-2xl font-bold ${data.kpis.marginPercent > 0 ? 'text-[#27bea5]' : 'text-rose-500'}`}>{data.kpis.marginPercent.toFixed(1)}%</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Gastos</p>
                    <h3 className="text-2xl font-bold text-rose-500">-{currencySymbol}{data.kpis.totalExpenses.toLocaleString()}</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Utilidad</p>
                    <h3 className="text-2xl font-bold text-[#1c2938]">{currencySymbol}{data.kpis.netMargin.toLocaleString()}</h3>
                 </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-3"><Wallet className="text-[#27bea5]" /> Flujo de Caja Real</h3>
                        <button onClick={() => handleDeepDive('cashflow', 'Flujo de Caja', data.monthlyData)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-[#27bea5] transition-all"><FileText className="w-5 h-5" /></button>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={compactNumber}/><Tooltip/><Bar dataKey="ingresos" fill="#27bea5" radius={[4,4,0,0]}/><Bar dataKey="gastos" fill="#ef4444" radius={[4,4,0,0]}/></BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  {/* EMBUDO DE COTIZACIONES (Nuevo reporte basado en Pipeline) */}
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-[#1c2938] text-xl flex items-center gap-3"><Target className="text-purple-500" /> Embudo de Cotizaciones</h3>
                        <button onClick={() => handleDeepDive('quoteFunnel', 'Embudo de Ventas', data.quoteFunnelData)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-purple-500 transition-all"><FileText className="w-5 h-5" /></button>
                    </div>
                    <p className="text-slate-400 text-[10px] mb-6 uppercase tracking-widest font-bold">Pipeline Comercial Real</p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.quoteFunnelData} layout="vertical">
                          <XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 700}}/><Tooltip/>
                          <Bar dataKey="value" barSize={35} radius={[0,4,4,0]}>{data.quoteFunnelData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
              </div>
          </div>
        )}

        {activeTab === 'DOCUMENTS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-xl flex items-center gap-2 text-[#1c2938]"><Filter className="text-indigo-500"/> Embudo de Cobro (Facturas)</h3>
                      <button onClick={() => handleDeepDive('invoiceFunnel', 'Embudo de Cobro', data.invoiceFunnelData)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-500 transition-all"><FileText className="w-5 h-5" /></button>
                  </div>
                  <p className="text-slate-400 text-xs mb-6 uppercase tracking-widest font-bold text-center">Enviada → Seguimiento → Abonada → Pagada → Incobrable</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.invoiceFunnelData} layout="vertical">
                        <XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 700}}/><Tooltip/>
                        <Bar dataKey="value" barSize={30} radius={[0,6,6,0]}>{data.invoiceFunnelData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-50 shadow-sm">
                  <div className="flex justify-between items-start mb-6">
                      <h3 className="font-bold text-xl flex items-center gap-2 text-[#1c2938]"><Package className="text-blue-500"/> Mejores Productos</h3>
                      <button onClick={() => handleDeepDive('topProducts', 'Análisis de Productos', [])} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-500 transition-all"><FileText className="w-5 h-5" /></button>
                  </div>
                  <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                    <Package size={48} className="opacity-20 mb-4" />
                    <p className="font-medium">Análisis de inventario disponible</p>
                  </div>
              </div>
          </div>
        )}

        {activeTab === 'CLIENTS' && (
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-50 shadow-sm animate-in fade-in">
              <div className="flex justify-between items-start mb-10">
                  <h3 className="font-bold text-xl flex items-center gap-3"><Users className="text-amber-500" /> Valor de Vida del Cliente (LTV)</h3>
                  <button onClick={() => handleDeepDive('ltv', 'Analítica de Clientes', data.ltvData)} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-amber-500 transition-all"><FileText className="w-5 h-5" /></button>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ltvData.slice(0,10)}><XAxis dataKey="name" tick={{fontSize: 10}}/><YAxis tickFormatter={compactNumber}/><Tooltip/><Bar dataKey="revenue" fill="#f59e0b" radius={[6,6,0,0]} barSize={40}/></BarChart>
                </ResponsiveContainer>
              </div>
          </div>
        )}

        {activeTab === 'FISCAL' && (
            <div className="animate-in fade-in bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-50">
               <h3 className="font-bold text-xl text-[#1c2938] mb-6 flex items-center gap-2"><DownloadCloud className="text-[#27bea5]"/> Reporte Impositivo</h3>
               <p className="text-slate-500">Usa el botón de CFO Virtual para obtener un diagnóstico fiscal basado en tus facturas y gastos registrados este periodo.</p>
            </div>
        )}
      </div>

      {/* MODAL DE DEEP DIVE */}
      {deepDiveVisual && createPortal(
          <div className="fixed inset-0 z-[99] bg-[#1c2938]/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-12 shadow-2xl relative animate-in zoom-in-95">
                  <button onClick={() => setDeepDiveVisual(null)} className="absolute top-8 right-8 p-3 hover:bg-slate-100 rounded-full transition-colors"><X/></button>
                  <div className="flex items-center gap-3 mb-10">
                    <div className="p-3 bg-[#27bea5]/10 rounded-2xl text-[#27bea5]"><FileText size={32}/></div>
                    <div><h3 className="text-3xl font-bold text-[#1c2938]">{deepDiveVisual.title}</h3><p className="text-slate-400">Análisis Profundo con IA</p></div>
                  </div>
                  {isDeepDiving ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                      <Loader2 className="animate-spin text-[#27bea5]" size={48}/><p className="text-slate-400 font-medium">El Analista Virtual está revisando los datos...</p>
                    </div>
                  ) : deepDiveReport ? (
                    <div className="space-y-10">
                        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100"><p className="text-xl font-light text-slate-700 italic">"{deepDiveReport.executiveSummary}"</p></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{deepDiveReport.keyMetrics.map((m, i) => <div key={i} className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm"><p className="text-xs text-slate-400 font-bold uppercase mb-2">{m.label}</p><p className="text-2xl font-bold text-[#1c2938]">{m.value}</p></div>)}</div>
                        <div className="bg-[#1c2938] text-white p-10 rounded-[2.5rem] relative overflow-hidden shadow-xl"><div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-10"></div><div className="relative z-10"><h4 className="text-[#27bea5] font-bold mb-4 flex items-center gap-2 text-xl"><Lightbulb/> Recomendación Estratégica</h4><p className="text-lg text-slate-200 leading-relaxed">{deepDiveReport.recommendation}</p></div></div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-400">No se pudo generar el reporte. Verifica tu conexión o API Key.</div>
                  )}
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default ReportsDashboard;
