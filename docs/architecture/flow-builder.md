# 🎨 Arquitectura: Flow Builder Dinámico

## 🎯 Objetivo

Transformar el sistema de un proceso rígido de 5 pasos fijos a un **Flow Builder completamente customizable** donde el usuario puede:

- ✅ Crear pasos ilimitados con prompts personalizados
- ✅ Reordenar, agregar, eliminar pasos
- ✅ Definir categorías de documentos custom
- ✅ Visualizar el proceso como un diagrama de flujo
- ✅ Ejecutar el flow completo de punta a punta automáticamente

---

## 📊 Modelo de Datos Actual vs. Nuevo

### ❌ Modelo ACTUAL (Rígido)

```sql
projects:
  - prompt_deep_research TEXT
  - prompt_1_find_place TEXT
  - prompt_2_select_assets TEXT
  - prompt_3_proof_legit TEXT
  - prompt_4_final_output TEXT
  - context_config JSONB  -- { "step_1": ["doc1", "doc2"] }

doc_category ENUM: ('product', 'competitor', 'research', 'output')
```

**Problemas:**
- Solo 5 pasos fijos
- No se pueden reordenar
- Categorías de documentos fijas
- No se puede cambiar la lógica

### ✅ Modelo NUEVO (Flexible)

```sql
projects:
  -- Flow configuration (array de steps)
  - flow_config JSONB DEFAULT '[]'::jsonb
    Estructura:
    [
      {
        "id": "step_uuid_1",
        "name": "Deep Research",
        "order": 1,
        "prompt": "Conduct research on {{ecp_name}}...",
        "selected_doc_ids": ["doc-uuid-1", "doc-uuid-2", "doc-uuid-5"],  -- SELECCIÓN MANUAL
        "depends_on": [],  -- IDs de steps previos necesarios
        "output_field": "deep_research_output"
      },
      {
        "id": "step_uuid_2",
        "name": "Find Market Place",
        "order": 2,
        "prompt": "Using the research from previous step...",
        "selected_doc_ids": ["doc-uuid-1", "doc-uuid-3", "doc-uuid-7"],  -- SELECCIÓN MANUAL
        "depends_on": ["step_uuid_1"],
        "output_field": "market_place_output"
      }
    ]

  -- Document categories configuration (solo para organización visual)
  - doc_categories JSONB DEFAULT '["product","competitor","research","output"]'::jsonb
    Ejemplo personalizado:
    ["product_specs", "customer_feedback", "market_analysis", "brand_voice", "outputs"]

    ⚠️ IMPORTANTE: Las categorías son SOLO etiquetas visuales para organizar documentos.
    NO se usan en la lógica de ejecución. El usuario selecciona INDIVIDUALMENTE
    qué documentos usar en cada step.

ecp_campaigns:
  -- Step outputs dinámicos (en lugar de output_1, output_2...)
  - step_outputs JSONB DEFAULT '{}'::jsonb
    Estructura:
    {
      "step_uuid_1": {
        "output": "Research text...",
        "tokens": 5000,
        "status": "completed",
        "completed_at": "2025-01-19T12:00:00Z"
      },
      "step_uuid_2": {
        "output": "Market analysis...",
        "tokens": 3000,
        "status": "completed",
        "completed_at": "2025-01-19T12:05:00Z"
      }
    }

  -- Execution state
  - current_step_id TEXT  -- ID del step actual en ejecución
  - status TEXT  -- 'draft', 'running', 'completed', 'error', 'paused'
  - started_at TIMESTAMPTZ
  - completed_at TIMESTAMPTZ

knowledge_base_docs:
  - category TEXT  -- Ya no es ENUM, es texto libre
```

---

## 🏗️ Componentes del Sistema

### 1. **Flow Builder UI**

**Ubicación:** `/src/components/flow/FlowBuilder.tsx`

**Funcionalidad:**
- Drag & drop de pasos
- Agregar/eliminar/editar pasos
- Configurar prompt de cada paso
- Seleccionar qué categorías de docs usar
- Ver dependencias entre pasos
- Guardar configuración

**UI:**
```
┌────────────────────────────────────────┐
│  Flow Builder                          │
│  ┌──────────┐    ┌──────────┐         │
│  │ Step 1   │ → │ Step 2   │         │
│  │ Research │    │ Analysis │         │
│  └──────────┘    └──────────┘         │
│       ↓               ↓                │
│  ┌──────────┐    ┌──────────┐         │
│  │ Step 3   │ ← │ Step 4   │         │
│  │ Assets   │    │ Proof    │         │
│  └──────────┘    └──────────┘         │
│       ↓                                │
│  ┌──────────┐                         │
│  │ Step 5   │                         │
│  │ Output   │                         │
│  └──────────┘                         │
│                                        │
│  [+ Add Step]  [Save Flow]            │
└────────────────────────────────────────┘
```

