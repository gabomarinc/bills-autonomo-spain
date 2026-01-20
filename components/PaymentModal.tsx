
import React, { useState, useEffect } from 'react';
import { X, Loader2, CreditCard, Landmark, Coins, FileText, AlertTriangle, Edit2 } from 'lucide-react';
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
  const [bankFee, setBankFee] = useState('');
  const [paymentExchangeRate, setPaymentExchangeRate] = useState<number | null>(null);
  const [exchangeDifference, setExchangeDifference] = useState<number | null>(null);
  const [isManualEur, setIsManualEur] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');

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
    } catch (e) { }
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
      setBankFee('');
      setIsManualEur(false);
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
      setIsManualEur(false);
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
        totalPayments: updatedInvoice.paymentPlan.totalPayments as number,
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
      updatedInvoice.status = newTotalPaid >= (invoice.total - 0.01) ? 'Pagada' : 'Abonada';

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
      updatedInvoice.exchangeDifference = (invoice.exchangeDifference || 0) + (exchangeDifference || 0);
    }
    if (bankFee) {
      updatedInvoice.bankFee = (invoice.bankFee || 0) + parseFloat(bankFee);
    }

    onConfirm(updatedInvoice);
    onClose();
  };

  const handleRevertPayment = async () => {
    if (selectedPaymentIndex === null || !invoice.paymentPlan) return;

    const confirmed = await alert.confirm({
      title: '¿Anular Cobro?',
      message: `¿Estás seguro de que deseas anular el cobro de la Cuota ${selectedPaymentIndex + 1}? Esto actualizará el balance de la factura.`,
      confirmText: 'Anular Cobro',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!confirmed) return;

    const updatedInvoice: Invoice = { ...invoice };
    const updatedPayments = [...normalizedPayments];
    const amountToSubtract = updatedPayments[selectedPaymentIndex].amount;

    updatedPayments[selectedPaymentIndex] = {
      ...updatedPayments[selectedPaymentIndex],
      paid: false,
      paidDate: undefined
    };

    updatedInvoice.paymentPlan = {
      totalPayments: (invoice.paymentPlan as PaymentPlan).totalPayments,
      payments: updatedPayments
    };

    const totalPaid = updatedPayments
      .filter(p => p.paid)
      .reduce((sum, p) => sum + p.amount, 0);

    updatedInvoice.amountPaid = totalPaid;

    // Update status
    if (totalPaid <= 0) {
      updatedInvoice.status = 'Enviada';
    } else {
      updatedInvoice.status = 'Abonada';
    }

    // Timeline event
    const event: TimelineEvent = {
      id: Date.now().toString(),
      type: 'EDITED',
      title: `Pago cuota ${selectedPaymentIndex + 1} anulado`,
      description: `Se ha revertido el cobro de ${currencySymbol}${amountToSubtract.toFixed(2)}`,
      timestamp: new Date().toISOString()
    };
    updatedInvoice.timeline = [...(invoice.timeline || []), event];

    onConfirm(updatedInvoice);
    onClose();
    alert.addToast('info', 'Cobro Anulado', `El cobro de la cuota ${selectedPaymentIndex + 1} ha sido revertido.`);
  };

  const handleUpdateDueDate = () => {
    if (selectedPaymentIndex === null || !invoice.paymentPlan || !editDueDate) return;

    const updatedInvoice: Invoice = { ...invoice };
    const updatedPayments = [...normalizedPayments];

    updatedPayments[selectedPaymentIndex] = {
      ...updatedPayments[selectedPaymentIndex],
      dueDate: editDueDate
    };

    updatedInvoice.paymentPlan = {
      totalPayments: (invoice.paymentPlan as PaymentPlan).totalPayments,
      payments: updatedPayments
    };

    const event: TimelineEvent = {
      id: Date.now().toString(),
      type: 'EDITED',
      title: `Vencimiento cuota ${selectedPaymentIndex + 1} modificado`,
      description: `Nueva fecha: ${new Date(editDueDate).toLocaleDateString()}`,
      timestamp: new Date().toISOString()
    };
    updatedInvoice.timeline = [...(invoice.timeline || []), event];

    onConfirm(updatedInvoice);
    setIsEditingDate(false);
    alert.addToast('success', 'Fecha Actualizada', 'El vencimiento ha sido modificado correctamente.');
  };

  const currencySymbol = SUPPORTED_CURRENCIES.find(c => c.code === (invoice.invoiceCurrency || invoice.currency || 'EUR'))?.symbol || '€';

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
                      setSelectedPaymentIndex(idx);
                      // Reset states
                      setIsEditingDate(false);
                      if (payment.paid) {
                        setPaymentAmount('');
                      } else {
                        setPaymentAmount(payment.amount.toString());
                        setPaymentDate(payment.dueDate);
                      }
                    }}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all flex justify-between items-center ${selectedPaymentIndex === idx
                      ? payment.paid ? 'border-red-400 bg-red-50 shadow-sm' : 'border-amber-500 bg-white shadow-md'
                      : payment.paid
                        ? 'border-green-100 bg-green-50/50'
                        : 'border-white bg-white/50 hover:bg-white'
                      }`}
                  >
                    <div className="flex flex-col">
                      <span className={`font-bold text-xs ${payment.paid ? 'text-green-800' : 'text-amber-900'}`}>Cuota {idx + 1}</span>
                      <span className="text-[10px] text-slate-500 text-amber-600">{new Date(payment.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold text-sm ${payment.paid ? 'text-green-700' : 'text-amber-900'}`}>{invoice.currency} {payment.amount.toFixed(2)}</span>
                      {payment.paid && <span className="block text-[9px] text-green-600 font-bold uppercase">Pagado</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Edit/Undo Actions for multi-payment */}
          {selectedPaymentIndex !== null && normalizedPayments[selectedPaymentIndex] && (
            <div className="space-y-3">
              {normalizedPayments[selectedPaymentIndex].paid ? (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-3">Esta cuota está pagada</p>
                  <button
                    onClick={handleRevertPayment}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm"
                  >
                    <AlertTriangle className="w-4 h-4" /> Anular Cobro de esta Cuota
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  {isEditingDate ? (
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Cambiar Vencimiento</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm"
                        />
                        <button
                          onClick={handleUpdateDueDate}
                          className="bg-amber-500 text-white px-4 rounded-lg text-xs font-bold"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setIsEditingDate(false)}
                          className="bg-slate-200 text-slate-600 px-3 rounded-lg text-xs font-medium"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsEditingDate(true);
                        setEditDueDate(normalizedPayments[selectedPaymentIndex].dueDate);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-amber-100 text-amber-700 rounded-xl text-xs font-bold hover:border-amber-300 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar fecha de vencimiento
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Payment Method - Only for unpaid */}
          {!(selectedPaymentIndex !== null && normalizedPayments[selectedPaymentIndex]?.paid) && (
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
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 ${paymentMethod === m.id
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
          )}

          {/* Amount - Only for unpaid */}
          {!(selectedPaymentIndex !== null && normalizedPayments[selectedPaymentIndex]?.paid) && (
            <div className="grid grid-cols-2 gap-4">
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Fecha Cobro</label>
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
          )}

          {/* Multicurrency Analysis */}
          {paymentAmount && parseFloat(paymentAmount) > 0 && paymentCurrency !== 'EUR' && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-4">
              {/* Actual EUR Received Input */}
              <div>
                <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block mb-1">
                  Euros Reales en Banco (Neto)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={paymentReceivedEur !== null ? paymentReceivedEur : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPaymentReceivedEur(isNaN(val) ? null : val);
                      setIsManualEur(true);
                      // Auto-recalc difference
                      if (invoice.baseAmountEur && !isNaN(val)) {
                        const fee = parseFloat(bankFee) || 0;
                        setExchangeDifference(invoice.baseAmountEur - (val + fee)); // Difference = InvoiceEUR - (ReceiveEUR + Fee)
                      }
                    }}
                    placeholder="Ej: 4350.00"
                    className="w-full p-2 text-sm border rounded-lg active:ring-2 ring-blue-500 outline-none"
                  />
                  {!isManualEur && (
                    <button onClick={handleCalculateConversion} className="bg-blue-200 text-blue-700 px-3 rounded-lg text-xs font-bold whitespace-nowrap">
                      {isCalculating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Auto'}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-blue-400 mt-1">Si es diferente al cálculo automático, edítalo aquí.</p>
              </div>

              {/* Bank Fee Input */}
              <div>
                <label className="text-[10px] font-bold text-red-400 uppercase tracking-widest block mb-1">
                  Comisión / Fee Bancario (€)
                </label>
                <input
                  type="number"
                  value={bankFee}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBankFee(val);
                    // Auto-recalc difference if manual EUR is set
                    if (invoice.baseAmountEur && paymentReceivedEur) {
                      const fee = parseFloat(val) || 0;
                      setExchangeDifference(invoice.baseAmountEur - (paymentReceivedEur + fee));
                    }
                  }}
                  placeholder="Ej: 50.00"
                  className="w-full p-2 text-sm border-red-200 border rounded-lg text-red-600 outline-none focus:ring-2 ring-red-200"
                />
              </div>

              {/* Result Summary */}
              {paymentReceivedEur !== null && exchangeDifference !== null && (
                <div className="bg-white p-3 rounded-xl border border-blue-100">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Diferencia de Cambio</span>
                    <span className={`text-xs font-bold ${exchangeDifference >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {exchangeDifference >= 0 ? 'Pérdida/Gasto: ' : 'Ganancia: '}
                      €{Math.abs(exchangeDifference).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirm Button - Only for unpaid */}
          {!(selectedPaymentIndex !== null && normalizedPayments[selectedPaymentIndex]?.paid) && (
            <button
              onClick={handleConfirm}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || isCalculating}
              className="w-full py-4 bg-[#1c2938] text-white rounded-2xl font-bold text-lg hover:bg-[#27bea5] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:-translate-y-1 active:translate-y-0"
            >
              Confirmar Registro
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
