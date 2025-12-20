
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Building2, MapPin, CreditCard, Palette, UploadCloud,
  Save, Crown, Calendar, Globe,
  Coins, Sparkles, Key, Eye, EyeOff, ShieldCheck,
  Check, Zap, Loader2, CheckCircle2, XCircle, AlertTriangle, Lock, ArrowRight,
  ChevronRight, FileText, Scale, TrendingUp, HelpCircle, Calculator, ExternalLink, RefreshCw,
  Search, AlertCircle, X, ArrowLeft, Plus, Percent, Trash2
} from 'lucide-react';
import { UserProfile, PaymentIntegration, ProfileType, SpanishFiscalConfig } from '../types';
import { testAiConnection } from '../services/geminiService';
import { updateUserPasswordInDb } from '../services/neon';
import { sendPasswordChangedEmail } from '../services/resendService';
import { useAlert } from './AlertSystem';
import { ACTIVITY_SECTORS, getIvaArticleForActivity, ActivitySector } from '../data/activitySectors';

interface UserProfileSettingsProps {
  currentUser: UserProfile;
  onUpdate: (updatedProfile: UserProfile) => Promise<void>;
}

const UserProfileSettings: React.FC<UserProfileSettingsProps> = ({ currentUser, onUpdate }) => {
  const [profile, setProfile] = useState<UserProfile>(currentUser);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [testStatus, setTestStatus] = useState<{ [key: string]: 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR' }>({});
  const [activePaymentTab, setActivePaymentTab] = useState<'STRIPE' | 'PAYPAL' | 'BIZUM'>('STRIPE');
  const [activeSettingsTab, setActiveSettingsTab] = useState<'GENERAL' | 'INTEGRATIONS'>('GENERAL');

  // Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Stripe Portal State
  const [isRedirectingToPortal, setIsRedirectingToPortal] = useState(false);

  // Activity Selection Modal State
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string>(profile.fiscalConfig?.activitySector || '');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    profile.fiscalConfig?.activitySubcategories ||
    (profile.fiscalConfig?.activitySubcategory ? [profile.fiscalConfig.activitySubcategory] : [])
  );
  const [searchSector, setSearchSector] = useState('');
  const [showStripeWizard, setShowStripeWizard] = useState(false);

  const alert = useAlert();

  // Helper to safely format dates stored as text in the DB
  const formatRenewalDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";

    // Si ya parece ser una fecha legible (contiene nombres de mes o espacios sin T de ISO)
    if (dateStr.length > 5 && !dateStr.includes('T') && isNaN(Number(dateStr))) {
      return dateStr;
    }

    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  // Initialize fiscal config if missing
  useEffect(() => {
    if (!profile.fiscalConfig) {
      setProfile((prev: UserProfile) => ({
        ...prev,
        fiscalConfig: {
          entityType: prev.type === ProfileType.COMPANY ? 'JURIDICA' : 'FISICA',
          nif: prev.taxId || '',
          regimenFiscal: 'GENERAL',
          actividadPrincipal: '',
          ivaRegimen: 'GENERAL',
          prorrateoIVA: false
        }
      }));
    }
  }, [profile.type, profile.taxId]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---

  const handleInputChange = (field: keyof UserProfile, value: any) => {
    setProfile((prev: UserProfile) => ({ ...prev, [field]: value }));
  };

  const handleFiscalChange = (field: keyof SpanishFiscalConfig, value: any) => {
    setProfile((prev: UserProfile) => ({
      ...prev,
      fiscalConfig: {
        ...(prev.fiscalConfig as SpanishFiscalConfig),
        [field]: value
      }
    }));
  };

  const handleBrandingChange = (field: keyof any, value: any) => {
    setProfile((prev: UserProfile) => ({
      ...prev,
      branding: { ...prev.branding, [field]: value } as any
    }));
  };

  const handleApiKeyChange = (provider: 'gemini' | 'openai', value: string) => {
    setProfile((prev: UserProfile) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: value }
    }));
    setTestStatus(prev => ({ ...prev, [provider]: 'IDLE' }));
  };

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const togglePaymentIntegration = () => {
    setProfile((prev: UserProfile) => {
      const isEnabled = !prev.paymentIntegration?.enabled;
      return {
        ...prev,
        paymentIntegration: {
          provider: prev.paymentIntegration?.provider || 'STRIPE',
          enabled: isEnabled,
          stripePublicKey: prev.paymentIntegration?.stripePublicKey || '',
          stripeSecretKey: prev.paymentIntegration?.stripeSecretKey || '',
          paypalClientId: prev.paymentIntegration?.paypalClientId || '',
          paypalSecret: prev.paymentIntegration?.paypalSecret || '',
          bizumPhone: prev.paymentIntegration?.bizumPhone || '',
          feeRules: prev.paymentIntegration?.feeRules || []
        }
      };
    });
  };

  const handlePaymentInputChange = (field: keyof PaymentIntegration, value: any) => {
    setProfile((prev: UserProfile) => {
      const currentInt = prev.paymentIntegration || { provider: 'STRIPE', enabled: true };
      const updatedInt = { ...currentInt, [field]: value };

      // Determine provider based on which fields are configured
      const hasStripe = !!(updatedInt.stripePublicKey && updatedInt.stripeSecretKey);
      const hasPayPal = !!(updatedInt.paypalClientId && updatedInt.paypalSecret);
      const hasBizum = !!updatedInt.bizumPhone;

      let newProvider: 'STRIPE' | 'PAYPAL' | 'BIZUM' | 'BOTH' = updatedInt.provider || 'STRIPE';
      if (hasStripe && (hasPayPal || hasBizum)) newProvider = 'BOTH';
      else if (hasPayPal && hasBizum) newProvider = 'BOTH';
      else if (hasPayPal) newProvider = 'PAYPAL';
      else if (hasBizum) newProvider = 'BIZUM';
      else if (hasStripe) newProvider = 'STRIPE';

      return {
        ...prev,
        paymentIntegration: {
          ...updatedInt,
          provider: newProvider
        }
      };
    });
  };

  const runConnectionTest = async (provider: 'gemini' | 'openai') => {
    const key = profile.apiKeys?.[provider];
    if (!key) return;
    setTestStatus(prev => ({ ...prev, [provider]: 'LOADING' }));
    const success = await testAiConnection(provider, key);
    setTestStatus(prev => ({ ...prev, [provider]: success ? 'SUCCESS' : 'ERROR' }));
    if (success) setTimeout(() => setTestStatus(prev => ({ ...prev, [provider]: 'IDLE' })), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => handleBrandingChange('logoUrl', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const saveChanges = async () => {
    setIsSaving(true);
    setSaveStatus('IDLE');
    try {
      await onUpdate(profile);
      setSaveStatus('SUCCESS');
      setTimeout(() => setSaveStatus('IDLE'), 3000);
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveStatus('ERROR');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      alert.addToast('error', 'Contraseña corta', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert.addToast('error', 'Error', 'Las contraseñas no coinciden.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const success = await updateUserPasswordInDb(currentUser.id, newPassword);
      if (success) {
        if (currentUser.email) {
          await sendPasswordChangedEmail(currentUser.email, currentUser.name);
        }
        alert.addToast('success', 'Contraseña Actualizada', 'Se ha enviado un correo de confirmación.');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordChange(false);
      } else {
        alert.addToast('error', 'Error', 'No se pudo actualizar la contraseña en el servidor.');
      }
    } catch (err) {
      alert.addToast('error', 'Error Crítico', 'Hubo un problema al conectar con la base de datos.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!profile.stripeCustomerId) {
      if (profile.plan === 'Free') {
        alert.addToast('info', 'Plan Gratis', "Actualmente estás en el plan Gratis. Contacta a soporte para actualizar.");
      } else {
        alert.addToast('error', 'Error', "No se encontró el ID de cliente de Stripe. Contacta a soporte.");
      }
      return;
    }

    setIsRedirectingToPortal(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: profile.stripeCustomerId })
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 503) {
          alert.addToast('info', 'Servicio no disponible', "El sistema de pagos no está configurado. Contacta a soporte.");
        } else {
          throw new Error(data.error || 'No se pudo generar el enlace');
        }
        setIsRedirectingToPortal(false);
        return;
      }

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No se pudo generar el enlace');
      }
    } catch (error) {
      console.error("Portal Error", error);
      alert.addToast('error', 'Error Stripe', "Error conectando con Stripe.");
      setIsRedirectingToPortal(false);
    }
  };

  const handleSaveActivity = async () => {
    if (!selectedSector || selectedSubcategories.length === 0) {
      alert.addToast('error', 'Error', 'Por favor selecciona un rubro y al menos una subcategoría.');
      return;
    }

    const sectorData = ACTIVITY_SECTORS.find(s => s.id === selectedSector);
    const selectedSubs = sectorData?.subcategories.filter(sub => selectedSubcategories.includes(sub.id)) || [];

    // Calcular ivaArticle: si hay múltiples artículos diferentes, usar MIXTO
    const articles = selectedSubcategories.map((subId: string) => getIvaArticleForActivity(selectedSector, subId));
    const uniqueArticles = [...new Set(articles)];
    const ivaArticle = uniqueArticles.length > 1 ? 'MIXTO' : uniqueArticles[0] as 'ART_21' | 'ART_69_70' | 'ART_69' | 'ART_70' | 'MIXTO';

    // Actualizar el perfil localmente
    setProfile((prev: UserProfile) => ({
      ...prev,
      fiscalConfig: {
        ...prev.fiscalConfig,
        activitySector: selectedSector,
        activitySubcategory: selectedSubcategories[0], // Mantener compatibilidad
        activitySubcategories: selectedSubcategories,
        ivaArticle: ivaArticle,
        actividadPrincipal: selectedSubs.map(s => s.name).join(', ') || prev.fiscalConfig?.actividadPrincipal || ''
      } as SpanishFiscalConfig
    }));

    // Guardar en el servidor
    setIsSaving(true);
    try {
      const updatedProfile = {
        ...profile,
        fiscalConfig: {
          ...profile.fiscalConfig,
          activitySector: selectedSector,
          activitySubcategory: selectedSubcategories[0], // Mantener compatibilidad
          activitySubcategories: selectedSubcategories,
          ivaArticle: ivaArticle,
          actividadPrincipal: selectedSubs.map(s => s.name).join(', ') || profile.fiscalConfig?.actividadPrincipal || ''
        } as SpanishFiscalConfig
      };

      await onUpdate(updatedProfile);
      setShowActivityModal(false);
      alert.addToast('success', 'Actividad Actualizada', 'La actividad económica se ha actualizado correctamente. Esto afectará las menciones legales en facturas futuras.');
    } catch (error) {
      alert.addToast('error', 'Error', 'No se pudo guardar la actividad. Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- FISCAL CALCULATIONS (SPAIN LOGIC) ---
  const fiscalPreview = useMemo(() => {
    const config = profile.fiscalConfig || {} as SpanishFiscalConfig;
    const isFisica = config.entityType === 'FISICA';

    // IVA según régimen
    let ivaInfo = "21% (General)";
    if (config.ivaRegimen === 'SIMPLIFICADO') {
      ivaInfo = "Simplificado (Estimación)";
    } else if (config.ivaRegimen === 'AGRICULTURA') {
      ivaInfo = "Agricultura (Especial)";
    } else if (config.ivaRegimen === 'EXENTO') {
      ivaInfo = "Exento";
    }

    // IRPF según tipo
    let irpfInfo = isFisica ? "15% (General)" : "N/A (Sociedad)";
    if (isFisica && config.fechaAltaAutonomo) {
      const fechaAlta = new Date(config.fechaAltaAutonomo);
      const hoy = new Date();
      const mesesTranscurridos = (hoy.getFullYear() - fechaAlta.getFullYear()) * 12 +
        (hoy.getMonth() - fechaAlta.getMonth());
      if (mesesTranscurridos < 24) {
        irpfInfo = "7% (Primeros 2 años)";
      }
    }

    // Régimen fiscal
    const regimenInfo = config.regimenFiscal || 'GENERAL';
    const regimenLabels: Record<string, string> = {
      'GENERAL': 'Estimación Directa',
      'SIMPLIFICADO': 'Estimación Objetiva',
      'AGRICOLA': 'Agricultura',
      'GANADERO': 'Ganadería',
      'FORESTAL': 'Forestal'
    };

    return {
      ivaInfo,
      irpfInfo,
      regimenInfo: regimenLabels[regimenInfo] || regimenInfo,
      prorrateoIVA: config.prorrateoIVA || false,
      porcentajeProrrateo: config.porcentajeProrrateo || 100
    };
  }, [profile.fiscalConfig]);

  const isStripeConfigured = !!(profile.paymentIntegration?.stripePublicKey && profile.paymentIntegration?.stripeSecretKey);
  const isPayPalConfigured = !!(profile.paymentIntegration?.paypalClientId && profile.paymentIntegration?.paypalSecret);
  const isBizumConfigured = !!profile.paymentIntegration?.bizumPhone;

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in pb-12 relative">
      {saveStatus === 'SUCCESS' && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold">¡Cambios guardados con éxito!</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1c2938] tracking-tight">{activeSettingsTab === 'GENERAL' ? 'Tu Espacio de Trabajo' : 'Integraciones y Comisiones'}</h1>
          <p className="text-slate-500 mt-1 text-lg font-light">
            {activeSettingsTab === 'GENERAL'
              ? 'Personaliza cómo te verán tus clientes y cómo trabaja tu IA.'
              : 'Conecta tus herramientas favoritas y automatiza el cálculo de comisiones.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-slate-100 rounded-2xl mr-4">
            <button
              onClick={() => setActiveSettingsTab('GENERAL')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeSettingsTab === 'GENERAL' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              General
            </button>
            <button
              onClick={() => setActiveSettingsTab('INTEGRATIONS')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeSettingsTab === 'INTEGRATIONS' ? 'bg-white text-[#1c2938] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Integraciones
            </button>
          </div>
          <button
            onClick={saveChanges}
            disabled={isSaving}
            className={`px-8 py-3 rounded-2xl font-bold transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:scale-95 disabled:opacity-70 ${saveStatus === 'SUCCESS' ? 'bg-green-500 text-white' : 'bg-[#1c2938] text-white hover:bg-[#27bea5]'
              }`}
          >
            {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</> : saveStatus === 'SUCCESS' ? <><Check className="w-5 h-5" /> Guardado</> : <><Save className="w-5 h-5" /> Guardar Cambios</>}
          </button>
        </div>
      </div>

      {activeSettingsTab === 'GENERAL' && (

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="space-y-8 xl:col-span-2">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50 relative group">
              <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-3">
                <div className="p-2 bg-slate-50 rounded-xl text-[#27bea5]"><Building2 className="w-6 h-6" /></div>
                Identidad del Negocio
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre Comercial</label>
                  <input value={profile.name} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none transition-all font-medium text-[#1c2938] focus:ring-2 focus:ring-[#27bea5]" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Razón Social</label>
                  <input value={profile.legalName || ''} onChange={(e) => handleInputChange('legalName', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none transition-all text-slate-700 focus:ring-2 focus:ring-[#27bea5]" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">NIF / CIF</label>
                  <input value={profile.taxId} onChange={(e) => handleInputChange('taxId', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-mono text-slate-600" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">País</label>
                  <select value={profile.country} onChange={(e) => handleInputChange('country', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none">
                    <option value="España">España</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dirección Fiscal</label>
                  <input value={profile.address} onChange={(e) => handleInputChange('address', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50 relative group">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-[#1c2938] flex items-center gap-3">
                  <div className="p-2 bg-rose-50 rounded-xl text-rose-500"><Lock className="w-6 h-6" /></div>
                  Seguridad de la Cuenta
                </h3>
              </div>

              {!showPasswordChange ? (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm text-slate-400"><Key size={20} /></div>
                    <div>
                      <p className="text-sm font-bold text-[#1c2938]">Contraseña</p>
                      <p className="text-xs text-slate-500">Actualizada periódicamente para mayor seguridad</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPasswordChange(true)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#1c2938] hover:bg-slate-100 transition-colors shadow-sm">Cambiar Contraseña</button>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nueva Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" />
                        <input type={showNewPass ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pl-12 pr-12 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] outline-none" placeholder="Mínimo 6 caracteres" />
                        <button onClick={() => setShowNewPass(!showNewPass)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600">{showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Confirmar Contraseña</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" />
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-12 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#27bea5] outline-none" placeholder="Repite la contraseña" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleUpdatePassword} disabled={isUpdatingPassword || !newPassword} className="px-6 py-3 bg-[#1c2938] text-white rounded-2xl font-bold text-sm hover:bg-rose-500 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50">
                      {isUpdatingPassword ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Actualizar y Notificar
                    </button>
                    <button onClick={() => { setShowPasswordChange(false); setNewPassword(''); setConfirmPassword(''); }} className="px-6 py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-2xl transition-colors">Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            {/* BÓVEDA FINANCIERA */}
            <div className="relative rounded-[2rem] shadow-xl overflow-hidden group bg-gradient-to-br from-[#27bea5] to-[#1e9984] p-8 text-white">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl text-white"><Coins className="w-6 h-6" /></div>
                  Bóveda Financiera
                </h3>
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Seguridad Bancaria
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/80 uppercase tracking-wider">Nombre del Banco</label>
                  <input
                    value={profile.bankName || ''}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    placeholder="Ej. Banco Santander"
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all font-medium text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/80 uppercase tracking-wider">Cuenta Bancaria (IBAN)</label>
                  <input
                    value={profile.bankAccount || ''}
                    onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                    placeholder="ES71 1583 0001 1790 6660 097"
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all font-mono text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/80 uppercase tracking-wider">Tipo de Cuenta</label>
                  <select
                    value={profile.bankAccountType || 'Ahorro'}
                    onChange={(e) => handleInputChange('bankAccountType', e.target.value)}
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all text-white focus:ring-2 focus:ring-white/50"
                  >
                    <option value="Ahorro" className="bg-[#1e9984]">Ahorro</option>
                    <option value="Corriente" className="bg-[#1e9984]">Corriente</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/80 uppercase tracking-wider">Moneda Base</label>
                  <div className="relative">
                    <input
                      value="EUR"
                      readOnly
                      className="w-full p-4 bg-white/10 border border-white/20 rounded-2xl outline-none font-bold text-white cursor-not-allowed"
                    />
                    <Globe className="absolute right-4 top-4 w-5 h-5 text-white/70" />
                  </div>
                </div>
              </div>

              {/* Pagos Digitales */}
              <div className="mt-6 pt-6 border-t border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Pagos Digitales</p>
                    <p className="text-xs text-white/80">Stripe / PayPal / Bizum</p>
                  </div>
                  <button
                    onClick={togglePaymentIntegration}
                    className={`relative w-14 h-8 rounded-full transition-colors ${profile.paymentIntegration?.enabled ? 'bg-white' : 'bg-white/30'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-[#27bea5] rounded-full transition-transform shadow-sm ${profile.paymentIntegration?.enabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>
            </div>

            {/* TU CEREBRO DIGITAL - API KEYS */}
            <div className="relative rounded-[2rem] shadow-xl overflow-hidden group bg-gradient-to-br from-[#27bea5] to-[#1e9984] p-8 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/20 rounded-xl text-white"><Zap className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-xl font-bold text-white">Tu Cerebro Digital</h3>
                  <p className="text-xs text-white/80">Conecta tus llaves de IA para darle superpoderes ilimitados a tu asistente.</p>
                </div>
              </div>

              <div className="space-y-6 mt-6">
                {/* Google Gemini API Key */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                      Google Gemini API Key
                      <span className="px-2 py-0.5 bg-white/20 text-white rounded text-[10px] font-bold">RECOMENDADO</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleKeyVisibility('gemini')}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        {showKeys['gemini'] ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-white" />}
                      </button>
                      <button
                        onClick={() => runConnectionTest('gemini')}
                        disabled={testStatus['gemini'] === 'LOADING' || !profile.apiKeys?.gemini}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {testStatus['gemini'] === 'LOADING' && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                        {testStatus['gemini'] === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-white" />}
                        {testStatus['gemini'] === 'ERROR' && <XCircle className="w-4 h-4 text-white" />}
                        {testStatus['gemini'] === 'IDLE' && <Zap className="w-4 h-4 text-white" />}
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys['gemini'] ? 'text' : 'password'}
                      value={profile.apiKeys?.gemini || ''}
                      onChange={(e) => handleApiKeyChange('gemini', e.target.value)}
                      placeholder="Pega tu llave aquí..."
                      className="w-full p-4 pr-24 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all font-mono text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/50"
                    />
                    <Key className="absolute right-4 top-4 w-5 h-5 text-white/70" />
                  </div>
                </div>

                {/* OpenAI API Key (Backup) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                      OpenAI API Key (Backup)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleKeyVisibility('openai')}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        {showKeys['openai'] ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-white" />}
                      </button>
                      <button
                        onClick={() => runConnectionTest('openai')}
                        disabled={testStatus['openai'] === 'LOADING' || !profile.apiKeys?.openai}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {testStatus['openai'] === 'LOADING' && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                        {testStatus['openai'] === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-white" />}
                        {testStatus['openai'] === 'ERROR' && <XCircle className="w-4 h-4 text-white" />}
                        {testStatus['openai'] === 'IDLE' && <Zap className="w-4 h-4 text-white" />}
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys['openai'] ? 'text' : 'password'}
                      value={profile.apiKeys?.openai || ''}
                      onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                      placeholder="Pega tu llave aquí..."
                      className="w-full p-4 pr-24 bg-white/10 border border-white/20 rounded-2xl outline-none transition-all font-mono text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/50"
                    />
                    <Key className="absolute right-4 top-4 w-5 h-5 text-white/70" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-500"><Scale className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-xl font-bold text-[#1c2938]">Perfil Fiscal (España)</h3>
                  <p className="text-xs text-slate-400">Configuración fiscal y obligaciones</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Entidad</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl">
                    <button onClick={() => handleFiscalChange('entityType', 'FISICA')} className={`py-2 px-3 rounded-lg text-xs font-bold ${profile.fiscalConfig?.entityType === 'FISICA' ? 'bg-white shadow-sm text-[#1c2938]' : 'text-slate-400'}`}>Persona Física</button>
                    <button onClick={() => handleFiscalChange('entityType', 'JURIDICA')} className={`py-2 px-3 rounded-lg text-xs font-bold ${profile.fiscalConfig?.entityType === 'JURIDICA' ? 'bg-white shadow-sm text-[#1c2938]' : 'text-slate-400'}`}>Persona Jurídica</button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Régimen Fiscal</label>
                      <select value={profile.fiscalConfig?.regimenFiscal || 'GENERAL'} onChange={(e) => handleFiscalChange('regimenFiscal', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-500">
                        <option value="GENERAL">Estimación Directa (General)</option>
                        <option value="SIMPLIFICADO">Estimación Objetiva (Simplificado)</option>
                        <option value="AGRICOLA">Agricultura</option>
                        <option value="GANADERO">Ganadería</option>
                        <option value="FORESTAL">Forestal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Actividad Económica</label>
                      <div className="space-y-2">
                        {profile.fiscalConfig?.activitySector && profile.fiscalConfig?.activitySubcategory ? (
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-[#1c2938]">
                                  {ACTIVITY_SECTORS.find(s => s.id === profile.fiscalConfig?.activitySector)?.name || 'Rubro no encontrado'}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {(() => {
                                    const sector = ACTIVITY_SECTORS.find(s => s.id === profile.fiscalConfig?.activitySector);
                                    const subcategories = profile.fiscalConfig?.activitySubcategories ||
                                      (profile.fiscalConfig?.activitySubcategory ? [profile.fiscalConfig.activitySubcategory] : []);
                                    if (subcategories.length === 0) return 'Sin subcategorías';
                                    if (subcategories.length === 1) {
                                      return sector?.subcategories.find(sub => sub.id === subcategories[0])?.name || 'Subcategoría no encontrada';
                                    }
                                    return `${subcategories.length} actividades seleccionadas`;
                                  })()}
                                </p>
                                {profile.fiscalConfig?.ivaArticle && (
                                  <p className="text-xs text-indigo-600 mt-1 font-medium">
                                    Art. {profile.fiscalConfig.ivaArticle === 'ART_21' ? '21' : profile.fiscalConfig.ivaArticle === 'ART_69_70' ? '69-70' : profile.fiscalConfig.ivaArticle === 'ART_69' ? '69' : profile.fiscalConfig.ivaArticle === 'ART_70' ? '70' : '69-70 (Mixto)'}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedSector(profile.fiscalConfig?.activitySector || '');
                                  setSelectedSubcategories(
                                    profile.fiscalConfig?.activitySubcategories ||
                                    (profile.fiscalConfig?.activitySubcategory ? [profile.fiscalConfig.activitySubcategory] : [])
                                  );
                                  setShowActivityModal(true);
                                }}
                                className="ml-3 px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition-colors"
                              >
                                Cambiar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowActivityModal(true)}
                            className="w-full p-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-sm font-bold text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Seleccionar actividad económica
                          </button>
                        )}
                        {profile.fiscalConfig?.actividadPrincipal && (
                          <input
                            type="text"
                            value={profile.fiscalConfig.actividadPrincipal}
                            onChange={(e) => handleFiscalChange('actividadPrincipal', e.target.value)}
                            placeholder="Descripción adicional (opcional)"
                            className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium outline-none focus:border-indigo-500"
                          />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Esto afectará las menciones legales en facturas futuras. Las facturas ya emitidas no cambiarán.
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Código CNAE (Opcional)</label>
                      <input type="text" value={profile.fiscalConfig?.codigoCnae || ''} onChange={(e) => handleFiscalChange('codigoCnae', e.target.value)} placeholder="Ej: 6201" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <h4 className="text-sm font-bold text-[#1c2938] mb-4">Configuración IVA</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Régimen IVA</label>
                      <select value={profile.fiscalConfig?.ivaRegimen || 'GENERAL'} onChange={(e) => handleFiscalChange('ivaRegimen', e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500">
                        <option value="GENERAL">General (21%, 10%, 4%)</option>
                        <option value="SIMPLIFICADO">Simplificado</option>
                        <option value="AGRICULTURA">Agricultura</option>
                        <option value="EXENTO">Exento</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <input type="checkbox" checked={profile.fiscalConfig?.prorrateoIVA || false} onChange={(e) => handleFiscalChange('prorrateoIVA', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500" />
                      <label className="text-xs font-bold text-slate-600">Aplicar prorrateo de IVA</label>
                    </div>
                    {profile.fiscalConfig?.prorrateoIVA && (
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">% Actividad Sujeta a IVA</label>
                        <input type="number" min="0" max="100" value={profile.fiscalConfig?.porcentajeProrrateo || 100} onChange={(e) => handleFiscalChange('porcentajeProrrateo', parseFloat(e.target.value) || 100)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500" />
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase">IVA</span>
                      <span className="text-sm font-bold text-[#1c2938]">{fiscalPreview.ivaInfo}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase">IRPF</span>
                      <span className="text-sm font-bold text-[#1c2938]">{fiscalPreview.irpfInfo}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase">Régimen</span>
                      <span className="text-sm font-bold text-[#1c2938]">{fiscalPreview.regimenInfo}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50">
              <h3 className="text-xl font-bold text-[#1c2938] mb-6 flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-xl text-purple-500"><Palette className="w-6 h-6" /></div>
                Marca
              </h3>
              <div className="mb-8 text-center" onClick={() => fileInputRef.current?.click()}>
                <div className="w-32 h-32 rounded-full border-4 border-slate-50 bg-white shadow-inner flex items-center justify-center overflow-hidden hover:border-[#27bea5] transition-all cursor-pointer mx-auto">
                  {profile.branding?.logoUrl ? <img src={profile.branding.logoUrl} className="w-full h-full object-contain p-4" /> : <UploadCloud className="text-slate-300" size={40} />}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </div>
              <div className="space-y-6">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Color de Marca</label>
                <input type="color" value={profile.branding?.primaryColor || '#27bea5'} onChange={(e) => handleBrandingChange('primaryColor', e.target.value)} className="w-full h-10 rounded-xl cursor-pointer bg-slate-50 p-1 border border-slate-100" />
              </div>
            </div>

            <div className="relative rounded-[2rem] shadow-xl overflow-hidden group bg-gradient-to-br from-[#27bea5] to-[#1e9984] p-8 text-white">
              <p className="text-xs font-bold uppercase mb-1">Membresía</p>
              <h3 className="text-2xl font-bold flex items-center gap-2 mb-1">{profile.plan || 'Free'} <Crown size={20} className="text-yellow-300" /></h3>
              {profile.renewalDate && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/80 uppercase tracking-widest mb-6">
                  <Calendar size={12} />
                  <span>Renueva: {formatRenewalDate(profile.renewalDate)}</span>
                </div>
              )}
              <button onClick={handleManageSubscription} disabled={isRedirectingToPortal} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2">
                {isRedirectingToPortal ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />} Gestionar Suscripción
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Selection Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1c2938]">Seleccionar Actividad Económica</h2>
                <p className="text-sm text-slate-500 mt-1">Esto afectará las menciones legales en facturas futuras</p>
              </div>
              <button
                onClick={() => {
                  setShowActivityModal(false);
                  setSelectedSector(profile.fiscalConfig?.activitySector || '');
                  setSelectedSubcategories(
                    profile.fiscalConfig?.activitySubcategories ||
                    (profile.fiscalConfig?.activitySubcategory ? [profile.fiscalConfig.activitySubcategory] : [])
                  );
                  setSearchSector('');
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const selectedSectorData = ACTIVITY_SECTORS.find(s => s.id === selectedSector);
                const filteredSectors = searchSector
                  ? ACTIVITY_SECTORS.filter(s => s.name.toLowerCase().includes(searchSector.toLowerCase()))
                  : ACTIVITY_SECTORS;

                if (!selectedSector) {
                  return (
                    <div className="space-y-4">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          value={searchSector}
                          onChange={(e) => setSearchSector(e.target.value)}
                          placeholder="Buscar rubro (ej: Tecnología, Diseño, Consultoría...)"
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>

                      {/* Sector Selection */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredSectors.map((sector) => (
                          <button
                            key={sector.id}
                            onClick={() => {
                              setSelectedSector(sector.id);
                              setSelectedSubcategories([]);
                            }}
                            className="p-4 bg-slate-50 border-2 border-slate-100 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all text-left group"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-bold text-[#1c2938] text-sm group-hover:text-indigo-600 transition-colors">
                                {sector.name}
                              </h3>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                            </div>
                            <p className="text-xs text-slate-500">
                              {sector.subcategories.length} {sector.subcategories.length === 1 ? 'opción' : 'opciones'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Back Button */}
                    <button
                      onClick={() => {
                        setSelectedSector('');
                        setSelectedSubcategories([]);
                      }}
                      className="flex items-center gap-2 text-slate-500 hover:text-[#1c2938] transition-colors font-medium text-sm"
                    >
                      <ArrowLeft className="w-4 h-4" /> Volver a rubros
                    </button>

                    {/* Sector Info */}
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 rounded-xl text-white">
                      <h3 className="text-xl font-bold mb-1">{selectedSectorData?.name}</h3>
                      <p className="text-white/80 text-sm">
                        Selecciona todas las subcategorías que describen tu actividad (puedes seleccionar varias)
                      </p>
                    </div>

                    {/* Subcategory Selection - Multiple Selection with Checkboxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedSectorData?.subcategories.map((sub) => {
                        const isSelected = selectedSubcategories.includes(sub.id);
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedSubcategories(prev => prev.filter(id => id !== sub.id));
                              } else {
                                setSelectedSubcategories(prev => [...prev, sub.id]);
                              }
                            }}
                            className={`p-4 bg-white border-2 rounded-xl text-left transition-all ${isSelected
                              ? 'border-indigo-500 bg-indigo-50 shadow-md'
                              : 'border-slate-100 hover:border-indigo-300'
                              }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected
                                  ? 'bg-indigo-500 border-indigo-500'
                                  : 'border-slate-300 bg-white'
                                  }`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-bold text-[#1c2938] text-sm">{sub.name}</h4>
                                  {sub.description && (
                                    <p className="text-xs text-slate-500 mt-1">{sub.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Info Box about IVA Article - Show info for all selected */}
                    {selectedSubcategories.length > 0 && (() => {
                      const selectedSubs = selectedSectorData?.subcategories.filter(s => selectedSubcategories.includes(s.id)) || [];
                      const ivaArticles = selectedSubcategories.map((subId: string) => getIvaArticleForActivity(selectedSector, subId));
                      const uniqueArticles = [...new Set(ivaArticles)];
                      const isMixed = uniqueArticles.length > 1;
                      const mainArticle = uniqueArticles[0] || 'ART_69_70';

                      const articleText = isMixed
                        ? '69-70 (Mixto según actividad)'
                        : mainArticle === 'ART_21' ? '21'
                          : mainArticle === 'ART_69_70' ? '69 y 70'
                            : mainArticle === 'ART_69' ? '69'
                              : mainArticle === 'ART_70' ? '70'
                                : '69 o 70';

                      return (
                        <div className="bg-blue-50 border-2 border-blue-200 p-5 rounded-xl">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-bold text-blue-900 mb-2">Información Fiscal</h4>
                              <p className="text-sm text-blue-800 mb-2">
                                Has seleccionado <strong>{selectedSubcategories.length}</strong> {selectedSubcategories.length === 1 ? 'actividad' : 'actividades'}:
                              </p>
                              <ul className="text-xs text-blue-700 mb-3 list-disc list-inside space-y-1">
                                {selectedSubs.map(sub => (
                                  <li key={sub.id}>{sub.name}</li>
                                ))}
                              </ul>
                              <p className="text-sm text-blue-800 mb-2">
                                Aplicarán los artículos <strong>{articleText}</strong> de la Ley del IVA.
                              </p>
                              <p className="text-xs text-blue-700">
                                {isMixed
                                  ? 'Tienes actividades mixtas. El artículo aplicable dependerá del tipo específico de servicio en cada factura.'
                                  : 'Cuando factures servicios a clientes fuera de España, el IVA se aplicará según la normativa del país del cliente (regla de localización).'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowActivityModal(false);
                  setSelectedSector(profile.fiscalConfig?.activitySector || '');
                  setSelectedSubcategories(
                    profile.fiscalConfig?.activitySubcategories ||
                    (profile.fiscalConfig?.activitySubcategory ? [profile.fiscalConfig.activitySubcategory] : [])
                  );
                  setSearchSector('');
                }}
                className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveActivity}
                disabled={!selectedSector || selectedSubcategories.length === 0 || isSaving}
                className="px-6 py-2 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar Actividad
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conditionally Render Tabs Content */}
      {activeSettingsTab === 'INTEGRATIONS' && (
        <div className="space-y-8 animate-in slide-in-from-right-4">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-50">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-[#1c2938] flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-500"><Zap className="w-6 h-6" /></div>
                Pasarela de Pagos Digitales
              </h3>
              <button
                onClick={togglePaymentIntegration}
                className={`relative w-14 h-8 rounded-full transition-colors ${profile.paymentIntegration?.enabled ? 'bg-[#27bea5]' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${profile.paymentIntegration?.enabled ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>

            {profile.paymentIntegration?.enabled && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg"
                          alt="Stripe"
                          className="h-5 opacity-80"
                        />
                        <h4 className="font-bold text-[#1c2938] text-sm uppercase tracking-wider text-slate-400">Configuración de Stripe</h4>
                      </div>
                      <button
                        onClick={() => setShowStripeWizard(true)}
                        className="text-[#27bea5] hover:text-[#1c2938] text-xs font-bold flex items-center gap-1.5 transition-colors bg-[#27bea5]/5 px-3 py-1.5 rounded-lg border border-[#27bea5]/10"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        ¿Cómo lo hago?
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">STRIPE PUBLIC KEY</label>
                        <div className="relative">
                          <Key className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" />
                          <input
                            type={showKeys['stripePublic'] ? 'text' : 'password'}
                            value={profile.paymentIntegration?.stripePublicKey || ''}
                            onChange={(e) => handlePaymentInputChange('stripePublicKey', e.target.value)}
                            placeholder="pk_live_..."
                            className="w-full pl-12 pr-12 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none"
                          />
                          <button onClick={() => toggleKeyVisibility('stripePublic')} className="absolute right-4 top-3.5 text-slate-400">{showKeys['stripePublic'] ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">STRIPE SECRET KEY</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-300" />
                          <input
                            type={showKeys['stripeSecret'] ? 'text' : 'password'}
                            value={profile.paymentIntegration?.stripeSecretKey || ''}
                            onChange={(e) => handlePaymentInputChange('stripeSecretKey', e.target.value)}
                            placeholder="sk_live_..."
                            className="w-full pl-12 pr-12 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none"
                          />
                          <button onClick={() => toggleKeyVisibility('stripeSecret')} className="absolute right-4 top-3.5 text-slate-400">{showKeys['stripeSecret'] ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                    <h4 className="font-bold text-[#1c2938] mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#27bea5]" /> Webhook URL
                    </h4>
                    <p className="text-sm text-slate-500 mb-4">Configura esta URL en tu dashboard de Stripe para sincronizar cobros automáticamente.</p>
                    <div className="group relative">
                      <div className="p-4 bg-white border border-slate-200 rounded-xl font-mono text-xs text-[#1c2938] break-all pr-12">
                        {window.location.origin}/api/webhooks/stripe?uid={profile.id}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/stripe?uid=${profile.id}`);
                          alert.addToast('success', 'Copiado', 'URL del Webhook lista para Stripe.');
                        }}
                        className="absolute right-3 top-2.5 p-2 bg-slate-50 text-[#27bea5] hover:bg-[#27bea5] hover:text-white rounded-lg transition-all"
                        title="Copiar URL"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-[#1c2938] flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-xl text-indigo-500"><Percent className="w-6 h-6" /></div>
                      Motor de Comisiones Personalizadas
                    </h3>
                    <button
                      onClick={() => {
                        const newRules = [...(profile.paymentIntegration?.feeRules || [])];
                        newRules.push({
                          id: crypto.randomUUID(),
                          paymentMethod: 'BANCO',
                          type: 'PERCENTAGE',
                          percentage: 0,
                          description: 'Nueva regla'
                        });
                        handlePaymentInputChange('feeRules', newRules);
                      }}
                      className="px-6 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Añadir Regla
                    </button>
                  </div>
                  <p className="text-slate-500 mb-6 font-light">Define reglas automáticas para registrar gastos por comisiones según el método de pago seleccionado al cobrar una factura.</p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(profile.paymentIntegration?.feeRules || []).map((rule, idx) => (
                      <div key={rule.id} className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative group">
                        <button
                          onClick={() => {
                            const newRules = profile.paymentIntegration?.feeRules?.filter(r => r.id !== rule.id) || [];
                            handlePaymentInputChange('feeRules', newRules);
                          }}
                          className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Método de Pago</label>
                            <select
                              value={rule.paymentMethod}
                              onChange={(e) => {
                                const newRules = [...(profile.paymentIntegration?.feeRules || [])];
                                newRules[idx] = { ...rule, paymentMethod: e.target.value as any };
                                handlePaymentInputChange('feeRules', newRules);
                              }}
                              className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold"
                            >
                              <option value="BANCO">Banco / Transferencia</option>
                              <option value="BIZUM">Bizum / Teléfono</option>
                              <option value="TARJETA">Tarjeta (Manual)</option>
                              <option value="PAYPAL">PayPal</option>
                              <option value="OTRO">Otro</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Comisión</label>
                            <select
                              value={rule.type}
                              onChange={(e) => {
                                const newRules = [...(profile.paymentIntegration?.feeRules || [])];
                                newRules[idx] = { ...rule, type: e.target.value as any };
                                handlePaymentInputChange('feeRules', newRules);
                              }}
                              className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold"
                            >
                              <option value="PERCENTAGE">Porcentaje (%)</option>
                              <option value="FIXED">Monto Fijo (€)</option>
                              <option value="HYBRID">Híbrido (% + €)</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">
                              {rule.type === 'PERCENTAGE' ? 'Porcentaje' : rule.type === 'FIXED' ? 'Monto Fijo' : 'Base (%)'}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                value={rule.type === 'FIXED' ? rule.fixedAmount : rule.percentage}
                                onChange={(e) => {
                                  const newRules = [...(profile.paymentIntegration?.feeRules || [])];
                                  const val = parseFloat(e.target.value) || 0;
                                  if (rule.type === 'FIXED') {
                                    newRules[idx] = { ...rule, fixedAmount: val };
                                  } else {
                                    newRules[idx] = { ...rule, percentage: val };
                                  }
                                  handlePaymentInputChange('feeRules', newRules);
                                }}
                                className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold pr-8"
                              />
                              <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">{rule.type === 'FIXED' ? '€' : '%'}</span>
                            </div>
                          </div>
                          {rule.type === 'HYBRID' && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Extra Fijo (€)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={rule.fixedAmount || 0}
                                  onChange={(e) => {
                                    const newRules = [...(profile.paymentIntegration?.feeRules || [])];
                                    newRules[idx] = { ...rule, fixedAmount: parseFloat(e.target.value) || 0 };
                                    handlePaymentInputChange('feeRules', newRules);
                                  }}
                                  className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold pr-8"
                                />
                                <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">€</span>
                              </div>
                            </div>
                          )}
                          <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción / Proveedor de Gasto</label>
                            <input
                              type="text"
                              value={rule.description}
                              onChange={(e) => {
                                const newRules = [...(profile.paymentIntegration?.feeRules || [])];
                                newRules[idx] = { ...rule, description: e.target.value };
                                handlePaymentInputChange('feeRules', newRules);
                              }}
                              placeholder="Ej: Comisión PayPal"
                              className="w-full p-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-medium"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Stripe Setup Wizard Modal */}
      {showStripeWizard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6 bg-[#1c2938]/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-500">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1c2938]">Configurar Sincronización</h3>
                  <p className="text-slate-500 text-sm">Sigue estos pasos para conectar Stripe con Kônsul.</p>
                </div>
              </div>
              <button onClick={() => setShowStripeWizard(false)} className="p-3 bg-white text-slate-400 hover:text-slate-600 rounded-2xl transition-all shadow-sm">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="space-y-6">
                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center font-bold text-sm">1</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-[#1c2938] mb-1">Entra en Stripe</h4>
                    <p className="text-slate-500 text-sm leading-relaxed mb-3">Haz clic en este botón y si ya tienes sesión saldrá directo:</p>
                    <a
                      href="https://dashboard.stripe.com/webhooks"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#1c2938] text-white rounded-xl text-xs font-bold hover:bg-[#27bea5] transition-colors shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir Panel de Webhooks
                    </a>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center font-bold text-sm">2</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-[#1c2938] mb-1">Selecciona los Eventos</h4>
                    <p className="text-slate-500 text-sm leading-relaxed mb-3">Tras pulsar <strong>+ Add destination</strong>, verás la pantalla de eventos:</p>
                    <ul className="text-xs text-slate-500 space-y-2 list-disc ml-4 font-medium">
                      <li>Marca la opción <strong>"Your account"</strong>.</li>
                      <li>En la barra de búsqueda escribe: <code className="bg-slate-100 px-1 rounded text-indigo-600">checkout.session.completed</code></li>
                      <li>Marca esa casilla y pulsa el botón azul <strong>Continue</strong>.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center font-bold text-sm">3</div>
                  <div className="flex-1">
                    <h4 className="font-bold text-[#1c2938] mb-1">Configura el Destino</h4>
                    <p className="text-slate-500 text-sm leading-relaxed mb-3">En la pantalla <strong>"Configure destination"</strong>, rellena los campos así:</p>
                    <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 mb-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination name</label>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#1c2938]">Kônsul Sync</div>
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Endpoint URL</label>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-600 break-all flex justify-between items-center pr-2">
                          <span className="truncate mr-4">{window.location.origin}/api/webhooks/stripe?uid={profile.id}</span>
                          <button onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/stripe?uid=${profile.id}`);
                            alert.addToast('success', 'Copiado', '¡URL lista para pegar!');
                          }} className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all flex-shrink-0 shadow-sm" title="Copiar URL">
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description (Opcional)</label>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-500">Sincronización automática de cobros facturados.</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 font-medium italic">Finalmente pulsa en el botón azul <strong>Add endpoint</strong> al final de la página.</p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-50 text-green-500 rounded-full flex items-center justify-center font-bold text-sm">4</div>
                  <div>
                    <h4 className="font-bold text-[#1c2938] mb-1">¡Todo Listo!</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">Ahora, cada vez que cobres una factura por Stripe, Kônsul detectará el pago y la marcará como <strong>Pagada</strong> automáticamente.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 flex justify-end">
                <button
                  onClick={() => setShowStripeWizard(false)}
                  className="px-8 py-3 bg-[#1c2938] text-white rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-lg shadow-[#1c2938]/10"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserProfileSettings;