### 2. **Step Editor Modal**

**Ubicación:** `/src/components/flow/StepEditor.tsx`

**Campos:**
- **Step Name**: Input de texto
- **Order**: Number (posición en el flow)
- **Prompt**: Textarea con variables disponibles ({{ecp_name}}, {{step:nombre}}, etc.)
- **Depends On**: Multiselect de steps previos (para incluir sus outputs)
- **Documents**: Lista de TODOS los documentos del proyecto con checkboxes
  - ☑ doc1.pdf (📦 product) - 2.5K tokens
  - ☐ doc2.docx (🎯 competitor) - 1.2K tokens
  - ☑ doc3.txt (🔬 research) - 500 tokens
  - [Filtrar por categoría: Todas ▼] (solo para facilitar búsqueda visual)
  - Total seleccionado: 3 docs, 4.2K tokens

### 3. **Category Manager**

**Ubicación:** `/src/components/flow/CategoryManager.tsx`

**Funcionalidad:**
- Ver categorías actuales
- Agregar nueva categoría
- Editar nombre de categoría
- Eliminar categoría (con validación de uso)
- Asignar color/icono a categoría

### 4. **Flow Executor (Motor de Ejecución)**

**Ubicación:** `/src/lib/flowExecutor.ts`

**Lógica:**
```typescript
class FlowExecutor {
  async executeFlow(campaignId: string) {
    1. Cargar flow_config del proyecto
    2. Ordenar steps por "order" y "depends_on"
    3. Para cada step en orden:
       a. Verificar que dependencias estén completadas
       b. Recolectar documentos según selected_doc_categories
       c. Incluir outputs de steps previos si depende de ellos
       d. Llamar a Edge Function con configuración del step
       e. Guardar output en step_outputs[step_id]
       f. Actualizar current_step_id
    4. Marcar campaña como 'completed'
    5. Retornar resultado completo
  }

  async executeStep(campaignId: string, stepId: string) {
    // Ejecutar solo un step específico
  }

  async pauseFlow(campaignId: string) {
    // Pausar ejecución
  }

  async resumeFlow(campaignId: string) {
    // Continuar desde current_step_id
  }
}
```

### 5. **Flow Visualizer**

**Ubicación:** `/src/components/flow/FlowVisualizer.tsx`

**Funcionalidad:**
- Mostrar flow como diagrama
- Mostrar estado de cada step (pending/running/completed/error)
- Click en step para ver output
- Progress bar general
- Tiempo estimado restante

---

## 🔄 Edge Function Genérica

### ❌ ACTUAL: Hardcoded por step

```typescript
switch (stepName) {
  case 'deep_research':
    promptTemplate = project.prompt_deep_research
    break
  case 'step_1':
    promptTemplate = project.prompt_1_find_place
    break
  // ...
}
```

### ✅ NUEVO: Genérica

```typescript
interface StepConfig {
  id: string
  name: string
  prompt: string
  selected_doc_ids: string[]  // SELECCIÓN MANUAL de documentos
  depends_on: string[]
}

async function executeStep(
  campaignId: string,
  stepConfig: StepConfig
) {
  // 1. Cargar documentos específicos por IDs (selección manual del usuario)
  const docs = await loadDocumentsByIds(
    stepConfig.selected_doc_ids
  )

  // 2. Cargar outputs de steps dependientes
  const previousOutputs = await loadPreviousStepOutputs(
    campaignId,
    stepConfig.depends_on
  )

  // 3. Construir contexto
  let contextString = ''

  // Agregar documentos seleccionados
  for (const doc of docs) {
    contextString += `\n--- START DOCUMENT: ${doc.filename} (${doc.category}) ---\n`
    contextString += doc.extracted_content
    contextString += `\n--- END DOCUMENT ---\n`
  }

  // Agregar outputs de steps previos (si depends_on tiene valores)
  for (const [stepId, output] of Object.entries(previousOutputs)) {
    contextString += `\n--- START PREVIOUS STEP OUTPUT: ${output.step_name} ---\n`
    contextString += output.text
    contextString += `\n--- END PREVIOUS STEP OUTPUT ---\n`
  }

  // 4. Reemplazar variables en el prompt
  const finalPrompt = replaceVariables(stepConfig.prompt, {
    ecp_name: campaign.ecp_name,
    problem_core: campaign.problem_core,
    country: campaign.country,
    industry: campaign.industry,
    client_name: project.name,
    // Variables de steps previos
    previous_outputs: previousOutputs
  })

  // 5. Llamar a Gemini
  const output = await callGemini(contextString, finalPrompt)

  // 6. Guardar output
  await saveStepOutput(campaignId, stepConfig.id, output)

  return output
}
```

