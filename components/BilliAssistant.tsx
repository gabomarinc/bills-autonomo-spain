import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, AppView } from '../types';
import { askBilli } from '../services/geminiService';
import { X, Send, Sparkles, MessageSquare, ChevronRight } from 'lucide-react';

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
    const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Initial Greeting
    useEffect(() => {
        if (messages.length === 0) {
            setTimeout(() => {
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
            }, 1000);
        }
    }, [currentUser]);

    // Handle Dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isChatOpen) return; // Disable drag when chat is open
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: inputValue };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            const response = await askBilli(inputValue, currentUser);

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

        // Add system message confirming action
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            text: `¡Listo! Te llevo a ${action.label}.`
        }]);
    };

    const toggleMenu = () => {
        if (!isDragging) {
            if (isChatOpen) {
                // If chat is open, close it and close menu
                setIsChatOpen(false);
                setIsMenuOpen(false);
            } else {
                // Toggle menu
                setIsMenuOpen(!isMenuOpen);
            }
        }
    }

    return (
        <>
            {/* Quick Actions Bubbles (Menu) */}
            {isMenuOpen && !isChatOpen && (
                <div
                    style={{
                        left: position.x - 200, // Show to the left of avatar
                        top: position.y - 150,
                        width: 200
                    }}
                    className="fixed z-50 flex flex-col items-end gap-2 animate-in slide-in-from-right-4 fade-in duration-300 pointer-events-none"
                >
                    <div className="pointer-events-auto">
                        <button
                            onClick={() => { onNavigate(AppView.WIZARD); setIsMenuOpen(false); }}
                            className="bg-white/90 backdrop-blur-sm shadow-lg border-2 border-slate-100 text-slate-600 font-bold py-2 px-4 rounded-full hover:scale-105 active:scale-95 transition-all text-sm flex items-center gap-2"
                        >
                            📄 Crear Factura
                        </button>
                    </div>
                    <div className="pointer-events-auto transition-all delay-75">
                        <button
                            onClick={() => { onNavigate(AppView.EXPENSE_WIZARD); setIsMenuOpen(false); }}
                            className="bg-white/90 backdrop-blur-sm shadow-lg border-2 border-slate-100 text-slate-600 font-bold py-2 px-4 rounded-full hover:scale-105 active:scale-95 transition-all text-sm flex items-center gap-2"
                        >
                            💸 Registrar Gasto
                        </button>
                    </div>
                    <div className="pointer-events-auto transition-all delay-100">
                        <button
                            onClick={() => { onNavigate(AppView.CLIENT_WIZARD); setIsMenuOpen(false); }}
                            className="bg-white/90 backdrop-blur-sm shadow-lg border-2 border-slate-100 text-slate-600 font-bold py-2 px-4 rounded-full hover:scale-105 active:scale-95 transition-all text-sm flex items-center gap-2"
                        >
                            👤 Nuevo Cliente
                        </button>
                    </div>
                    <div className="pointer-events-auto transition-all delay-150">
                        <button
                            onClick={() => { setIsChatOpen(true); setIsMenuOpen(false); }}
                            className="bg-[#27bea5] shadow-lg shadow-[#27bea5]/20 text-white font-bold py-2 px-4 rounded-full hover:bg-[#22a890] hover:scale-105 active:scale-95 transition-all text-sm flex items-center gap-2"
                        >
                            💬 Chatear con Billi
                        </button>
                    </div>
                </div>
            )}

            {/* Floating Avatar */}
            <div
                style={{ left: position.x, top: position.y }}
                className={`fixed z-50 transition-transform ${isDragging ? 'scale-110 cursor-grabbing' : 'cursor-grab hover:scale-105'}`}
                onMouseDown={handleMouseDown}
                onClick={toggleMenu}
            >
                <div className="relative group">
                    {/* Glow Effect */}
                    <div className={`absolute inset-0 bg-[#27bea5] rounded-full blur-md opacity-20 transition-opacity animate-pulse ${isMenuOpen || isChatOpen ? 'opacity-60' : 'group-hover:opacity-40'}`}></div>

                    <div className="w-16 h-16 bg-white rounded-full shadow-2xl border-2 border-white overflow-hidden flex items-center justify-center relative z-10">
                        <img
                            src="/billi_avatar.png"
                            alt="Billi"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                        <div className="hidden w-full h-full bg-[#f0fdfa] flex items-center justify-center text-[#27bea5]">
                            <Sparkles size={32} />
                        </div>
                    </div>

                    {/* Notification Badge */}
                    {!isChatOpen && !isMenuOpen && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center z-20">
                            <span className="text-[10px] text-white font-bold">1</span>
                        </div>
                    )}

                    {/* Close 'X' indicator when menu is open */}
                    {(isMenuOpen || isChatOpen) && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-slate-800 rounded-full border-2 border-white flex items-center justify-center z-20 text-white shadow-sm">
                            <X size={12} />
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Window */}
            {isChatOpen && (
                <div
                    style={{
                        left: Math.min(window.innerWidth - 380, Math.max(20, position.x - 300)),
                        top: Math.min(window.innerHeight - 500, Math.max(20, position.y - 450))
                    }}
                    className="fixed w-[350px] h-[450px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col z-50 animate-in zoom-in-95 origin-bottom-right overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-[#1c2938] p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                                <Sparkles size={16} className="text-[#27bea5]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Billi Assistant</h3>
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-[#27bea5] rounded-full animate-pulse"></span> En línea
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="text-white/50 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${msg.role === 'user'
                                    ? 'bg-[#1c2938] text-white rounded-br-none'
                                    : 'bg-white text-slate-600 shadow-sm border border-slate-100 rounded-bl-none'
                                    }`}>
                                    <p>{msg.text}</p>

                                    {/* Actions */}
                                    {msg.actions && (
                                        <div className="mt-3 space-y-2">
                                            {msg.actions.map((action, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleActionClick(action)}
                                                    className="w-full text-left text-xs font-bold text-[#27bea5] bg-[#27bea5]/5 hover:bg-[#27bea5]/10 py-2 px-3 rounded-lg transition-colors flex items-center justify-between group"
                                                >
                                                    {action.label}
                                                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none shadow-sm border border-slate-100">
                                    <div className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Pregúntale a Billi..."
                            className="flex-1 bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#27bea5]/20 focus:outline-none"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isTyping}
                            className="bg-[#27bea5] text-white p-2 rounded-xl hover:bg-[#22a890] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default BilliAssistant;
