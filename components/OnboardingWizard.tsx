
import React, { useState, useRef } from 'react';
import {
  Building2, Check, ChevronRight, Palette, CreditCard, ShoppingBag, Mail, Sparkles,
  Loader2, Globe, UploadCloud, LayoutTemplate, Search, MapPin, AlertCircle, X,
  Coins, Smartphone, Server, AtSign, ShieldCheck, Zap, ArrowRight, ArrowLeft, PenLine,
  User, CheckCircle2, Hash, Lock, Eye, EyeOff, Crown, Rocket, Star, Info
} from 'lucide-react';
import { UserProfile, CatalogItem, EmailConfig, ProfileType } from '../types';
import { createUserInDb, saveInitialCatalog } from '../services/neon'; // Import for direct DB creation
import { sendWelcomeEmail } from '../services/resendService'; // Import Email Service
import { ACTIVITY_SECTORS, getIvaArticleForActivity, ActivitySector } from '../data/activitySectors';
import { FreePlanModal } from './FreePlanModal';

interface OnboardingWizardProps {
  onComplete: (profileData: Partial<UserProfile> & { password?: string, email?: string }) => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// España configuration
const DEFAULT_COUNTRY = 'España';
const DEFAULT_CURRENCY = 'EUR';
const DEFAULT_PHONE_CODE = '+34';

const CURRENCIES = ['EUR', 'USD'];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false); // New state for company lookup
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Step 1 State - Identity & Credentials
  const [personType, setPersonType] = useState<'NATURAL' | 'JURIDICA' | null>(null);
  const [taxId, setTaxId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');      // New
  const [province, setProvince] = useState('');  // New
  const [zipCode, setZipCode] = useState('');   // New
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]); // New: Default today
  const [isTarifaPlana, setIsTarifaPlana] = useState(true); // New: Default true for new freelancers
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [showFreeModal, setShowFreeModal] = useState(false); // New State

  // Step 2 State - Fiscal Data (NEW)
  const [createdUserProvider, setCreatedUserProvider] = useState<UserProfile | null>(null);

  // Step 3 State - Activity Selection (Shifted)
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [searchSector, setSearchSector] = useState('');

  // Step 4 State - Branding (Shifted)
  const [primaryColor, setPrimaryColor] = useState('#27bea5');
  const [templateStyle, setTemplateStyle] = useState<'Modern' | 'Classic' | 'Minimal'>('Modern');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4 State - Finance (renumbered from Step 3)
  const [bankAccount, setBankAccount] = useState('');
  const [acceptsOnline, setAcceptsOnline] = useState(false);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  // Step 5 State - Catalog (renumbered from Step 4)
  const [businessDesc, setBusinessDesc] = useState('');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  // Step 6 State - Comms (renumbered from Step 5)
  const [tone, setTone] = useState<'Formal' | 'Casual' | null>(null);
  const [emailPreview, setEmailPreview] = useState('');

  // Step 7 State - Channels (renumbered from Step 6)
  const [whatsappCountryCode, setWhatsappCountryCode] = useState(DEFAULT_PHONE_CODE);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Step 8 State - Plan (renumbered from Step 7)
  const [selectedPlan, setSelectedPlan] = useState<'Emprendedor Pro'>('Emprendedor Pro');

  // --- ACTIONS ---

  const handlePersonTypeSelect = (type: 'NATURAL' | 'JURIDICA') => {
    setPersonType(type);
    setManualEntryMode(true);
    setTaxId('');
    setCompanyName('');
    setAddress('');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- HANDLERS ---
  const handleNext = () => {
    if (step === 1) {
      // Validate Step 1
      if (!companyName || !address || !taxId || !email || !password) {
        alert('Por favor completa todos los campos.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Validate Step 2
      if (!startDate) {
        alert('Por favor indica la fecha de inicio.');
        return;
      }
      setStep(3);
    } else {
      // Default next
      setStep(prev => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1 as Step);
  };

  const generateCatalog = async () => {
    if (!businessDesc || !businessDesc.trim()) {
      alert('Por favor ingresa una descripción de tu negocio.');
      return;
    }
    setIsLoading(true);

    // Function to run local mock generation (Enhanced)
    const runLocalMock = async () => {
      console.log('🔄 Ejecutando generación local (Fallback)...', { sector: selectedSector });
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay

      const businessDescLower = businessDesc.toLowerCase();
      let mockItems: CatalogItem[] = [];

      // Priority 1: Sector Based Fallback (Matches what User Selected)
      const sectorMap: Record<string, CatalogItem[]> = {
        'MARKETING': [
          { id: '1', name: 'Gestión de RRSS', description: 'Plan mensual de redes sociales.', price: 300.00 },
          { id: '2', name: 'Diseño de Logo', description: 'Diseño de identidad visual.', price: 150.00 },
          { id: '3', name: 'Campaña Ads', description: 'Configuración y gestión de campaña.', price: 250.00 }
        ],
        'PROGRAMACION': [
          { id: '1', name: 'Desarrollo Web', description: 'Sitio web corporativo.', price: 800.00 },
          { id: '2', name: 'Mantenimiento', description: 'Mantenimiento mensual web.', price: 50.00 },
          { id: '3', name: 'Consultoría IT', description: 'Hora de soporte técnico.', price: 60.00 }
        ],
        'DISENO': [
          { id: '1', name: 'Diseño Web UI', description: 'Diseño de interfaz web.', price: 400.00 },
          { id: '2', name: 'Branding Completo', description: 'Logo, papelería y manual.', price: 600.00 },
          { id: '3', name: 'Diseño Editorial', description: 'Maquetación de dossier.', price: 150.00 }
        ],
        'SALUD': [
          { id: '1', name: 'Consulta Inicial', description: 'Evaluación y diagnóstico.', price: 60.00 },
          { id: '2', name: 'Sesión Terapia', description: 'Sesión individual (1h).', price: 50.00 },
          { id: '3', name: 'Bono Mensual', description: 'Pack de 4 sesiones.', price: 180.00 }
        ],
        'CONSTRUCCION': [
          { id: '1', name: 'Mano de Obra', description: 'Hora de oficial primera.', price: 28.00 },
          { id: '2', name: 'Presupuesto Reforma', description: 'Reforma parcial según medición.', price: 1500.00 },
          { id: '3', name: 'Desplazamiento', description: 'Salida y diagnóstico.', price: 40.00 }
        ]
      };

      if (selectedSector && sectorMap[selectedSector]) {
        // Sub-logic for specific sectors to be more granular
        if (selectedSector === 'PROGRAMACION') {
          if (businessDescLower.includes('consult') || businessDescLower.includes('estrategia') || businessDescLower.includes('negocio') || businessDescLower.includes('asesor') || businessDescLower.includes('b2b')) {
            mockItems = [
              { id: '1', name: 'Consultoría Tecnológica', description: 'Auditoría y estrategia digital para empresa.', price: 120.00 },
              { id: '2', name: 'Mentoria Técnica', description: 'Sesión de acompañamiento a equipos.', price: 90.00 },
              { id: '3', name: 'Optimización de Procesos', description: 'Análisis y mejora de flujos de trabajo.', price: 150.00 }
            ];
          } else {
            // Default Dev
            mockItems = [
              { id: '1', name: 'Desarrollo Web', description: 'Sitio web corporativo.', price: 800.00 },
              { id: '2', name: 'Mantenimiento', description: 'Mantenimiento mensual web.', price: 50.00 },
              { id: '3', name: 'Consultoría IT', description: 'Hora de soporte técnico.', price: 60.00 }
            ];
          }
        } else {
          mockItems = sectorMap[selectedSector];
        }
      } else {
        // Priority 2: Keyword Matching Fallback (Legacy)
        if (businessDescLower.includes('tecnologia') || businessDescLower.includes('software') || businessDescLower.includes('consultor') || businessDescLower.includes('programador') || businessDescLower.includes('web')) {
          mockItems = [
            { id: '1', name: 'Consultoría Tecnológica', description: 'Asesoramiento especializado en transformación digital.', price: 80.00 },
            { id: '2', name: 'Desarrollo de Software', description: 'Desarrollo de soluciones a medida.', price: 120.00 },
            { id: '3', name: 'Mantenimiento de Sistemas', description: 'Soporte técnico y mantenimiento preventivo.', price: 60.00 },
            { id: '4', name: 'Auditoría de Seguridad', description: 'Análisis de vulnerabilidades y seguridad.', price: 150.00 }
          ];
        } else if (businessDescLower.includes('diseño') || businessDescLower.includes('marketing') || businessDescLower.includes('redes') || businessDescLower.includes('social') || businessDescLower.includes('creativo')) {
          mockItems = [
            { id: '1', name: 'Diseño de Identidad Visual', description: 'Creación de logo y manual de marca.', price: 500.00 },
            { id: '2', name: 'Gestión de Redes Sociales', description: 'Planificación y publicación de contenido mensual.', price: 300.00 },
            { id: '3', name: 'Diseño Web', description: 'Diseño y desarrollo de sitio web corporativo.', price: 1200.00 }
          ];
        } else if (businessDescLower.includes('abogado') || businessDescLower.includes('legal') || businessDescLower.includes('asesor') || businessDescLower.includes('gestor')) {
          mockItems = [
            { id: '1', name: 'Consulta Legal', description: 'Hora de consulta jurídica especializada.', price: 150.00 },
            { id: '2', name: 'Revisión de Contratos', description: 'Análisis y redacción de documentos legales.', price: 250.00 },
            { id: '3', name: 'Gestión de Trámites', description: 'Representación y gestión administrativa.', price: 300.00 }
          ];
        } else if (businessDescLower.includes('video') || businessDescLower.includes('foto') || businessDescLower.includes('camara') || businessDescLower.includes('edicion') || businessDescLower.includes('produccion')) {
          mockItems = [
            { id: '1', name: 'Sesión de Grabación (Jornada)', description: 'Grabación de video profesional (8h).', price: 450.00 },
            { id: '2', name: 'Edición de Video', description: 'Edición y post-producción por proyecto.', price: 300.00 },
            { id: '3', name: 'Fotografía de Producto', description: 'Pack de 10 fotos editadas.', price: 150.00 },
            { id: '4', name: 'Reel para Redes Sociales', description: 'Grabación y edición de video corto vertical.', price: 120.00 }
          ];
        } else if (businessDescLower.includes('limpieza') || businessDescLower.includes('mantenimiento') || businessDescLower.includes('hogar')) {
          mockItems = [
            { id: '1', name: 'Limpieza General', description: 'Servicio de limpieza por hora.', price: 15.00 },
            { id: '2', name: 'Limpieza a Fondo', description: 'Limpieza profunda de estancia o local.', price: 120.00 },
            { id: '3', name: 'Mantenimiento Mensual', description: 'Servicio recurrente de mantenimiento.', price: 200.00 }
          ];
        } else if (businessDescLower.includes('salud') || businessDescLower.includes('entrenador') || businessDescLower.includes('nutricion') || businessDescLower.includes('fisio') || businessDescLower.includes('psicolog')) {
          mockItems = [
            { id: '1', name: 'Consulta Inicial', description: 'Evaluación y diagnóstico inicial.', price: 60.00 },
            { id: '2', name: 'Sesión de Seguimiento', description: 'Sesión individual de tratamiento/entrenamiento.', price: 45.00 },
            { id: '3', name: 'Pack Mensual', description: '4 sesiones al mes con seguimiento.', price: 160.00 }
          ];
        } else if (businessDescLower.includes('obra') || businessDescLower.includes('reforma') || businessDescLower.includes('construccion') || businessDescLower.includes('pintor')) {
          mockItems = [
            { id: '1', name: 'Mano de Obra (Hora)', description: 'Hora de trabajo especializado.', price: 25.00 },
            { id: '2', name: 'Presupuesto Reforma Baño', description: 'Reforma integral de baño estándar.', price: 2500.00 },
            { id: '3', name: 'Pintura Habitación', description: 'Mano de obra y materiales para habitación.', price: 350.00 }
          ];
        } else {
          // Generic Fallback
          mockItems = [
            { id: '1', name: 'Servicio Profesional', description: 'Prestación de servicios profesionales.', price: 100.00 },
            { id: '2', name: 'Asesoría / Consultoría', description: 'Hora de asesoría estándar.', price: 50.00 },
            { id: '3', name: 'Proyecto a Medida', description: 'Ejecución de proyecto según presupuesto.', price: 1000.00 }
          ];
        }
      }

      setCatalogItems(mockItems);
    };

    try {
      // First attempt: Call API
      const response = await fetch('/api/generate-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessDescription: businessDesc.trim(),
          sector: selectedSector,
          subcategories: selectedSubcategories
        })
      });

      // Verify JSON content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('⚠️ API devolvió respuesta no-JSON (probablemente 404 o 500). Usando fallback.');
        await runLocalMock(); // Use Mock if API fails totally (e.g. 404 on Vercel)
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        console.warn('⚠️ API devolvió error:', data.error);
        if (response.status === 404 || response.status === 503 || response.status === 500) {
          await runLocalMock(); // Use Mock if API errors out
        } else {
          alert(data.error || 'Error al generar catálogo.');
        }
        return;
      }

      // Success Path
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        setCatalogItems(data.items);
      } else if (data.canContinue) {
        // Empty but valid response? try mock just in case to be helpful
        await runLocalMock();
      } else {
        alert('No se pudieron generar servicios. Intenta con más detalles.');
      }

    } catch (error) {
      console.error('Error generando catálogo (red/fetch):', error);
      // Fallback on network error
      await runLocalMock();
    } finally {
      setIsLoading(false);
    }
  };

  const updateCatalogItem = (index: number, field: keyof CatalogItem, value: any) => {
    const newItems = [...catalogItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setCatalogItems(newItems);
  };

  const generateEmail = async (selectedTone: 'Formal' | 'Casual') => {
    setTone(selectedTone);
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate-email-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone: selectedTone })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setEmailPreview(data.text || '');
      } else {
        throw new Error('API returned non-JSON response');
      }
    } catch (error) {
      console.error('Error generando plantilla (usando fallback):', error);
      setEmailPreview(selectedTone === 'Formal'
        ? "Estimado cliente,\n\nAdjunto encontrará la factura correspondiente.\n\nSaludos cordiales."
        : "¡Hola!\n\nAquí tienes tu factura. Cualquier duda, avísame.\n\n¡Un abrazo!");
    } finally {
      setIsLoading(false);
    }
  };

  const initiatePayment = async (userId: string) => {
    try {
      setIsRedirecting(true);
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'Emprendedor Pro', // Hardcoded single plan
          email: email,
          userId: userId
        })
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 503) {
          // Si Stripe no está configurado, continuar sin pago
          window.location.href = '/';
          return;
        } else {
          throw new Error(data.error || 'Error al iniciar el pago');
        }
      }

      const { url, error } = await response.json();

      if (error) throw new Error(error);
      if (url) window.location.href = url;

    } catch (error) {
      console.error("Payment Error:", error);
      setIsRedirecting(false);
      alert("Hubo un error iniciando el pago. Por favor intenta más tarde.");
    }
  };

  const skipPayment = async () => {
    setIsRedirecting(true);
    try {
      // Generate ID locally
      const newUserId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const emailConfig: EmailConfig = {
        provider: 'SYSTEM',
        email: email
      };

      const profileData = {
        id: newUserId,
        name: companyName || 'Usuario Nuevo',
        taxId,
        address,
        country: DEFAULT_COUNTRY,
        fiscalConfig: {
          entityType: (personType === 'JURIDICA' ? 'JURIDICA' : 'FISICA') as 'FISICA' | 'JURIDICA',
          nif: taxId,
          regimenFiscal: 'GENERAL' as 'GENERAL' | 'SIMPLIFICADO' | 'AGRICOLA' | 'GANADERO' | 'FORESTAL',
          actividadPrincipal: businessDesc || '',
          activitySector: selectedSector || undefined,
          activitySubcategory: selectedSubcategories.length > 0 ? selectedSubcategories[0] : undefined,
          activitySubcategories: selectedSubcategories.length > 0 ? selectedSubcategories : undefined,
          ivaArticle: (() => {
            if (!selectedSector || selectedSubcategories.length === 0) return undefined;
            const articles = selectedSubcategories.map(subId => getIvaArticleForActivity(selectedSector, subId));
            const uniqueArticles = [...new Set(articles)];
            if (uniqueArticles.length > 1) return 'MIXTO';
            return uniqueArticles[0] as 'ART_21' | 'ART_69_70' | 'ART_69' | 'ART_70' | 'MIXTO';
          })(),
          ivaRegimen: 'GENERAL' as 'GENERAL' | 'SIMPLIFICADO' | 'AGRICULTURA' | 'EXENTO',
          prorrateoIVA: false
        },
        branding: { primaryColor, templateStyle, logoUrl: logoPreview || undefined },
        bankAccount,
        acceptsOnlinePayment: acceptsOnline,
        defaultCurrency: currency,
        defaultServices: catalogItems,
        toneOfVoice: tone || 'Casual',
        emailConfig,
        whatsappNumber,
        whatsappCountryCode,
        plan: 'Freshie' as const, // Free Plan
        isOnboardingComplete: true,
        email,
        password,
        type: personType === 'JURIDICA' ? ProfileType.COMPANY : ProfileType.FREELANCE,
        avatar: logoPreview || ''
      };

      console.log('Creando usuario Freshie en BD...', { email, userId: newUserId });
      const success = await createUserInDb(profileData, password, email);

      if (!success) {
        throw new Error('No se pudo crear el usuario en la base de datos.');
      }

      // Save initial catalog items (generated by AI or Mock)
      if (catalogItems && catalogItems.length > 0) {
        console.log('Guardando catálogo inicial...', catalogItems.length);
        await saveInitialCatalog(newUserId, catalogItems);
      }

      await sendWelcomeEmail({ ...profileData, email } as UserProfile);
      localStorage.setItem('konsul_user_data', JSON.stringify(profileData));

      // Redirect to Dashboard
      window.location.href = '/';

    } catch (e: any) {
      console.error("Skip Payment Error", e);
      alert(e.message || "Hubo un error al crear tu cuenta gratuita.");
      setIsRedirecting(false);
    }
  };

  const finishOnboarding = async () => {
    const emailConfig: EmailConfig = {
      provider: 'SYSTEM',
      email: email
    };

    // Generate ID locally so we can pass it to both Stripe and DB
    const newUserId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const profileData = {
      id: newUserId, // Important: Pass generated ID
      name: companyName || 'Usuario Nuevo',
      taxId,
      address,
      city,     // New
      province, // New
      zipCode,  // New
      country: DEFAULT_COUNTRY,
      fiscalConfig: {
        entityType: (personType === 'JURIDICA' ? 'JURIDICA' : 'FISICA') as 'FISICA' | 'JURIDICA',
        nif: taxId,
        regimenFiscal: 'GENERAL' as 'GENERAL' | 'SIMPLIFICADO' | 'AGRICOLA' | 'GANADERO' | 'FORESTAL',
        actividadPrincipal: businessDesc || '',
        activitySector: selectedSector || undefined,
        activitySubcategory: selectedSubcategories.length > 0 ? selectedSubcategories[0] : undefined,
        activitySubcategories: selectedSubcategories.length > 0 ? selectedSubcategories : undefined,
        ivaArticle: (() => {
          if (!selectedSector || selectedSubcategories.length === 0) return undefined;
          const articles = selectedSubcategories.map(subId => getIvaArticleForActivity(selectedSector, subId));
          const uniqueArticles = [...new Set(articles)];
          if (uniqueArticles.length > 1) return 'MIXTO';
          return uniqueArticles[0] as 'ART_21' | 'ART_69_70' | 'ART_69' | 'ART_70' | 'MIXTO';
        })(),
        ivaRegimen: 'GENERAL' as 'GENERAL' | 'SIMPLIFICADO' | 'AGRICULTURA' | 'EXENTO',
        prorrateoIVA: false,
        startDate,       // New
        isTarifaPlana    // New
      },
      branding: { primaryColor, templateStyle, logoUrl: logoPreview || undefined },
      bankAccount,
      acceptsOnlinePayment: acceptsOnline,
      defaultCurrency: currency,
      defaultServices: catalogItems,
      toneOfVoice: tone || 'Casual',
      emailConfig,
      whatsappNumber,
      whatsappCountryCode,
      plan: 'Money Honey' as const, // Force Paid Plan
      isOnboardingComplete: true,
      email,
      password,
      // Include required fields for UserProfile
      type: personType === 'JURIDICA' ? ProfileType.COMPANY : ProfileType.FREELANCE,
      avatar: logoPreview || ''
    };

    setIsRedirecting(true);

    try {
      // 1. Create User in DB directly (bypass App state update to avoid flashing dashboard)
      // We import createUserInDb directly instead of relying on callback that changes view
      console.log('Intentando crear usuario en BD...', { email, userId: newUserId });
      const success = await createUserInDb(profileData, password, email);

      if (!success) {
        console.error('createUserInDb retornó false');
        throw new Error('No se pudo crear el usuario en la base de datos. Verifica tu conexión y que el email no esté ya registrado.');
      }

      console.log('Usuario creado exitosamente en BD');

      // 2. SEND WELCOME EMAIL (Template: welcome-to-konsul-bills)
      // We do this before redirecting. It's best effort.
      try {
        await sendWelcomeEmail({ ...profileData, email } as UserProfile);
      } catch (mailError) {
        console.error("Failed to send welcome email:", mailError);
        // Continue flow even if email fails
      }

      // 3. Set LocalStorage so when they return from Stripe, App.tsx can rehydrate session
      localStorage.setItem('konsul_user_data', JSON.stringify(profileData));

      // 4. Initiate Stripe Session with the created User ID (or skip if user chooses)
      await initiatePayment(newUserId);
    } catch (e: any) {
      console.error("Onboarding Error", e);
      alert(e.message || "Hubo un error al guardar tu perfil. Intenta nuevamente.");
      setIsRedirecting(false);
    }
  };

  // --- RENDER HELPERS ---
  const renderTemplatePreview = (style: 'Modern' | 'Classic' | 'Minimal') => {
    // ... (Keep existing preview logic)
    const isSelected = templateStyle === style;
    switch (style) {
      case 'Modern':
        return (
          <div className="h-full flex flex-col bg-white">
            <div style={{ backgroundColor: primaryColor }} className="h-16 w-full flex items-center px-2 relative transition-colors duration-300">
              {logoPreview && <img src={logoPreview} className="h-8 w-8 object-contain bg-white rounded-md p-0.5 shadow-sm" />}
            </div>
            <div className="p-3 space-y-2">
              <div className="h-1.5 bg-slate-100 w-3/4 rounded-full"></div>
              <div className="h-1.5 bg-slate-100 w-1/2 rounded-full"></div>
            </div>
            <div className="mt-auto p-3 border-t border-slate-50 flex justify-between items-center">
              <span className="text-[6px] font-bold text-slate-400">TOTAL</span>
              <div style={{ color: primaryColor }} className="text-[10px] font-bold">€1,250.00</div>
            </div>
          </div>
        );
      case 'Classic':
        return (
          <div className="h-full flex flex-col bg-white p-4 border-4 border-double" style={{ borderColor: isSelected ? primaryColor : '#e2e8f0' }}>
            <div className="text-center mb-3 border-b pb-2" style={{ borderColor: primaryColor }}>
              <span className="text-[8px] font-serif font-bold text-[#1c2938] uppercase tracking-widest">Factura</span>
            </div>
            <div className="flex justify-between items-start mb-2">
              {logoPreview ? <img src={logoPreview} className="h-6 w-6 object-contain" /> : <div className="h-6 w-6 bg-slate-100 rounded"></div>}
              <div className="space-y-1 text-right">
                <div className="h-1 bg-slate-200 w-8 ml-auto"></div>
                <div className="h-1 bg-slate-200 w-5 ml-auto"></div>
              </div>
            </div>
          </div>
        );
      case 'Minimal':
        return (
          <div className="h-full flex flex-col bg-white p-4">
            <div className="flex items-center gap-3 mb-6">
              {logoPreview ? (
                <img src={logoPreview} className="h-8 w-8 object-contain" />
              ) : (
                <div style={{ backgroundColor: primaryColor }} className="h-4 w-4 rounded-full"></div>
              )}
              <div className="h-2 w-16 bg-slate-100 rounded"></div>
            </div>
            <div className="mt-auto text-right">
              <p className="text-[8px] text-slate-400 uppercase">Total a Pagar</p>
              <span style={{ color: primaryColor }} className="text-xs font-bold tracking-tighter text-2xl">€1,250</span>
            </div>
          </div>
        );
    }
  };


  // --- STEPS ---

  const renderStep1_Fiscal = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-blue-100 shadow-sm">
          <span>🇪🇸</span> Edición España
        </div>
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Identidad Fiscal</h2>
        <p className="text-slate-500 text-lg">Selecciona tu tipo de entidad para configurar tu perfil.</p>
      </div>

      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 max-w-2xl mx-auto">

        {/* Person Type Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => handlePersonTypeSelect('NATURAL')}
            className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 group ${personType === 'NATURAL'
              ? 'border-[#27bea5] bg-[#27bea5]/5 ring-2 ring-[#27bea5]/10 shadow-lg'
              : 'border-slate-100 hover:border-slate-300 bg-white hover:shadow-md'
              }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${personType === 'NATURAL' ? 'bg-[#27bea5] text-white' : 'bg-slate-100 text-slate-400'}`}>
              <User className="w-6 h-6" />
            </div>
            <h3 className={`font-bold text-lg ${personType === 'NATURAL' ? 'text-[#1c2938]' : 'text-slate-600'}`}>Persona Física</h3>
            <p className="text-sm text-slate-400 mt-1">Autónomo / Profesional (NIF)</p>
          </button>

          <button
            onClick={() => handlePersonTypeSelect('JURIDICA')}
            className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 group ${personType === 'JURIDICA'
              ? 'border-[#27bea5] bg-[#27bea5]/5 ring-2 ring-[#27bea5]/10 shadow-lg'
              : 'border-slate-100 hover:border-slate-300 bg-white hover:shadow-md'
              }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${personType === 'JURIDICA' ? 'bg-[#27bea5] text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className={`font-bold text-lg ${personType === 'JURIDICA' ? 'text-[#1c2938]' : 'text-slate-600'}`}>Persona Jurídica</h3>
            <p className="text-sm text-slate-400 mt-1">Empresa / Sociedad (CIF)</p>
          </button>
        </div>

        {/* Manual Entry Form */}
        {(personType) && (
          <div className="mt-8 bg-slate-50 p-6 rounded-3xl border border-slate-100 animate-in slide-in-from-bottom-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-[#1c2938] flex items-center gap-2">
                <PenLine className="w-5 h-5 text-[#27bea5]" />
                Datos Oficiales
              </h3>
            </div>

            <div className="space-y-4">
              {/* 1. Tax ID */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                  {personType === 'NATURAL' ? 'NIF (Número de Identificación Fiscal)' : 'CIF (Código de Identificación Fiscal)'}
                </label>
                <div className="relative group/input">
                  <Hash className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                  <input
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value.toUpperCase())}
                    onBlur={async () => {
                      if (personType === 'JURIDICA' && taxId.length >= 8) {
                        setIsFetchingData(true);
                        try {
                          const { fetchCompanyData } = await import('../services/companyDataService');
                          const data = await fetchCompanyData(taxId);
                          if (data) {
                            setCompanyName(data.name);
                            setAddress(data.address);
                            // Optional: toast success
                          }
                        } catch (error) {
                          console.error("Error fetching company data", error);
                        } finally {
                          setIsFetchingData(false);
                        }
                      }
                    }}
                    className="w-full pl-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none font-mono font-bold text-[#1c2938] placeholder:text-slate-300 uppercase pr-10"
                    placeholder={personType === 'NATURAL' ? "Ej: 12345678Z" : "Ej: B12345678"}
                    autoFocus
                  />
                  {isFetchingData && (
                    <div className="absolute right-4 top-3.5">
                      <Loader2 className="w-5 h-5 text-[#27bea5] animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Name */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                  {personType === 'NATURAL' ? 'Nombre Completo' : 'Razón Social'}
                </label>
                <div className="relative group/input">
                  {personType === 'NATURAL' ? (
                    <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                  ) : (
                    <Building2 className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                  )}
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full pl-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none font-bold text-[#1c2938] placeholder:text-slate-300"
                    placeholder={personType === 'JURIDICA' ? "Nombre de la Sociedad" : "Tu Nombre Completo"}
                  />
                </div>
              </div>

              {/* Expanded Address Fields */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Domicilio Fiscal</label>
                <div className="relative group/input">
                  <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none text-slate-700 placeholder:text-slate-300 transition-all font-medium"
                    placeholder="Calle / Avenida / Plaza..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none text-slate-700 placeholder:text-slate-300 transition-all font-medium"
                    placeholder="Localidad"
                  />
                  <input
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none text-slate-700 placeholder:text-slate-300 transition-all font-medium"
                    placeholder="Provincia"
                  />
                </div>
                <input
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="w-1/2 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none text-slate-700 placeholder:text-slate-300 transition-all font-medium"
                  placeholder="Código Postal"
                />
              </div>

              {/* 3. Credentials (Renumbered) */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-sm font-bold text-[#1c2938] mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#27bea5]" /> Crea tu Acceso Seguro
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Correo Electrónico</label>
                    <div className="relative group/input">
                      <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none text-slate-700 placeholder:text-slate-300"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Contraseña</label>
                    <div className="relative group/input">
                      <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-12 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#27bea5] outline-none text-slate-700 placeholder:text-slate-300"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-[#1c2938] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-10 flex justify-end">
          <button
            onClick={handleNext}
            disabled={!companyName || !address || !taxId || !email || !password}
            className="group w-full md:w-auto bg-[#1c2938] text-white py-4 px-10 rounded-2xl font-bold text-lg hover:bg-[#27bea5] disabled:opacity-30 disabled:hover:bg-[#1c2938] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 cursor-pointer"
          >
            Siguiente <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep2_FiscalData = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-100 shadow-sm">
          <span>📅</span> Datos de Alta de Autónomo
        </div>
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Inicio de Actividad</h2>
        <p className="text-slate-500 text-lg">Para calcular tus impuestos con precisión, necesitamos saber cuándo empezaste.</p>
      </div>

      <div className="max-w-2xl mx-auto bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-8">

        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Fecha de Inicio de Actividad</label>
          <div className="relative group/input">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within/input:text-[#27bea5] transition-colors pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-12 p-4 border-2 border-slate-100 rounded-2xl focus:border-[#27bea5] outline-none text-[#1c2938] font-bold text-lg bg-slate-50/50"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 ml-1">La fecha oficial que aparece en tu Modelo 036/037.</p>
        </div>

        {personType === 'NATURAL' ? (
          <div
            onClick={() => setIsTarifaPlana(!isTarifaPlana)}
            className={`cursor-pointer border-2 rounded-2xl p-6 flex items-center justify-between transition-all duration-300 group ${isTarifaPlana ? 'border-[#27bea5] bg-[#27bea5]/5 ring-2 ring-[#27bea5]/10' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className={`font-bold text-lg ${isTarifaPlana ? 'text-[#1c2938]' : 'text-slate-600'}`}>Tarifa Plana</h3>
                {isTarifaPlana && <span className="bg-[#27bea5] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">ACTIVA</span>}
              </div>
              <p className="text-sm text-slate-500">
                Cuota reducida de Seguridad Social (~88€/mes) durante el primer año.
              </p>
            </div>
            <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${isTarifaPlana ? 'bg-[#27bea5] border-[#27bea5] scale-110' : 'border-slate-300 bg-white'}`}>
              {isTarifaPlana && <Check className="w-5 h-5 text-white" />}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex gap-4 text-slate-500">
            <div className="p-2 bg-white rounded-lg border border-slate-100 h-fit">
              <Info className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-sm">
              <p className="font-bold text-slate-700 mb-1">Nota para Empresas</p>
              <p>La Tarifa Plana de autónomos generalmente aplica a personas físicas. Como sociedad, la cotización depende de los administradores.</p>
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
          <button onClick={handleBack} className="text-slate-400 font-bold hover:text-slate-600 transition-colors">Atrás</button>
          <button
            onClick={handleNext}
            disabled={!startDate}
            className="bg-[#1c2938] text-white py-4 px-10 rounded-2xl font-bold text-lg hover:bg-[#27bea5] disabled:opacity-50 transition-all shadow-xl hover:shadow-2xl flex items-center gap-3"
          >
            Continuar <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep2_Activity = () => {
    const selectedSectorData = ACTIVITY_SECTORS.find(s => s.id === selectedSector);
    const filteredSectors = searchSector
      ? ACTIVITY_SECTORS.filter(s => s.name.toLowerCase().includes(searchSector.toLowerCase()))
      : ACTIVITY_SECTORS;

    return (
      <div className="animate-in fade-in slide-in-from-right-8 duration-500">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Actividad Económica</h2>
          <p className="text-slate-500 text-lg">Selecciona el rubro que mejor describe tu actividad. Esto nos ayuda a aplicar la normativa fiscal correcta.</p>
        </div>

        <div className="max-w-5xl mx-auto space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchSector}
              onChange={(e) => setSearchSector(e.target.value)}
              placeholder="Buscar rubro (ej: Tecnología, Diseño, Consultoría...)"
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#27bea5] transition-all text-lg"
            />
          </div>

          {/* Sector Selection */}
          {!selectedSector ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
              {filteredSectors.map((sector) => (
                <button
                  key={sector.id}
                  onClick={() => {
                    setSelectedSector(sector.id);
                    setSelectedSubcategories([]); // Reset subcategories when changing sector
                  }}
                  className="p-6 bg-white border-2 border-slate-100 rounded-2xl hover:border-[#27bea5] hover:shadow-lg transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-[#1c2938] text-lg group-hover:text-[#27bea5] transition-colors">
                      {sector.name}
                    </h3>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#27bea5] transition-colors" />
                  </div>
                  <p className="text-xs text-slate-500">
                    {sector.subcategories.length} {sector.subcategories.length === 1 ? 'opción' : 'opciones'}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Back Button */}
              <button
                onClick={() => {
                  setSelectedSector('');
                  setSelectedSubcategories([]);
                }}
                className="flex items-center gap-2 text-slate-500 hover:text-[#1c2938] transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Volver a rubros
              </button>

              {/* Sector Info */}
              <div className="bg-gradient-to-br from-[#27bea5] to-[#1e9984] p-6 rounded-2xl text-white">
                <h3 className="text-2xl font-bold mb-2">{selectedSectorData?.name}</h3>
                <p className="text-white/80 text-sm">
                  Selecciona todas las subcategorías que describen tu actividad (puedes seleccionar varias)
                </p>
              </div>

              {/* Subcategory Selection - Multiple Selection with Checkboxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
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
                      className={`p-5 bg-white border-2 rounded-2xl text-left transition-all ${isSelected
                        ? 'border-[#27bea5] bg-[#27bea5]/5 shadow-lg'
                        : 'border-slate-100 hover:border-[#27bea5]/50'
                        }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected
                            ? 'bg-[#27bea5] border-[#27bea5]'
                            : 'border-slate-300 bg-white'
                            }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-[#1c2938]">{sub.name}</h4>
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
                const ivaArticles = selectedSubcategories.map(subId => getIvaArticleForActivity(selectedSector, subId));
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
                  <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
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
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-10 pt-8 border-t border-slate-100">
          <button
            onClick={() => setStep(2)}
            className="text-slate-500 hover:text-[#1c2938] font-medium flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
          <button
            onClick={() => setStep(4)}
            disabled={!selectedSector || selectedSubcategories.length === 0}
            className="group bg-[#1c2938] text-white py-4 px-10 rounded-2xl font-bold text-lg hover:bg-[#27bea5] disabled:opacity-30 disabled:hover:bg-[#1c2938] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3 cursor-pointer"
          >
            Siguiente <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  };

  const renderStep3_Branding = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Diseña tu Marca</h2>
        <p className="text-slate-500 text-lg">Personaliza cómo te verán tus clientes.</p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-8">

          {/* Logo Uploader */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="font-bold text-[#1c2938] mb-4 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-[#27bea5]" /> Logotipo
            </h3>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleLogoUpload}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative group cursor-pointer border-2 border-dashed border-slate-200 rounded-2xl h-48 flex flex-col items-center justify-center hover:border-[#27bea5] hover:bg-slate-50 transition-all overflow-hidden"
            >
              {logoPreview ? (
                <>
                  <img src={logoPreview} className="w-full h-full object-contain p-6" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold">
                    Cambiar Logo
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-[#27bea5]" />
                  </div>
                  <p className="text-sm font-bold text-slate-500">Arrastra o haz clic</p>
                </>
              )}
            </div>
          </div>

          {/* Color Picker */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="font-bold text-[#1c2938] mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#27bea5]" /> Color Principal
            </h3>
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-14 h-14 rounded-xl cursor-pointer border-none bg-transparent"
              />
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-400 uppercase">HEX Code</p>
                <p className="font-mono text-lg font-bold text-[#1c2938]">{primaryColor}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-4 font-bold text-slate-500 hover:text-[#1c2938] hover:bg-white rounded-2xl transition-colors cursor-pointer"
            >
              Atrás
            </button>
            <button
              onClick={() => setStep(6)}
              className="flex-[2] bg-[#1c2938] text-white py-4 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              Se ve genial <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Column: Interactive Preview */}
        <div className="lg:col-span-7">
          <div className="bg-slate-100 p-8 rounded-[3rem] h-full flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-500 uppercase tracking-widest text-xs mb-6 text-center">Selecciona tu Estilo</h3>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {(['Modern', 'Classic', 'Minimal'] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => setTemplateStyle(style)}
                    className={`py-3 px-2 rounded-xl text-sm font-bold transition-all ${templateStyle === style
                      ? 'bg-white text-[#1c2938] shadow-md ring-1 ring-black/5'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                      }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* The "Document" */}
            <div className="flex-1 bg-white rounded-xl shadow-2xl shadow-slate-300/50 overflow-hidden transform transition-all duration-500 hover:scale-[1.02] origin-bottom mx-auto w-full max-w-sm aspect-[3/4] relative">
              {renderTemplatePreview(templateStyle)}
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-50 pointer-events-none"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  const renderStep4_Finance = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Bóveda Financiera</h2>
        <p className="text-slate-500 text-lg">Define cómo y en qué moneda recibirás tus pagos.</p>
      </div>

      <div className="max-w-xl mx-auto space-y-6">

        {/* Bank Account Card */}
        <div className="bg-gradient-to-br from-[#1c2938] to-slate-800 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#27bea5] rounded-full blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>

          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-center">
              <CreditCard className="w-8 h-8 text-[#27bea5]" />
              <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full text-slate-300 uppercase tracking-widest">Principal</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Cuenta Bancaria (IBAN / ACH)</label>
              <input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="0000 0000 0000 0000"
                className="w-full bg-transparent text-2xl md:text-3xl font-mono text-white placeholder:text-slate-600 outline-none border-b border-slate-600 focus:border-[#27bea5] py-2 transition-colors"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Moneda Base</label>
                <div className="relative">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-white/10 text-white p-3 rounded-xl outline-none appearance-none cursor-pointer hover:bg-white/20 transition-colors font-bold"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
                  </select>
                  <Coins className="absolute right-3 top-3 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Banco</label>
                <input className="w-full bg-white/10 text-white p-3 rounded-xl outline-none placeholder:text-slate-500 font-medium" placeholder="Ej. Banco General" />
              </div>
            </div>
          </div>
        </div>

        {/* Online Payments Toggle */}
        <div
          onClick={() => setAcceptsOnline(!acceptsOnline)}
          className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all duration-300 flex items-center justify-between group ${acceptsOnline ? 'bg-[#27bea5]/5 border-[#27bea5]' : 'bg-white border-slate-100 hover:border-slate-300'
            }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${acceptsOnline ? 'bg-[#27bea5] text-white' : 'bg-slate-100 text-slate-400'
              }`}>
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h4 className={`font-bold text-lg ${acceptsOnline ? 'text-[#1c2938]' : 'text-slate-600'}`}>Pagos Digitales</h4>
              <p className="text-sm text-slate-400">Habilitar enlaces de pago y QR</p>
            </div>
          </div>

          <div className={`w-14 h-8 rounded-full relative transition-colors ${acceptsOnline ? 'bg-[#27bea5]' : 'bg-slate-200'}`}>
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${acceptsOnline ? 'left-7' : 'left-1'}`}></div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            onClick={() => setStep(4)}
            className="flex-1 py-4 font-bold text-slate-500 hover:text-[#1c2938] hover:bg-white rounded-2xl transition-colors cursor-pointer"
          >
            Atrás
          </button>
          <button
            onClick={() => setStep(6)}
            className="flex-[2] bg-[#1c2938] text-white py-4 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
          >
            Guardar Billetera <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );

  const renderStep5_Catalog = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Oferta de Valor</h2>
        <p className="text-slate-500 text-lg">Describe tu negocio y la IA creará tu catálogo inicial.</p>
      </div>

      <div className="max-w-3xl mx-auto">

        {/* Magic Input */}
        <div className="bg-white p-2 rounded-[2rem] shadow-xl shadow-indigo-100/50 border border-slate-100 flex flex-col md:flex-row gap-2 relative z-10">
          <input
            value={businessDesc}
            onChange={(e) => setBusinessDesc(e.target.value)}
            placeholder="Ej: Soy diseñador gráfico freelance y hago branding..."
            className="flex-1 p-6 text-lg bg-transparent outline-none text-[#1c2938] placeholder:text-slate-300 font-medium"
            onKeyDown={(e) => e.key === 'Enter' && generateCatalog()}
            autoFocus
          />
          <button
            onClick={generateCatalog}
            disabled={!businessDesc || isLoading}
            className="bg-[#27bea5] text-white px-8 py-4 rounded-[1.5rem] font-bold hover:bg-[#22a890] disabled:opacity-50 transition-all flex items-center gap-2 min-w-[160px] justify-center group cursor-pointer"
          >
            {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5 group-hover:scale-125 transition-transform" />}
            <span>{isLoading ? 'Creando...' : 'Generar'}</span>
          </button>
        </div>

        {/* Results Area */}
        <div className="mt-10 min-h-[300px]">
          {catalogItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-8">
              {catalogItems.map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 hover:border-[#27bea5] transition-all group hover:-translate-y-1 flex flex-col gap-3 relative">
                  {/* Edit Indicator */}
                  <div className="absolute top-4 right-4 text-slate-300 group-hover:text-[#27bea5] transition-colors pointer-events-none">
                    <PenLine className="w-4 h-4" />
                  </div>

                  <div className="flex justify-between items-start mb-1">
                    <div className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl group-hover:bg-[#27bea5] group-hover:text-white transition-colors flex-shrink-0">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-xl font-bold text-[#1c2938]">
                        <span className="text-slate-400 mr-1 text-sm">€</span>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => updateCatalogItem(idx, 'price', parseFloat(e.target.value) || 0)}
                          className="w-24 bg-transparent outline-none border-b border-transparent focus:border-[#27bea5] transition-colors text-right"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const newItems = [...catalogItems];
                          newItems.splice(idx, 1);
                          setCatalogItems(newItems);
                        }}
                        className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-colors"
                        title="Eliminar Servicio"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateCatalogItem(idx, 'name', e.target.value)}
                    className="font-bold text-lg text-slate-800 bg-transparent outline-none border-b border-transparent focus:border-[#27bea5] transition-colors w-full"
                  />
                  <p className="text-sm text-slate-400 font-light">Servicio sugerido</p>
                </div>
              ))}

              {/* Next Step Card */}
              <div className="flex items-center justify-center p-6">
                <button
                  onClick={() => setStep(7)}
                  className="w-full bg-[#1c2938] text-white py-4 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  Continuar <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300 h-64 border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50 transition-all">
              <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-medium mb-2 text-slate-400">Tus servicios aparecerán aquí</p>
              {businessDesc && !isLoading && (
                <div className="text-center mt-4 space-y-3">
                  <p className="text-xs text-slate-400 mb-2">
                    Haz clic en "Generar" para crear tu catálogo con IA
                  </p>
                  <p className="text-xs text-slate-300 italic mb-4">
                    O puedes continuar y agregar servicios manualmente más tarde
                  </p>
                  <button
                    onClick={() => setStep(7)}
                    className="px-6 py-2 bg-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-300 transition-colors text-sm"
                  >
                    Continuar sin catálogo
                  </button>
                </div>
              )}
              {!businessDesc && (
                <p className="text-xs text-slate-300 mt-2">
                  Describe tu negocio arriba y haz clic en "Generar"
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep6_Comms = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Tu Voz ante el Cliente</h2>
        <p className="text-slate-500 text-lg">Elige el tono de comunicación para tus correos automáticos.</p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Tone Selectors */}
        <div className="space-y-6">
          {(['Formal', 'Casual'] as const).map((t) => (
            <button
              key={t}
              onClick={() => generateEmail(t)}
              className={`w-full p-8 text-left rounded-[2.5rem] border-2 transition-all duration-300 group hover:shadow-lg cursor-pointer ${tone === t
                ? 'border-[#27bea5] bg-white ring-4 ring-[#27bea5]/10 shadow-lg'
                : 'border-transparent bg-white shadow-sm hover:border-slate-200'
                }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${tone === t ? 'bg-[#27bea5] text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {t === 'Formal' ? <Building2 className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                </div>
                {tone === t && <div className="w-6 h-6 bg-[#27bea5] rounded-full flex items-center justify-center text-white"><Check className="w-4 h-4" /></div>}
              </div>
              <h3 className="text-2xl font-bold text-[#1c2938] mb-2">{t === 'Formal' ? 'Corporativo' : 'Cercano'}</h3>
              <p className="text-slate-500 font-light leading-relaxed">
                {t === 'Formal'
                  ? "Ideal para empresas grandes. Serio, directo y profesional. Genera confianza institucional."
                  : "Perfecto para creativos y freelancers. Amigable, usa emojis y calidez humana."}
              </p>
            </button>
          ))}
        </div>

        {/* Live Preview (Phone Style) */}
        <div className="relative mx-auto">
          <div className="w-[320px] h-[580px] bg-[#1c2938] rounded-[3rem] p-4 shadow-2xl relative border-4 border-[#2c3e50]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1c2938] rounded-b-2xl z-20"></div>
            <div className="bg-slate-50 w-full h-full rounded-[2.2rem] overflow-hidden flex flex-col relative">
              <div className="bg-white p-4 pt-10 border-b border-slate-100 shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                  <div className="h-2 bg-slate-200 w-24 rounded-full"></div>
                </div>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#27bea5]" />
                    <span className="text-xs font-bold uppercase tracking-widest">Escribiendo...</span>
                  </div>
                ) : tone ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4">
                    <div className="font-serif text-slate-800 text-lg leading-relaxed mb-6">
                      {emailPreview || (tone === 'Formal' ? "Estimado cliente..." : "Hola!...")}
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
                        <span className="font-bold text-xs">PDF</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Factura_001.pdf</p>
                        <p className="text-[10px] text-slate-400">125 KB</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-4">
                    <Sparkles className="w-12 h-12 mb-4 opacity-30" />
                    <p className="font-medium text-sm">Selecciona un estilo.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-full flex justify-center">
            <button
              onClick={() => setStep(9)}
              disabled={!tone}
              className="bg-[#27bea5] text-white px-10 py-4 rounded-full font-bold shadow-xl hover:bg-[#22a890] hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
            >
              Continuar <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep7_Channels = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Conexiones Finales</h2>
        <p className="text-slate-500 text-lg">El correo oficial ya está configurado. Opcionalmente, agrega WhatsApp.</p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Email Channel Card (System Only) */}
        <div className="p-8 rounded-[2.5rem] bg-[#1c2938] text-white shadow-xl flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl">
              <Mail className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Correo Oficial</h3>
              <p className="text-sm text-slate-400">Entrega garantizada por Resend</p>
            </div>
          </div>

          <div className="bg-white/10 p-6 rounded-2xl border border-white/10 mb-4">
            <div className="flex items-center gap-3 text-green-400 font-bold mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Activado</span>
            </div>
            <p className="text-sm text-slate-300">
              Tus facturas se enviarán automáticamente desde nuestro servidor seguro. No requiere configuración adicional.
            </p>
          </div>
        </div>

        {/* WhatsApp Channel Card */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                <Smartphone className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-[#1c2938]">WhatsApp Business</h3>
                <p className="text-sm text-slate-400">Entrega rápida (Opcional)</p>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Código</label>
                <select
                  value={whatsappCountryCode}
                  onChange={(e) => setWhatsappCountryCode(e.target.value)}
                  className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold text-[#1c2938] outline-none"
                >
                  <option value="+34">🇪🇸 +34 (España)</option>
                  <option value="+1">🇺🇸 +1</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">Número</label>
                <input
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full p-3 bg-white rounded-xl border border-slate-200 font-bold text-[#1c2938] outline-none placeholder:text-slate-300"
                  placeholder="612345678"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-12">
        <button
          onClick={() => setStep(9)} // Move to Step 9 (Plan)
          className="bg-[#1c2938] text-white py-5 px-16 rounded-[2rem] font-bold text-xl hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 flex items-center gap-3 cursor-pointer"
        >
          Siguiente <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );

  const renderStep8_Plan = () => (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-[#1c2938] mb-3">Activa tu Suscripción</h2>
        <p className="text-slate-500 text-lg">Comienza a potenciar tu negocio hoy mismo.</p>
      </div>

      <div className="max-w-2xl mx-auto">

        {/* SINGLE PAID PLAN (VIP Style) */}
        <div
          className="p-10 rounded-[2.5rem] border-2 border-amber-400 bg-amber-50/10 ring-4 ring-amber-400/20 shadow-2xl relative overflow-hidden transform hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white via-amber-50/20 to-white pointer-events-none"></div>

          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <h3 className="text-3xl font-bold text-[#1c2938]">Money Honey</h3>
              <Crown className="w-8 h-8 text-amber-500 fill-amber-500" />
            </div>
            <p className="text-6xl font-black text-[#1c2938] mb-2">€5 <span className="text-xl font-medium text-slate-400">/mes</span></p>
            <p className="text-slate-500 mb-8">Acceso total a todas las herramientas.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-left max-w-lg mx-auto mb-10">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0" /> <span className="font-medium text-slate-700">Facturación Ilimitada</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0" /> <span className="font-medium text-slate-700">Sin Marca de Agua</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0" /> <span className="font-medium text-slate-700">IA Integrada (Gemini)</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0" /> <span className="font-medium text-slate-700">Soporte Prioritario</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0" /> <span className="font-medium text-slate-700">Gestión de Clientes CRM</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0" /> <span className="font-medium text-slate-700">Reportes Financieros</span></li>
            </div>

            <div className="space-y-4">
              <button
                onClick={finishOnboarding}
                disabled={isRedirecting}
                className="w-full bg-[#1c2938] text-white py-5 px-10 rounded-[2rem] font-bold text-xl hover:bg-amber-500 hover:text-white transition-all shadow-xl hover:shadow-2xl active:translate-y-0 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isRedirecting ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> Procesando Pago...</>
                ) : (
                  <><CreditCard className="w-6 h-6" /> Suscribirse y Continuar</>
                )}
              </button>

              <button
                onClick={() => setShowFreeModal(true)}
                disabled={isRedirecting}
                className="w-full bg-slate-100 text-slate-600 py-4 px-10 rounded-[2rem] font-bold text-lg hover:bg-slate-200 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                Empezar Gratis
              </button>

              <p className="text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Pago seguro vía Stripe
              </p>
            </div>
          </div>
        </div>
      </div>

      <FreePlanModal
        isOpen={showFreeModal}
        onClose={() => setShowFreeModal(false)}
        onConfirm={() => {
          setShowFreeModal(false);
          skipPayment();
        }}
      />
    </div>
  );

  // --- MAIN LAYOUT ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden">

      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#27bea5] rounded-full blur-[120px] opacity-5 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#1c2938] rounded-full blur-[120px] opacity-5 translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

      {/* Header / Progress */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-8 pb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Official Icon */}
          <img
            src="https://konsul.digital/wp-content/uploads/2025/07/cropped-3.png"
            alt="Kônsul Icon"
            className="w-12 h-12 object-contain"
          />
          <div>
            {/* Official Logo Text */}
            <img
              src="https://konsul.digital/wp-content/uploads/2025/11/1-min-e1762361628509.avif"
              alt="Kônsul"
              className="h-6 object-contain block mb-1"
            />
            <span className="text-xs text-slate-400 font-medium">Asistente de Configuración</span>
          </div>
        </div>

        {/* Visual Progress Steps */}
        <div className="hidden md:flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-[#27bea5]' : 'w-4 bg-slate-200'
                }`}
            />
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-center py-8 relative z-10 px-4">
        <div className="w-full">
          {step === 1 && renderStep1_Fiscal()}
          {step === 2 && renderStep2_FiscalData()}
          {step === 3 && renderStep2_Activity()}
          {step === 4 && renderStep3_Branding()}
          {step === 5 && renderStep4_Finance()}
          {step === 6 && renderStep5_Catalog()}
          {step === 7 && renderStep6_Comms()}
          {step === 8 && renderStep7_Channels()}
          {step === 9 && renderStep8_Plan()}
        </div>
      </div>

      {/* Footer / Skip */}
      <div className="text-center pb-8 relative z-10">
        {step > 1 && step < 8 && (
          <button onClick={() => setStep(step + 1 as Step)} className="text-slate-400 hover:text-slate-600 text-sm font-medium">
            Saltar por ahora
          </button>
        )}
      </div>

    </div>
  );
};

export default OnboardingWizard;
