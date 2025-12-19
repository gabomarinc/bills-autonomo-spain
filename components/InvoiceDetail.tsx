
import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Printer, Share2, Download, Building2, 
  CheckCircle2, Loader2, Send, MessageCircle, Smartphone, Mail, Check, AlertTriangle, Edit2, 
  ChevronDown, XCircle, Wallet, ArrowRight, X, Trash2, CreditCard, Clock, StickyNote, Lock, Link, FileText, Receipt
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Invoice, UserProfile, TimelineEvent, InvoiceStatus, PaymentPlan } from '../types';
import DocumentTimeline from './DocumentTimeline';
import { sendEmail, generateDocumentHtml, getEmailStatus } from '../services/resendService';
import { useAlert } from './AlertSystem';
import { convertToEur, SUPPORTED_CURRENCIES } from '../services/exchangeRateService';
import ConvertQuoteModal from './ConvertQuoteModal';

interface InvoiceDetailProps {
  invoice: Invoice;
  issuer: UserProfile;
  onBack: () => void;
  onEdit?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onUpdateStatus?: (id: string, status: InvoiceStatus) => void;
  onDelete?: (id: string) => void;
  onConvertQuote?: (quote: Invoice, invoiceData: {
    mode: 'SINGLE' | 'MULTIPLE';
    paymentPlan?: PaymentPlan;
    invoices?: Array<{ amount: number; dueDate: string }>;
  }) => void;
}

