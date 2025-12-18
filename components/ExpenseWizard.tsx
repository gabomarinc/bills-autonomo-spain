
import React, { useState } from 'react';
import { UploadCloud, Loader2, ArrowLeft, Check, X, Camera, FileText, Eye, Sparkles } from 'lucide-react';
import { UserProfile, Invoice } from '../types';
import { parseExpenseImage, AI_ERROR_BLOCKED } from '../services/geminiService';

interface ExpenseWizardProps {
  currentUser: UserProfile;
  onSave: (invoice: Invoice) => void;
  onCancel: () => void;
  initialData?: Invoice | null;
}

const ExpenseWizard: React.FC<ExpenseWizardProps> = ({ currentUser, onSave, onCancel, initialData }) => {
  const isEditing = !!initialData;
  const [step, setStep] = useState<'UPLOAD' | 'REVIEW'>(isEditing ? 'REVIEW' : 'UPLOAD');
  const [uploadedImage, setUploadedImage] = useState<string | null>(initialData?.receiptUrl || null);
  const [fileType, setFileType] = useState<'image' | 'pdf'>(initialData?.receiptUrl?.includes('pdf') ? 'pdf' : 'image');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  
  const [expenseData, setExpenseData] = useState<{
    clientName: string;
    amount: number;
    currency: string;
    concept: string;
    date: string;
    isDeductible: boolean; 
    isValidDoc: boolean;
  }>({
    clientName: initialData?.clientName || '',
    amount: initialData?.total || 0,
    currency: initialData?.currency || currentUser.defaultCurrency || 'EUR',
    concept: initialData?.items?.[0]?.description || '',
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    isDeductible: initialData ? initialData.expenseDeductibility !== 'NONE' : true,
    isValidDoc: initialData ? (initialData.isValidFiscalDoc ?? true) : true
  });

  const hasAiAccess = !!currentUser.apiKeys?.gemini || !!currentUser.apiKeys?.openai;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPdf = file.type === 'application/pdf';
      setFileType(isPdf ? 'pdf' : 'image');

      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setUploadedImage(base64String);
        
        const rawBase64 = base64String.split(',')[1];
        const mimeType = file.type;

        if (hasAiAccess) {
            setIsLoading(true);
            setLoadingMsg(isPdf ? 'Analizando PDF con IA...' : 'Escaneando recibo con IA...');
            try {
                const result = await parseExpenseImage(rawBase64, mimeType, currentUser.apiKeys);
                if (result) {
                    setExpenseData({
                        clientName: result.clientName || 'Proveedor Desconocido',
                        amount: result.amount || 0,
                        currency: result.currency || 'EUR',
                        concept: result.concept || 'Gasto Varios',
                        date: result.date || new Date().toISOString().split('T')[0],
                        isDeductible: true,
                        isValidDoc: true
                    });
                }
            } catch (err) {
                console.error("Vision Error", err);
            } finally {
                setIsLoading(false);
                setStep('REVIEW'); 
            }
        } else {
            setExpenseData({ ...expenseData, concept: file.name });
            setStep('REVIEW');
        }
      };

      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const newExpense: Invoice = {
        id: initialData?.id || `EXP-${Date.now()}`,
        type: 'Expense',
        clientName: expenseData.clientName,
        date: expenseData.date,
        currency: expenseData.currency,
        total: expenseData.amount,
        status: 'Pagada',
        expenseDeductibility: expenseData.isDeductible ? 'FULL' : 'NONE',
        isValidFiscalDoc: expenseData.isValidDoc,
        items: [{
            id: initialData?.items?.[0]?.id || Date.now().toString(),
            description: expenseData.concept,
            quantity: 1,
            price: expenseData.amount,
            tax: 0
        }],
        receiptUrl: uploadedImage || undefined
    };
    onSave(newExpense);
  };

  // Helper component to render the document preview safely
  const DocumentPreview = ({ data, type, className }: { data: string, type: 'image' | 'pdf', className?: string }) => {
    if (!data) return null;
    if (type === 'pdf') {
      return (
        <object 
          data={data} 
          type="application/pdf"
          className={`w-full h-full rounded-xl border-0 ${className}`}
        >
           <div className="flex flex-col items-center justify-center h-full p-4 text-slate-400 bg-slate-50 rounded-xl">
              <FileText size={40} className="mb-2 opacity-20" />
              <p className="text-xs font-bold">Vista previa PDF</p>
              <p className="text-[10px]">Documento cargado correctamente</p>
           </div>
        </object>
      );
    }
    return (
      <img 
        src={data} 
        alt="Preview" 
        className={`object-contain w-full h-full rounded-xl ${className}`} 
      />
    );
  };

  if (step === 'UPLOAD') {
      return (
          <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl shadow-lg text-center mt-10 animate-in fade-in">
              <h2 className="text-2xl font-bold text-[#1c2938] mb-4">Cargar Gasto</h2>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 transition-colors relative min-h-[400px] overflow-hidden group">
                  <input 
                    type="file" 
                    onChange={handleImageUpload} 
                    accept="image/*,application/pdf" 
                    className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                    disabled={isLoading} 
                  />
                  
                  {isLoading ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
                          {uploadedImage && (
                              <div className="absolute inset-0 opacity-30 blur-[2px] scale-105 pointer-events-none">
                                 <DocumentPreview data={uploadedImage} type={fileType} />
                              </div>
                          )}
                          <div className="bg-white/90 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center backdrop-blur-md border border-white/50 animate-in zoom-in-95">
                              <div className="relative mb-4">
                                <Loader2 className="w-12 h-12 animate-spin text-[#27bea5]" />
                                <Sparkles className="w-5 h-5 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                              </div>
                              <p className="text-[#1c2938] font-black text-lg">{loadingMsg}</p>
                              <p className="text-slate-400 text-xs mt-2 uppercase tracking-widest font-bold">Potenciado por Gemini IA</p>
                          </div>
                      </div>
                  ) : (
                      <>
                          <div className="w-20 h-20 bg-[#27bea5]/10 rounded-3xl flex items-center justify-center text-[#27bea5] group-hover:scale-110 transition-transform">
                              <Camera className="w-10 h-10" />
                          </div>
                          <div>
                            <p className="text-slate-700 font-black text-xl">Sube tu comprobante</p>
                            <p className="text-slate-400 text-sm mt-1">Formatos aceptados: JPG, PNG o PDF</p>
                          </div>
                          <button className="mt-4 bg-[#1c2938] text-white px-8 py-3 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-lg">
                            Seleccionar Archivo
                          </button>
                      </>
                  )}
              </div>
              <div className="mt-8 flex justify-between items-center px-4">
                  <button onClick={onCancel} className="text-slate-400 font-bold hover:text-slate-600 transition-colors">Cancelar</button>
                  <button onClick={() => setStep('REVIEW')} className="text-[#27bea5] font-bold hover:underline flex items-center gap-2">
                    Ingresar manualmente <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
              </div>
          </div>
      );
  }

  return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-[2.5rem] shadow-2xl mt-10 animate-in slide-in-from-bottom-4 border border-slate-50">
          <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <button onClick={() => setStep('UPLOAD')} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-[#1c2938]">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-3xl font-black text-[#1c2938] tracking-tight">{isEditing ? 'Editar Gasto' : 'Confirmar Gasto'}</h2>
                  <p className="text-slate-400 text-sm font-medium">Revisa los datos extraídos antes de guardar</p>
                </div>
              </div>
              {!isEditing && uploadedImage && (
                <div className="flex items-center gap-2 bg-[#27bea5]/10 text-[#27bea5] px-4 py-2 rounded-full border border-[#27bea5]/20">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Verificado por IA</span>
                </div>
              )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Form Side */}
              <div className="lg:col-span-7 space-y-6">
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Proveedor / Establecimiento</label>
                        <input 
                          value={expenseData.clientName}
                          onChange={(e) => setExpenseData({...expenseData, clientName: e.target.value})}
                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-[#1c2938] outline-none focus:ring-2 focus:ring-[#27bea5] transition-all shadow-sm"
                          placeholder="Nombre del proveedor"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Concepto del Gasto</label>
                        <input 
                          value={expenseData.concept}
                          onChange={(e) => setExpenseData({...expenseData, concept: e.target.value})}
                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#27bea5] transition-all shadow-sm"
                          placeholder="Ej: Materiales de oficina"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Importe Total</label>
                            <div className="relative group">
                              <span className="absolute left-4 top-4 text-slate-400 font-bold">€</span>
                              <input 
                                type="number"
                                value={expenseData.amount}
                                onChange={(e) => setExpenseData({...expenseData, amount: parseFloat(e.target.value) || 0})}
                                className="w-full pl-8 p-4 bg-white border border-slate-200 rounded-2xl font-black text-[#1c2938] text-xl outline-none focus:ring-2 focus:ring-[#27bea5] transition-all shadow-sm"
                              />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Fecha</label>
                            <input 
                              type="date"
                              value={expenseData.date}
                              onChange={(e) => setExpenseData({...expenseData, date: e.target.value})}
                              className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#27bea5] transition-all shadow-sm"
                            />
                        </div>
                    </div>
                  </div>

                  {/* FISCAL CHECKS */}
                  <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                      <p className="text-xs font-black text-[#27bea5] uppercase mb-4 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Inteligencia Fiscal
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all ${expenseData.isValidDoc ? 'border-[#27bea5] bg-[#27bea5]/5' : 'border-slate-100 bg-slate-50'}`}>
                              <input 
                                type="checkbox"
                                checked={expenseData.isValidDoc}
                                onChange={(e) => setExpenseData({...expenseData, isValidDoc: e.target.checked})}
                                className="w-6 h-6 text-[#27bea5] rounded-lg focus:ring-0 border-slate-300"
                              />
                              <div className="flex-1">
                                  <span className={`block font-bold text-sm ${expenseData.isValidDoc ? 'text-[#1c2938]' : 'text-slate-500'}`}>Factura Fiscal</span>
                                  <span className="text-[10px] text-slate-400 font-medium">Deduce IVA</span>
                              </div>
                          </label>

                          <label className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all ${expenseData.isDeductible ? 'border-[#27bea5] bg-[#27bea5]/5' : 'border-slate-100 bg-slate-50'}`}>
                              <input 
                                type="checkbox"
                                checked={expenseData.isDeductible}
                                onChange={(e) => setExpenseData({...expenseData, isDeductible: e.target.checked})}
                                className="w-6 h-6 text-[#27bea5] rounded-lg focus:ring-0 border-slate-300"
                              />
                              <div className="flex-1">
                                  <span className={`block font-bold text-sm ${expenseData.isDeductible ? 'text-[#1c2938]' : 'text-slate-500'}`}>Gasto Deducible</span>
                                  <span className="text-[10px] text-slate-400 font-medium">Gasto de Negocio</span>
                              </div>
                          </label>
                      </div>
                  </div>
              </div>
              
              {/* Preview Side */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <Eye className="w-3 h-3" /> Vista Previa del Comprobante
                  </p>
                  <div className="bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 flex items-center justify-center p-1 overflow-hidden h-full min-h-[400px] shadow-inner relative group">
                      {uploadedImage ? (
                          <DocumentPreview data={uploadedImage} type={fileType} />
                      ) : (
                          <div className="flex flex-col items-center gap-3 text-slate-300">
                             <UploadCloud className="w-12 h-12" />
                             <p className="font-bold text-sm">Sin documento adjunto</p>
                          </div>
                      )}
                      
                      {/* Zoom hint overlay for images */}
                      {uploadedImage && fileType === 'image' && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                           <span className="bg-white text-[#1c2938] px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2">
                              <Camera className="w-3 h-3" /> Ver a tamaño completo
                           </span>
                        </div>
                      )}
                  </div>
              </div>
          </div>

          <div className="flex justify-end gap-4 mt-12 pt-8 border-t border-slate-100">
              <button 
                onClick={onCancel} 
                className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                disabled={!expenseData.clientName || expenseData.amount <= 0}
                className="bg-[#1c2938] text-white px-12 py-4 rounded-2xl font-bold hover:bg-[#27bea5] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                  <Check className="w-6 h-6" /> {isEditing ? 'Guardar Cambios' : 'Confirmar Gasto'}
              </button>
          </div>
      </div>
  );
};

export default ExpenseWizard;
