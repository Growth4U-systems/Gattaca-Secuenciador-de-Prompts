# ECP Generator - Sistema Automatizado de Marketing

🌐 **Sistema 100% Cloud** para generar estrategias de marketing ECP (Extended Customer Problem) usando IA con Gemini 2.0 Flash/Pro y arquitectura guiada.

✅ **Sin Docker | Sin Instalación Local | Deploy en Minutos**

## 🎯 Arquitectura

### Filosofía: "Guided Setup"
- **Proyecto**: Configuración global del cliente (prompts, documentos)
- **Campaña**: Ejecución específica por nicho (país, industria, ECP)
- **Control granular**: El usuario selecciona qué documentos usar en cada paso

### Stack Tecnológico
- **Frontend**: Next.js 14 (App Router), React, TailwindCSS
- **Backend**: Supabase Cloud (Postgres + Row Level Security)
- **IA**: Gemini 2.0 Flash (análisis) y Pro (outputs finales)
- **Edge Functions**: Deno runtime en Supabase Cloud
- **Deployment**: Vercel (frontend) + Supabase Cloud (backend)

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

## 🚀 Quick Start - Deploy en 15 Minutos

> 📖 **Guía Completa de Deployment**: Lee **[cloud-deployment.md](./docs/deployment/cloud-deployment.md)** para instrucciones paso a paso.

### Resumen Rápido

1. **Crear proyecto en Supabase Cloud** (gratis)
   - Ir a [app.supabase.com](https://app.supabase.com)
   - Crear nuevo proyecto: `ecp-generator`

2. **Aplicar migraciones** (crear tablas)
   - Copiar SQL de `supabase/migrations/20250101000000_initial_schema.sql`
   - Pegar en SQL Editor de Supabase → Run

3. **Obtener credenciales**
   - Supabase: Settings → API (URL + anon key + service role key)
   - Gemini: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

4. **Configurar variables de entorno**
   ```bash
   cp .env.example .env.local
   # Editar .env.local con tus credenciales
   ```

5. **Deploy Edge Function**
   ```bash
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase functions deploy generate-ecp-step
   supabase secrets set GEMINI_API_KEY=tu-api-key
   ```

6. **Correr el proyecto**
   ```bash
   npm install
   npm run dev
   ```

🎉 Abre http://localhost:3000

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
5. **Deploy a producción en Vercel** (conectado a Supabase Cloud)

## 📝 Notas

- Los modelos Gemini 2.0 están en preview (pueden cambiar)
- El límite de 2M tokens es conservador (oficial: 2.09M)
- Para producción, considerar streaming de respuestas largas
- El sistema de tokens usa estimación simple (chars/4)

## 🤝 Contribuciones

Este es un proyecto interno. Para cambios:
1. Crea una branch
2. Testea contra tu proyecto de Supabase Cloud
3. Commit y push
4. Deploy con `npm run supabase:deploy`

---

**Versión**: 1.0.0
**Última actualización**: 2025-01-19