---

## 📝 Variables Disponibles en Prompts

El usuario podrá usar estas variables en los prompts:

**Variables de Campaña:**
- `{{ecp_name}}` - Nombre del ECP
- `{{problem_core}}` - Problema core
- `{{country}}` - País
- `{{industry}}` - Industria
- `{{client_name}}` - Nombre del proyecto

**Variables de Steps Previos:**
- `{{step:STEP_NAME}}` - Output completo de un step previo
- `{{step:STEP_NAME:summary}}` - Resumen del step previo (primeros 500 chars)

**Ejemplo de Prompt:**
```
ACT AS: Senior Analyst
CONTEXT: Market in {{country}} for {{industry}}
PREVIOUS RESEARCH: {{step:Deep Research}}

TASK: Analyze the market position based on the research above...
```

---

## 🎨 UX del Flow Builder

### Vista Principal: Project Dashboard

```
┌────────────────────────────────────────────────────┐
│  📊 Project: ACME Corp                             │
│  ┌──────────┬──────────┬──────────┬──────────┐   │
│  │Documents │Flow Build│Categories│Campaigns │   │
│  └──────────┴──────────┴──────────┴──────────┘   │
│                                                    │
│  [Flow Builder Tab]                               │
│                                                    │
│  ┌────────────────────────────────────────┐       │
│  │ Current Flow: "Standard ECP Process"   │       │
│  │                                         │       │
│  │  START                                  │       │
│  │    ↓                                    │       │
│  │  ┌─────────────────┐                   │       │
│  │  │ 1. Deep Research│ ✓ completed       │       │
│  │  │ Uses: research  │ (2.5K tokens)     │       │
│  │  └─────────────────┘                   │       │
│  │    ↓                                    │       │
│  │  ┌─────────────────┐                   │       │
│  │  │ 2. Find Place   │ ⏸ running...      │       │
│  │  │ Uses: research, │                   │       │
│  │  │       competitor│                   │       │
│  │  └─────────────────┘                   │       │
│  │    ↓                                    │       │
│  │  ┌─────────────────┐                   │       │
│  │  │ 3. Assets       │ ⏳ pending        │       │
│  │  │ Uses: product   │                   │       │
│  │  └─────────────────┘                   │       │
│  │    ↓                                    │       │
│  │  ┌─────────────────┐                   │       │
│  │  │ 4. Proof Points │ ⏳ pending        │       │
│  │  │ Uses: product,  │                   │       │
│  │  │       outputs   │                   │       │
│  │  └─────────────────┘                   │       │
│  │    ↓                                    │       │
│  │  ┌─────────────────┐                   │       │
│  │  │ 5. Final Output │ ⏳ pending        │       │
│  │  │ Uses: all       │                   │       │
│  │  └─────────────────┘                   │       │
│  │    ↓                                    │       │
│  │  END                                    │       │
│  │                                         │       │
│  │  [+ Add Step]  [Edit Flow]  [Clone]   │       │
│  └────────────────────────────────────────┘       │
│                                                    │
│  Quick Actions:                                   │
│  [▶ Run Full Flow] [⏸ Pause] [⏹ Stop] [🔄 Reset] │
└────────────────────────────────────────────────────┘
```

### Modal: Edit Step

```
┌──────────────────────────────────────────┐
│  Edit Step: "Deep Research"             │
│  ─────────────────────────────────────   │
│                                          │
│  Step Name: *                            │
│  ┌────────────────────────────────────┐ │
│  │ Deep Research                      │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Order: *                                │
│  ┌───┐                                   │
│  │ 1 │                                   │
│  └───┘                                   │
│                                          │
│  Document Categories:                    │
│  ☑ Research                              │
│  ☑ Competitor                            │
│  ☐ Product                               │
│  ☐ Outputs                               │
│  [+ Add Category]                        │
│                                          │
│  Depends On (previous steps):            │
│  ☐ None (first step)                     │
│                                          │
│  Prompt: *                               │
│  ┌────────────────────────────────────┐ │
│  │ Conduct a thorough analysis of    │ │
│  │ the unmet financial need for ECP: │ │
│  │ '{{ecp_name}}' with Pain:         │ │
│  │ '{{problem_core}}' in {{country}} │ │
│  │ {{industry}} market...            │ │
│  │                                    │ │
│  │ [5 lines more...]                 │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Available Variables:                    │
│  {{ecp_name}}, {{problem_core}},        │
│  {{country}}, {{industry}}              │
│                                          │
│  [Save Step]  [Cancel]  [Delete Step]   │
└──────────────────────────────────────────┘
```

