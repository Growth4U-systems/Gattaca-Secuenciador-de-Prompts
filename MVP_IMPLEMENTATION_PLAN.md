# 📋 Plan de Implementación: MVP Flow Builder

## 🎯 Objetivo

Crear la versión mínima viable del Flow Builder que permita:
1. Configurar el flow UNA VEZ (asignar docs y editar prompts)
2. Ejecutar campañas AUTOMÁTICAMENTE de punta a punta
3. Ver progreso en tiempo real

## ✅ Lo que YA está listo

- ✅ Migración SQL (`20250119000001_add_flow_config.sql`)
- ✅ Tipos TypeScript (`src/types/flow.types.ts`)
- ✅ Nueva Edge Function genérica (`execute-flow-step/index.ts`)

## 🛠️ Lo que falta implementar (MVP)

### 1. APIs Backend (Next.js)

#### `/api/flow/save-config` - Guardar configuración del flow
```typescript
POST /api/flow/save-config
Body: {
  projectId: string
  flowConfig: {
    steps: [
      {
        id: "step-1",
        name: "Deep Research",
        order: 1,
        prompt: "...",
        base_doc_ids: ["doc-uuid-1", "doc-uuid-2"],
        auto_receive_from: []
      },
      ...
    ]
  }
}
```

**Qué hace:**
- Valida el flowConfig
- Actualiza `projects.flow_config`
- Retorna success/error

#### `/api/campaign/run` - Ejecutar campaña completa
```typescript
POST /api/campaign/run
Body: {
  campaignId: string
}
```

**Qué hace:**
1. Cargar flowConfig del proyecto
2. Para cada step en orden:
   - Llamar a edge function `execute-flow-step`
   - Esperar a que complete
   - Siguiente step
3. Marcar campaña como completada
4. Retornar resultados

### 2. UI Components

#### `FlowSetup.tsx` - Configurar flow del proyecto

**Ubicación:** `src/components/flow/FlowSetup.tsx`

**UI:**
```
┌──────────────────────────────────────────┐
│  Flow Configuration                      │
│  ──────────────────────────────────────  │
│                                          │
│  1. Deep Research                  [Edit]│
│     Docs: 2 documentos asignados         │
│     Auto-receives: (ninguno)             │
│                                          │
│  2. Find Place                     [Edit]│
│     Docs: 1 documento asignado           │
│     Auto-receives: ← Step 1              │
│                                          │
│  3. Select Assets                  [Edit]│
│     Docs: 2 documentos asignados         │
│     Auto-receives: ← Step 2              │
│                                          │
│  4. Proof Points                   [Edit]│
│     Docs: 1 documento asignado           │
│     Auto-receives: ← Step 3              │
│                                          │
│  5. Final Output                   [Edit]│
│     Docs: 0 documentos               │
│     Auto-receives: ← Steps 1,2,3,4       │
│                                          │
│  [Save Flow Configuration]               │
└──────────────────────────────────────────┘
```

**Funcionalidad:**
- Muestra los 5 steps existentes (NO se pueden crear/eliminar por ahora)
- Botón "Edit" abre modal StepEditor
- Botón "Save" guarda flowConfig via API

#### `StepEditor.tsx` - Editar step individual

**Ubicación:** `src/components/flow/StepEditor.tsx`

**UI:**
```
┌──────────────────────────────────────────┐
│  Edit Step: "Deep Research"              │
│  ──────────────────────────────────────  │
│                                          │
│  📄 Base Documents:                      │
│  ☑ market-trends.pdf (2.5K tokens)      │
│  ☑ industry-report.pdf (1.2K tokens)    │
│  ☐ competitor-analysis.pdf (800 tokens) │
│  ☐ product-specs.pdf (3.1K tokens)      │
│  ☐ features.pdf (1.5K tokens)           │
│                                          │
│  Total selected: 2 docs, 3.7K tokens    │
│                                          │
│  📥 Auto-receive output from:            │
│  ☐ Step 1: Deep Research                │
│  ☐ Step 2: Find Place                   │
│  ☐ Step 3: Select Assets                │
│  ☐ Step 4: Proof Points                 │
│                                          │
│  📝 Prompt:                              │
│  ┌────────────────────────────────────┐ │
│  │ ACT AS: Market Researcher          │ │
│  │ Analyze {{ecp_name}} in {{country}}│ │
│  │ ...                                 │ │
│  │ (20 lines)                          │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Variables: {{ecp_name}}, {{country}},  │
│  {{industry}}, {{problem_core}}          │
│                                          │
│  [Save]  [Cancel]                        │
└──────────────────────────────────────────┘
```

**Funcionalidad:**
- Checkboxes para seleccionar documentos base
- Checkboxes para auto_receive_from
- Textarea para editar prompt
- Botón Save cierra modal y actualiza estado local

#### `CampaignRunner.tsx` - Ejecutar y ver progreso

**Ubicación:** `src/components/campaign/CampaignRunner.tsx`

