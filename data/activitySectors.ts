// Estructura de Rubros y Subcategorías para Autónomos en España
// Mapeo a artículos de IVA según tipo de actividad

export interface ActivitySector {
  id: string;
  name: string;
  subcategories: ActivitySubcategory[];
  defaultIvaArticle: 'ART_21' | 'ART_69_70' | 'ART_69' | 'ART_70' | 'MIXTO';
}

export interface ActivitySubcategory {
  id: string;
  name: string;
  ivaArticle?: 'ART_21' | 'ART_69_70' | 'ART_69' | 'ART_70' | 'MIXTO'; // Si no se especifica, usa el del sector
  description?: string; // Descripción breve para ayudar al usuario
}

export const ACTIVITY_SECTORS: ActivitySector[] = [
  {
    id: 'tecnologia',
    name: 'Tecnología y Software',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'desarrollo-web', name: 'Desarrollo Web', description: 'Sitios web, aplicaciones web, e-commerce' },
      { id: 'desarrollo-movil', name: 'Desarrollo Móvil', description: 'Apps iOS, Android, multiplataforma' },
      { id: 'desarrollo-software', name: 'Desarrollo de Software', description: 'Software a medida, sistemas empresariales' },
      { id: 'devops', name: 'DevOps e Infraestructura', description: 'Cloud, servidores, CI/CD, automatización' },
      { id: 'ciberseguridad', name: 'Ciberseguridad', description: 'Auditorías, consultoría de seguridad' },
      { id: 'qa-testing', name: 'QA y Testing', description: 'Pruebas de software, control de calidad' },
      { id: 'data-science', name: 'Data Science y Analytics', description: 'Análisis de datos, machine learning, BI' },
      { id: 'blockchain', name: 'Blockchain y Cripto', description: 'Smart contracts, desarrollo blockchain' },
      { id: 'otro-tecnologia', name: 'Otra actividad tecnológica' }
    ]
  },
  {
    id: 'diseno',
    name: 'Diseño y Creatividad',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'diseno-grafico', name: 'Diseño Gráfico', description: 'Branding, identidad visual, material gráfico' },
      { id: 'diseno-web', name: 'Diseño Web/UI/UX', description: 'Interfaces, experiencia de usuario, prototipado' },
      { id: 'diseno-producto', name: 'Diseño de Producto', description: 'Diseño industrial, packaging' },
      { id: 'ilustracion', name: 'Ilustración', description: 'Ilustración digital, tradicional, editorial' },
      { id: 'fotografia', name: 'Fotografía', description: 'Fotografía comercial, eventos, producto' },
      { id: 'video-animacion', name: 'Video y Animación', description: 'Edición de video, motion graphics, animación' },
      { id: 'otro-diseno', name: 'Otra actividad de diseño' }
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing y Publicidad',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'marketing-digital', name: 'Marketing Digital', description: 'SEO, SEM, redes sociales, email marketing' },
      { id: 'publicidad', name: 'Publicidad', description: 'Campañas publicitarias, creatividad publicitaria' },
      { id: 'content-marketing', name: 'Content Marketing', description: 'Creación de contenido, copywriting' },
      { id: 'influencer', name: 'Influencer Marketing', description: 'Colaboraciones, contenido patrocinado' },
      { id: 'eventos-marketing', name: 'Organización de Eventos', description: 'Eventos corporativos, ferias, lanzamientos' },
      { id: 'otro-marketing', name: 'Otra actividad de marketing' }
    ]
  },
  {
    id: 'consultoria',
    name: 'Consultoría',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'consultoria-negocio', name: 'Consultoría de Negocio', description: 'Estrategia, organización, procesos' },
      { id: 'consultoria-it', name: 'Consultoría IT', description: 'Asesoría tecnológica, transformación digital' },
      { id: 'consultoria-financiera', name: 'Consultoría Financiera', description: 'Asesoría financiera, inversiones' },
      { id: 'consultoria-rrhh', name: 'Consultoría de RRHH', description: 'Selección, formación, desarrollo organizacional' },
      { id: 'consultoria-marketing', name: 'Consultoría de Marketing', description: 'Estrategia de marketing, branding' },
      { id: 'otro-consultoria', name: 'Otra consultoría' }
    ]
  },
  {
    id: 'educacion',
    name: 'Educación y Formación',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'formacion-online', name: 'Formación Online', description: 'Cursos online, e-learning, webinars' },
      { id: 'formacion-presencial', name: 'Formación Presencial', description: 'Cursos, talleres, clases particulares' },
      { id: 'coaching', name: 'Coaching', description: 'Coaching personal, ejecutivo, de equipos' },
      { id: 'traduccion', name: 'Traducción e Interpretación', description: 'Traducción de documentos, interpretación' },
      { id: 'otro-educacion', name: 'Otra actividad educativa' }
    ]
  },
  {
    id: 'salud',
    name: 'Salud y Bienestar',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'psicologia', name: 'Psicología', description: 'Terapia psicológica, psicología clínica' },
      { id: 'nutricion', name: 'Nutrición', description: 'Asesoría nutricional, dietética' },
      { id: 'fisioterapia', name: 'Fisioterapia', description: 'Rehabilitación, terapia física' },
      { id: 'medicina-alternativa', name: 'Medicina Alternativa', description: 'Acupuntura, homeopatía, etc.' },
      { id: 'otro-salud', name: 'Otra actividad de salud' }
    ]
  },
  {
    id: 'legal',
    name: 'Legal y Asesoría',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'abogado', name: 'Abogacía', description: 'Asesoría legal, representación legal' },
      { id: 'asesoria-fiscal', name: 'Asesoría Fiscal', description: 'Gestoría, asesoría tributaria' },
      { id: 'asesoria-laboral', name: 'Asesoría Laboral', description: 'Asesoría en RRHH, nóminas' },
      { id: 'notario', name: 'Notaría', description: 'Actos notariales' },
      { id: 'otro-legal', name: 'Otra actividad legal' }
    ]
  },
  {
    id: 'arquitectura',
    name: 'Arquitectura e Ingeniería',
    defaultIvaArticle: 'MIXTO',
    subcategories: [
      { id: 'arquitectura', name: 'Arquitectura', description: 'Proyectos arquitectónicos, dirección de obra' },
      { id: 'ingenieria', name: 'Ingeniería', description: 'Ingeniería civil, industrial, técnica' },
      { id: 'delineante', name: 'Delineación', description: 'Delineación, CAD, planos' },
      { id: 'topografia', name: 'Topografía', description: 'Mediciones, levantamientos topográficos' },
      { id: 'otro-arquitectura', name: 'Otra actividad de arquitectura/ingeniería' }
    ]
  },
  {
    id: 'comercio',
    name: 'Comercio y Retail',
    defaultIvaArticle: 'ART_21',
    subcategories: [
      { id: 'comercio-online', name: 'Comercio Online', description: 'E-commerce, venta online de productos' },
      { id: 'comercio-fisico', name: 'Comercio Físico', description: 'Tienda física, retail' },
      { id: 'dropshipping', name: 'Dropshipping', description: 'Venta sin stock, intermediación' },
      { id: 'importacion-exportacion', name: 'Importación/Exportación', description: 'Comercio internacional de bienes' },
      { id: 'otro-comercio', name: 'Otra actividad comercial' }
    ]
  },
  {
    id: 'servicios-profesionales',
    name: 'Servicios Profesionales',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'contabilidad', name: 'Contabilidad', description: 'Contabilidad, auditoría, análisis financiero' },
      { id: 'recursos-humanos', name: 'Recursos Humanos', description: 'Selección, formación, nóminas' },
      { id: 'comunicacion', name: 'Comunicación', description: 'Comunicación corporativa, relaciones públicas' },
      { id: 'investigacion', name: 'Investigación', description: 'Investigación de mercados, estudios' },
      { id: 'otro-profesional', name: 'Otro servicio profesional' }
    ]
  },
  {
    id: 'arte-cultura',
    name: 'Arte y Cultura',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'musica', name: 'Música', description: 'Composición, producción musical, sesiones' },
      { id: 'escritura', name: 'Escritura', description: 'Escritura creativa, guiones, copywriting' },
      { id: 'arte-visual', name: 'Arte Visual', description: 'Pintura, escultura, arte digital' },
      { id: 'teatro-danza', name: 'Teatro y Danza', description: 'Actuación, dirección, coreografía' },
      { id: 'otro-arte', name: 'Otra actividad artística' }
    ]
  },
  {
    id: 'deportes',
    name: 'Deportes y Fitness',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'entrenador-personal', name: 'Entrenador Personal', description: 'Entrenamiento personalizado, fitness' },
      { id: 'instructor-deporte', name: 'Instructor Deportivo', description: 'Clases de deporte, yoga, pilates' },
      { id: 'nutricion-deportiva', name: 'Nutrición Deportiva', description: 'Asesoría nutricional para deportistas' },
      { id: 'otro-deporte', name: 'Otra actividad deportiva' }
    ]
  },
  {
    id: 'gastronomia',
    name: 'Gastronomía y Hostelería',
    defaultIvaArticle: 'MIXTO',
    subcategories: [
      { id: 'catering', name: 'Catering', description: 'Servicio de catering, eventos' },
      { id: 'chef', name: 'Chef/Cocina', description: 'Servicios de cocina, chef a domicilio' },
      { id: 'pasteleria', name: 'Pastelería', description: 'Repostería, pasteles personalizados' },
      { id: 'otro-gastronomia', name: 'Otra actividad gastronómica' }
    ]
  },
  {
    id: 'belleza',
    name: 'Belleza y Estética',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'peluqueria', name: 'Peluquería', description: 'Cortes, peinados, coloración' },
      { id: 'estetica', name: 'Estética', description: 'Tratamientos faciales, corporales' },
      { id: 'maquillaje', name: 'Maquillaje', description: 'Maquillaje profesional, eventos' },
      { id: 'unas', name: 'Uñas', description: 'Manicura, pedicura, uñas acrílicas' },
      { id: 'otro-belleza', name: 'Otra actividad de belleza' }
    ]
  },
  {
    id: 'reparacion',
    name: 'Reparación y Mantenimiento',
    defaultIvaArticle: 'MIXTO',
    subcategories: [
      { id: 'reparacion-electronica', name: 'Reparación de Electrónica', description: 'Reparación de dispositivos, ordenadores' },
      { id: 'reparacion-vehiculos', name: 'Reparación de Vehículos', description: 'Mecánica, chapa y pintura' },
      { id: 'reparacion-hogar', name: 'Reparación del Hogar', description: 'Fontanería, electricidad, carpintería' },
      { id: 'limpieza', name: 'Limpieza', description: 'Limpieza doméstica, comercial' },
      { id: 'otro-reparacion', name: 'Otra actividad de reparación' }
    ]
  },
  {
    id: 'transporte',
    name: 'Transporte y Logística',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'transporte-pasajeros', name: 'Transporte de Pasajeros', description: 'Taxi, VTC, transporte privado' },
      { id: 'transporte-mercancias', name: 'Transporte de Mercancías', description: 'Mensajería, paquetería, logística' },
      { id: 'otro-transporte', name: 'Otra actividad de transporte' }
    ]
  },
  {
    id: 'inmobiliaria',
    name: 'Inmobiliaria',
    defaultIvaArticle: 'ART_69_70',
    subcategories: [
      { id: 'agente-inmobiliario', name: 'Agente Inmobiliario', description: 'Compraventa, alquiler de inmuebles' },
      { id: 'administracion-fincas', name: 'Administración de Fincas', description: 'Gestión de comunidades, fincas' },
      { id: 'otro-inmobiliaria', name: 'Otra actividad inmobiliaria' }
    ]
  },
  {
    id: 'otro',
    name: 'Otra Actividad',
    defaultIvaArticle: 'MIXTO',
    subcategories: [
      { id: 'otro-general', name: 'Otra actividad no listada', description: 'Especifica tu actividad en el siguiente campo' }
    ]
  }
];

