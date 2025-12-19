
import React, { useState, useEffect } from 'react';
import { 
  Mic, Send, Sparkles, Check, ArrowLeft, Edit2, Loader2, 
  FileText, FileBadge, Calendar, User, Search, Plus, Trash2, 
  ShoppingBag, Calculator, ChevronDown, Building2, Eye,
  Coins, Lock, AlertTriangle, Settings, Save, Archive, Percent, DollarSign, BrainCircuit, Scissors, X, Globe
} from 'lucide-react';
import { Invoice, ParsedInvoiceData, UserProfile, InvoiceItem, InvoiceStatus, CatalogItem } from '../types';
import { parseInvoiceRequest, getDiscountRecommendation, AI_ERROR_BLOCKED } from '../services/geminiService';
import { getLegalMentionByIvaArticle } from '../data/activitySectors';
import { getExchangeRateForInvoiceDate, convertToEur, SUPPORTED_CURRENCIES } from '../services/exchangeRateService';

interface InvoiceWizardProps {
  currentUser: UserProfile;
  isOffline: boolean;
  onSave: (invoice: Invoice) => Promise<void>; 
  onCancel: () => void;
  onViewDetail?: () => void;
  onSelectInvoiceForDetail?: (invoice: Invoice) => void; 
  initialData?: Invoice | null; 
  dbClients?: any[]; 
  invoices: Invoice[]; 
  catalogItems?: CatalogItem[]; // NEW Prop
}

type Step = 'TYPE_SELECT' | 'AI_INPUT' | 'SMART_EDITOR' | 'SUCCESS';