const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoice, issuer, onBack, onEdit, onUpdateInvoice, onUpdateStatus, onDelete, onConvertQuote }) => {
  const [isSending, setIsSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentCurrency, setPaymentCurrency] = useState(invoice.invoiceCurrency || invoice.currency || 'EUR');
  const [paymentExchangeRate, setPaymentExchangeRate] = useState<number | null>(null);
  const [paymentReceivedEur, setPaymentReceivedEur] = useState<number | null>(null);
  const [exchangeDifference, setExchangeDifference] = useState<number | null>(null);
  const [isCalculatingPayment, setIsCalculatingPayment] = useState(false);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'TARJETA' | 'BANCO' | 'EFECTIVO' | 'OTRO'>('BANCO');

  // Ref for PDF Generation
  const documentRef = useRef<HTMLDivElement>(null);
  
  const alert = useAlert(); // Custom Alert Hook

  // Poll for Resend Status Updates
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      if (!invoice.resendEmailId) return;
      
      const hasOpened = invoice.timeline?.some(e => e.type === 'OPENED');
      const hasClicked = invoice.timeline?.some(e => e.type === 'CLICKED');
      
      if (hasClicked) return; 

      const data = await getEmailStatus(invoice.resendEmailId);
      
      if (isMounted && data && data.last_event) {
          let newEvent: TimelineEvent | null = null;
          
          if (data.last_event === 'opened' && !hasOpened) {
               newEvent = {
                   id: Date.now().toString(),
                   type: 'OPENED',
                   title: 'Visto por el cliente',
                   description: 'El correo fue abierto.',
                   timestamp: new Date().toISOString()
               };
          } else if (data.last_event === 'clicked' && !hasClicked) {
               newEvent = {
                   id: Date.now().toString(),
                   type: 'CLICKED',
                   title: 'Clic en el documento',
                   description: 'El cliente hizo clic en el enlace.',
                   timestamp: new Date().toISOString()
               };
          }
          
          if (newEvent && onUpdateInvoice) {
              const updatedInvoice = {
                  ...invoice,
                  timeline: [...(invoice.timeline || []), newEvent]
              };
              onUpdateInvoice(updatedInvoice);
              alert.addToast('info', 'Actividad Detectada', newEvent.title);
          }
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 30000);

    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, [invoice.resendEmailId, invoice.timeline, onUpdateInvoice]);

  // Helper function to safely convert date to ISO string
  const dateToISOString = (dateValue: any): string => {
    if (!dateValue) return new Date().toISOString().split('T')[0];
    if (typeof dateValue === 'string') {
      return dateValue.split('T')[0]; // Si es string ISO, tomar solo la fecha
    }
    // Si es un objeto Date o cualquier otro objeto, intentar convertirlo
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      // Si falla, usar fecha actual como fallback
    }
    return new Date().toISOString().split('T')[0];
  };

  // Normalize paymentPlan to ensure all dates are strings
  const normalizePaymentPlan = (plan: any): PaymentPlan | undefined => {
    if (!plan || !plan.payments || !Array.isArray(plan.payments)) return undefined;
    
    return {
      totalPayments: plan.totalPayments || plan.payments.length,
      payments: plan.payments.map((p: any) => ({
        amount: typeof p.amount === 'number' ? p.amount : parseFloat(p.amount) || 0,
        dueDate: dateToISOString(p.dueDate), // Asegurar que siempre sea string
        paid: Boolean(p.paid),
        paidDate: p.paidDate ? dateToISOString(p.paidDate) : undefined,
        paymentId: p.paymentId || `payment_${Date.now()}_${Math.random()}`
      }))
    };
  };

  // Normalized payment plan
  const normalizedPaymentPlan = invoice.paymentPlan ? normalizePaymentPlan(invoice.paymentPlan) : undefined;

  // Reset payment modal state when it opens
  useEffect(() => {
    if (isPaymentModalOpen) {
      setPaymentCurrency(invoice.invoiceCurrency || invoice.currency || 'EUR');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentAmount('');
      setPaymentReceivedEur(null);
      setPaymentExchangeRate(null);
      setExchangeDifference(null);
      setPaymentMethod('BANCO');
      
      // Si hay plan de pagos, seleccionar el primer pago pendiente
      if (normalizedPaymentPlan && normalizedPaymentPlan.payments && normalizedPaymentPlan.payments.length > 0) {
        const firstUnpaidIndex = normalizedPaymentPlan.payments.findIndex(p => !p.paid);
        if (firstUnpaidIndex >= 0) {
          setSelectedPaymentIndex(firstUnpaidIndex);
          const selectedPayment = normalizedPaymentPlan.payments[firstUnpaidIndex];
          setPaymentAmount(selectedPayment.amount.toFixed(2));
          // dueDate ya está normalizado como string
          setPaymentDate(selectedPayment.dueDate);
        } else {
          setSelectedPaymentIndex(null);
        }
      } else {
        setSelectedPaymentIndex(null);
      }
    }
  }, [isPaymentModalOpen, invoice.invoiceCurrency, invoice.currency, normalizedPaymentPlan]);

  // --- CALCULATION LOGIC ---
  const subtotal = invoice.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountRate = invoice.discountRate || 0;
  const discountAmount = subtotal * (discountRate / 100);
  
  // Calculate Tax on the Discounted Base (Proportional)
  // Logic matches InvoiceWizard to ensure consistency
  const taxTotal = invoice.items.reduce((acc, item) => {
      const itemTotal = item.price * item.quantity;
      // Apply discount share to this item
      const itemTaxable = itemTotal * (1 - (discountRate / 100));
      return acc + (itemTaxable * (item.tax / 100));
  }, 0);

  const amountPaid = invoice.amountPaid || 0;
  // Para facturas en otra moneda, usar baseAmountEur y paymentReceivedEur para cálculos
  const invoiceTotal = invoice.baseAmountEur || invoice.total;
  const paidEur = invoice.paymentReceivedEur || (invoice.invoiceCurrency && invoice.invoiceCurrency.toUpperCase() !== 'EUR' ? 0 : amountPaid);
  const remainingBalance = Math.max(0, invoiceTotal - paidEur);
  
  const isQuote = invoice.type === 'Quote';
  const branding = issuer.branding || { primaryColor: '#27bea5', templateStyle: 'Modern' };
  const color = branding.primaryColor;
  const logo = branding.logoUrl;

  // --- PAYMENT HELPERS ---
  // TODO: Implementar Stripe/PayPal/Bizum cuando estén configurados
  const handleStripePayment = () => {
      // Implementar cuando Stripe esté configurado
      alert.addToast('info', 'Pago con Stripe', 'Funcionalidad de pago en desarrollo.');
  };

  const handlePayPalPayment = () => {
      // Implementar cuando PayPal esté configurado
      alert.addToast('info', 'Pago con PayPal', 'Funcionalidad de pago en desarrollo.');
  };

  const handleBizumPayment = () => {
      // Implementar cuando Bizum esté configurado
      alert.addToast('info', 'Pago con Bizum', 'Funcionalidad de pago en desarrollo.');
  };

  const handleStatusChange = (newStatus: InvoiceStatus) => {
      if (onUpdateStatus) {
          onUpdateStatus(invoice.id, newStatus);
          setShowStatusMenu(false);
      }
  };

  const handleDelete = async () => {
      if (!onDelete) return;
      
      const confirmed = await alert.confirm({
          title: '¿Eliminar Documento?',
          message: 'Esta acción es irreversible. El documento se borrará permanentemente.',
          confirmText: 'Eliminar',
          cancelText: 'Cancelar',
          type: 'danger'
      });

      if (confirmed) {
          onDelete(invoice.id);
      }
  };

  const handleRegisterPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    let updatedInvoice: Invoice = { ...invoice };
    let updatedPaymentPlan = normalizedPaymentPlan ? { ...normalizedPaymentPlan } : undefined;

    // Si hay plan de pagos y se seleccionó un pago específico
    if (updatedPaymentPlan && selectedPaymentIndex !== null && updatedPaymentPlan.payments[selectedPaymentIndex]) {
      const selectedPayment = updatedPaymentPlan.payments[selectedPaymentIndex];
      
      // Marcar el pago como pagado
      // Asegurar que paidDate sea un string
      const paidDateStr = dateToISOString(paymentDate);
      
      updatedPaymentPlan.payments[selectedPaymentIndex] = {
        ...selectedPayment,
        paid: true,
        paidDate: paidDateStr
      };
      
      updatedInvoice.paymentPlan = updatedPaymentPlan;
      
      // Calcular total pagado sumando todos los pagos marcados como pagados
      const totalPaid = updatedPaymentPlan.payments
        .filter(p => p.paid)
        .reduce((sum, p) => sum + p.amount, 0);
      
      updatedInvoice.amountPaid = totalPaid;
      
      // Verificar si todos los pagos están completos
      const allPaid = updatedPaymentPlan.payments.every(p => p.paid);
      updatedInvoice.status = allPaid ? 'Pagada' : 'Abonada';
      
      const paymentEvent: TimelineEvent = {
        id: Date.now().toString(),
        type: 'PAID',
        title: `Pago ${selectedPaymentIndex + 1} registrado: ${invoice.currency} ${amount.toFixed(2)}`,
        description: `Método: ${paymentMethod} | Fecha: ${new Date(paymentDate).toLocaleDateString()}`,
        timestamp: new Date().toISOString()
      };
      
      updatedInvoice.timeline = [...(invoice.timeline || []), paymentEvent];
    } else {
      // Pago normal sin plan de pagos
      const newTotalPaid = (invoice.amountPaid || 0) + amount;
      const newRemaining = invoice.total - newTotalPaid;
      
      updatedInvoice.amountPaid = newTotalPaid;
      updatedInvoice.status = newRemaining <= 0.01 ? 'Pagada' : 'Abonada';
      
      const paymentEvent: TimelineEvent = {
        id: Date.now().toString(),
        type: 'PAID',
        title: `Pago registrado: ${invoice.currency} ${amount.toFixed(2)}`,
        description: `Método: ${paymentMethod} | Resta: ${invoice.currency} ${Math.max(0, newRemaining).toFixed(2)}`,
        timestamp: new Date().toISOString()
      };
      
      updatedInvoice.timeline = [...(invoice.timeline || []), paymentEvent];
    }

    // Agregar información de pago multicurrency si aplica
    if (paymentReceivedEur !== null) {
      updatedInvoice.paymentReceivedEur = paymentReceivedEur;
      updatedInvoice.paymentReceivedOriginal = amount;
      updatedInvoice.paymentExchangeRate = paymentExchangeRate || undefined;
      updatedInvoice.paymentDate = paymentDate;
      if (exchangeDifference !== null) {
        updatedInvoice.exchangeDifference = exchangeDifference;
      }
    }

    if (onUpdateInvoice) {
        onUpdateInvoice(updatedInvoice);
    }
    
    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setSelectedPaymentIndex(null);
    alert.addToast('success', 'Pago Registrado', `Se ha registrado el pago de ${invoice.currency} ${amount.toFixed(2)}`);
  };

  const handleSend = async () => {
    if (!invoice.clientEmail) {
        alert.addToast('error', 'Falta Email', "El cliente no tiene un email registrado.");
        return;
    }

    setIsSending(true);

    try {
        if (!documentRef.current) throw new Error("No se pudo capturar el documento.");
        
        const canvas = await html2canvas(documentRef.current, {
            scale: 2,
            useCORS: true, 
            logging: false,
            backgroundColor: '#ffffff',
            ignoreElements: (element) => {
                // Ocultar elementos con clase 'print:hidden' o 'no-pdf'
                return element.classList.contains('no-pdf') || 
                       window.getComputedStyle(element).display === 'none' ||
                       element.closest('.no-pdf') !== null;
            }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        const htmlContent = generateDocumentHtml(invoice, issuer);
        const docTypeName = isQuote ? 'Cotización' : 'Factura';
        const emailSubject = `${docTypeName} #${invoice.id} - ${issuer.name}`;

        const result = await sendEmail({
            to: invoice.clientEmail,
            cc: issuer.email, // Carbon Copy to the User
            subject: emailSubject, 
            html: htmlContent, 
            senderName: issuer.legalName || issuer.name, 
            attachments: [{
                filename: `${docTypeName}_${invoice.id}.pdf`,
                content: pdfBase64
            }]
        });

        if (result.success) {
            if (result.id && onUpdateInvoice) {
                const sentEvent: TimelineEvent = {
                    id: Date.now().toString(),
                    type: 'SENT',
                    title: 'Enviado por Correo',
                    description: `Entregado a ${invoice.clientEmail} (ID: ${result.id.slice(0,8)}...)`,
                    timestamp: new Date().toISOString()
                };
                
                const updatedInvoice = {
                    ...invoice,
                    status: 'Enviada' as const, 
                    resendEmailId: result.id,
                    timeline: [...(invoice.timeline || []), sentEvent]
                };
                onUpdateInvoice(updatedInvoice);
            }
            setShowSuccessModal(true);
            alert.addToast('success', 'Correo Enviado', 'El documento ha sido enviado correctamente.');
        } else {
            const errorMsg = result.error || 'Error al enviar el correo.';
            if (errorMsg.includes('no está configurado')) {
                alert.addToast('info', 'Servicio no disponible', 'El servicio de emails no está configurado. Puedes descargar el PDF manualmente.');
            } else {
                throw new Error(errorMsg);
            }
        }
    } catch (error: any) {
        console.error("Error sending document:", error);
        alert.addToast('error', 'Error de Envío', error.message || 'No se pudo enviar el correo.');
    } finally {
        setIsSending(false);
    }
  };

  const handleDownloadPdf = async () => {
      if (!documentRef.current) return;
      
      const canvas = await html2canvas(documentRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${isQuote ? 'Cotizacion' : 'Factura'}_${invoice.id}.pdf`);
      alert.addToast('success', 'PDF Descargado');
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Pagada':
      case 'Aceptada': return 'bg-green-50 text-green-700 border-green-200';
      case 'Rechazada': 
      case 'Incobrable': return 'bg-red-50 text-red-700 border-red-200';
      case 'Negociacion': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Seguimiento': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Abonada': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Enviada': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'PendingSync': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200'; 
    }
  };

  const renderStatusOptions = () => {
      const options = isQuote 
        ? ['Negociacion', 'Aceptada', 'Rechazada', 'Enviada']
        : ['Enviada', 'Seguimiento', 'Abonada', 'Pagada', 'Incobrable'];
      
      return (
          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">
              {options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleStatusChange(opt as InvoiceStatus)}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-[#1c2938] transition-colors"
                  >
                      {opt}
                  </button>
              ))}
          </div>
      );
  };

  // --- RENDER PAYMENT BUTTONS ---
  const renderPaymentButtons = () => {
      // Usar remainingBalance en EUR para determinar si hay saldo pendiente
      if (isQuote || !remainingBalance || remainingBalance <= 0.01) return null;
      
      const paymentInt = issuer.paymentIntegration;
      if (!paymentInt?.enabled) return null;

      const hasStripe = paymentInt.provider === 'STRIPE' || paymentInt.provider === 'BOTH';
      const hasPayPal = paymentInt.provider === 'PAYPAL' || paymentInt.provider === 'BOTH';
      const hasBizum = paymentInt.provider === 'BIZUM' || paymentInt.provider === 'BOTH';

      if (!hasStripe && !hasPayPal && !hasBizum) return null;

      return (
          <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="font-bold text-[#1c2938] mb-3 text-sm uppercase tracking-wide">Pagar Online</p>
              <div className="flex flex-wrap gap-3">
                  {hasStripe && (
                      <button 
                        onClick={handleStripePayment}
                        className="flex-1 bg-[#635bff] text-white py-2.5 px-4 rounded-xl font-bold hover:bg-[#5548cc] transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                          <Lock className="w-4 h-4" /> Stripe
                      </button>
                  )}
                  {hasPayPal && (
                      <button 
                        onClick={handlePayPalPayment}
                        className="flex-1 bg-[#0070ba] text-white py-2.5 px-4 rounded-xl font-bold hover:bg-[#005ea6] transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                          <Lock className="w-4 h-4" /> PayPal
                      </button>
                  )}
                  {hasBizum && (
                      <button 
                        onClick={handleBizumPayment}
                        className="flex-1 bg-[#00d9ff] text-white py-2.5 px-4 rounded-xl font-bold hover:bg-[#00c4e6] transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                          <Smartphone className="w-4 h-4" /> Bizum
                      </button>
                  )}
              </div>
          </div>
      );
  };

  const renderModern = () => (
    <div className="bg-white shadow-xl rounded-none md:rounded-lg overflow-hidden min-h-[800px] flex flex-col relative print:shadow-none">
      <div className="h-4 w-full" style={{ backgroundColor: color }}></div>
      <div className="p-8 md:p-12 flex-1">
        <div className="flex justify-between items-start mb-12">
          <div>
              <div className="flex items-center gap-3 mb-4">
                {logo ? (
                   <img src={logo} alt="Logo" className="h-24 max-w-[250px] object-contain" />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <Building2 className="w-8 h-8" />
                  </div>
                )}
                {!logo && (
                  <div>
                    <h1 className="text-xl font-bold text-[#1c2938]">{issuer.name}</h1>
                    <p className="text-sm text-slate-500">{issuer.taxId}</p>
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-500 space-y-1">
                {/* Modified Header: Commercial Name then Legal Name */}
                {logo && (
                   <>
                     <p className="font-bold text-[#1c2938] text-lg leading-tight">{issuer.name}</p>
                     {issuer.legalName && <p className="text-xs font-medium text-slate-400 mb-2">{issuer.legalName}</p>}
                   </>
                )}
                <p>{issuer.address}</p>
                <p>{issuer.country}</p>
                <p className="text-xs mt-2">{issuer.fiscalRegime}</p>
              </div>
          </div>

          <div className="text-right">
            <h2 className="text-4xl font-bold text-slate-200 uppercase tracking-widest mb-2">
              {isQuote ? 'Cotización' : 'Factura'}
            </h2>
            <p className="font-mono text-xl font-semibold text-slate-700">#{invoice.id.toUpperCase()}</p>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-end gap-4">
                <span className="text-slate-400">Fecha:</span>
                <span className="font-medium text-slate-800">{new Date(invoice.date).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="mt-4 flex justify-end relative">
              <button 
                onClick={() => onUpdateStatus && setShowStatusMenu(!showStatusMenu)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold border uppercase tracking-wide flex items-center gap-1 ${getStatusStyle(invoice.status)} ${onUpdateStatus ? 'cursor-pointer hover:shadow-md' : ''}`}
                disabled={!onUpdateStatus}
              >
                {invoice.status === 'PendingSync' ? 'Offline' : invoice.status}
                {onUpdateStatus && <ChevronDown className="w-3 h-3" />}
              </button>
              {showStatusMenu && renderStatusOptions()}
            </div>
          </div>
        </div>

        <div className="mb-12 bg-slate-50 rounded-xl p-8 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cliente</p>
            <h3 className="text-2xl font-bold text-[#1c2938]">{invoice.clientName}</h3>
            {invoice.clientTaxId && <p className="text-slate-600 font-mono text-base mt-1">{invoice.clientTaxId}</p>}
            {invoice.clientEmail && <p className="text-slate-500 text-sm mt-1">{invoice.clientEmail}</p>}
        </div>

        <div className="mb-12">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Descripción</th>
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-20">Cant</th>
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right w-32">Precio</th>
                <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-5">
                    <p className="font-medium text-slate-800 text-lg">{item.description}</p>
                    {item.details && <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">{item.details}</p>}
                  </td>
                  <td className="py-5 text-center text-slate-600 align-top pt-6">{item.quantity}</td>
                  <td className="py-5 text-right text-slate-600 align-top pt-6">€{item.price.toFixed(2)}</td>
                  <td className="py-5 text-right font-bold text-[#1c2938] text-lg align-top pt-6">€{(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row gap-12">
            <div className="flex-1 space-y-6">
              {/* NOTES SECTION */}
              {invoice.notes && (
                  <div className="p-6 rounded-xl text-sm bg-slate-50 border border-slate-100">
                      <p className="font-bold mb-2 flex items-center gap-2 text-slate-700 uppercase tracking-wider text-xs">
                          <StickyNote className="w-4 h-4"/> Notas
                      </p>
                      <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
                  </div>
              )}

              {/* LEGAL MENTION */}
              {invoice.legalMention && (
                  <div className="p-6 rounded-xl text-sm bg-blue-50/50 border border-blue-100">
                      <p className="font-bold mb-2 flex items-center gap-2 text-blue-700 uppercase tracking-wider text-xs">
                          <FileText className="w-4 h-4"/> Mención Legal
                      </p>
                      <p className="text-blue-800 text-xs italic leading-relaxed">{invoice.legalMention}</p>
                  </div>
              )}

              {isQuote ? (
                <div style={{ backgroundColor: color + '15', color: color }} className="p-6 rounded-xl text-sm border border-transparent">
                  <p className="font-bold mb-2 flex items-center gap-2 text-lg"><CheckCircle2 className="w-5 h-5"/> Condiciones</p>
                  <p className="opacity-90 text-[#1c2938] leading-relaxed">Esta cotización incluye impuestos. Para aprobar, favor de firmar y enviar respuesta a este correo.</p>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-xl text-slate-700 text-sm">
                  <p className="font-bold mb-2 text-lg">Datos Bancarios</p>
                  <p className="font-bold text-[#1c2938]">{issuer.legalName || issuer.name}</p>
                  {issuer.bankName && <p className="font-medium text-slate-600">{issuer.bankName}</p>}
                  <p className="font-mono text-base mb-1">
                     <span className="text-xs font-bold text-slate-400 uppercase mr-1">{issuer.bankAccountType || 'Cuenta'}:</span> 
                     {issuer.bankAccount || 'No configurado'}
                  </p>
                  
                  {/* Payment Buttons (PagueloFacil / Yappy) */}
                  {renderPaymentButtons()}
                </div>
              )}
            </div>

            <div className="w-full md:w-80 space-y-4">
              <div className="flex justify-between text-slate-500 text-lg">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-lg">
                    <span className="text-slate-500">Descuento ({discountRate.toFixed(1)}%)</span>
                    <span className="text-green-600 font-medium">-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 text-lg">
                <span>IVA {invoice.items[0]?.tax ? `(${invoice.items[0].tax}%)` : ''}</span>
                <span>${(invoice.ivaAmount || taxTotal).toFixed(2)}</span>
              </div>
              {invoice.irpfAmount && invoice.irpfAmount > 0 && (
                <div className="flex justify-between text-slate-500 text-lg">
                  <span>Ret. IRPF ({invoice.irpfRetention}%)</span>
                  <span className="text-amber-600">-${invoice.irpfAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-6 border-t-2 border-slate-100 flex justify-between items-end">
                  <span className="font-bold text-[#1c2938] text-xl">Total</span>
                  <div className="text-center">
                    <span className="font-bold text-[#1c2938] text-4xl" style={{ color: color }}>
                      {(() => {
                        const currency = invoice.invoiceCurrency || invoice.currency;
                        const symbol = SUPPORTED_CURRENCIES.find(c => c.code === currency)?.symbol || '€';
                        return `${symbol} ${invoice.total.toFixed(2)}`;
                      })()}
                    </span>
                    {/* Información interna de conversión - NO visible en PDF para cliente */}
                    {invoice.baseAmountEur && invoice.invoiceCurrency && invoice.invoiceCurrency.toUpperCase() !== 'EUR' && (
                      <p className="text-sm text-slate-500 mt-1 no-pdf">
                        (€{invoice.baseAmountEur.toFixed(2)} para declaración)
                      </p>
                    )}
                  </div>
              </div>
              
              {!isQuote && (amountPaid > 0 || paidEur > 0) && (
                <div className="pt-4 mt-2 border-t border-slate-100">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-bold text-green-600">Pagado</span>
                        <div className="text-right">
                          {invoice.invoiceCurrency && invoice.invoiceCurrency.toUpperCase() !== 'EUR' && invoice.baseAmountEur ? (
                            <>
                              <span className="font-bold text-slate-600 block">
                                {invoice.invoiceCurrency} {amountPaid.toFixed(2)}
                              </span>
                              <span className="text-xs text-slate-500 no-pdf">
                                (€{paidEur.toFixed(2)} para declaración)
                              </span>
                            </>
                          ) : (
                            <span className="font-bold text-slate-600">
                              {invoice.currency} {amountPaid.toFixed(2)}
                            </span>
                          )}
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1">
                        <div 
                            className="bg-green-500 h-2.5 rounded-full" 
                            style={{ width: `${Math.min(100, (paidEur / invoiceTotal) * 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>{((paidEur / invoiceTotal) * 100).toFixed(0)}% Completado</span>
                        <span>
                          Resta: {(() => {
                            const currency = invoice.invoiceCurrency || invoice.currency;
                            const symbol = SUPPORTED_CURRENCIES.find(c => c.code === currency)?.symbol || '€';
                            return `${symbol} ${(invoice.total - amountPaid).toFixed(2)}`;
                          })()}
                          {invoice.baseAmountEur && (
                            <span className="block text-[10px] no-pdf">(€{remainingBalance.toFixed(2)} para declaración)</span>
                          )}
                        </span>
                    </div>
                    {invoice.exchangeDifference && invoice.exchangeDifference !== 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-amber-700">
                        <div className="flex justify-between font-medium">
                          <span>Diferencia de cambio:</span>
                          <span>€{invoice.exchangeDifference.toFixed(2)}</span>
                        </div>
                        <p className="text-[10px] text-amber-600 mt-1 italic">
                          Gasto financiero deducible
                        </p>
                      </div>
                    )}
                </div>
              )}
            </div>
        </div>
      </div>
      <div className="bg-slate-50 p-8 text-center border-t border-slate-100 mt-auto">
          <p className="text-slate-400 text-xs font-medium">Generado con Kônsul Bills</p>
      </div>
    </div>
  );

  const renderClassic = () => (
    <div className="bg-white shadow-xl min-h-[800px] flex flex-col relative print:shadow-none p-12 md:p-16 border-t-[12px]" style={{ borderColor: color }}>
       <div className="text-center border-b-4 border-slate-100 pb-8 mb-8">
          <h1 className="text-3xl font-serif font-bold text-slate-800 uppercase tracking-widest mb-1">{issuer.name}</h1>
          {issuer.legalName && <p className="text-slate-600 font-serif font-bold text-sm mb-1">{issuer.legalName}</p>}
          <p className="text-slate-500 font-serif italic text-sm">{issuer.address} • {issuer.country}</p>
       </div>

       <div className="flex justify-between items-start mb-12">
          <div className="border-l-4 pl-4" style={{ borderColor: color }}>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Facturado A</p>
             <h3 className="text-xl font-serif font-bold text-slate-800">{invoice.clientName}</h3>
             <p className="text-slate-600 text-sm mt-1">{invoice.clientTaxId}</p>
          </div>
          <div className="text-right">
             <h2 className="text-2xl font-serif font-bold text-slate-800">{isQuote ? 'COTIZACIÓN' : 'FACTURA'}</h2>
             <p className="text-slate-500 text-lg">#{invoice.id}</p>
             <p className="text-slate-400 text-sm mt-1">{new Date(invoice.date).toLocaleDateString()}</p>
          </div>
       </div>

       <table className="w-full text-left mb-12">
          <thead>
             <tr className="border-b-2 border-slate-800">
                <th className="py-3 font-serif font-bold text-slate-800 uppercase text-sm">Ítem</th>
                <th className="py-3 font-serif font-bold text-slate-800 uppercase text-sm text-right">Cant</th>
                <th className="py-3 font-serif font-bold text-slate-800 uppercase text-sm text-right">Precio</th>
                <th className="py-3 font-serif font-bold text-slate-800 uppercase text-sm text-right">Total</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
             {invoice.items.map((item, idx) => (
                <tr key={idx}>
                   <td className="py-4 font-serif text-slate-700">
                      <p>{item.description}</p>
                      {item.details && <p className="text-sm text-slate-500 mt-1 italic">{item.details}</p>}
                   </td>
                   <td className="py-4 font-serif text-slate-700 text-right align-top pt-4">{item.quantity}</td>
                   <td className="py-4 font-serif text-slate-700 text-right align-top pt-4">€{item.price.toFixed(2)}</td>
                   <td className="py-4 font-serif font-bold text-slate-800 text-right align-top pt-4">€{(item.quantity * item.price).toFixed(2)}</td>
                </tr>
             ))}
          </tbody>
       </table>

       <div className="flex justify-end mb-16">
          <div className="w-64 space-y-3">
             <div className="flex justify-between text-slate-600 font-serif text-sm">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
             </div>
             {discountAmount > 0 && (
                <div className="flex justify-between text-slate-600 font-serif text-sm">
                    <span>Descuento:</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                </div>
             )}
             <div className="flex justify-between text-slate-600 font-serif text-sm border-b border-slate-300 pb-2">
                <span>IVA {invoice.items[0]?.tax ? `(${invoice.items[0].tax}%)` : ''}:</span>
                <span>${(invoice.ivaAmount || taxTotal).toFixed(2)}</span>
             </div>
             {invoice.irpfAmount && invoice.irpfAmount > 0 && (
                <div className="flex justify-between text-slate-600 font-serif text-sm border-b border-slate-300 pb-2">
                   <span>Ret. IRPF ({invoice.irpfRetention}%):</span>
                   <span>-${invoice.irpfAmount.toFixed(2)}</span>
                </div>
             )}
             <div className="flex justify-between font-serif font-bold text-xl text-slate-900">
                <span>Total:</span>
                <span>{invoice.currency === 'EUR' ? '€' : invoice.currency} {invoice.total.toFixed(2)}</span>
             </div>
          </div>
       </div>

       {invoice.notes && (
           <div className="mb-8 p-4 border-t border-slate-200">
               <p className="font-serif font-bold text-sm text-slate-800 mb-1">Notas:</p>
               <p className="font-serif text-sm text-slate-600 italic">{invoice.notes}</p>
           </div>
       )}

       {/* LEGAL MENTION */}
       {invoice.legalMention && (
           <div className="mb-8 p-4 border-t border-slate-200 bg-blue-50/50 rounded-lg">
               <p className="font-serif font-bold text-xs text-slate-700 mb-1 uppercase tracking-wide">Mención Legal:</p>
               <p className="font-serif text-xs text-slate-600 italic leading-relaxed">{invoice.legalMention}</p>
           </div>
       )}

       {/* BANK INFO CLASSIC */}
       {!isQuote && (
           <div className="mb-8 p-4 border border-slate-200 rounded text-center">
               <p className="font-serif font-bold text-sm text-slate-800">Métodos de Pago</p>
               <p className="font-serif text-sm font-bold text-slate-900">{issuer.legalName || issuer.name}</p>
               <p className="font-serif text-sm text-slate-600">{issuer.bankName}</p>
               <p className="font-serif text-sm text-slate-600 font-bold">{issuer.bankAccountType}: {issuer.bankAccount}</p>
               {renderPaymentButtons()}
           </div>
       )}

       <div className="mt-auto text-center text-slate-400 text-xs font-serif italic border-t border-slate-100 pt-8">
          Gracias por su confianza. {issuer.name}
       </div>
    </div>
  );

  const renderMinimal = () => (
    <div className="bg-white shadow-xl min-h-[800px] flex flex-col relative print:shadow-none p-12 font-sans">
       <div className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-3">
             <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}></div>
             <div>
                <h1 className="font-bold text-slate-900 text-xl tracking-tight">{issuer.name}</h1>
                {issuer.legalName && <p className="text-xs text-slate-500">{issuer.legalName}</p>}
             </div>
          </div>
          <div className="text-right">
             <p className="text-sm font-bold text-slate-900">{isQuote ? 'Cotización' : 'Factura'} {invoice.id}</p>
             <p className="text-xs text-slate-400">{new Date(invoice.date).toLocaleDateString()}</p>
          </div>
       </div>

       <div className="mb-16">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Para</p>
          <h2 className="text-3xl font-light text-slate-900 mb-2">{invoice.clientName}</h2>
          <p className="text-sm text-slate-500">{invoice.clientTaxId}</p>
       </div>

       <div className="space-y-4 mb-16">
          {invoice.items.map((item, idx) => (
             <div key={idx} className="flex justify-between items-start py-4 border-b border-slate-50">
                <div>
                   <p className="font-medium text-slate-900 text-lg">{item.description}</p>
                   {item.details && <p className="text-sm text-slate-500 mt-1">{item.details}</p>}
                   <p className="text-xs text-slate-400 mt-1">{item.quantity} x €{item.price.toFixed(2)}</p>
                </div>
                <p className="font-bold text-slate-900 text-lg">€{(item.quantity * item.price).toFixed(2)}</p>
             </div>
          ))}
       </div>

       <div className="flex justify-end">
          <div className="text-right space-y-1">
             <div className="flex justify-end gap-8 text-sm text-slate-500">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
             </div>
             {discountAmount > 0 && (
                <div className="flex justify-end gap-8 text-sm text-slate-500">
                    <span>Descuento</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                </div>
             )}
             <div className="flex justify-end gap-8 text-sm text-slate-500 pb-4">
                <span>IVA {invoice.items[0]?.tax ? `(${invoice.items[0].tax}%)` : ''}</span>
                <span>${(invoice.ivaAmount || taxTotal).toFixed(2)}</span>
             </div>
             {invoice.irpfAmount && invoice.irpfAmount > 0 && (
                <div className="flex justify-end gap-8 text-sm text-slate-500 pb-4">
                   <span>Ret. IRPF ({invoice.irpfRetention}%)</span>
                   <span>-${invoice.irpfAmount.toFixed(2)}</span>
                </div>
             )}
             
             <p className="text-xs text-slate-400 uppercase tracking-widest mb-1 pt-4 border-t border-slate-100">Total a Pagar</p>
             <h2 className="text-5xl font-bold text-slate-900 tracking-tighter" style={{ color: color }}>
                {invoice.currency} {invoice.total.toLocaleString()}
             </h2>
          </div>
       </div>

       {invoice.notes && (
           <div className="mt-16 text-slate-500 text-sm">
               {invoice.notes}
           </div>
       )}

       {/* LEGAL MENTION */}
       {invoice.legalMention && (
           <div className="mt-8 pt-8 border-t border-slate-100">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mención Legal</p>
               <p className="text-xs text-slate-500 italic leading-relaxed">{invoice.legalMention}</p>
           </div>
       )}

       {/* BANK INFO MINIMAL */}
       {!isQuote && (
           <div className="mt-16 pt-8 border-t border-slate-100">
               <div className="flex flex-col md:flex-row justify-between items-end">
                   <div className="text-sm text-slate-500">
                       <p className="font-bold mb-1">Información de Pago</p>
                       <p className="font-medium text-slate-800">{issuer.legalName || issuer.name}</p>
                       <p>{issuer.bankName}</p>
                       <p><span className="font-bold uppercase text-xs">{issuer.bankAccountType}</span>: {issuer.bankAccount}</p>
                   </div>
                   <div className="mt-4 md:mt-0">
                       {renderPaymentButtons()}
                   </div>
               </div>
           </div>
       )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 animate-in fade-in pb-10">
      
      {/* LEFT: PREVIEW */}
      <div className="flex-1 flex flex-col h-full">
         <div className="flex justify-between items-center mb-4 px-2">
            <button onClick={onBack} className="flex items-center text-slate-500 hover:text-[#1c2938] transition-colors gap-2 text-sm font-bold">
               <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <div className="flex gap-2">
               {invoice.timeline && invoice.timeline.length > 0 && (
                  <span className="text-xs text-slate-400 flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm">
                     <Clock className="w-3 h-3" /> Actualizado: {new Date(invoice.timeline[invoice.timeline.length - 1].timestamp).toLocaleTimeString()}
                  </span>
               )}
            </div>
         </div>

         {/* INCREASED PADDING BOTTOM TO pb-32 FOR BETTER SCROLLING */}
         <div className="flex-1 bg-slate-100 rounded-3xl p-4 md:p-8 overflow-y-auto custom-scrollbar shadow-inner border border-slate-200/50 pb-32">
            <div ref={documentRef} className="max-w-[800px] mx-auto transition-all duration-500 min-h-full">
               {branding.templateStyle === 'Classic' ? renderClassic() : 
                branding.templateStyle === 'Minimal' ? renderMinimal() : 
                renderModern()}
            </div>
         </div>
      </div>

      {/* Convert Quote Modal */}
      {showConvertModal && onConvertQuote && (
        <ConvertQuoteModal
          quote={invoice}
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          onConvert={(invoiceData) => {
            onConvertQuote(invoice, invoiceData);
            setShowConvertModal(false);
          }}
        />
      )}

      {/* RIGHT: CONTROLS */}
      <div className="w-full md:w-[350px] flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
         
         {/* STATUS CARD */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
               <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusStyle(invoice.status)}`}>
                  {invoice.status}
               </span>
               {invoice.type === 'Quote' && (
                  <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                     {invoice.successProbability ? `${invoice.successProbability}% Éxito` : 'IA Pendiente'}
                  </span>
               )}
            </div>
            
            <h3 className="font-bold text-[#1c2938] text-2xl mb-1">{invoice.clientName}</h3>
            <p className="text-sm text-slate-500 mb-2">{invoice.type === 'Quote' ? 'Cotización' : 'Factura'} #{invoice.id}</p>
            
            {/* Show parent quote relationship */}
            {invoice.parentQuoteId && (
              <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">
                  <Link className="w-3 h-3 inline mr-1" />
                  Convertida desde Cotización #{invoice.parentQuoteId}
                </p>
              </div>
            )}
            
            {/* Show payment plan info */}
            {normalizedPaymentPlan && normalizedPaymentPlan.payments && normalizedPaymentPlan.payments.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-wide">Plan de Pagos</p>
                <div className="space-y-1">
                  {normalizedPaymentPlan.payments.map((payment, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-amber-700">
                        Pago {idx + 1}: {(() => {
                          try {
                            // dueDate ya está normalizado como string
                            return new Date(payment.dueDate).toLocaleDateString();
                          } catch (e) {
                            return 'Fecha inválida';
                          }
                        })()}
                      </span>
                      <span className={`font-bold ${payment.paid ? 'text-green-600' : 'text-amber-800'}`}>
                        {payment.paid ? '✓' : '○'} {invoice.currency} {payment.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Show parent invoice relationship (for split invoices) */}
            {invoice.parentInvoiceId && (
              <div className="mb-4 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-xs text-purple-700 font-medium">
                  <Receipt className="w-3 h-3 inline mr-1" />
                  Parte de factura dividida (Padre: #{invoice.parentInvoiceId})
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
               <button 
                 onClick={handleSend}
                 disabled={isSending || !invoice.clientEmail}
                 className="col-span-2 bg-[#1c2938] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#27bea5] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed group"
               >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  {isSending ? 'Enviando...' : 'Enviar Email'}
               </button>
               
               {/* PDF and Edit buttons side by side */}
               <button 
                 onClick={handleDownloadPdf}
                 className="bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
               >
                  <Download className="w-4 h-4" /> PDF
               </button>
               
               {onEdit && (
                  <button 
                    onClick={() => onEdit(invoice)}
                    className="bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                  >
                      <Edit2 className="w-4 h-4" /> Editar
                  </button>
               )}
               
               {/* Convert Quote Button - Only show for accepted quotes */}
               {invoice.type === 'Quote' && invoice.status === 'Aceptada' && onConvertQuote && (
                  <button 
                    onClick={() => setShowConvertModal(true)}
                    className="col-span-2 bg-[#27bea5] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#22a892] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <FileText className="w-5 h-5" />
                    Convertir a Factura
                  </button>
               )}
            </div>

            {/* ACTION FOR INVOICES: REGISTER PAYMENT */}
            {!isQuote && (
                <button 
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="w-full mt-3 bg-green-50 text-green-700 border border-green-100 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
                >
                    <CreditCard className="w-4 h-4" /> Registrar Cobro
                </button>
            )}

            {/* DELETE BUTTON */}
            {onDelete && (
                <button 
                    onClick={handleDelete}
                    className="w-full mt-3 text-red-400 hover:text-red-600 py-2 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                >
                    <Trash2 className="w-3 h-3" /> Eliminar Documento
                </button>
            )}
         </div>

         {/* TIMELINE */}
         <div className="flex-1 min-h-[300px]">
            <DocumentTimeline 
               events={invoice.timeline} 
               type={invoice.type} 
               successProbability={invoice.successProbability} 
            />
         </div>
      </div>

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#1c2938]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 relative my-8 max-h-[90vh] overflow-y-auto">
                <button 
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>
                
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Wallet className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-[#1c2938]">Registrar Pago</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Saldo pendiente: {(() => {
                        try {
                          const currency = invoice.invoiceCurrency || invoice.currency || 'EUR';
                          const symbol = SUPPORTED_CURRENCIES.find(c => c.code === currency)?.symbol || '€';
                          const balance = remainingBalance || 0;
                          return `${symbol} ${balance.toFixed(2)}`;
                        } catch (e) {
                          return '€0.00';
                        }
                      })()}
                      {invoice.baseAmountEur && (
                        <span className="block mt-1 text-xs print:hidden">(€{invoice.baseAmountEur.toFixed(2)} para declaración)</span>
                      )}
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Selector de pago del plan si existe */}
                    {normalizedPaymentPlan && normalizedPaymentPlan.payments && normalizedPaymentPlan.payments.length > 0 && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <label className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-2 block">
                          Seleccionar Pago del Plan
                        </label>
                        <div className="space-y-2">
                          {normalizedPaymentPlan.payments.map((payment, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSelectedPaymentIndex(idx);
                                setPaymentAmount(payment.amount.toFixed(2));
                                // dueDate ya está normalizado como string
                                setPaymentDate(payment.dueDate);
                              }}
                              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                                selectedPaymentIndex === idx
                                  ? 'border-amber-500 bg-amber-100'
                                  : payment.paid
                                  ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                                  : 'border-amber-200 bg-white hover:border-amber-300'
                              }`}
                              disabled={payment.paid}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-bold text-sm text-amber-900">
                                    Pago {idx + 1} {payment.paid && '(Pagado ✓)'}
                                  </span>
                                  <p className="text-xs text-amber-700 mt-1">
                                    Vence: {(() => {
                                      try {
                                        if (!payment.dueDate) return 'Fecha no definida';
                                        // dueDate ya está normalizado como string
                                        return new Date(payment.dueDate).toLocaleDateString();
                                      } catch (e) {
                                        return 'Fecha inválida';
                                      }
                                    })()}
                                  </p>
                                </div>
                                <span className="font-bold text-amber-900">
                                  {invoice.currency} {payment.amount.toFixed(2)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-amber-600 mt-2 italic">
                          O puedes registrar un pago parcial manualmente
                        </p>
                      </div>
                    )}

                    {/* Método de pago */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                          Método de Pago
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['BANCO', 'TARJETA', 'EFECTIVO', 'OTRO'] as const).map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setPaymentMethod(method)}
                              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                                paymentMethod === method
                                  ? 'border-green-500 bg-green-50 text-green-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              {method === 'TARJETA' && '💳 '}
                              {method === 'BANCO' && '🏦 '}
                              {method === 'EFECTIVO' && '💵 '}
                              {method === 'OTRO' && '📝 '}
                              {method}
                            </button>
                          ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Monto Recibido</label>
                        <div className="relative">
                            <span className="absolute left-4 top-4 text-slate-400 font-bold">
                              {SUPPORTED_CURRENCIES.find(c => c.code === paymentCurrency)?.symbol || '€'}
                            </span>
                            <input 
                                type="number" 
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="w-full pl-10 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-bold text-[#1c2938] outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                                placeholder="0.00"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Selector de moneda del pago */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Moneda del Pago</label>
                        <select 
                            value={paymentCurrency}
                            onChange={(e) => {
                              setPaymentCurrency(e.target.value);
                              setPaymentReceivedEur(null);
                              setPaymentExchangeRate(null);
                              setExchangeDifference(null);
                            }}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-green-500 text-sm"
                        >
                            {SUPPORTED_CURRENCIES.map(curr => (
                                <option key={curr.code} value={curr.code}>
                                    {curr.code} - {curr.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Fecha del pago */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Fecha de Recepción</label>
                        <input 
                            type="date" 
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-green-500 text-sm"
                        />
                    </div>

                    {/* Mostrar conversión a EUR si es necesario */}
                    {paymentAmount && parseFloat(paymentAmount) > 0 && paymentCurrency.toUpperCase() !== 'EUR' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        {isCalculatingPayment ? (
                          <div className="flex items-center gap-2 text-blue-700 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Calculando conversión...
                          </div>
                        ) : paymentReceivedEur ? (
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-blue-800">
                              <span className="font-medium">Equivalente en EUR:</span>
                              <span className="font-bold">€{paymentReceivedEur.toFixed(2)}</span>
                            </div>
                            {paymentExchangeRate && (
                              <div className="text-blue-600">
                                Tipo de cambio: 1 {paymentCurrency} = {paymentExchangeRate.toFixed(4)} EUR
                              </div>
                            )}
                            {invoice.baseAmountEur && exchangeDifference !== null && (
                              <div className={`mt-2 pt-2 border-t border-blue-200 ${exchangeDifference !== 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                                <div className="flex justify-between font-medium">
                                  <span>Diferencia de cambio:</span>
                                  <span>€{exchangeDifference.toFixed(2)}</span>
                                </div>
                                {exchangeDifference !== 0 && (
                                  <p className="text-[10px] mt-1 italic">
                                    Esta diferencia se registrará como gasto financiero deducible
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              setIsCalculatingPayment(true);
                              try {
                                const converted = await convertToEur(parseFloat(paymentAmount), paymentCurrency, paymentDate);
                                setPaymentReceivedEur(converted.amountEur);
                                setPaymentExchangeRate(converted.rate?.rateToEur || null);
                                
                                if (invoice.baseAmountEur) {
                                  setExchangeDifference(invoice.baseAmountEur - converted.amountEur);
                                }
                              } catch (error) {
                                alert.addToast('error', 'Error', 'No se pudo calcular la conversión. Verifica tu conexión.');
                              } finally {
                                setIsCalculatingPayment(false);
                              }
                            }}
                            className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                          >
                            Calcular Conversión a EUR
                          </button>
                        )}
                      </div>
                    )}

                    {/* Mostrar info si la factura es en otra moneda - NO visible en PDF para cliente */}
                    {invoice.invoiceCurrency && invoice.invoiceCurrency.toUpperCase() !== 'EUR' && invoice.baseAmountEur && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 no-pdf">
                        <p className="font-medium mb-1">⚠️ Factura en {invoice.invoiceCurrency}</p>
                        <p>Facturado: {invoice.invoiceCurrency} {invoice.total.toFixed(2)}</p>
                        <p>Para declaración: €{invoice.baseAmountEur.toFixed(2)}</p>
                        {invoice.exchangeRateBce && (
                          <p className="text-amber-600 mt-1">
                            Tipo de cambio usado: {invoice.exchangeRateBce.toFixed(4)} (fecha: {invoice.exchangeRateDate})
                          </p>
                        )}
                      </div>
                    )}
                    
                    <button 
                        onClick={handleRegisterPayment}
                        disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || isCalculatingPayment}
                        className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
                    >
                        {isCalculatingPayment ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Calculando...
                          </>
                        ) : (
                          'Confirmar Pago'
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-[#1c2938]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-[#1c2938] mb-2">¡Enviado!</h3>
              <p className="text-slate-500 mb-6">El documento está en camino a {invoice.clientEmail}</p>
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3 bg-[#1c2938] text-white rounded-xl font-bold hover:bg-[#27bea5] transition-colors"
              >
                 Entendido
              </button>
           </div>
        </div>
      )}

    </div>
  );
};

export default InvoiceDetail;