// Función helper para obtener el artículo de IVA según la actividad
export const getIvaArticleForActivity = (sectorId: string, subcategoryId?: string): 'ART_21' | 'ART_69_70' | 'ART_69' | 'ART_70' | 'MIXTO' => {
  const sector = ACTIVITY_SECTORS.find(s => s.id === sectorId);
  if (!sector) return 'ART_69_70'; // Default para servicios
  
  if (subcategoryId) {
    const subcategory = sector.subcategories.find(sub => sub.id === subcategoryId);
    if (subcategory && subcategory.ivaArticle) {
      return subcategory.ivaArticle;
    }
  }
  
  return sector.defaultIvaArticle;
};

// Función helper para obtener la mención legal según el artículo de IVA
export const getLegalMentionByIvaArticle = (
  ivaArticle: 'ART_21' | 'ART_69_70' | 'ART_69' | 'ART_70' | 'MIXTO',
  operationType: 'NACIONAL' | 'EXPORTACION' | 'INTRACOMUNITARIA'
): string => {
  if (operationType === 'NACIONAL') {
    return ''; // No se necesita mención para operaciones nacionales
  }
  
  switch (ivaArticle) {
    case 'ART_21':
      // Exportación de bienes físicos
      return 'Operación exenta por exportación de bienes según artículo 21 de la Ley 37/1992 del IVA.';
    
    case 'ART_69_70':
      // Servicios digitales/profesionales - regla de localización
      if (operationType === 'EXPORTACION') {
        return 'Operación exenta de IVA según artículos 69 y 70 de la Ley 37/1992 del IVA (regla de localización de servicios).';
      } else if (operationType === 'INTRACOMUNITARIA') {
        return 'Operación intracomunitaria exenta de IVA según artículos 69 y 70 de la Directiva 2006/112/CE (regla de localización de servicios).';
      }
      return '';
    
    case 'ART_69':
      // Servicios prestados a empresarios/profesionales
      if (operationType === 'EXPORTACION') {
        return 'Operación exenta de IVA según artículo 69 de la Ley 37/1992 del IVA (servicios a empresarios/profesionales).';
      } else if (operationType === 'INTRACOMUNITARIA') {
        return 'Operación intracomunitaria exenta de IVA según artículo 69 de la Directiva 2006/112/CE (servicios a empresarios/profesionales).';
      }
      return '';
    
    case 'ART_70':
      // Servicios prestados a particulares
      if (operationType === 'EXPORTACION') {
        return 'Operación exenta de IVA según artículo 70 de la Ley 37/1992 del IVA (servicios a particulares).';
      } else if (operationType === 'INTRACOMUNITARIA') {
        return 'Operación intracomunitaria exenta de IVA según artículo 70 de la Directiva 2006/112/CE (servicios a particulares).';
      }
      return '';
    
    case 'MIXTO':
      // Actividades mixtas - requiere evaluación caso por caso
      if (operationType === 'EXPORTACION') {
        return 'Operación exenta de IVA. Se aplica la normativa correspondiente según el tipo de servicio/prestación (artículos 21, 69 o 70 de la Ley 37/1992 del IVA).';
      } else if (operationType === 'INTRACOMUNITARIA') {
        return 'Operación intracomunitaria exenta de IVA. Se aplica la normativa correspondiente según el tipo de servicio/prestación (artículos 69 o 70 de la Directiva 2006/112/CE).';
      }
      return '';
    
    default:
      return '';
  }
};
