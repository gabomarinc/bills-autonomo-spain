import React from 'react';
import { X, ArrowRight, TrendingUp, DollarSign, Calculator, ChevronRight, FileBadge } from 'lucide-react';
import { Invoice } from '../types';

interface PipelineDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    pipelineQuotes: Invoice[];
    totalPipelineAmount: number; // In EUR
}

const PipelineDetailModal: React.FC<PipelineDetailModalProps> = ({ isOpen, onClose, pipelineQuotes, totalPipelineAmount }) => {
    if (!isOpen) return null;

    // Calculate currency breakdown
    const usdQuotes = pipelineQuotes.filter(q => q.currency === 'USD' || q.invoiceCurrency === 'USD');
    const eurQuotes = pipelineQuotes.filter(q => !q.currency || q.currency === 'EUR' || q.invoiceCurrency === 'EUR');

    const totalUsdOriginal = usdQuotes.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const totalUsdInEur = usdQuotes.reduce((acc, curr) => acc + (curr.baseAmountEur || curr.total), 0); // Fallback to total if baseAmountEur missing

    // Calculate average exchange rate if there are USD quotes
    const avgExchangeRate = totalUsdOriginal > 0 ? (totalUsdInEur / totalUsdOriginal) : 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-[#1c2938] text-white px-8 py-6 flex items-start justify-between relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-20 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="relative z-10">
                        <h2 className="text-2xl font-black tracking-tight mb-1">Pipeline Detallado</h2>
                        <p className="text-slate-400 font-medium text-sm">Desglose de todas las cotizaciones activas</p>

                        <div className="mt-6 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-[#27bea5]">€{totalPipelineAmount.toLocaleString()}</span>
                            <span className="text-slate-400 font-bold">Total Estimado</span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors relative z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar">

                    {/* Currency Conversion Card */}
                    {usdQuotes.length > 0 && (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8 relative overflow-hidden">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                    <Calculator className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-[#1c2938]">Conversión de Divisas</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                                {/* USD Side */}
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Total en Dólares</p>
                                    <p className="text-2xl font-black text-[#1c2938]">${totalUsdOriginal.toLocaleString()}</p>
                                    <p className="text-xs text-slate-400 mt-1">{usdQuotes.length} cotizaciones</p>
                                </div>

                                {/* Arrow */}
                                <div className="flex flex-col items-center justify-center">
                                    <div className="w-full h-px bg-slate-200 relative mb-2">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-50 px-2 text-slate-400">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                    {avgExchangeRate > 0 && (
                                        <span className="text-xs font-bold text-slate-500 bg-slate-200/50 px-2 py-1 rounded-md">
                                            1 USD ≈ €{avgExchangeRate.toFixed(4)}
                                        </span>
                                    )}
                                </div>

                                {/* EUR Side */}
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Valor en Euros (Base)</p>
                                    <p className="text-2xl font-black text-[#27bea5]">€{totalUsdInEur.toLocaleString()}</p>
                                    <p className="text-xs text-slate-400 mt-1">Calculado s/ tasa oficial</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quote List */}
                    <div>
                        <h3 className="font-bold text-[#1c2938] mb-4 flex items-center gap-2">
                            <FileBadge className="w-5 h-5 text-[#27bea5]" />
                            Listado de Cotizaciones
                        </h3>

                        <div className="space-y-3">
                            {pipelineQuotes.map((quote) => (
                                <div key={quote.id} className="group bg-white border border-slate-100 rounded-xl p-4 hover:border-[#27bea5] hover:shadow-md transition-all duration-200 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-[#f0fdf9] text-[#27bea5] flex items-center justify-center font-bold text-xs ring-4 ring-[#f0fdf9] group-hover:bg-[#27bea5] group-hover:text-white transition-colors">
                                            {quote.clientName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[#1c2938] text-sm group-hover:text-[#27bea5] transition-colors">{quote.clientName}</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>#{quote.id.slice(0, 6).toUpperCase()}</span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span>{new Date(quote.date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="flex flex-col items-end">
                                            {/* Main Amount */}
                                            <span className="font-bold text-[#1c2938]">
                                                {quote.invoiceCurrency === 'USD' ? '$' : '€'}{quote.total.toLocaleString()}
                                            </span>

                                            {/* Converted Amount (if USD) */}
                                            {quote.invoiceCurrency === 'USD' && (
                                                <span className="text-xs font-bold text-[#27bea5] mt-0.5">
                                                    ≈ €{(quote.baseAmountEur || quote.total).toLocaleString()}
                                                </span>
                                            )}

                                            {/* Status Badge */}
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide mt-1 
                                        ${quote.status === 'Creada' ? 'bg-slate-100 text-slate-500' :
                                                    quote.status === 'Enviada' ? 'bg-sky-50 text-sky-600' :
                                                        quote.status === 'Negociacion' ? 'bg-purple-50 text-purple-600' :
                                                            'bg-blue-50 text-blue-600'}`}>
                                                {quote.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {pipelineQuotes.length === 0 && (
                                <div className="text-center py-10 opacity-50">
                                    <p>No hay cotizaciones activas en este momento.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
                    >
                        Cerrar
                    </button>
                </div>

            </div>
        </div>
    );
};

export default PipelineDetailModal;