**UI (antes de ejecutar):**
```
┌──────────────────────────────────────────┐
│  New Campaign                            │
│  ──────────────────────────────────────  │
│                                          │
│  ECP Name: [Fintech for SMEs       ]    │
│  Problem: [Access to credit         ]    │
│  Country: [Mexico                   ]    │
│  Industry: [Financial Services      ]    │
│                                          │
│  [▶ Run Campaign]                        │
└──────────────────────────────────────────┘
```

**UI (ejecutando):**
```
┌──────────────────────────────────────────┐
│  Campaign: Fintech for SMEs              │
│  Status: Running... (Step 2 of 5)        │
│  ──────────────────────────────────────  │
│                                          │
│  ✓ Step 1: Deep Research                │
│     Output: 2,500 tokens (completed)     │
│                                          │
│  ⏸ Step 2: Find Place                   │
│     Running... 45%                       │
│                                          │
│  ⏳ Step 3: Select Assets                │
│  ⏳ Step 4: Proof Points                 │
│  ⏳ Step 5: Final Output                 │
│                                          │
│  [⏹ Cancel]                              │
└──────────────────────────────────────────┘
```

**UI (completado):**
```
┌──────────────────────────────────────────┐
│  Campaign: Fintech for SMEs              │
│  Status: ✓ Completed                     │
│  ──────────────────────────────────────  │
│                                          │
│  ✓ Step 1: Deep Research (2.5K tokens)  │
│  ✓ Step 2: Find Place (1.8K tokens)     │
│  ✓ Step 3: Select Assets (2.1K tokens)  │
│  ✓ Step 4: Proof Points (1.5K tokens)   │
│  ✓ Step 5: Final Output (3.2K tokens)   │
│                                          │
│  Total: 11.1K tokens | Duration: 2m 15s  │
│                                          │
│  [View Outputs] [Download All]           │
└──────────────────────────────────────────┘
```

**Funcionalidad:**
- Formulario para crear campaña
- Botón "Run Campaign" llama a API `/api/campaign/run`
- Polling cada 2 segundos para actualizar progreso
- Muestra estado de cada step en tiempo real

### 3. Integración con UI existente

#### Modificar `src/app/projects/[projectId]/page.tsx`

**Agregar nueva pestaña:**
```tsx
const tabs = [
  { id: 'documents', label: 'Documentos', icon: FileText },
  { id: 'flow', label: 'Flow Setup', icon: Workflow },  // ← NUEVO
  { id: 'campaigns', label: 'Campañas', icon: Rocket },
]
```

**Nuevo tab content:**
```tsx
{activeTab === 'flow' && (
  <FlowSetup projectId={params.projectId} />
)}
```

## 📦 Archivos a crear/modificar

### Nuevos archivos:

1. `supabase/functions/execute-flow-step/index.ts` ✅ (ya creado)
2. `src/app/api/flow/save-config/route.ts`
3. `src/app/api/campaign/run/route.ts`
4. `src/components/flow/FlowSetup.tsx`
5. `src/components/flow/StepEditor.tsx`
6. `src/components/campaign/CampaignRunner.tsx`

### Archivos a modificar:

1. `src/app/projects/[projectId]/page.tsx` (agregar tab Flow Setup)

## 🔄 Flujo completo de uso

### Setup inicial (UNA VEZ):

1. Usuario crea proyecto
2. Usuario sube documentos
3. Usuario va a pestaña "Flow Setup"
4. Para cada step:
   - Click "Edit"
   - Selecciona documentos base
   - Selecciona auto_receive_from
   - Edita prompt (opcional)
   - Click "Save"
5. Click "Save Flow Configuration"

### Ejecutar campaña (N VECES):

1. Usuario va a pestaña "Campañas"
2. Click "Nueva Campaña"
3. Llena formulario (ECP, país, industria, problema)
4. Click "▶ Run Campaign"
5. **El sistema ejecuta AUTOMÁTICAMENTE:**
   - Step 1 con docs base asignados
   - Step 2 con docs base + output de Step 1
   - Step 3 con docs base + output de Step 2
   - Step 4 con docs base + output de Step 3
   - Step 5 con docs base + outputs de todos los steps previos
6. Ver resultados

## ⏱️ Estimación de tiempo

- ✅ Edge Function genérica: **LISTO**
- API save-config: **20 min**
- API run campaign: **40 min**
- FlowSetup UI: **30 min**
- StepEditor UI: **40 min**
- CampaignRunner UI: **40 min**
- Integración con tabs: **10 min**
- Testing: **30 min**

**Total: ~3 horas**

## 🚫 Lo que NO voy a hacer (fuera de scope MVP)

❌ Crear/eliminar steps dinámicamente
❌ Drag & drop para reordenar
❌ Visualización con diagramas/flechas
❌ Pausar/resumir campaña
❌ Templates de flows
❌ Clonar flows
❌ Exportar/importar flows

## ✅ Validación

Antes de continuar, confirma:

1. ¿La UI propuesta es clara y suficiente?
2. ¿El flujo de uso tiene sentido?
3. ¿Hay algo que quieras cambiar o agregar?
4. ¿Procedo con la implementación?
