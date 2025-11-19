# ECP Generator - Sistema Automatizado de Marketing

Sistema para generar estrategias de marketing ECP (Extended Customer Problem) usando IA con Gemini 2.0 Flash/Pro y arquitectura guiada.

## 🎯 Arquitectura

### Filosofía: "Guided Setup"
- **Proyecto**: Configuración global del cliente (prompts, documentos)
- **Campaña**: Ejecución específica por nicho (país, industria, ECP)
- **Control granular**: El usuario selecciona qué documentos usar en cada paso

### Stack Tecnológico
- **Frontend**: Next.js 14 (App Router), React, TailwindCSS
- **Backend**: Supabase (Postgres + Row Level Security)
- **IA**: Gemini 2.0 Flash (análisis) y Pro (outputs finales)
- **Edge Functions**: Deno runtime en Supabase

## 🗄️ Estructura de Base de Datos

### `projects`
Configuración del proceso para un cliente
- Prompts maestros editables (5 pasos)
- Guías paso a paso para el usuario
- `context_config`: JSONB que mapea `step_X` → `[doc_ids]`

### `knowledge_base_docs`
Documentos subidos con contenido extraído
- Categorías: `product`, `competitor`, `research`, `output`
- Extracción automática: PDF (pdf-parse), DOCX (mammoth), TXT
- Token count automático (trigger SQL)

### `ecp_campaigns`
Sesiones de análisis por nicho
- Inputs: ECP name, problem core, country, industry
- Outputs: research + 4 pasos de análisis
- Status tracking completo

### `execution_logs`
Auditoría detallada de cada llamada a IA

## 🚀 Setup

> ⚠️ **IMPORTANTE**: Las tablas de base de datos NO están creadas automáticamente.
> Lee **SETUP_REQUIRED.md** para instrucciones detalladas sobre cómo aplicar las migraciones.

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase Local (⚠️ REQUERIDO MANUALMENTE)

```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar Supabase local
supabase start

# Aplicar migraciones
supabase db reset
```

### 3. Variables de entorno

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus valores:
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-local
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-local
GEMINI_API_KEY=tu-api-key-de-gemini
```

**Obtener claves locales:**
```bash
supabase status
```

**Obtener Gemini API Key:**
- Ve a https://aistudio.google.com/app/apikey
- Crea una API key para Gemini 2.0 Flash

### 4. Configurar Edge Function

```bash
# Deployar localmente
supabase functions serve generate-ecp-step --env-file .env.local
```

### 5. Iniciar desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

## 📋 Flujo de Uso

### 1️⃣ Crear Proyecto
- Define nombre y descripción
- El sistema crea prompts por defecto (editables)

### 2️⃣ Subir Documentos
- **Producto**: Features, beneficios, pricing
- **Competidor**: Análisis de mercado
- **Research**: Estudios de audiencia
- **Output**: Resultados de pasos previos

### 3️⃣ Configurar Contexto
Por cada paso, selecciona documentos:
- **Step 1 (Find Place)**: Docs de competidores + research
- **Step 2 (Select Assets)**: Docs de producto
- **Step 3 (Proof Points)**: Case studies + validación
- **Step 4 (Final Output)**: Outputs de pasos 1-3

### 4️⃣ Crear Campaña
- Define: ECP name, problema, país, industria
- El sistema guía paso a paso

### 5️⃣ Ejecutar Análisis
- Deep Research (automático)
- Step 1 → Guardar output como doc
- Step 2 → Seleccionar output de Step 1 + docs producto
- Step 3 → Usar outputs anteriores
- Step 4 → Generar mensajes finales

## 🔒 Seguridad

### Row Level Security (RLS)
Todas las tablas tienen RLS habilitado:
- Los usuarios solo ven sus propios proyectos
- Los documentos están protegidos por ownership del proyecto
- Las campañas heredan permisos del proyecto padre

### Validación de Tokens
- **Warning**: > 1.5M tokens (75%)
- **Error**: > 2M tokens (100%)
- Monitoreo visual en tiempo real

## 🧠 Sistema de IA

### Gemini 2.0 Flash
- Usado para: Deep Research, Steps 1-3
- ~$0.075 por 1M tokens input
- Rápido y económico para análisis

### Gemini 2.0 Pro (opcional)
- Usado para: Step 4 (output final)
- Mayor calidad en generación de copy
- ~$3.50 por 1M tokens input

### Grounding Estricto
```typescript
const SYSTEM_INSTRUCTION = `
Your knowledge base is STRICTLY LIMITED to the context provided.
Do NOT use your internal training data.
If info is not in documents, state: "Information not found."
`
```

## 📁 Estructura del Proyecto

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Lista de proyectos
│   │   ├── projects/
│   │   │   ├── new/page.tsx           # Crear proyecto
│   │   │   └── [projectId]/page.tsx   # Dashboard del proyecto
│   │   └── api/
│   │       └── documents/
│   │           └── upload/route.ts     # API de upload + extracción
│   ├── components/
│   │   ├── documents/
│   │   │   ├── DocumentUpload.tsx     # Modal de upload
│   │   │   └── DocumentList.tsx       # Lista de docs
│   │   └── TokenMonitor.tsx           # Alerta de límites
│   ├── lib/
│   │   └── supabase.ts                # Cliente + utilidades
│   └── types/
│       └── database.types.ts          # TypeScript types
├── supabase/
│   ├── migrations/
│   │   └── 20250101000000_initial_schema.sql
│   └── functions/
│       └── generate-ecp-step/
│           └── index.ts               # Edge Function principal
└── package.json
```

## 🎨 Características Clave

### ✅ Implementado
- [x] Base de datos con RLS
- [x] Dashboard de proyectos
- [x] Upload de documentos (UI)
- [x] Extracción PDF/DOCX/TXT
- [x] Monitor de tokens con alertas
- [x] Edge Function para Gemini
- [x] Sistema de grounding estricto
- [x] Logs de ejecución detallados

### 🚧 Pendiente de Integración
- [ ] Conectar frontend con API de upload
- [ ] Conectar botones de ejecución con Edge Function
- [ ] Implementar "Guardar output como documento"
- [ ] Dashboard de logs de ejecución
- [ ] Edición de prompts en UI
- [ ] Sistema de autenticación (Supabase Auth)

## 🧪 Testing

### Test de Upload Local
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@test.pdf" \
  -F "projectId=xxx-xxx-xxx" \
  -F "category=product"
```

### Test de Edge Function
```bash
curl -X POST http://localhost:54321/functions/v1/generate-ecp-step \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "xxx-xxx-xxx",
    "stepName": "deep_research"
  }'
```

## 📚 Próximos Pasos

1. **Completar integración frontend ↔ backend**
2. **Agregar autenticación** (Supabase Auth UI)
3. **Implementar función "Save as Document"**
4. **Testing completo del flujo end-to-end**
5. **Deploy a producción** (Vercel + Supabase Cloud)

## 📝 Notas

- Los modelos Gemini 2.0 están en preview (pueden cambiar)
- El límite de 2M tokens es conservador (oficial: 2.09M)
- Para producción, considerar streaming de respuestas largas
- El sistema de tokens usa estimación simple (chars/4)

## 🤝 Contribuciones

Este es un proyecto interno. Para cambios:
1. Crea una branch
2. Testea localmente con `supabase start`
3. Ejecuta migraciones con `supabase db reset`
4. Commit y push

---

**Versión**: 1.0.0
**Última actualización**: 2025-01-19