const InvoiceWizard: React.FC<InvoiceWizardProps> = ({ 
  currentUser, 
  isOffline, 
  onSave, 
  onCancel, 
  onViewDetail, 
  onSelectInvoiceForDetail, 
  initialData, 
  dbClients = [], 
  invoices = [],
  catalogItems // New Prop usage
}) => {
  const isTemplateMode = initialData && !initialData.id;
  const isEditMode = initialData && !!initialData.id;

  // Prioritize passed items, fallback to user profile legacy array
  const availableServices = catalogItems || currentUser.defaultServices || [];

  const [step, setStep] = useState<Step>(initialData ? 'SMART_EDITOR' : 'TYPE_SELECT');
  const [docType, setDocType] = useState<'Invoice' | 'Quote'>(initialData?.type as 'Invoice' | 'Quote' || 'Invoice');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  const [aiError, setAiError] = useState<string | null>(null);
  
  const [clientSearch, setClientSearch] = useState(initialData?.clientName || '');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  
  // IVA State
  const [ivaType, setIvaType] = useState<'GENERAL' | 'REDUCIDO' | 'SUPERREDUCIDO' | 'EXENTO'>('GENERAL');
  const [applyIva, setApplyIva] = useState(true);

  // IRPF Retention State
  const [irpfRetention, setIrpfRetention] = useState<number>(15); // 15% por defecto, 7% primeros 2 años, 0% exentos
  const [showIrpfRetention, setShowIrpfRetention] = useState(false);
  const [irpfAmount, setIrpfAmount] = useState(0);

  // Discount State
  const [discountType, setDiscountType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountValue, setDiscountValue] = useState(initialData?.discountRate || 0);

  const [aiRecommendation, setAiRecommendation] = useState<{rate: number, text: string} | null>(null);
  const [isGettingRec, setIsGettingRec] = useState(false);

  const [draft, setDraft] = useState<{
    clientName: string;
    clientTaxId: string;
    clientEmail?: string;
    clientCountry?: string;
    operationType?: 'NACIONAL' | 'EXPORTACION' | 'INTRACOMUNITARIA';
    legalMention?: string;
    items: InvoiceItem[];
    currency: string;
    invoiceCurrency?: string; // Moneda de facturación (puede ser diferente de currency para compatibilidad)
    notes: string;
    validityDate: string; 
  }>({
    clientName: initialData?.clientName || '',
    clientTaxId: initialData?.clientTaxId || '',
    clientEmail: initialData?.clientEmail || '',
    clientCountry: initialData?.clientCountry || 'España',
    operationType: initialData?.operationType || 'NACIONAL',
    legalMention: initialData?.legalMention,
    items: initialData?.items || [],
    currency: initialData?.currency || currentUser.defaultCurrency || 'EUR',
    invoiceCurrency: initialData?.invoiceCurrency || initialData?.currency || currentUser.defaultCurrency || 'EUR',
    notes: initialData?.notes || '', 
    validityDate: initialData ? new Date(initialData.date).toISOString().split('T')[0] : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  // Multicurrency state
  const [exchangeRate, setExchangeRate] = useState<{ rate: number; date: string; source: string } | null>(null);
  const [baseAmountEur, setBaseAmountEur] = useState<number | null>(null);
  const [isLoadingExchangeRate, setIsLoadingExchangeRate] = useState(false);

  const [generatedId, setGeneratedId] = useState(initialData?.id || '');
  const [finalInvoiceObj, setFinalInvoiceObj] = useState<Invoice | null>(null); 
  const [savedStatus, setSavedStatus] = useState<InvoiceStatus>('Creada');

  // Check AI Access
  const hasAiAccess = !!currentUser.apiKeys?.gemini || !!currentUser.apiKeys?.openai;

  // Get IVA rate from type
  const getIvaRate = (type: 'GENERAL' | 'REDUCIDO' | 'SUPERREDUCIDO' | 'EXENTO'): number => {
    switch(type) {
      case 'GENERAL': return 21;
      case 'REDUCIDO': return 10;
      case 'SUPERREDUCIDO': return 4;
      case 'EXENTO': return 0;
      default: return 21;
    }
  };

  // Lista de países de la UE
  const EU_COUNTRIES = [
    'Alemania', 'Austria', 'Bélgica', 'Bulgaria', 'Chipre', 'Croacia', 'Dinamarca',
    'Eslovaquia', 'Eslovenia', 'España', 'Estonia', 'Finlandia', 'Francia', 'Grecia',
    'Hungría', 'Irlanda', 'Italia', 'Letonia', 'Lituania', 'Luxemburgo', 'Malta',
    'Países Bajos', 'Polonia', 'Portugal', 'República Checa', 'Rumanía', 'Suecia'
  ];

  // Generar mención legal según tipo de operación y actividad del usuario
  const getLegalMention = (operationType: 'NACIONAL' | 'EXPORTACION' | 'INTRACOMUNITARIA'): string => {
    // Obtener el artículo de IVA del perfil del usuario según su actividad
    const userIvaArticle = currentUser.fiscalConfig?.ivaArticle || 'ART_69_70';
    
    // Usar la función helper que considera tanto el artículo como el tipo de operación
    return getLegalMentionByIvaArticle(userIvaArticle, operationType);
  };

  // Detectar tipo de operación basado en el país
  const detectOperationType = (country: string): 'NACIONAL' | 'EXPORTACION' | 'INTRACOMUNITARIA' => {
    if (country === 'España') return 'NACIONAL';
    if (EU_COUNTRIES.includes(country)) return 'INTRACOMUNITARIA';
    return 'EXPORTACION';
  };

  // Efecto para actualizar tipo de operación y IVA cuando cambia el país
  useEffect(() => {
    if (draft.clientCountry) {
      const detectedType = detectOperationType(draft.clientCountry);
      const legalMention = getLegalMention(detectedType);
      
      setDraft(prev => ({
        ...prev,
        operationType: detectedType,
        legalMention: legalMention || undefined
      }));

      // Si es exportación o intracomunitaria, aplicar 0% IVA automáticamente
      if (detectedType === 'EXPORTACION' || detectedType === 'INTRACOMUNITARIA') {
        setApplyIva(false);
        setIvaType('EXENTO');
        setDraft(prev => ({
          ...prev,
          items: prev.items.map(item => ({ 
            ...item, 
            tax: 0,
            taxType: 'EXENTO'
          }))
        }));
      }
    }
  }, [draft.clientCountry]);

  // Efecto para calcular conversión a EUR cuando cambia la moneda o el total
  useEffect(() => {
    const calculateExchangeRate = async () => {
      const invoiceCurrency = draft.invoiceCurrency || draft.currency;
      
      console.log('calculateExchangeRate triggered:', {
        invoiceCurrency,
        itemsCount: draft.items.length,
        items: draft.items
      });
      
      // Si es EUR, no hay conversión
      if (invoiceCurrency.toUpperCase() === 'EUR') {
        setExchangeRate(null);
        setBaseAmountEur(null);
        return;
      }

      // Calcular total actual
      const subtotal = draft.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      // Calcular descuento según tipo (porcentaje o monto fijo)
      let discount = 0;
      if (discountType === 'PERCENT') {
        discount = subtotal * (discountValue / 100);
      } else {
        discount = discountValue;
      }
      const totalBeforeTax = subtotal - discount;
      const taxAmount = applyIva ? totalBeforeTax * (getIvaRate(ivaType) / 100) : 0;
      const total = totalBeforeTax + taxAmount;
      
      console.log('Total calculation:', {
        subtotal,
        discount,
        totalBeforeTax,
        taxAmount,
        total,
        applyIva,
        ivaType
      });

      if (total <= 0) {
        setExchangeRate(null);
        setBaseAmountEur(null);
        return;
      }

      setIsLoadingExchangeRate(true);
      try {
        // Usar fecha de factura o fecha actual
        const invoiceDate = draft.validityDate || new Date().toISOString().split('T')[0];
        const rateData = await getExchangeRateForInvoiceDate(invoiceCurrency, invoiceDate);
        
        if (rateData) {
          const converted = await convertToEur(total, invoiceCurrency, invoiceDate);
          
          // Asegurar que rateDate sea siempre un string (ya viene como string de la interfaz)
          const rateDateString = rateData.rateDate || new Date().toISOString().split('T')[0];
          
          setExchangeRate({
            rate: rateData.rateToEur,
            date: rateDateString,
            source: rateData.source || 'BCE'
          });
          
          // Debug: verificar que la conversión se está aplicando
          console.log('Currency conversion:', {
            originalTotal: total,
            currency: invoiceCurrency,
            rate: rateData.rateToEur,
            convertedEur: converted.amountEur
          });
          
          setBaseAmountEur(converted.amountEur);
        } else {
          console.warn('No rate data available for currency:', invoiceCurrency);
          setExchangeRate(null);
          setBaseAmountEur(null);
        }
      } catch (error) {
        console.error('Error calculating exchange rate:', error);
        setExchangeRate(null);
        setBaseAmountEur(null);
      } finally {
        setIsLoadingExchangeRate(false);
      }
    };

    calculateExchangeRate();
  }, [draft.invoiceCurrency, draft.currency, draft.items, draft.validityDate, discountValue, discountType, applyIva, ivaType]);

  // Sync IVA/IRPF & discount visibility with existing items on load
  useEffect(() => {
    if (initialData?.items && initialData.items.length > 0) {
      const firstItem = initialData.items[0];
      const hasIva = firstItem.tax > 0;
      setApplyIva(hasIva);
      // Determinar tipo de IVA según el porcentaje
      if (firstItem.tax === 21) setIvaType('GENERAL');
      else if (firstItem.tax === 10) setIvaType('REDUCIDO');
      else if (firstItem.tax === 4) setIvaType('SUPERREDUCIDO');
      else if (firstItem.tax === 0) setIvaType('EXENTO');
    }
    if (initialData?.discountRate && initialData.discountRate > 0) {
      setDiscountValue(initialData.discountRate);
      setShowDiscountInput(true);
    }
    if (initialData?.irpfRetention && initialData.irpfRetention > 0) {
      setIrpfRetention(initialData.irpfRetention);
      setShowIrpfRetention(true);
    }
  }, [initialData]);

  // Handle IVA Toggle Change
  const handleIvaToggle = (enabled: boolean) => {
    setApplyIva(enabled);
    const newRate = enabled ? getIvaRate(ivaType) : 0;
    setDraft(prev => ({
      ...prev,
      items: prev.items.map(item => ({ 
        ...item, 
        tax: newRate,
        taxType: enabled ? ivaType : 'EXENTO'
      }))
    }));
  };

  // Handle IVA Type Change
  const handleIvaTypeChange = (type: 'GENERAL' | 'REDUCIDO' | 'SUPERREDUCIDO' | 'EXENTO') => {
    setIvaType(type);
    if (applyIva) {
      const newRate = getIvaRate(type);
      setDraft(prev => ({
        ...prev,
        items: prev.items.map(item => ({ 
          ...item, 
          tax: newRate,
          taxType: type
        }))
      }));
    }
  };

  // --- LOGIC: Math & Fiscal ---
  const calculateTotals = () => {
    const subtotal = draft.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    // Calculate Discount Amount
    let discountAmount = 0;
    let effectiveRate = 0;

    if (showDiscountInput) {
        if (discountType === 'PERCENT') {
            effectiveRate = discountValue;
            discountAmount = subtotal * (discountValue / 100);
        } else {
            discountAmount = discountValue;
            effectiveRate = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
        }
    }

    const taxableBase = subtotal - discountAmount;
    
    // Calculate IVA
    // If global discount is applied, IVA basis reduces proportionally
    const ivaAmount = draft.items.reduce((acc, item) => {
       const itemTotal = item.price * item.quantity;
       // Distribute discount proportionally
       const itemShare = subtotal > 0 ? itemTotal / subtotal : 0;
       const itemDiscount = discountAmount * itemShare;
       const itemBase = itemTotal - itemDiscount;
       return acc + (itemBase * (item.tax / 100));
    }, 0);

    // Calculate IRPF Retention (only for Invoices, not Quotes)
    let irpfRetentionAmount = 0;
    if (docType === 'Invoice' && showIrpfRetention && irpfRetention > 0) {
      // IRPF se calcula sobre la base imponible (sin IVA)
      irpfRetentionAmount = taxableBase * (irpfRetention / 100);
      setIrpfAmount(irpfRetentionAmount);
    }
    
    // Total = Base + IVA - Retención IRPF
    const total = taxableBase + ivaAmount - irpfRetentionAmount;

    return { 
      subtotal, 
      discountAmount, 
      taxAmount: ivaAmount, 
      ivaAmount,
      irpfRetentionAmount,
      total, 
      effectiveRate 
    };
  };

  const totals = calculateTotals();

  // --- HANDLER: AI RECOMMENDATION ---
  const handleGetDiscountRec = async () => {
      if (!hasAiAccess) return;
      setIsGettingRec(true);
      setAiRecommendation(null);
      
      try {
          const rec = await getDiscountRecommendation(totals.subtotal, draft.clientName, currentUser.apiKeys);
          if (rec) {
              setAiRecommendation({ rate: rec.recommendedRate, text: rec.reasoning });
              // If user hasn't opened the input, open it
              setShowDiscountInput(true);
              setDiscountType('PERCENT');
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsGettingRec(false);
      }
  };

  const applyRecommendation = () => {
      if (aiRecommendation) {
          setDiscountValue(aiRecommendation.rate);
          setDiscountType('PERCENT');
          setAiRecommendation(null);
      }
  };

  // --- LOGIC: Client Autocomplete ---
  const handleClientSelect = (client: any) => {
    const clientCountry = client.country || 'España';
    const detectedType = detectOperationType(clientCountry);
    setDraft(prev => ({ 
      ...prev, 
      clientName: client.name, 
      clientTaxId: client.taxId || '',
      clientEmail: client.email || '',
      clientCountry: clientCountry,
      operationType: detectedType,
      legalMention: getLegalMention(detectedType)
    }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  const handleNewClientTaxId = (id: string) => {
    setDraft(prev => ({ ...prev, clientTaxId: id }));
  };

  // --- LOGIC: AI Parsing & Matching ---
  const handleTypeSelect = (type: 'Invoice' | 'Quote') => {
    setDocType(type);
    setStep('AI_INPUT');
  };

  const findBestClientMatch = (name: string) => {
    if (!name || dbClients.length === 0) return null;
    const lowerName = name.toLowerCase();
    const exact = dbClients.find(c => c.name.toLowerCase() === lowerName);
    if (exact) return exact;
    const partial = dbClients.find(c => c.name.toLowerCase().includes(lowerName) || lowerName.includes(c.name.toLowerCase()));
    return partial || null;
  };

  const handleAiSubmit = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setAiError(null);
    try {
      const contextInput = `${docType === 'Quote' ? 'Cotización: ' : 'Factura: '} ${input}`;
      const result = await parseInvoiceRequest(contextInput, currentUser.apiKeys);
      
      if (result) {
        const newItems = [{
          id: Date.now().toString(),
          description: result.concept || 'Servicios Profesionales',
          details: '', // AI parsing currently just returns concept
          quantity: 1,
          price: result.amount || 0,
          tax: applyIva ? getIvaRate(ivaType) : 0,
          taxType: applyIva ? ivaType : 'EXENTO' 
        }];

        let matchedClient = null;
        if (result.clientName) {
            matchedClient = findBestClientMatch(result.clientName);
        }

        setDraft(prev => ({
          ...prev,
          clientName: matchedClient ? matchedClient.name : (result.clientName || prev.clientName),
          clientTaxId: matchedClient ? (matchedClient.taxId || '') : (result.clientName ? '' : prev.clientTaxId),
          clientEmail: matchedClient ? (matchedClient.email || '') : prev.clientEmail,
          currency: result.currency || prev.currency,
          items: newItems
        }));
        
        setClientSearch(matchedClient ? matchedClient.name : (result.clientName || ''));
        setStep('SMART_EDITOR');
      }
    } catch (error: any) {
      console.error("AI Parsing Error", error);
      if (error.message === AI_ERROR_BLOCKED) {
          setAiError("Función bloqueada por falta de API Key.");
      } else {
          setAiError("No pude entender la solicitud. Intenta de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const skipAi = () => {
    setStep('SMART_EDITOR');
  };

  const generateUniqueId = () => {
    const sequences = currentUser.documentSequences || {
        invoicePrefix: 'FAC', invoiceNextNumber: 1,
        quotePrefix: 'COT', quoteNextNumber: 1
    };
    
    let prefix = docType === 'Invoice' ? sequences.invoicePrefix : sequences.quotePrefix;
    let nextNum = docType === 'Invoice' ? sequences.invoiceNextNumber : sequences.quoteNextNumber;
    
    let candidateId = `${prefix}-${String(nextNum).padStart(4, '0')}`;
    while (invoices.some(inv => inv.id === candidateId)) {
        nextNum++;
        candidateId = `${prefix}-${String(nextNum).padStart(4, '0')}`;
    }
    return candidateId;
  };

  const handleSave = async (targetStatus: 'Borrador' | 'Creada') => {
    if (!draft.clientName) return;
    setIsSaving(true); 

    let newId = generatedId;
    if (!newId) {
        newId = generateUniqueId();
    }

    const invoiceCurrency = draft.invoiceCurrency || draft.currency;
    const invoiceDate = initialData?.date || draft.validityDate || new Date().toISOString().split('T')[0];
    
    const finalInvoice: Invoice = {
      id: newId,
      clientName: draft.clientName,
      clientTaxId: draft.clientTaxId,
      clientEmail: draft.clientEmail,
      clientCountry: draft.clientCountry || 'España',
      operationType: draft.operationType || 'NACIONAL',
      legalMention: draft.operationType && draft.operationType !== 'NACIONAL' ? getLegalMention(draft.operationType) : undefined,
      date: invoiceDate, 
      items: draft.items,
      total: totals.total,
      discountRate: totals.effectiveRate,
      ivaAmount: totals.ivaAmount,
      ivaRepercutido: totals.ivaAmount, // IVA cobrado
      irpfRetention: showIrpfRetention ? irpfRetention : 0,
      irpfAmount: totals.irpfRetentionAmount,
      notes: draft.notes, 
      status: isOffline ? 'PendingSync' : targetStatus,
      currency: draft.currency,
      type: docType,
      timeline: initialData?.timeline,
      // Multicurrency fields
      invoiceCurrency: invoiceCurrency,
      baseAmountEur: baseAmountEur || (invoiceCurrency.toUpperCase() === 'EUR' ? totals.total : undefined),
      exchangeRateBce: exchangeRate?.rate || undefined,
      exchangeRateDate: exchangeRate?.date || undefined
    };
    
    await onSave(finalInvoice);
    
    setGeneratedId(newId);
    setFinalInvoiceObj(finalInvoice);
    setSavedStatus(targetStatus);
    setIsSaving(false); 
    setStep('SUCCESS');
  };

  const handleViewDetail = () => {
    if (finalInvoiceObj && onSelectInvoiceForDetail) {
      onSelectInvoiceForDetail(finalInvoiceObj);
    } else if (onViewDetail) {
      onViewDetail();
    }
  };

  const addItem = (catalogItem?: any) => {
    setDraft(prev => ({
      ...prev,
      items: [...prev.items, {
        id: Date.now().toString(),
        description: catalogItem?.name || '',
        details: catalogItem?.description || '', // Pull description from catalog
        quantity: 1,
        price: catalogItem?.price || 0,
        tax: applyIva ? getIvaRate(ivaType) : 0,
        taxType: applyIva ? ivaType : 'EXENTO' 
      }]
    }));
    setShowCatalog(false);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...draft.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setDraft(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index: number) => {
    setDraft(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  // ... (Step Logic and Components for Type Select, AI Input remain mostly same) ...

  if (step === 'SUCCESS') {
    const isDraft = savedStatus === 'Borrador';
    return (
      <div className="flex flex-col items-center justify-center h-full text-center animate-in zoom-in duration-300">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg ${isDraft ? 'bg-slate-100 text-slate-500 shadow-slate-200' : 'bg-green-100 text-green-600 shadow-green-200'}`}>
          {isDraft ? <Archive className="w-12 h-12" /> : <Check className="w-12 h-12" />}
        </div>
        <h2 className="text-3xl font-bold text-[#1c2938] mb-2">
          {isEditMode ? 'Cambios Guardados' : (isDraft ? 'Borrador Guardado' : (docType === 'Quote' ? 'Cotización Lista' : 'Factura Creada'))}
        </h2>
        <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 mb-6">
           <span className="font-mono text-xl font-bold text-[#1c2938]">{generatedId}</span>
        </div>
        <p className="text-lg text-slate-500 mb-8 max-w-md">
          {isEditMode ? "El documento ha sido actualizado correctamente." : "Listo para el siguiente paso."}
        </p>
        <div className="flex gap-4">
           <button onClick={onCancel} className="text-slate-500 font-medium hover:text-slate-800 px-6">
             Cerrar
           </button>
           {!isDraft && (
             <button 
               onClick={handleViewDetail}
               className="bg-[#27bea5] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#22a890] transition-all shadow-lg flex items-center gap-2"
             >
               <Eye className="w-5 h-5" /> Ver Documento
             </button>
           )}
        </div>
      </div>
    );
  }

  // --- RENDER MAIN FORM ---
  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-4 lg:px-0">
        <div className="flex items-center gap-4">
          <button onClick={() => step === 'SMART_EDITOR' && !initialData ? setStep('AI_INPUT') : onCancel()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-500" />
          </button>
          {!initialData && (
            <div className="h-2 w-24 md:w-32 bg-slate-100 rounded-full overflow-hidden hidden md:block">
                <div className={`h-full bg-[#27bea5] transition-all duration-500 ease-out`} style={{ width: step === 'TYPE_SELECT' ? '20%' : step === 'AI_INPUT' ? '50%' : '100%' }} />
            </div>
          )}
        </div>
        <div className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          {step === 'SMART_EDITOR' ? (isEditMode ? 'Editando Documento' : (isTemplateMode ? 'Nuevo para Cliente' : (docType === 'Quote' ? 'Nueva Cotización' : 'Nueva Factura'))) : 'Asistente'}
        </div>
      </div>

      {step === 'TYPE_SELECT' && (
        <div className="flex-1 flex flex-col items-center justify-center animate-in slide-in-from-right-8 px-4">
          <h2 className="text-3xl font-bold text-[#1c2938] mb-8 text-center">¿Qué vamos a crear?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <button onClick={() => handleTypeSelect('Invoice')} className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-[#27bea5] transition-all text-left">
              <div className="w-14 h-14 bg-[#27bea5]/10 text-[#27bea5] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#1c2938]">Factura de Venta</h3>
              <p className="text-slate-500 mt-2">Para cobrar un trabajo ya realizado.</p>
            </button>
            <button onClick={() => handleTypeSelect('Quote')} className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-[#27bea5] transition-all text-left">
              <div className="w-14 h-14 bg-[#1c2938]/10 text-[#1c2938] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileBadge className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#1c2938]">Cotización</h3>
              <p className="text-slate-500 mt-2">Presupuesto formal para cerrar una venta.</p>
            </button>
          </div>
        </div>
      )}

      {step === 'AI_INPUT' && (
        <div className="flex-1 flex flex-col justify-center animate-in slide-in-from-right-8 px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[#1c2938]">Dímelo con tus palabras</h2>
            <p className="text-slate-500 mt-2">O salta este paso para hacerlo manualmente.</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 max-w-2xl mx-auto w-full relative overflow-hidden">
            {hasAiAccess ? (
                <>
                    <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={docType === 'Quote' ? "Ej: Cotiza 3 laptops para TechSolutions..." : "Ej: Factura a Juan Pérez por consultoría..."}
                    className="w-full h-40 text-xl p-4 placeholder-slate-300 border-none focus:ring-0 resize-none rounded-xl"
                    autoFocus
                    />
                    {aiError && (
                        <div className="mx-4 mb-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> {aiError}
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
                    <button onClick={skipAi} className="text-slate-500 font-medium hover:text-[#27bea5] px-4">
                        Saltar a Manual
                    </button>
                    <button 
                        onClick={handleAiSubmit}
                        disabled={!input.trim() || isLoading}
                        className="flex items-center gap-2 bg-[#27bea5] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#22a890] disabled:opacity-50 transition-all"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        {isLoading ? 'Analizando...' : 'Generar Borrador'}
                    </button>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-[#1c2938] mb-2">Función de IA Bloqueada</h3>
                    <p className="text-slate-500 mb-6 max-w-md">Configura tu API Key en Ajustes.</p>
                    <button onClick={skipAi} className="text-slate-500 font-medium hover:text-[#1c2938] px-4">Usar Modo Manual</button>
                </div>
            )}
          </div>
        </div>
      )}

      {step === 'SMART_EDITOR' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300 h-[calc(100vh-140px)] min-h-[500px]">
          
          {/* LEFT: FORM INPUTS */}
          <div className="flex-1 space-y-6 overflow-y-auto pb-20 pr-2 custom-scrollbar">
            
            {/* 1. Client Identity */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4" /> Cliente
              </h3>
              <div className="relative">
                <div className="flex items-center border rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-[#27bea5] bg-slate-50">
                  <Search className="w-5 h-5 text-slate-400 mr-3" />
                  <input 
                    value={clientSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setClientSearch(value);
                      setShowClientDropdown(true);
                      if (draft.clientName !== value) setDraft(prev => ({...prev, clientName: value}));
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={(e) => {
                      // Delay closing to allow click on dropdown item
                      setTimeout(() => setShowClientDropdown(false), 200);
                    }}
                    placeholder="Buscar cliente o prospecto..."
                    className="flex-1 bg-transparent outline-none font-medium text-[#1c2938] placeholder:font-normal"
                  />
                </div>
                {showClientDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden max-h-60 overflow-y-auto">
                    {(() => {
                      const searchTerm = clientSearch.toLowerCase().trim();
                      const filteredClients = searchTerm 
                        ? dbClients.filter(c => 
                            c.name.toLowerCase().includes(searchTerm) ||
                            (c.taxId && c.taxId.toLowerCase().includes(searchTerm)) ||
                            (c.email && c.email.toLowerCase().includes(searchTerm))
                          )
                        : dbClients; // Mostrar todos si no hay búsqueda
                      
                      if (filteredClients.length === 0) {
                        return (
                          <div className="px-4 py-6 text-center">
                            <p className="text-slate-400 text-sm mb-2">No se encontraron resultados</p>
                            <p className="text-xs text-slate-500">Se creará "{clientSearch}" como nuevo cliente</p>
                          </div>
                        );
                      }
                      
                      return filteredClients.map((c, idx) => (
                        <button 
                          key={c.id || idx} 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleClientSelect(c);
                          }}
                          onMouseDown={(e) => e.preventDefault()} // Prevent blur
                          className="w-full text-left px-4 py-3 hover:bg-[#27bea5]/10 transition-colors flex justify-between items-center group border-b border-slate-50 last:border-0"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">{c.name}</p>
                              {c.status === 'PROSPECT' && (
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded uppercase font-bold">Prospecto</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {c.taxId || 'Sin NIF/CIF'}
                              {c.email && ` • ${c.email}`}
                            </p>
                          </div>
                          <Check className="w-4 h-4 text-[#27bea5] opacity-0 group-hover:opacity-100 flex-shrink-0" />
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ID Fiscal</label>
                  <input value={draft.clientTaxId} onChange={(e) => handleNewClientTaxId(e.target.value.toUpperCase())} placeholder="NIF/CIF" className="w-full p-3 rounded-xl border border-slate-200 bg-white outline-none" />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                   <input value={draft.clientEmail || ''} onChange={(e) => setDraft({...draft, clientEmail: e.target.value})} placeholder="email@cliente.com" className="w-full p-3 rounded-xl border border-slate-200 bg-white outline-none" />
                </div>
              </div>

              {/* País del Cliente y Tipo de Operación */}
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">País del Cliente</label>
                  <select 
                    value={draft.clientCountry || 'España'} 
                    onChange={(e) => setDraft({...draft, clientCountry: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white outline-none focus:border-[#27bea5]"
                  >
                    <option value="España">España</option>
                    <optgroup label="Unión Europea">
                      {EU_COUNTRIES.filter(c => c !== 'España').map(country => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Otros Países">
                      <option value="Estados Unidos">Estados Unidos</option>
                      <option value="México">México</option>
                      <option value="Colombia">Colombia</option>
                      <option value="Argentina">Argentina</option>
                      <option value="Chile">Chile</option>
                      <option value="Perú">Perú</option>
                      <option value="Panamá">Panamá</option>
                      <option value="Reino Unido">Reino Unido</option>
                      <option value="Canadá">Canadá</option>
                      <option value="Brasil">Brasil</option>
                      <option value="Otro">Otro</option>
                    </optgroup>
                  </select>
                </div>

                {/* Información sobre Tipo de Operación */}
                {draft.operationType && draft.operationType !== 'NACIONAL' && (
                  <div className={`p-4 rounded-xl border-2 ${
                    draft.operationType === 'EXPORTACION' 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-purple-50 border-purple-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        draft.operationType === 'EXPORTACION' 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-purple-100 text-purple-600'
                      }`}>
                        {draft.operationType === 'EXPORTACION' ? (
                          <Globe className="w-5 h-5" />
                        ) : (
                          <Building2 className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-slate-800 mb-1">
                          {draft.operationType === 'EXPORTACION' ? 'Operación de Exportación' : 'Operación Intracomunitaria'}
                        </h4>
                        <p className="text-xs text-slate-600 mb-2">
                          {draft.operationType === 'EXPORTACION' 
                            ? 'Esta factura NO aplica IVA español. El cliente está fuera de la UE, por lo que la operación está exenta de IVA según la normativa española. El IVA, si aplica, se gestiona en el país del cliente según su normativa local.'
                            : 'Esta factura NO aplica IVA español. El cliente está en la UE y tiene NIF intracomunitario válido. La operación está exenta de IVA según la normativa europea. Debes declarar esta operación en el Modelo 349 (Declaración Recapitulativa Intracomunitaria).'}
                        </p>
                        {draft.legalMention && (
                          <div className="mt-2 p-2 bg-white rounded-lg border border-slate-200">
                            <p className="text-xs font-medium text-slate-700 italic">
                              "{draft.legalMention}"
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1">
                              Esta mención legal se incluirá automáticamente en la factura.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {draft.operationType === 'NACIONAL' && draft.clientCountry === 'España' && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-xs text-slate-600">
                      <span className="font-bold">Operación Nacional:</span> Se aplicará IVA español según el tipo seleccionado (General 21%, Reducido 10%, Superreducido 4% o Exento 0%).
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* 2. Items Section */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Ítems
                </h3>
                <button onClick={() => setShowCatalog(!showCatalog)} className="text-xs font-bold text-[#27bea5] bg-[#27bea5]/10 px-3 py-1.5 rounded-lg hover:bg-[#27bea5]/20 transition-colors flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Catálogo
                </button>
              </div>
              {showCatalog && (
                <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
                  {availableServices.length > 0 ? (
                      availableServices.map(svc => (
                          <button key={svc.id} onClick={() => addItem(svc)} className="flex justify-between items-center p-2 bg-white rounded-lg border border-slate-100 hover:border-[#27bea5] text-left w-full mb-2">
                            <span className="text-sm font-medium text-slate-700">{svc.name}</span>
                            <span className="text-sm font-bold text-[#1c2938]">€{svc.price}</span>
                          </button>
                      ))
                  ) : (
                      <p className="text-center text-xs text-slate-400 py-2">Tu catálogo está vacío.</p>
                  )}
                  <button onClick={() => addItem()} className="text-center p-2 text-sm text-[#27bea5] font-medium hover:underline w-full">+ En blanco</button>
                </div>
              )}
              <div className="space-y-4">
                {draft.items.map((item, idx) => (
                  <div key={item.id} className="flex gap-2 items-start group">
                    <div className="flex-1 space-y-2">
                      <input value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} placeholder="Nombre del producto/servicio" className="w-full p-2 font-bold text-slate-700 border-b border-transparent focus:border-[#27bea5] bg-transparent outline-none placeholder:text-slate-300" />
                      
                      {/* NEW: DETAILS TEXTAREA */}
                      <textarea 
                        value={item.details || ''} 
                        onChange={(e) => updateItem(idx, 'details', e.target.value)} 
                        placeholder="Descripción detallada (opcional)" 
                        className="w-full p-2 text-sm text-slate-500 border border-slate-100 rounded-lg focus:border-[#27bea5] bg-slate-50/50 outline-none resize-none h-16 placeholder:text-slate-300" 
                      />

                      <div className="flex gap-2">
                         <div className="w-20"><input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value))} className="w-full p-2 bg-slate-50 rounded-lg text-sm text-center outline-none focus:ring-1 focus:ring-[#27bea5]" placeholder="Cant" /></div>
                         <div className="flex-1 relative">
                           <span className="absolute left-3 top-2 text-slate-400 text-sm">
                             {(() => {
                               const currency = draft.invoiceCurrency || draft.currency;
                               return SUPPORTED_CURRENCIES.find(c => c.code === currency)?.symbol || '€';
                             })()}
                           </span>
                           <input 
                             type="number" 
                             value={item.price} 
                             onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value))} 
                             className="w-full p-2 pl-6 bg-slate-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#27bea5]" 
                             placeholder="Precio" 
                           />
                         </div>
                      </div>
                    </div>
                    <button onClick={() => removeItem(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Conditions Section */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Condiciones
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">{docType === 'Quote' ? 'Válida hasta' : 'Vencimiento'}</label>
                   <input type="date" value={draft.validityDate} onChange={(e) => setDraft({...draft, validityDate: e.target.value})} className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">Moneda de Facturación</label>
                   <select 
                     value={draft.invoiceCurrency || draft.currency} 
                     onChange={(e) => {
                       const newCurrency = e.target.value;
                       console.log('Currency changed to:', newCurrency);
                       setDraft(prev => ({
                         ...prev, 
                         currency: newCurrency, 
                         invoiceCurrency: newCurrency
                       }));
                     }} 
                     className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm"
                   >
                     {SUPPORTED_CURRENCIES.map(curr => (
                       <option key={curr.code} value={curr.code}>
                         {curr.code} - {curr.name} ({curr.symbol})
                       </option>
                     ))}
                   </select>
                   {/* Mostrar conversión a EUR si no es EUR */}
                   {(draft.invoiceCurrency || draft.currency).toUpperCase() !== 'EUR' && baseAmountEur && exchangeRate && (
                     <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                       <div className="flex items-center justify-between text-xs">
                         <span className="text-blue-700 font-medium">Equivalente en EUR:</span>
                         <span className="text-blue-900 font-bold">€{baseAmountEur.toFixed(2)}</span>
                       </div>
                       <div className="mt-1 text-[10px] text-blue-600">
                         Tipo de cambio: 1 {draft.invoiceCurrency || draft.currency} = {exchangeRate.rate.toFixed(4)} EUR
                         <br />
                         <span className="text-blue-500">Fuente: {exchangeRate.source} ({exchangeRate.date || 'N/A'})</span>
                       </div>
                       {isLoadingExchangeRate && (
                         <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600">
                           <Loader2 className="w-3 h-3 animate-spin" />
                           Obteniendo tipo de cambio...
                         </div>
                       )}
                     </div>
                   )}
                 </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Notas / Comentarios</label>
                <textarea value={draft.notes} onChange={(e) => setDraft({...draft, notes: e.target.value})} placeholder="Notas visibles en la factura..." className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none text-sm h-20 resize-none" />
              </div>
            </section>
          </div>

          {/* RIGHT/BOTTOM: LIVE PREVIEW & MATH (Sticky) */}
          <div className="lg:w-[380px] flex-shrink-0 z-10">
             <div className="bg-[#1c2938] text-white p-6 rounded-3xl shadow-xl lg:h-auto overflow-y-auto lg:overflow-visible flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-[#27bea5]" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Estimado</p>
                      <p className="text-3xl font-bold">
                        {(() => {
                          const currency = draft.invoiceCurrency || draft.currency;
                          const symbol = SUPPORTED_CURRENCIES.find(c => c.code === currency)?.symbol || '€';
                          return symbol;
                        })()} {totals.total.toFixed(2)}
                      </p>
                      {/* Mostrar conversión a EUR si no es EUR */}
                      {(draft.invoiceCurrency || draft.currency).toUpperCase() !== 'EUR' && baseAmountEur && (
                        <p className="text-sm text-slate-400 mt-1">
                          ≈ €{baseAmountEur.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm border-t border-white/10 pt-4 mb-8">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal</span>
                      <span>{totals.subtotal.toFixed(2)}</span>
                    </div>
                    
                    {/* DISCOUNT ROW WITH AI & TOGGLE */}
                    {showDiscountInput ? (
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10 animate-in fade-in">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-[#27bea5] uppercase flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Descuento
                                </span>
                                <div className="flex bg-black/20 rounded-lg p-0.5">
                                    <button onClick={() => setDiscountType('PERCENT')} className={`px-2 py-0.5 rounded text-[10px] font-bold ${discountType === 'PERCENT' ? 'bg-[#27bea5] text-white' : 'text-slate-400'}`}>%</button>
                                    <button onClick={() => setDiscountType('AMOUNT')} className={`px-2 py-0.5 rounded text-[10px] font-bold ${discountType === 'AMOUNT' ? 'bg-[#27bea5] text-white' : 'text-slate-400'}`}>$</button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    value={discountValue}
                                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1 text-white font-bold outline-none focus:border-[#27bea5]"
                                />
                                <button onClick={() => { setShowDiscountInput(false); setDiscountValue(0); setAiRecommendation(null); }} className="p-1 hover:text-red-400 text-slate-500"><Trash2 className="w-4 h-4"/></button>
                            </div>
                            {aiRecommendation && (
                                <div className="mt-2 text-[10px] bg-[#27bea5]/10 text-[#27bea5] p-2 rounded-lg border border-[#27bea5]/30">
                                    <p className="font-bold mb-1">IA Sugiere: {aiRecommendation.rate}%</p>
                                    <p className="opacity-80 leading-tight">{aiRecommendation.text}</p>
                                    <button onClick={applyRecommendation} className="mt-2 w-full bg-[#27bea5] text-white py-1 rounded font-bold hover:bg-[#22a890]">Aplicar</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex justify-between items-center text-slate-300 group cursor-pointer" onClick={() => setShowDiscountInput(true)}>
                            <div className="flex items-center gap-2">
                                <span>Descuento</span>
                                {hasAiAccess && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleGetDiscountRec(); }}
                                      className="p-1 bg-white/10 rounded-full hover:bg-[#27bea5] hover:text-white transition-colors"
                                      title="Pedir recomendación a la IA"
                                    >
                                        {isGettingRec ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                                    </button>
                                )}
                            </div>
                            <span className="text-xs text-slate-500 group-hover:text-white transition-colors">+ Agregar</span>
                        </div>
                    )}

                    {totals.discountAmount > 0 && !showDiscountInput && (
                      <div className="flex justify-between text-green-400">
                        <span>Descuento ({totals.effectiveRate.toFixed(1)}%)</span>
                        <span>- {totals.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {/* IVA Row with Toggle and Type Selector */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-slate-300">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">IVA</span>
                          <button 
                            onClick={() => handleIvaToggle(!applyIva)} 
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#27bea5] focus:ring-offset-2 ${
                              applyIva ? 'bg-[#27bea5]' : 'bg-slate-600'
                            }`}
                            role="switch"
                            aria-checked={applyIva}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                applyIva ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          {applyIva && (
                            <span className="text-xs text-slate-400">({getIvaRate(ivaType)}%)</span>
                          )}
                        </div>
                        <span className="font-bold">{totals.ivaAmount.toFixed(2)}</span>
                      </div>
                      {applyIva && (
                        <div className="flex gap-1.5 bg-black/20 rounded-lg p-1.5">
                          <button 
                            onClick={() => handleIvaTypeChange('GENERAL')} 
                            className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                              ivaType === 'GENERAL' 
                                ? 'bg-[#27bea5] text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            21%
                          </button>
                          <button 
                            onClick={() => handleIvaTypeChange('REDUCIDO')} 
                            className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                              ivaType === 'REDUCIDO' 
                                ? 'bg-[#27bea5] text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            10%
                          </button>
                          <button 
                            onClick={() => handleIvaTypeChange('SUPERREDUCIDO')} 
                            className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                              ivaType === 'SUPERREDUCIDO' 
                                ? 'bg-[#27bea5] text-white shadow-sm' 
                                : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            4%
                          </button>
                        </div>
                      )}
                    </div>

                    {/* IRPF RETENTION ROW */}
                    {docType === 'Invoice' && (
                        <>
                            {showIrpfRetention ? (
                                <div className="bg-white/5 rounded-xl p-3 border border-white/10 mt-2 animate-in fade-in">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1">
                                            <Scissors className="w-3 h-3" /> Retención IRPF
                                        </span>
                                        <button onClick={() => { setShowIrpfRetention(false); setIrpfRetention(15); }} className="p-1 hover:text-red-400 text-slate-500"><X className="w-3 h-3"/></button>
                                    </div>
                                    <div className="flex gap-2 mb-2">
                                        <select
                                            value={irpfRetention}
                                            onChange={(e) => {
                                              const rate = parseFloat(e.target.value);
                                              setIrpfRetention(rate);
                                            }}
                                            className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1 text-white font-bold outline-none focus:border-amber-400"
                                        >
                                            <option value="0">0% (Exento)</option>
                                            <option value="7">7% (Primeros 2 años)</option>
                                            <option value="15">15% (General)</option>
                                        </select>
                                    </div>
                                    {irpfRetention > 0 && (
                                        <div className="flex justify-between text-amber-300 text-xs">
                                            <span>Retención ({irpfRetention}%)</span>
                                            <span>-{totals.irpfRetentionAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <p className="text-[9px] text-slate-400 mt-1">Retención IRPF que aplica el cliente.</p>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center text-slate-300 group cursor-pointer pt-1" onClick={() => setShowIrpfRetention(true)}>
                                    <span>Retención IRPF</span>
                                    <span className="text-xs text-slate-500 group-hover:text-amber-400 transition-colors">+ Agregar</span>
                                </div>
                            )}
                        </>
                    )}

                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleSave('Borrador')} disabled={!draft.clientName || isSaving} className="bg-transparent border border-slate-500 text-slate-300 py-3 rounded-xl font-bold hover:bg-white/5 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Borrador
                    </button>
                    <button onClick={() => handleSave('Creada')} disabled={!draft.clientName || totals.total === 0 || isSaving} className="bg-white text-[#1c2938] py-3 rounded-xl font-bold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group text-sm">
                      {isSaving ? (<>Guardando <Loader2 className="w-4 h-4 animate-spin" /></>) : (<>{initialData ? 'Guardar Cambios' : 'Finalizar'} <Check className="w-4 h-4" /></>)}
                    </button>
                  </div>
                  {isOffline && <p className="text-center text-xs text-amber-400 mt-2 font-medium">Modo Offline Activo ⚡️</p>}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceWizard;