---

## 🗄️ Migration Plan

### Paso 1: Agregar columnas nuevas SIN borrar las viejas

```sql
-- Migration: 20250119000000_add_flow_builder.sql

ALTER TABLE projects ADD COLUMN flow_config JSONB DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN doc_categories JSONB DEFAULT '["product","competitor","research","output"]'::jsonb;

ALTER TABLE ecp_campaigns ADD COLUMN step_outputs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ecp_campaigns ADD COLUMN current_step_id TEXT;
ALTER TABLE ecp_campaigns ADD COLUMN started_at TIMESTAMPTZ;
ALTER TABLE ecp_campaigns ADD COLUMN completed_at TIMESTAMPTZ;

-- Cambiar category de ENUM a TEXT (mantener compatibilidad)
ALTER TABLE knowledge_base_docs ALTER COLUMN category TYPE TEXT;

-- Función para migrar datos viejos a nuevo formato
CREATE OR REPLACE FUNCTION migrate_old_flow_to_new()
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET flow_config = jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Deep Research',
      'order', 0,
      'prompt', prompt_deep_research,
      'selected_doc_categories', ARRAY['research', 'competitor'],
      'depends_on', ARRAY[]::text[],
      'output_field', 'deep_research_text'
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Find Place',
      'order', 1,
      'prompt', prompt_1_find_place,
      'selected_doc_categories', ARRAY['research', 'competitor'],
      'depends_on', ARRAY[]::text[],
      'output_field', 'output_1_find_place'
    )
    -- ... más steps
  )
  WHERE flow_config = '[]'::jsonb;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar migración
SELECT migrate_old_flow_to_new();
```

### Paso 2: Después de validar, DROP columnas viejas (opcional)

```sql
-- Migration: 20250120000000_remove_old_columns.sql (futuro)
ALTER TABLE projects DROP COLUMN prompt_deep_research;
ALTER TABLE projects DROP COLUMN prompt_1_find_place;
-- etc...
```

---

## 📦 Implementación por Fases

### Fase 1: Backend & DB ✅
- [ ] Migración de base de datos
- [ ] Modificar Edge Function a genérica
- [ ] Crear FlowExecutor service
- [ ] APIs para CRUD de flow_config

### Fase 2: UI Básico ✅
- [ ] FlowBuilder component (lista, sin drag&drop)
- [ ] StepEditor modal
- [ ] CategoryManager component
- [ ] Guardar/cargar flow config

### Fase 3: Ejecución ✅
- [ ] Botón "Run Flow"
- [ ] Progress tracking
- [ ] Ver outputs por step
- [ ] Error handling

### Fase 4: UX Avanzado 🚀
- [ ] Drag & drop visual de steps
- [ ] Diagrama de flujo con conexiones
- [ ] Templates de flows predefinidos
- [ ] Clone/export/import flows

---

## 🎯 Resultado Final

Con este sistema, el usuario podrá:

1. **Crear un flow desde cero:**
   - "Quiero 3 pasos: Research → Analysis → Output"
   - Definir prompts personalizados
   - Elegir qué docs usar en cada paso

2. **Modificar flow existente:**
   - "Quiero agregar un paso de 'Competitive Analysis' entre step 2 y 3"
   - Reordenar con drag & drop
   - Cambiar dependencias

3. **Categorías custom:**
   - "Mis categorías son: Product_Specs, Customer_Feedback, Brand_Voice, Market_Data"
   - Asignar colores/iconos

4. **Ejecutar de punta a punta:**
   - Click en "Run Flow"
   - Ver progreso en tiempo real
   - Pausar/resumir/cancelar
   - Ver outputs intermedios

5. **Reutilizar flows:**
   - Guardar flow como template
   - Clonar a otros proyectos
   - Exportar/importar JSON

---

¿Te parece bien este diseño? ¿Quieres que empiece a implementarlo?
