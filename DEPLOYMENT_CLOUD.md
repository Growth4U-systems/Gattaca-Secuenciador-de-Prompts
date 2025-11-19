# 🚀 Deployment en la Nube - ECP Generator

Este proyecto está diseñado para correr **100% en la nube**, sin necesidad de instalar Supabase localmente.

## 📋 Requisitos Previos

1. **Cuenta de Supabase** - [Crear cuenta gratis](https://app.supabase.com)
2. **Cuenta de Google AI** - Para obtener API key de Gemini
3. **Node.js 18+** - Para correr el proyecto Next.js

---

## 🏗️ Paso 1: Configurar Proyecto en Supabase Cloud

### 1.1 Crear el Proyecto en Supabase

1. Ve a [https://app.supabase.com](https://app.supabase.com)
2. Click en **"New Project"**
3. Configura:
   - **Name**: `ecp-generator` (o el nombre que prefieras)
   - **Database Password**: Guarda esta contraseña en un lugar seguro
   - **Region**: Selecciona la más cercana a tus usuarios
4. Click en **"Create new project"** y espera ~2 minutos

### 1.2 Aplicar las Migraciones (Crear Tablas)

Una vez que tu proyecto esté listo:

1. En el dashboard de Supabase, ve a: **SQL Editor**
2. Click en **"New query"**
3. Copia y pega **TODO** el contenido de:
   ```
   supabase/migrations/20250101000000_initial_schema.sql
   ```
4. Click en **"Run"** o presiona `Ctrl+Enter`
5. Deberías ver: ✅ **"Success. No rows returned"**

### 1.3 Obtener las Credenciales

1. Ve a: **Settings** → **API**
2. Copia estos 3 valores:
   - **Project URL** (algo como: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public key** (empieza con `eyJ...`)
   - **service_role key** (empieza con `eyJ...`) ⚠️ **ESTE ES SECRETO**

---

## 🔑 Paso 2: Configurar Gemini API

1. Ve a [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click en **"Create API key"**
3. Selecciona un proyecto de Google Cloud (o crea uno nuevo)
4. Copia el API key generado

---

## ⚙️ Paso 3: Configurar Variables de Entorno

1. En la raíz del proyecto, **crea** un archivo `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edita `.env.local` y reemplaza con tus valores reales:

   ```env
   # Supabase Cloud Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://tu-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   # ⚠️ KEEP THIS SECRET!
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   # Gemini API Key
   GEMINI_API_KEY=AIzaSy...
   ```

3. **IMPORTANTE**:
   - ✅ `.env.local` ya está en `.gitignore`
   - ❌ **NUNCA** comitees este archivo a git
   - ❌ **NUNCA** compartas el `service_role` key públicamente

---

## 🌐 Paso 4: Deploy de Edge Functions

Las Edge Functions son funciones serverless que corren en Supabase Cloud.

### 4.1 Instalar Supabase CLI

**En tu máquina local** (no en el entorno de ejecución):

```bash
# macOS
brew install supabase/tap/supabase

# Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
brew install supabase/tap/supabase
```

### 4.2 Conectar CLI al Proyecto Cloud

```bash
# Login en Supabase
supabase login

# Link al proyecto cloud (reemplaza con tu project-ref)
supabase link --project-ref xxxxxxxxxxxxx
```

Cuando te pida el database password, usa el que guardaste en el Paso 1.1.

### 4.3 Deploy de la Edge Function

```bash
# Deploy de la función generate-ecp-step
supabase functions deploy generate-ecp-step
```

### 4.4 Configurar Secretos de la Edge Function

La Edge Function necesita acceso al API key de Gemini:

```bash
# Configurar GEMINI_API_KEY en Supabase
supabase secrets set GEMINI_API_KEY=AIzaSy...
```

Para verificar:
```bash
supabase secrets list
```

---

## 🚀 Paso 5: Correr el Proyecto Localmente

```bash
# Instalar dependencias
npm install

# Correr en modo desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📦 Paso 6: Deploy a Producción (Opcional)

### Opción A: Vercel (Recomendado)

1. Ve a [https://vercel.com](https://vercel.com)
2. Import tu repositorio de GitHub
3. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (marca como secreto)
   - `GEMINI_API_KEY` ⚠️ (marca como secreto)
4. Deploy automático ✅

### Opción B: Otro proveedor

Asegúrate de que tu proveedor soporte:
- Next.js 14+
- Node.js 18+
- Variables de entorno

---

## ✅ Verificación Final

### Verificar Tablas

En Supabase → **Table Editor**, deberías ver:
- ✅ `projects`
- ✅ `knowledge_base_docs`
- ✅ `ecp_campaigns`
- ✅ `execution_logs`

### Verificar Edge Function

```bash
supabase functions list
```

Deberías ver:
```
generate-ecp-step (deployed)
```

### Verificar Aplicación

1. Abre la app en el navegador
2. Intenta crear un proyecto
3. Sube un documento
4. Si todo funciona, ¡estás listo! 🎉

---

## 🔒 Seguridad

### Row Level Security (RLS)

El proyecto viene con RLS **habilitado** por defecto. Esto significa:

- ✅ Los usuarios solo pueden ver sus propios proyectos
- ✅ Los documentos están protegidos por ownership del proyecto
- ✅ Las campañas y logs son privados por usuario

### Autenticación

Para habilitar auth de usuarios:

1. En Supabase → **Authentication** → **Providers**
2. Habilita los providers que quieras (Email, Google, GitHub, etc.)
3. Configura las URLs de redirect si es necesario

---

## 🐛 Troubleshooting

### Error: "No se pueden crear proyectos"

**Causa**: El usuario no está autenticado.

**Solución**: Implementa autenticación en tu app. Por ahora, puedes deshabilitar RLS temporalmente para testing:

```sql
-- En SQL Editor de Supabase (solo para testing local)
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_docs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ecp_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs DISABLE ROW LEVEL SECURITY;
```

⚠️ **NO HAGAS ESTO EN PRODUCCIÓN**

### Error: "Edge function failed"

1. Verifica que el secret `GEMINI_API_KEY` esté configurado:
   ```bash
   supabase secrets list
   ```

2. Verifica logs de la función:
   ```bash
   supabase functions serve generate-ecp-step --no-verify-jwt
   ```

### Error: "Database connection failed"

Verifica que:
- Las URLs en `.env.local` sean correctas
- El proyecto de Supabase esté activo
- Las API keys sean válidas

---

## 📚 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Gemini API](https://ai.google.dev/docs)

---

## 💡 Próximos Pasos

1. **Implementar Autenticación**: Agrega login/signup de usuarios
2. **Agregar Storage**: Para guardar archivos originales (PDFs/DOCX)
3. **Mejorar UI**: Agregar loading states, error handling, etc.
4. **Analytics**: Track usage de tokens de Gemini
5. **Rate Limiting**: Prevenir abuse de la API

---

¿Necesitas ayuda? Abre un issue en el repositorio. 🚀
