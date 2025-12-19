import React, { useState } from 'react';
import { X, FileText, Receipt, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { Invoice, PaymentPlan } from '../types';

interface ConvertQuoteModalProps {
  quote: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onConvert: (invoiceData: {
    mode: 'SINGLE' | 'MULTIPLE';
    paymentPlan?: PaymentPlan;
    invoices?: Array<{ amount: number; dueDate: string }>;
  }) => void;
}

const ConvertQuoteModal: React.FC<ConvertQuoteModalProps> = ({ quote, isOpen, onClose, onConvert }) => {
  const [mode, setMode] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE');
  const [numPayments, setNumPayments] = useState(2);
  const [numInvoices, setNumInvoices] = useState(2);
  const [paymentDates, setPaymentDates] = useState<string[]>([]);
  const [invoiceDates, setInvoiceDates] = useState<string[]>([]);

  if (!isOpen) return null;

  const total = quote.total;
  const currency = quote.invoiceCurrency || quote.currency || 'EUR';
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;

  // Initialize dates when mode or count changes
  React.useEffect(() => {
    if (mode === 'SINGLE') {
      const dates: string[] = [];
      const today = new Date();
      for (let i = 0; i < numPayments; i++) {
        const date = new Date(today);
        date.setMonth(today.getMonth() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
      setPaymentDates(dates);
    } else {
      const dates: string[] = [];
      const today = new Date();
      for (let i = 0; i < numInvoices; i++) {
        const date = new Date(today);
        date.setMonth(today.getMonth() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
      setInvoiceDates(dates);
    }
  }, [mode, numPayments, numInvoices]);

  const handleConvert = () => {
    if (mode === 'SINGLE') {
      const paymentAmount = total / numPayments;
      const paymentPlan: PaymentPlan = {
        totalPayments: numPayments,
        payments: paymentDates.map((date, idx) => ({
          amount: paymentAmount,
          dueDate: date,
          paid: false,
          paymentId: `payment_${Date.now()}_${idx}`
        }))
      };
      onConvert({ mode: 'SINGLE', paymentPlan });
    } else {
      const invoiceAmount = total / numInvoices;
      const invoices = invoiceDates.map((date, idx) => ({
        amount: invoiceAmount,
        dueDate: date
      }));
      onConvert({ mode: 'MULTIPLE', invoices });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#1c2938]">Convertir Cotización a Factura</h2>
            <p className="text-sm text-slate-500 mt-1">Cotización #{quote.id} - {symbol}{total.toFixed(2)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Mode Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
              ¿Cómo quieres facturar este pedido?
            </label>
            
            {/* Option 1: Single Invoice with Payment Plan */}
            <div
              onClick={() => setMode('SINGLE')}
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                mode === 'SINGLE'
                  ? 'border-[#27bea5] bg-[#27bea5]/5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${mode === 'SINGLE' ? 'bg-[#27bea5]' : 'bg-slate-100'}`}>
                  <FileText className={`w-6 h-6 ${mode === 'SINGLE' ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg text-[#1c2938]">Una factura con plan de pagos</h3>
                    {mode === 'SINGLE' && <CheckCircle2 className="w-5 h-5 text-[#27bea5]" />}
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Crea una sola factura y registra los pagos cuando los recibas. Ideal para clientes que quieren un solo documento.
                  </p>
                  
                  {mode === 'SINGLE' && (
                    <div className="space-y-3 mt-4 p-4 bg-white rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-slate-700 w-32">Número de pagos:</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={numPayments}
                          onChange={(e) => setNumPayments(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#27bea5] focus:border-transparent"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Fechas de vencimiento:</label>
                        {paymentDates.map((date, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-sm text-slate-500 w-24">Pago {idx + 1}:</span>
                            <input
                              type="date"
                              value={date}
                              onChange={(e) => {
                                const newDates = [...paymentDates];
                                newDates[idx] = e.target.value;
                                setPaymentDates(newDates);
                              }}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#27bea5] focus:border-transparent"
                            />
                            <span className="text-sm font-medium text-slate-700 w-20 text-right">
                              {symbol}{(total / numPayments).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Option 2: Multiple Invoices */}
            <div
              onClick={() => setMode('MULTIPLE')}
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                mode === 'MULTIPLE'
                  ? 'border-[#27bea5] bg-[#27bea5]/5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${mode === 'MULTIPLE' ? 'bg-[#27bea5]' : 'bg-slate-100'}`}>
                  <Receipt className={`w-6 h-6 ${mode === 'MULTIPLE' ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg text-[#1c2938]">Dividir en múltiples facturas</h3>
                    {mode === 'MULTIPLE' && <CheckCircle2 className="w-5 h-5 text-[#27bea5]" />}
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Crea facturas separadas, cada una con su propio número y fecha. Ideal para clientes que necesitan facturas independientes.
                  </p>
                  
                  {mode === 'MULTIPLE' && (
                    <div className="space-y-3 mt-4 p-4 bg-white rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-slate-700 w-32">Número de facturas:</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={numInvoices}
                          onChange={(e) => setNumInvoices(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#27bea5] focus:border-transparent"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Fechas de emisión:</label>
                        {invoiceDates.map((date, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-sm text-slate-500 w-24">Factura {idx + 1}:</span>
                            <input
                              type="date"
                              value={date}
                              onChange={(e) => {
                                const newDates = [...invoiceDates];
                                newDates[idx] = e.target.value;
                                setInvoiceDates(newDates);
                              }}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#27bea5] focus:border-transparent"
                            />
                            <span className="text-sm font-medium text-slate-700 w-20 text-right">
                              {symbol}{(total / numInvoices).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleConvert}
            className="px-6 py-2 bg-[#27bea5] text-white rounded-lg hover:bg-[#22a892] transition-colors font-bold flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Convertir a Factura{mode === 'MULTIPLE' ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConvertQuoteModal;
