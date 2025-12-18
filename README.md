# Kônsul Bills - España

Software de facturación especializado para autónomos españoles. Offline-first, automatización con IA y gestión completa de obligaciones fiscales.

## 🚀 Características

- **Facturación completa** con IVA (21%, 10%, 4%) e IRPF (15%, 7%, 0%)
- **Cuotas de autónomo** - Calculadora y seguimiento de Seguridad Social
- **Declaraciones trimestrales** - Modelo 130, 131 y 303
- **Validación NIF/CIF** - Integración con servicios de Hacienda
- **IA integrada** - Parsing de facturas, análisis financiero, recomendaciones
- **Modo offline** - Funciona sin conexión, sincroniza automáticamente

## 📋 Prerrequisitos

- Node.js 18+
- Base de datos PostgreSQL (Neon recomendado)
- API Key de Gemini (opcional, para funciones de IA)

## 🛠️ Instalación Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/gabomarinc/bills-autonomo-spain.git
   cd bills-autonomo-spain
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   
   Crea un archivo `.env` en la raíz del proyecto:
   ```env
   # Base de datos Neon PostgreSQL
   DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
   
   # Gemini AI (opcional)
   API_KEY=tu_gemini_api_key
   
   # Resend Email (opcional)
   RESEND_API_KEY=tu_resend_api_key
   RESEND_FROM_EMAIL=tu_email_verificado@dominio.com
   
   # Stripe (opcional, para suscripciones)
   STRIPE_SECRET_KEY=tu_stripe_secret_key
   ```

4. **Configurar la base de datos:**
   
   Ejecuta el script SQL en tu base de datos Neon:
   ```bash
   psql $DATABASE_URL -f database_setup_espana.sql
   ```
   
   O copia y pega el contenido de `database_setup_espana.sql` en el editor SQL de Neon.

5. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

## 📦 Despliegue en Vercel

1. **Conectar repositorio:**
   - Ve a [Vercel](https://vercel.com)
   - Importa el repositorio `bills-autonomo-spain`

2. **Configurar variables de entorno:**
   - `DATABASE_URL`: Tu connection string de Neon
   - `API_KEY`: Tu Gemini API key (opcional)
   - `RESEND_API_KEY`: Tu Resend API key (opcional)
   - `RESEND_FROM_EMAIL`: Email verificado en Resend (opcional)
   - `STRIPE_SECRET_KEY`: Tu Stripe secret key (opcional)

3. **Configuración de build:**
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Desplegar:**
   - Haz clic en "Deploy"
   - Espera a que termine el build

## 🗄️ Base de Datos

El proyecto usa PostgreSQL (Neon). El script `database_setup_espana.sql` crea todas las tablas necesarias:

- `users` - Usuarios/autónomos
- `invoices` - Facturas y cotizaciones
- `expenses` - Gastos
- `clients` - Clientes
- `prospects` - Prospectos
- `providers` - Proveedores
- `catalog_items` - Catálogo de servicios
- `autonomo_quotas` - Cuotas de autónomo
- `trimestral_declarations` - Declaraciones trimestrales
- `autonomo_config` - Configuración autónomo
- `audit_log` - Log de auditoría

## 🧪 Credenciales de Prueba

- Email: `juan@konsulbills.es`
- Password: `password123`

## 📝 Notas

- El proyecto está especializado para **autónomos españoles**
- Moneda por defecto: **EUR**
- Sistema fiscal: **IVA e IRPF**
- Validación de documentos: **NIF/CIF**

## 📄 Licencia

Este proyecto es privado.
