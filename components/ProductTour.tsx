
import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

interface TourStep {
    targetId: string;
    title: string;
    content: string;
    position: 'right' | 'left' | 'top' | 'bottom';
}

const TOUR_STEPS: TourStep[] = [
    {
        targetId: 'tour-dashboard',
        title: 'Tu Centro de Mando',
        content: 'Bienvenido al Dashboard. Aquí verás un resumen en tiempo real de tu facturación, impuestos y estado financiero.',
        position: 'right'
    },
    {
        targetId: 'tour-documents',
        title: 'Facturas y Cotizaciones',
        content: 'Crea facturas ilimitadas, envíalas a tus clientes y convierte cotizaciones en facturas con un solo clic.',
        position: 'right'
    },
    {
        targetId: 'tour-clients',
        title: 'Tus Clientes',
        content: 'Gestiona tu cartera de clientes, guarda sus datos fiscales y visualiza su historial de pagos.',
        position: 'right'
    },
    {
        targetId: 'tour-expenses',
        title: 'Control de Gastos',
        content: 'Sube tus tickets y facturas de gasto. La IA analizará la deducibilidad de cada uno.',
        position: 'right'
    },
    {
        targetId: 'tour-catalog',
        title: 'Tu Catálogo',
        content: 'Define tus precios y servicios. Puedes agregar o editar los items que la IA generó para ti.',
        position: 'right'
    },
    {
        targetId: 'tour-quotas',
        title: 'Calculadora de Cuotas',
        content: 'Prevé tu Cuota de Autónomo según tus ingresos reales. Ajusta tu tramo para evitar sorpresas.',
        position: 'right'
    },
    {
        targetId: 'tour-taxes',
        title: 'Impuestos al Día',
        content: 'Visualiza tus modelos trimestrales (130, 303) en tiempo real, calculados automáticamente según tus facturas y gastos.',
        position: 'right'
    },
    {
        targetId: 'tour-reports',
        title: 'Reportes Detallados',
        content: 'Obtén análisis profundos sobre la salud de tu negocio, con recomendaciones estratégicas de tu CFO Virtual.',
        position: 'right'
    },
    {
        targetId: 'tour-profile',
        title: 'Tu Perfil y Ajustes',
        content: 'Accede a la configuración de tu cuenta y cierra sesión desde este menú desplegable.',
        position: 'right'
    }
];

interface ProductTourProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

const ProductTour: React.FC<ProductTourProps> = ({ isOpen, onClose, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [style, setStyle] = useState<React.CSSProperties>({}); // Tooltip position
    const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({}); // Highlighting

    useEffect(() => {
        if (!isOpen) return;

        // Add small delay to ensure DOM is ready if transitioning
        const timer = setTimeout(() => {
            updatePosition();
        }, 100);

        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('resize', updatePosition);
            clearTimeout(timer);
        };
    }, [isOpen, currentStep]);

    const updatePosition = () => {
        const step = TOUR_STEPS[currentStep];
        const element = document.getElementById(step.targetId);

        if (element) {
            const rect = element.getBoundingClientRect();
            const PADDING = 10;

            // Calculate Spotlight Position
            setSpotlightStyle({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                borderRadius: window.getComputedStyle(element).borderRadius
            });

            // Calculate Tooltip Position
            let top = 0;
            let left = 0;

            // Simple implementation for 'right' position mostly for sidebar
            if (step.position === 'right') {
                top = rect.top;
                left = rect.right + 20;
            }

            // Ensure it doesn't go off screen (basic check)
            if (top + 200 > window.innerHeight) top = window.innerHeight - 250;

            setStyle({
                top,
                left,
                position: 'absolute'
            });
        } else {
            // Fallback center if element not found
            setStyle({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                position: 'fixed'
            });
            setSpotlightStyle({});
        }
    };

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const stepData = TOUR_STEPS[currentStep];
    const isLastStep = currentStep === TOUR_STEPS.length - 1;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop with Hole (using clip-path or huge shadow approach? Simplest is just distinct divs or a canvas overlay)
          Let's use a composite approach: 4 dark divs surrounding the hole.
          Actually, let's use a simpler SVG overlay or just a high z-index overlay that is semi-transparent
          EXCEPT for the target area. `mask-image` is great for this.
      */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300" style={{
                clipPath: `polygon(
            0% 0%, 
            0% 100%, 
            ${spotlightStyle.left}px 100%, 
            ${spotlightStyle.left}px ${spotlightStyle.top}px, 
            ${(spotlightStyle.left as number) + (spotlightStyle.width as number)}px ${spotlightStyle.top}px, 
            ${(spotlightStyle.left as number) + (spotlightStyle.width as number)}px ${(spotlightStyle.top as number) + (spotlightStyle.height as number)}px, 
            ${spotlightStyle.left}px ${(spotlightStyle.top as number) + (spotlightStyle.height as number)}px, 
            ${spotlightStyle.left}px 100%, 
            100% 100%, 
            100% 0%
         )`
                // Note: Polygon clip path for a hole is tricky. 
                // Easier approach: Use a giant Box Shadow on the spotlight element itself? No, that requires modifying the element.
                // Better: SVG overlay with a mask.
            }}></div>

            {/* SVG Overlay for perfect hole */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                    <mask id="tour-mask" x="0" y="0" width="100%" height="100%">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {spotlightStyle.top !== undefined && (
                            <rect
                                x={spotlightStyle.left}
                                y={spotlightStyle.top}
                                width={spotlightStyle.width}
                                height={spotlightStyle.height}
                                rx={typeof spotlightStyle.borderRadius === 'string' ? parseFloat(spotlightStyle.borderRadius) : 12}
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#tour-mask)" />

                {/* Animated ring around the target */}
                {spotlightStyle.top !== undefined && (
                    <rect
                        x={(spotlightStyle.left as number) - 4}
                        y={(spotlightStyle.top as number) - 4}
                        width={(spotlightStyle.width as number) + 8}
                        height={(spotlightStyle.height as number) + 8}
                        rx={typeof spotlightStyle.borderRadius === 'string' ? parseFloat(spotlightStyle.borderRadius) + 4 : 16}
                        fill="none"
                        stroke="#27bea5"
                        strokeWidth="3"
                        className="animate-pulse"
                    />
                )}
            </svg>

            {/* Tooltip Card */}
            <div
                className="absolute w-[350px] bg-white rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-300 border border-slate-100/50"
                style={style}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                        Paso {currentStep + 1} de {TOUR_STEPS.length}
                    </div>
                    <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <h3 className="text-2xl font-bold text-[#1c2938] mb-2">{stepData.title}</h3>
                <p className="text-slate-500 leading-relaxed mb-8">{stepData.content}</p>

                <div className="flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={currentStep === 0}
                        className="text-slate-400 hover:text-[#1c2938] disabled:opacity-30 disabled:hover:text-slate-400 transition-colors flex items-center gap-2 font-bold"
                    >
                        <ArrowLeft className="w-4 h-4" /> Anterior
                    </button>

                    <button
                        onClick={handleNext}
                        className="bg-[#1c2938] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#27bea5] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 flex items-center gap-2"
                    >
                        {isLastStep ? '¡Empezar!' : 'Siguiente'}
                        {!isLastStep && <ArrowRight className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductTour;
