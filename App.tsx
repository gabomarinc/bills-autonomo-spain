
import React, { useState, useEffect } from 'react';
import { AppView, Invoice, UserProfile, CatalogItem, InvoiceStatus, TimelineEvent, DbClient } from './types';
import LoginScreen from './components/LoginScreen';
import OnboardingWizard from './components/OnboardingWizard';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InvoiceWizard from './components/InvoiceWizard';
import DocumentList from './components/DocumentList';
import InvoiceDetail from './components/InvoiceDetail';
import ClientList from './components/ClientList';
import ClientDetail from './components/ClientDetail';
import ReportsDashboard from './components/ReportsDashboard';
import UserProfileSettings from './components/UserProfileSettings';
import CatalogDashboard from './components/CatalogDashboard';
import ExpenseTracker from './components/ExpenseTracker';
import ExpenseWizard from './components/ExpenseWizard';
import ClientWizard from './components/ClientWizard';
import QuotaCalculator from './components/QuotaCalculator';
import TrimestralWizard from './components/TrimestralWizard'; 
import { AlertProvider, useAlert } from './components/AlertSystem';
import { 
  authenticateUser, 
  createUserInDb, 
  updateUserProfileInDb, 
  fetchInvoicesFromDb, 
  saveInvoiceToDb, 
  deleteInvoiceFromDb,
  saveClientToDb,
  saveProviderToDb, 
  getUserById,
  fetchClientsFromDb,
  fetchCatalogItemsFromDb,
  saveCatalogItemToDb,
  deleteCatalogItemFromDb
} from './services/neon';

