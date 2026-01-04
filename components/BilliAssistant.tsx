import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, AppView } from '../types';
import { askBilli } from '../services/geminiService';
import { fetchInvoicesFromDb, fetchClientsFromDb } from '../services/neon';
import { X, Send, Sparkles, ChevronRight, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BilliAssistantProps {
    currentUser: UserProfile;
    onNavigate: (view: AppView) => void;
    onAction?: (action: string) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    actions?: { label: string; action: string; view?: AppView }[];
}

const BilliAssistant: React.FC<BilliAssistantProps> = ({ currentUser, onNavigate, onAction }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showGreeting, setShowGreeting] = useState(true);
    const [appContext, setAppContext] = useState<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial Greeting & Auto-hide logic
    useEffect(() => {
        // Show greeting on mount
        setShowGreeting(true);

        // Auto hide greeting after 8 seconds if no interaction
        const timer = setTimeout(() => {
            if (!isMenuOpen && !isChatOpen) {
                setShowGreeting(false);
            }
        }, 8000);

        // Preload welcome message for chat
        if (messages.length === 0) {
            setMessages([
                {
                    id: 'welcome',
                    role: 'assistant',
                    text: `¡Hola ${currentUser.name.split(' ')[0]}! 👋 Soy Billi, tu asistente inteligente. ¿En qué puedo ayudarte hoy?`,
                    actions: [
                        { label: 'Crear Factura', action: 'CREATE_INVOICE', view: AppView.WIZARD },
                        { label: 'Ver Impuestos', action: 'VIEW_TAXES', view: AppView.TRIMESTRAL },
                        { label: 'Calcular Cuota', action: 'CALC_QUOTA', view: AppView.QUOTA_CALCULATOR }
                    ]
                }
            ]);
        }

        return () => clearTimeout(timer);
    }, [currentUser, isMenuOpen, isChatOpen, messages.length]);

    // Scroll to bottom
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Fetch Context for RAG when Chat Opens
    useEffect(() => {
        if (isChatOpen && !appContext) {
            const loadContext = async () => {
                try {
                    const [invoices, clients] = await Promise.all([
                        fetchInvoicesFromDb(currentUser.id),
                        fetchClientsFromDb(currentUser.id)
                    ]);
                    setAppContext({ invoices, clients });
                } catch (e) {
                    console.error("Error loading Billi context:", e);
                }
            };
            loadContext();
        }
    }, [isChatOpen, currentUser.id, appContext]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: inputValue };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            // Pass appContext to askBilli for RAG capabilities
            const response = await askBilli(inputValue, currentUser, undefined, appContext);

            const billiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: response.text,
                actions: response.actions
            };

            setMessages(prev => [...prev, billiMsg]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: 'Lo siento, tuve un problema de conexión. ¿Intentamos de nuevo?' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleActionClick = (action: { label: string; action: string; view?: AppView }) => {
        if (action.view) {
            onNavigate(action.view);
            setIsChatOpen(false);
            setIsMenuOpen(false);
        }
        if (onAction) onAction(action.action);

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            text: `¡Listo! Te llevo a ${action.label}.`
        }]);
    };

    const toggleMenu = () => {
        if (isChatOpen) {
            setIsChatOpen(false);
            setIsMenuOpen(false);
        } else {
            setIsMenuOpen(!isMenuOpen);
            // Hide greeting when interacting
            setShowGreeting(false);
        }
    }

    return (
        <div ref={containerRef} className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {/* Draggable Avatar Area */}
            <motion.div
                drag
                dragMomentum={true}
                dragElastic={0.1}
                dragConstraints={containerRef}
                initial={{ x: window.innerWidth - 100, y: window.innerHeight - 150 }}
                whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
                whileHover={{ scale: 1.05 }}
                className="absolute pointer-events-auto cursor-grab touch-none"
                onClick={toggleMenu}
            >
                <div className="relative group">
                    {/* Persistent Greeting Bubble (Left side) */}
                    <AnimatePresence>
                        {showGreeting && !isMenuOpen && !isChatOpen && (
                            <motion.div
                                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="absolute right-full mr-4 top-2 bg-white px-4 py-2 rounded-2xl rounded-tr-none shadow-xl border border-slate-100 whitespace-nowrap"
                            >
                                <p className="text-sm font-medium text-slate-700">
                                    ¡Hola, <strong>{currentUser.name.split(' ')[0]}</strong>! 👋
                                </p>
                                <span className="absolute -right-2 top-0 w-4 h-4 bg-white transform rotate-45 border-r border-t border-slate-100 shadow-none"></span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Animated Glow */}
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{
                            repeat: Infinity,
                            duration: 2
                        }}
                        className={`absolute inset-0 bg-[#27bea5] rounded-full blur-md -z-10 ${isMenuOpen || isChatOpen ? 'opacity-60' : 'group-hover:opacity-40'}`}
                    />

                    <div className="w-24 h-24 flex items-center justify-center relative z-10 transition-transform hover:scale-105">
                        <img
                            src={(isMenuOpen || isChatOpen) ? '/billi_avatar_2.png' : '/billi_avatar_1.png'}
                            alt="Billi"
                            draggable={false}
                            className="w-full h-full object-contain pointer-events-none select-none drop-shadow-2xl filter"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                        <div className="hidden w-16 h-16 bg-[#f0fdfa] rounded-full flex items-center justify-center text-[#27bea5] shadow-lg">
                            <Sparkles size={32} />
                        </div>
                    </div>

                    {/* Billi Name Label */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 px-2 py-0.5 bg-slate-800/80 backdrop-blur-sm rounded-full pointer-events-none z-20">
                        <span className="text-[10px] font-bold text-white tracking-wide">Billi</span>
                    </div>

                    {/* Badge */}
                    {!isChatOpen && !isMenuOpen && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center z-20">
                            <span className="text-[10px] text-white font-bold">1</span>
                        </div>
                    )}

                    {/* Close Icon (only when interacting) */}
                    {(isMenuOpen || isChatOpen) && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-slate-800 rounded-full border-2 border-white flex items-center justify-center z-20 text-white shadow-sm">
                            <X size={12} />
                        </div>
                    )}
                </div>

                {/* Floating Menu Bubbles (Positioned relative to Avatar) */}
                <AnimatePresence>
                    {isMenuOpen && !isChatOpen && (
                        <div className="absolute bottom-20 right-0 flex flex-col items-end gap-3 w-64 pointer-events-none">
                            {[
                                { label: 'Crear Factura', icon: '📄', view: AppView.WIZARD, delay: 0 },
                                { label: 'Nuevo Cliente', icon: '👤', view: AppView.CLIENT_WIZARD, delay: 0.1 },
                                { label: 'Registrar Gasto', icon: '💸', view: AppView.EXPENSE_WIZARD, delay: 0.2 },
                                { label: 'Chatear con Billi', icon: '💬', chat: true, delay: 0.3 },
                            ].map((item, i) => (
                                <motion.button
                                    key={i}
                                    initial={{ opacity: 0, x: 20, scale: 0.8 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 20, scale: 0.8 }}
                                    transition={{ delay: item.delay }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (item.chat) {
                                            setIsChatOpen(true);
                                            setIsMenuOpen(false);
                                        } else if (item.view) {
                                            onNavigate(item.view);
                                            setIsMenuOpen(false);
                                        }
                                    }}
                                    className={`pointer-events-auto px-5 py-3 rounded-full font-bold shadow-lg backdrop-blur-md flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 ${item.chat
                                        ? 'bg-[#27bea5] text-white'
                                        : 'bg-white/95 text-slate-700 border border-slate-100'
                                        }`}
                                >
                                    <span className="text-lg">{item.icon}</span>
                                    <span className="text-sm">{item.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Chat Window (Floating Glass Bubble) */}
            <AnimatePresence>
                {isChatOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 100, x: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: 100, x: 50 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        drag
                        dragConstraints={containerRef}
                        className="fixed pointer-events-auto w-[380px] h-[550px] bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/40 flex flex-col z-50 overflow-hidden"
                        style={{
                            right: 40,
                            bottom: 120
                        }}
                    >
                        {/* Minimal Header */}
                        <div className="p-6 pb-2 flex justify-between items-center cursor-move" onPointerDownCapture={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-tr from-[#27bea5] to-[#1c2938] rounded-full flex items-center justify-center shadow-lg text-white">
                                    <Sparkles size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Billi</h3>
                                    <p className="text-xs text-[#27bea5] font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-[#27bea5] rounded-full animate-pulse"></span>
                                        Online
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsChatOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar scroll-smooth">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[85%] p-4 text-sm shadow-sm relative group ${msg.role === 'user'
                                        ? 'bg-[#1c2938] text-white rounded-2xl rounded-tr-sm'
                                        : 'bg-white text-slate-600 border border-slate-50 rounded-2xl rounded-tl-sm'
                                        }`}>
                                        <p className="leading-relaxed">{msg.text}</p>

                                        {/* Actions Grid */}
                                        {msg.actions && (
                                            <div className="mt-4 grid gap-2">
                                                {msg.actions.map((action, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleActionClick(action)}
                                                        className="w-full text-left text-xs font-bold text-[#1c2938] bg-slate-50 hover:bg-[#27bea5]/10 hover:text-[#27bea5] py-2.5 px-4 rounded-xl transition-all border border-slate-100 flex items-center justify-between group/btn"
                                                    >
                                                        {action.label}
                                                        <ChevronRight size={14} className="text-slate-300 group-hover/btn:text-[#27bea5]" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* Timestamp or tiny label could go here */}
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-50">
                                        <div className="flex gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Floating Input Area */}
                        <div className="p-5 pt-2">
                            <div className="bg-white p-1.5 pl-4 rounded-[1.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex gap-2 items-center focus-within:ring-2 focus-within:ring-[#27bea5]/20 transition-all">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Escribe tu pregunta..."
                                    className="flex-1 bg-transparent border-0 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isTyping}
                                    className="w-10 h-10 bg-[#27bea5] text-white rounded-full flex items-center justify-center hover:bg-[#22a890] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md transform hover:scale-105 active:scale-95"
                                >
                                    <Send size={18} className={!inputValue.trim() ? 'opacity-50' : ''} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BilliAssistant;
