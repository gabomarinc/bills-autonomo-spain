
import React, { useState, useEffect } from 'react';
import { X, Loader2, CreditCard, Landmark, Coins, FileText, AlertTriangle } from 'lucide-react';
import { Invoice, UserProfile, PaymentPlan, PaymentPlanItem, TimelineEvent } from '../types';
import { convertToEur, SUPPORTED_CURRENCIES } from '../services/exchangeRateService';
import { useAlert } from './AlertSystem';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  issuer: UserProfile;
  onConfirm: (updatedInvoice: Invoice) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, invoice, issuer, onConfirm }) => {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentCurrency, setPaymentCurrency] = useState(invoice.invoiceCurrency || invoice.currency || 'EUR');
  const [paymentMethod, setPaymentMethod] = useState<'TARJETA' | 'BANCO' | 'EFECTIVO' | 'OTRO'>('BANCO');
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [paymentReceivedEur, setPaymentReceivedEur] = useState<number | null>(null);
  const [paymentExchangeRate, setPaymentExchangeRate] = useState<number | null>(null);
  const [exchangeDifference, setExchangeDifference] = useState<number | null>(null);

  const alert = useAlert();

  // Helper function to safely convert date to ISO string
  const dateToISOString = (dateValue: any): string => {
    if (!dateValue) return new Date().toISOString().split('T')[0];
    if (typeof dateValue === 'string') {
      return dateValue.split('T')[0];
    }
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {}
    return new Date().toISOString().split('T')[0];
  };

  // Normalize paymentPlan to ensure all dates are strings and data is valid
  const normalizedPayments = React.useMemo(() => {
    if (!invoice.paymentPlan || !Array.isArray(invoice.paymentPlan.payments)) return [];
    return invoice.paymentPlan.payments.map((p, idx) => ({
      ...p,
      amount: typeof p.amount === 'number' ? p.amount : parseFloat(p.amount as any) || 0,
      dueDate: dateToISOString(p.dueDate),
      id: p.paymentId || `p-${idx}-${Date.now()}`
    }));
  }, [invoice.paymentPlan]);

  // Initial state setup
  useEffect(() => {
    if (isOpen) {
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentCurrency(invoice.invoiceCurrency || invoice.currency || 'EUR');
      setPaymentMethod('BANCO');
      setPaymentReceivedEur(null);
      setPaymentExchangeRate(null);
      setExchangeDifference(null);

      // Default to first unpaid payment if plan exists
      if (normalizedPayments.length > 0) {
        const firstUnpaid = normalizedPayments.findIndex(p => !p.paid);
        if (firstUnpaid !== -1) {
          setSelectedPaymentIndex(firstUnpaid);
          setPaymentAmount(normalizedPayments[firstUnpaid].amount.toString());
          setPaymentDate(normalizedPayments[firstUnpaid].dueDate);
        }
      }
    }
  }, [isOpen, invoice, normalizedPayments]);

  const handleCalculateConversion = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsCalculating(true);
    try {
      const converted = await convertToEur(amount, paymentCurrency, paymentDate);
      setPaymentReceivedEur(converted.amountEur);
      setPaymentExchangeRate(converted.rate?.rateToEur || null);
      
      if (invoice.baseAmountEur) {
        setExchangeDifference(invoice.baseAmountEur - converted.amountEur);
      }
    } catch (error) {
      alert.addToast('error', 'Error', 'No se pudo calcular la conversión.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleConfirm = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert.addToast('error', 'Error', 'Por favor ingresa un monto válido.');
      return;
    }

    const updatedInvoice: Invoice = { ...invoice };
    const now = new Date().toISOString();

    if (selectedPaymentIndex !== null && updatedInvoice.paymentPlan) {
      // Use logic for payment plan
      const updatedPayments = [...normalizedPayments];
      updatedPayments[selectedPaymentIndex] = {
        ...updatedPayments[selectedPaymentIndex],
        paid: true,
        paidDate: paymentDate
      };

      updatedInvoice.paymentPlan = {
        ...updatedInvoice.paymentPlan,
        payments: updatedPayments
      };

      const totalPaid = updatedPayments
        .filter(p => p.paid)
        .reduce((sum, p) => sum + p.amount, 0);
      
      updatedInvoice.amountPaid = totalPaid;
      const allPaid = updatedPayments.every(p => p.paid);
      updatedInvoice.status = allPaid ? 'Pagada' : 'Abonada';

      const event: TimelineEvent = {
        id: Date.now().toString(),
        type: 'PAID',
        title: `Pago cuota ${selectedPaymentIndex + 1} registrado`,
        description: `${paymentCurrency} ${amount.toFixed(2)} via ${paymentMethod}`,
        timestamp: now
      };
      updatedInvoice.timeline = [...(invoice.timeline || []), event];
    } else {
      // Normal payment logic
      const newTotalPaid = (invoice.amountPaid || 0) + amount;
      updatedInvoice.amountPaid = newTotalPaid;
      updatedInvoice.status = newTotalPaid >= invoice.total - 0.01 ? 'Pagada' : 'Abonada';

      const event: TimelineEvent = {
        id: Date.now().toString(),
        type: 'PAID',
        title: `Pago registrado: ${paymentCurrency} ${amount.toFixed(2)}`,
        description: `Método: ${paymentMethod}`,
        timestamp: now
      };
      updatedInvoice.timeline = [...(invoice.timeline || []), event];
    }

    // Multicurrency updates
    if (paymentReceivedEur !== null) {
      updatedInvoice.paymentReceivedEur = (invoice.paymentReceivedEur || 0) + paymentReceivedEur;
      updatedInvoice.paymentReceivedOriginal = amount;
      updatedInvoice.paymentExchangeRate = paymentExchangeRate || undefined;
      updatedInvoice.paymentDate = paymentDate;
      if (exchangeDifference !== null) {
        updatedInvoice.exchangeDifference = (invoice.exchangeDifference || 0) + exchangeDifference;
      }
    }

    onConfirm(updatedInvoice);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 overflow-hidden">
        {/* Header decoration */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500"></div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#1c2938]">Registrar Cobro</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Factura #{invoice.id}</p>
          </div>
        </div>
        
        <div className="space-y-5">
          {/* Payment Plan Selector */}
          {normalizedPayments.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-3 block">
                Seleccionar Cuota del Plan
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {normalizedPayments.map((payment, idx) => (
                  <button
                    key={payment.id}
                    type="button"
                    onClick={() => {
                      if (!payment.paid) {
                        setSelectedPaymentIndex(idx);
                        setPaymentAmount(payment.amount.toString());
                        setPaymentDate(payment.dueDate);
                      }
                    }}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all flex justify-between items-center ${
                      selectedPaymentIndex === idx
                        ? 'border-amber-500 bg-white shadow-md'
                        : payment.paid
                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                        : 'border-white bg-white/50 hover:bg-white'
                    }`}
                    disabled={payment.paid}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-amber-900">Cuota {idx + 1}</span>
                      <span className="text-[10px] text-amber-600">{new Date(payment.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-sm text-amber-900">{invoice.currency} {payment.amount.toFixed(2)}</span>
                      {payment.paid && <span className="block text-[9px] text-green-600 font-bold uppercase">Pagado</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Método de Pago</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'BANCO', icon: Landmark, label: 'Banco' },
                { id: 'TARJETA', icon: CreditCard, label: 'Tarjeta' },
                { id: 'EFECTIVO', icon: Coins, label: 'Efectivo' },
                { id: 'OTRO', icon: FileText, label: 'Otro' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 ${
                    paymentMethod === m.id
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-slate-50 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-white'
                  }`}
                >
                  <m.icon className="w-5 h-5" />
                  <span className="text-[10px] font-bold">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Monto Recibido</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">
                  {SUPPORTED_CURRENCIES.find(c => c.code === paymentCurrency)?.symbol || '€'}
                </span>
                <input 
                  type="number" 
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(e.target.value);
                    setPaymentReceivedEur(null);
                  }}
                  className="w-full pl-10 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-bold text-[#1c2938] outline-none focus:bg-white focus:border-green-500 transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Date */}
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Fecha</label>
              <input 
                type="date" 
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-green-500 transition-all"
              />
            </div>

            {/* Currency */}
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Moneda</label>
              <select 
                value={paymentCurrency}
                onChange={(e) => {
                  setPaymentCurrency(e.target.value);
                  setPaymentReceivedEur(null);
                }}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-green-500 transition-all"
              >
                {SUPPORTED_CURRENCIES.map(curr => (
                  <option key={curr.code} value={curr.code}>{curr.code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Multicurrency Analysis */}
          {paymentAmount && parseFloat(paymentAmount) > 0 && paymentCurrency !== 'EUR' && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
              {isCalculating ? (
                <div className="flex items-center gap-2 text-blue-600 text-xs font-bold justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> CALCULANDO CONVERSIÓN...
                </div>
              ) : paymentReceivedEur ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Equivalente EUR</span>
                    <span className="text-sm font-bold text-blue-700">€{paymentReceivedEur.toFixed(2)}</span>
                  </div>
                  {exchangeDifference !== null && (
                    <div className="flex justify-between items-center pt-2 border-t border-blue-100">
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Diferencia Cambio</span>
                      <span className={`text-xs font-bold ${exchangeDifference >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {exchangeDifference >= 0 ? '+' : '-'} €{Math.abs(exchangeDifference).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCalculateConversion}
                  className="w-full py-2 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all shadow-md"
                >
                  Calcular Conversión
                </button>
              )}
            </div>
          )}

          {/* Confirm Button */}
          <button 
            onClick={handleConfirm}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || isCalculating}
            className="w-full py-4 bg-[#1c2938] text-white rounded-2xl font-bold text-lg hover:bg-[#27bea5] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:-translate-y-1 active:translate-y-0"
          >
            Confirmar Registro
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
