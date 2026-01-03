import React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface FreePlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const FreePlanModal: React.FC<FreePlanModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-50 p-6 text-center border-b border-slate-100">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                        <span className="text-3xl">🎁</span>
                    </div>
                    <h3 className="text-2xl font-bold text-[#1c2938]">Plan Freshie</h3>
                    <p className="text-slate-500 mt-1">Perfecto para empezar sin costes</p>
                </div>

                {/* Body */}
                <div className="p-8">
                    <div className="space-y-4 mb-8">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-[#1c2938]">Acceso a todas las herramientas</p>
                                <p className="text-sm text-slate-500">Facturación, CRM, Gastos e IA.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-[#1c2938]">Límite Mensual</p>
                                <p className="text-sm text-slate-500">
                                    Máximo <span className="font-bold text-amber-600">5 facturas</span> al mes. Ideal para bajo volumen.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-[#1c2938]">Sin compromiso</p>
                                <p className="text-sm text-slate-500">Actualiza a Premium cuando crezcas.</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={onConfirm}
                            className="w-full bg-[#1c2938] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#2c3e50] transition-colors flex items-center justify-center gap-2 group"
                        >
                            Confirmar y Empezar con Freshie
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-3 text-slate-500 font-medium hover:text-[#1c2938] transition-colors"
                        >
                            Volver y Suscribirme (Recomendado)
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>,
        document.body
    );
};