// Wrapper Component to use Hooks
const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dbClients, setDbClients] = useState<DbClient[]>([]); 
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]); 
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<Invoice | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  
  const alert = useAlert(); 

  // SESSION RESTORATION LOGIC
  useEffect(() => {
    const initSession = async () => {
        const params = new URLSearchParams(window.location.search);
        const paymentSuccess = params.get('payment_success');
        const sessionId = params.get('session_id');
        
        const storedUserStr = localStorage.getItem('konsul_user_data'); 
        const storedUserId = localStorage.getItem('konsul_session_id');

        if (storedUserStr) {
           try {
             let cachedUser = JSON.parse(storedUserStr);
             
             if (paymentSuccess === 'true' && sessionId) {
                 try {
                    const stripeRes = await fetch(`/api/get-stripe-session?sessionId=${sessionId}`);
                    const stripeData = await stripeRes.json();

                    if (stripeData.customerId) {
                        const updatedUserWithStripe = {
                            ...cachedUser,
                            stripeCustomerId: stripeData.customerId,
                            renewalDate: stripeData.renewalDate || cachedUser.renewalDate, // Store ISO string
                            plan: stripeData.plan || 'Emprendedor Pro'
                        };

                        cachedUser = updatedUserWithStripe;
                        localStorage.setItem('konsul_user_data', JSON.stringify(updatedUserWithStripe));
                        await updateUserProfileInDb(updatedUserWithStripe);

                        setTimeout(() => {
                            alert.addToast('success', 'Suscripción Activada', 'Tu cuenta Pro está lista y sincronizada.');
                        }, 1000);
                    }
                 } catch (err) {
                    console.error("Error syncing Stripe data:", err);
                 }
                 window.history.replaceState({}, document.title, window.location.pathname);
             }

             setCurrentUser(cachedUser);
             setIsSessionLoading(false); 
           } catch (e) {
             console.error("Cache parse error", e);
           }
        }

        if (storedUserId) {
            try {
                const user = await getUserById(storedUserId);
                if (user) {
                    setCurrentUser(prev => {
                        if (prev?.stripeCustomerId && !user.stripeCustomerId) return prev;
                        return user;
                    });
                    localStorage.setItem('konsul_user_data', JSON.stringify(user));
                } else {
                    handleLogout();
                }
            } catch (error) {
                setIsOffline(true);
            }
        }
        setIsSessionLoading(false);
    };
    initSession();
  }, [alert]);

  // Load data when user is set
  useEffect(() => {
    if (currentUser) {
      const loadData = async () => {
        const docs = await fetchInvoicesFromDb(currentUser.id);
        if (docs) {
            setInvoices(docs);
            setIsOffline(false);
        } else {
            setIsOffline(true);
        }

        const clients = await fetchClientsFromDb(currentUser.id);
        if (clients) setDbClients(clients);

        const items = await fetchCatalogItemsFromDb(currentUser.id);
        if (items) {
            setCatalogItems(items);
            setCurrentUser(prev => prev ? ({ ...prev, defaultServices: items }) : null);
        }
      };
      loadData();
    }
  }, [currentUser?.id]);

  const handleLoginSuccess = (user: UserProfile) => {
    localStorage.setItem('konsul_session_id', user.id);
    localStorage.setItem('konsul_user_data', JSON.stringify(user)); 
    setCurrentUser(user);
    alert.addToast('success', `Bienvenido, ${user.name}`, 'Tu sesión ha iniciado correctamente.');
  };

  const handleLogout = () => {
    localStorage.removeItem('konsul_session_id');
    localStorage.removeItem('konsul_user_data');
    setCurrentUser(null);
    setInvoices([]);
    setDbClients([]);
    setCatalogItems([]);
    setActiveView(AppView.DASHBOARD);
  };

  const handleOnboardingComplete = async (data: Partial<UserProfile> & { password?: string, email?: string }) => {
    if (data.password && data.email) {
       const success = await createUserInDb(data, data.password, data.email);
       if (success) {
         const user = await authenticateUser(data.email, data.password);
         if (user) handleLoginSuccess(user);
       } else {
         alert.addToast('error', 'Error de Registro', 'El correo podría ya estar registrado.');
       }
    } else if (currentUser) {
       const updated = { ...currentUser, ...data, isOnboardingComplete: true };
       await updateUserProfileInDb(updated);
       setCurrentUser(updated);
       localStorage.setItem('konsul_user_data', JSON.stringify(updated));
    }
  };

  const handleSaveInvoice = async (invoice: Invoice) => {
    if (!currentUser) return;
    const exists = invoices.find(i => i.id === invoice.id);
    if (exists) {
      setInvoices(invoices.map(i => i.id === invoice.id ? invoice : i));
    } else {
      setInvoices([invoice, ...invoices]);
    }
    await saveInvoiceToDb({ ...invoice, userId: currentUser.id });
    if (invoice.clientName) {
       if (invoice.type === 'Expense') {
           await saveProviderToDb({ name: invoice.clientName.trim(), category: invoice.items[0]?.description || 'General' }, currentUser.id);
       } else {
           const existingClient = dbClients.find(c => c.name.trim().toLowerCase() === invoice.clientName.trim().toLowerCase());
           await saveClientToDb({ id: existingClient?.id, name: invoice.clientName.trim(), taxId: invoice.clientTaxId, email: invoice.clientEmail, address: invoice.clientAddress }, currentUser.id, invoice.type === 'Invoice' ? 'CLIENT' : 'PROSPECT');
           setDbClients(await fetchClientsFromDb(currentUser.id));
       }
    }
    setDocumentToEdit(null);
    alert.addToast('success', 'Documento Guardado');
  };

  const handleUpdateStatus = async (id: string, newStatus: InvoiceStatus) => {
    if (!currentUser) return;
    const targetInvoice = invoices.find(i => i.id === id);
    if (!targetInvoice) return;
    const event: TimelineEvent = { id: Date.now().toString(), type: 'STATUS_CHANGE', title: `Estado: ${newStatus}`, timestamp: new Date().toISOString() };
    const updatedInvoice = { ...targetInvoice, status: newStatus, timeline: [...(targetInvoice.timeline || []), event] };
    setInvoices(invoices.map(i => i.id === id ? updatedInvoice : i));
    if (selectedInvoice?.id === id) setSelectedInvoice(updatedInvoice);
    await saveInvoiceToDb({ ...updatedInvoice, userId: currentUser.id });
    alert.addToast('success', 'Estado Actualizado');
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!currentUser) return;
    if (await alert.confirm({ title: '¿Eliminar?', message: 'Esta acción es irreversible.', confirmText: 'Eliminar', type: 'danger' })) {
      setInvoices(invoices.filter(i => i.id !== id));
      if (selectedInvoice?.id === id) setSelectedInvoice(null);
      await deleteInvoiceFromDb(id, currentUser.id);
    }
  };

  const handleUpdateProfile = async (updated: UserProfile) => {
    try {
      setCurrentUser(updated);
      localStorage.setItem('konsul_user_data', JSON.stringify(updated)); 
      
      // Llamar a la API route en lugar de la función directa
      const response = await fetch('/api/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: updated })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'No se pudo guardar en la base de datos');
      }
      
      alert.addToast('success', 'Perfil Actualizado');
    } catch (error: any) {
      console.error('Error actualizando perfil:', error);
      alert.addToast('error', 'Error', error.message || 'No se pudo actualizar el perfil. Verifica tu conexión.');
      throw error; // Re-lanzar para que el componente pueda manejarlo
    }
  };

  const handleSaveCatalogItem = async (item: CatalogItem) => {
    if (!currentUser) return;
    const res = await saveCatalogItemToDb(item, currentUser.id);
    if (res.success) {
        const updated = await fetchCatalogItemsFromDb(currentUser.id);
        setCatalogItems(updated);
        setCurrentUser(prev => prev ? ({ ...prev, defaultServices: updated }) : null);
        alert.addToast('success', 'Ítem Guardado');
    }
  };

  const handleDeleteCatalogItem = async (itemId: string) => {
    if (!currentUser) return;
    if (await deleteCatalogItemFromDb(itemId, currentUser.id)) {
        const updated = catalogItems.filter(i => i.id !== itemId);
        setCatalogItems(updated);
        setCurrentUser(prev => prev ? ({ ...prev, defaultServices: updated }) : null);
    }
  };

  if (isSessionLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-t-[#27bea5] rounded-full animate-spin"></div></div>;

  if (!currentUser) return <LoginScreen onLoginSuccess={handleLoginSuccess} onRegisterClick={() => setCurrentUser({ id: 'temp', name: '', type: 'Autónomo' as any, taxId: '', avatar: '', isOnboardingComplete: false } as UserProfile)} />;

  if (!currentUser.isOnboardingComplete) return <OnboardingWizard onComplete={handleOnboardingComplete} />;

  return (
    <Layout activeView={activeView} onNavigate={setActiveView} currentProfile={currentUser} isOffline={isOffline} onToggleOffline={() => setIsOffline(!isOffline)} pendingInvoicesCount={invoices.filter(i => i.status === 'PendingSync').length} onLogout={handleLogout}>
      {activeView === AppView.DASHBOARD && <Dashboard recentInvoices={invoices} isOffline={isOffline} pendingCount={invoices.filter(i => i.status === 'PendingSync').length} onNewAction={() => { setDocumentToEdit(null); setActiveView(AppView.WIZARD); }} onSelectInvoice={(inv) => { setSelectedInvoice(inv); setActiveView(AppView.INVOICE_DETAIL); }} onNavigate={setActiveView} currentUser={currentUser} />}
      {activeView === AppView.WIZARD && <InvoiceWizard currentUser={currentUser} isOffline={isOffline} onSave={handleSaveInvoice} onCancel={() => setActiveView(AppView.DASHBOARD)} initialData={documentToEdit} dbClients={dbClients} invoices={invoices} catalogItems={catalogItems} />}
      {activeView === AppView.INVOICES && <DocumentList invoices={invoices} onSelectInvoice={(inv) => { setSelectedInvoice(inv); setActiveView(AppView.INVOICE_DETAIL); }} onCreateNew={() => setActiveView(AppView.WIZARD)} onDeleteInvoice={handleDeleteInvoice} onEditInvoice={(inv) => { setDocumentToEdit(inv); setActiveView(AppView.WIZARD); }} onUpdateStatus={handleUpdateStatus} currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '€'} currentUser={currentUser} />}
      {activeView === AppView.INVOICE_DETAIL && selectedInvoice && <InvoiceDetail invoice={selectedInvoice} issuer={currentUser} onBack={() => setActiveView(AppView.INVOICES)} onUpdateInvoice={(updated) => { setInvoices(invoices.map(i => i.id === updated.id ? updated : i)); setSelectedInvoice(updated); saveInvoiceToDb({ ...updated, userId: currentUser.id }); }} onUpdateStatus={handleUpdateStatus} onEdit={(inv) => { setDocumentToEdit(inv); setActiveView(AppView.WIZARD); }} onDelete={handleDeleteInvoice} />}
      {activeView === AppView.CLIENTS && <ClientList invoices={invoices} dbClients={dbClients} onCreateDocument={(c) => { setDocumentToEdit(c ? { id: '', clientName: c.name, clientTaxId: c.taxId, type: 'Invoice', status: 'Borrador', date: new Date().toISOString(), total: 0, currency: currentUser.defaultCurrency || 'EUR', items: [] } : null); setActiveView(AppView.WIZARD); }} onCreateClient={() => setActiveView(AppView.CLIENT_WIZARD)} currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '€'} currentUser={currentUser} onSelectClient={(name) => { setSelectedClientName(name); setActiveView(AppView.CLIENT_DETAIL); }} />}
      {activeView === AppView.CLIENT_DETAIL && selectedClientName && <ClientDetail clientName={selectedClientName} invoices={invoices} dbClientData={dbClients.find(c => c.name.trim().toLowerCase() === selectedClientName.trim().toLowerCase())} onBack={() => setActiveView(AppView.CLIENTS)} onSelectInvoice={(inv) => { setSelectedInvoice(inv); setActiveView(AppView.INVOICE_DETAIL); }} currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '€'} onUpdateClientContact={async (old, upd) => { await saveClientToDb(upd, currentUser.id, 'CLIENT'); setDbClients(await fetchClientsFromDb(currentUser.id)); }} />}
      {activeView === AppView.EXPENSES && <ExpenseTracker invoices={invoices} currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '€'} onCreateExpense={() => { setDocumentToEdit(null); setActiveView(AppView.EXPENSE_WIZARD); }} onEditExpense={(e) => { setDocumentToEdit(e); setActiveView(AppView.EXPENSE_WIZARD); }} currentProfile={currentUser} onUpdateProfile={handleUpdateProfile} />}
      {activeView === AppView.EXPENSE_WIZARD && <ExpenseWizard currentUser={currentUser} onSave={(inv) => { handleSaveInvoice(inv); setActiveView(AppView.EXPENSES); }} onCancel={() => setActiveView(AppView.EXPENSES)} initialData={documentToEdit} />}
      {activeView === AppView.CATALOG && <CatalogDashboard items={catalogItems} userCountry={currentUser.country || 'España'} apiKey={currentUser.apiKeys} onSaveItem={handleSaveCatalogItem} onDeleteItem={handleDeleteCatalogItem} referenceHourlyRate={currentUser.hourlyRateConfig?.calculatedRate} currentUser={currentUser} />}
      {activeView === AppView.REPORTS && <ReportsDashboard invoices={invoices} currencySymbol={currentUser.defaultCurrency === 'EUR' ? '€' : '€'} apiKey={currentUser.apiKeys} currentUser={currentUser} />}
      {activeView === AppView.QUOTA_CALCULATOR && <QuotaCalculator currentUser={currentUser} onUpdateProfile={handleUpdateProfile} />}
      {activeView === AppView.TRIMESTRAL && <TrimestralWizard currentUser={currentUser} invoices={invoices} onSave={async (decl) => { 
        const { saveTrimestralDeclaration } = await import('./services/neon');
        await saveTrimestralDeclaration(decl);
        alert.addToast('success', 'Declaración Guardada', 'La declaración se ha guardado correctamente.');
      }} />}
      {activeView === AppView.SETTINGS && <UserProfileSettings currentUser={currentUser} onUpdate={handleUpdateProfile} />}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AlertProvider>
      <AppContent />
    </AlertProvider>
  );
};

export default App;
