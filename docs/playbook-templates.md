# Playbook Templates - Documentación y Verificación

Este documento define la estructura estándar de los templates de playbook y su estado de completitud.

---

## Arquitectura Visual Unificada

### Modelo de Datos

```
PROYECTO (Playbook)
├── Configuración Base (compartida por todas las campañas)
│   ├── Prompts de cada paso (editables)
│   └── Variables de configuración del sistema
│
└── CAMPAÑAS (instancias)
    ├── Heredan prompts de Configuración Base al crearse
    ├── Variables de prompt: valores específicos (ej: client_name = "Acme")
    └── Ejecución paso a paso con Human in the Loop
```

### Vista Unificada (Panel Dual)

Todos los playbooks usan una vista unificada con:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔍 Nombre del Playbook                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  [Configuración Base]  [Campaña: Nombre ▼]                              │
├──────────────────────────────────┬──────────────────────────────────────┤
│  NAVEGACIÓN (fases/pasos)        │  ÁREA DE TRABAJO                     │
│  ● Fase 1: Config                │  Paso actual con:                    │
│    ✓ Paso 1                      │  - Variables requeridas              │
│    ● Paso 2 ◀                    │  - Prompt (en modo config)           │
│    ○ Paso 3                      │  - Resultado (si ejecutado)          │
│  ○ Fase 2: Ejecución             │  - Botón ejecutar/continuar          │
│    ○ Paso 4                      │                                      │
└──────────────────────────────────┴──────────────────────────────────────┘
```

### Dos Modos de Operación

**Modo Configuración Base**:
- Editar prompts de cada paso
- Configurar parámetros del sistema
- NO se ejecuta nada

**Modo Campaña**:
- Seleccionar/crear campaña desde header
- Wizard de configuración al crear nueva campaña
- Ejecución paso a paso con human in the loop

### Tipos de Paso para UI

```typescript
type StepType =
  | 'input'              // Usuario ingresa datos
  | 'suggestion'         // Sistema sugiere, usuario selecciona/edita
  | 'auto'               // Ejecuta automáticamente
  | 'auto_with_preview'  // Preview antes de continuar
  | 'auto_with_review'   // Ejecuta y muestra para revisión
  | 'decision'           // Usuario toma decisión crítica
  | 'display'            // Solo muestra información
  | 'action'             // Acción del usuario (ej: exportar)

type ExecutorType = 'llm' | 'job' | 'api' | 'custom' | 'none'
```

### Archivos de Configuración Visual

| Archivo | Propósito |
|---------|-----------|
| `src/components/playbook/types.ts` | Tipos para la arquitectura visual |
| `src/components/playbook/configs/index.ts` | Registry de configuraciones |
| `src/components/playbook/configs/[playbook].config.ts` | Config visual por playbook |
| `src/components/playbook/PlaybookShell.tsx` | Layout con panel dual |
| `src/components/playbook/NavigationPanel.tsx` | Panel izquierdo |
| `src/components/playbook/WorkArea.tsx` | Panel derecho |

---

## Estructura de un PlaybookTemplate

Cada template debe implementar la interface `PlaybookTemplate` definida en `src/lib/templates/types.ts`:

```typescript
interface PlaybookTemplate {
  template_id: string
  name: string
  description: string
  playbook_type: 'ecp' | 'niche_finder' | 'competitor_analysis' | 'signal_based_outreach'

  flow_config: {
    steps: FlowStep[]
    version: string
    description: string
  }

  variable_definitions: VariableDefinition[]

  required_documents: {
    product: string[]
    competitor: string[]
    research: string[]
  }

  campaign_docs_guide: string
}
```

### Elementos Requeridos por Paso (FlowStep)

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| `id` | UUID único del paso | ✅ |
| `name` | Nombre descriptivo | ✅ |
| `order` | Orden de ejecución (0-based) | ✅ |
| `type` | `'llm'` o `'scraper'` | ✅ |
| `prompt` | Prompt completo con placeholders | ✅ (si type=llm) |
| `model` | Modelo a usar (ej: `'openai/gpt-4o-mini'`) | ✅ |
| `temperature` | 0.0 - 1.0 | ✅ |
| `max_tokens` | Límite de tokens de salida | ✅ |
| `output_format` | `'text'`, `'markdown'`, `'json'`, `'csv'` | ⚠️ Recomendado |
| `description` | Descripción para UI | ⚠️ Recomendado |
| `auto_receive_from` | IDs de pasos anteriores | ⚠️ Opcional |
| `base_doc_ids` | Categorías de docs sugeridos | ⚠️ Opcional |

### Variables del Proyecto (VariableDefinition)

```typescript
interface VariableDefinition {
  name: string           // Nombre para placeholders: {{name}}
  default_value: string  // Valor por defecto
  required: boolean      // Si es obligatorio
  description: string    // Explicación para el usuario
}
```

---

## Checklist de Verificación por Template

### Estado Actual ✅ COMPLETADO

| Elemento | Niche Finder | ECP Positioning | Competitor Analysis | Signal-Based Outreach |
|----------|:------------:|:---------------:|:-------------------:|:---------------------:|
| **Archivo existe** | ✅ | ✅ | ✅ | ✅ |
| **flow_config.steps** | ✅ 4 pasos | ✅ 5 pasos | ✅ 4 pasos | ✅ 11 pasos (v2) |
| **Prompts completos** | ✅ | ✅ | ✅ | ✅ |
| **variable_definitions** | ✅ 7 vars | ✅ 5 vars | ✅ 5 vars | ✅ 15 vars |
| **required_documents** | ✅ | ✅ | ✅ | ✅ |
| **output_format por paso** | ✅ | ✅ | ✅ | ✅ |
| **description por paso** | ✅ | ✅ | ✅ | ✅ |
| **auto_receive_from** | ✅ | ✅ | ✅ | ✅ |
| **campaign_docs_guide** | ✅ | ✅ | ✅ | ✅ |

---

## Templates

### 1. ECP Positioning (`ecp`)

**Archivo**: `src/lib/templates/ecp-positioning-playbook.ts`

**Descripción**: Proceso de posicionamiento estratégico para ECPs (Exceptional Customer Pain) en 5 pasos.

**Variables Requeridas**:
- `{{ecp_name}}` - Nombre del ECP
- `{{problem_core}}` - Pain principal
- `{{country}}` - País objetivo
- `{{industry}}` - Industria

**Pasos**:
1. Deep Research - Investigación profunda del mercado
2. Find Market Place - Identificar criterios de valor
3. Select Assets - Mapear assets del producto
4. Proof Points - Definir pruebas de legitimidad
5. Final Output - Generar VP y USPs

**Documentos Sugeridos**:
- Product: Product specs, feature list, technical capabilities
- Competitor: Competitor analysis, market positioning
- Research: Market research, customer surveys, industry trends

---

### 2. Niche Finder (`niche_finder`)

**Archivo**: `src/lib/templates/niche-finder-playbook.ts`

**Descripción**: Buscador de Nichos 100x - Encuentra y analiza nichos desde foros y redes.

**Variables Requeridas**:
- `{{product}}` - Nombre del producto
- `{{target}}` - Audiencia objetivo
- `{{industry}}` - Industria
- `{{company_name}}` - Nombre de la empresa
- `{{country}}` - País objetivo

**Pasos**:
0. Búsqueda y Extracción (scraper) - Extrae nichos de foros
1. Limpiar y Filtrar Nichos - Consolida y valida nichos
2. Scoring (Deep Research) - Analiza Pain, Market Size, Reachability
3. Tabla Final Consolidada - Combina datos en tabla final

**Documentos Sugeridos**:
- Product: Product functionalities, strategic segments
- Research: Market data, industry reports

---

### 3. Competitor Analysis (`competitor_analysis`)

**Archivo**: `src/lib/templates/competitor-analysis-playbook.ts`

**Descripción**: Análisis profundo de competidores y posicionamiento.

**Variables Requeridas**:
- `{{company_name}}` - Nombre de la empresa
- `{{industry}}` - Industria
- `{{country}}` - País objetivo
- `{{competitors}}` - Lista de competidores principales

**Pasos**: (Por definir basado en campañas existentes)

---

### 4. Signal-Based Outreach (`signal_based_outreach`) - v2

**Archivo**: `src/lib/templates/signal-based-outreach-playbook.ts`

**Descripción**: LinkedIn outreach usando señales de intención. Flujo completo en 3 fases: (1) Discovery de creadores cuya audiencia coincide con ICP, (2) Discovery de posts con alta tracción, (3) Scraping de engagers + mensajes personalizados con lead magnet.

**Variables Requeridas** (6):
- `{{client_name}}` - Nombre del cliente/empresa
- `{{value_proposition}}` - Propuesta de valor: qué problema resuelve y para quién
- `{{icp_description}}` - Descripción del ICP (cargos, industria, características)
- `{{industry}}` - Industria objetivo
- `{{country}}` - País objetivo
- `{{problem_core}}` - Pain principal que resuelve el producto

**Variables Opcionales** (9):
- `{{known_creators}}` - URLs de creadores que ya conoces que atraen al ICP
- `{{adjacent_topics}}` - Temas tangencialmente relacionados con la propuesta de valor
- `{{current_creator_name}}` - Nombre del creador que se está procesando (para loops)
- `{{current_creator_url}}` - URL del creador que se está procesando (para loops)
- `{{lead_magnet_name}}` - Nombre del lead magnet (si existe)
- `{{lead_magnet_format}}` - Formato: Notion, PDF, etc.
- `{{target_leads_count}}` - Número objetivo de leads (default: 500)
- `{{scraping_tool}}` - Herramienta: Apify, Phantombuster
- `{{outreach_tool}}` - Herramienta: Manual, Expandi, etc.

**11 Pasos en 3 Fases**:

**FASE 1: Discovery de Creadores**
1. **Mapear Propuesta → Temas** - Traducir propuesta de valor a temas de contenido (principal, adyacentes, tangenciales)
2. **Buscar Creadores** - Estrategia de búsqueda (LinkedIn, Perplexity, scrapers)
3. **Evaluar Creadores** - Scoring por actividad, viralidad, alineamiento temático
4. **Seleccionar Creadores** - Lista final priorizada para scrapear

**FASE 2: Discovery de Posts** (loop por creador)
5. **Scrapear Posts del Creador** - Obtener últimos posts con métricas
6. **Evaluar Posts** - Scoring por tracción, tema, calidad de comentaristas
7. **Seleccionar Posts** - Consolidar posts para scrapear engagers

**FASE 3: Leads + Outreach**
8. **Scrapear Engagers** - Extraer personas que interactuaron con los posts
9. **Filtrar por ICP** - Clasificar leads por cargo, industria, geografía
10. **Lead Magnet + Mensajes** - Diseño del lead magnet y templates personalizados
11. **Export y Lanzamiento** - CSV final, validaciones y plan de lanzamiento

**Documentos Sugeridos**:
- Product: Descripción producto, propuesta de valor, case studies
- Research: Descripción ICP, creadores conocidos, lead magnets existentes

**Instructivo**: Ver `docs/signal-based-outreach.md` para guía operativa detallada.

---

## Archivos del Sistema de Templates

| Archivo | Propósito |
|---------|-----------|
| `src/lib/templates/types.ts` | Interfaces y tipos |
| `src/lib/templates/index.ts` | Export centralizado y `getPlaybookTemplate()` |
| `src/lib/templates/ecp-positioning-playbook.ts` | Template ECP |
| `src/lib/templates/niche-finder-playbook.ts` | Template Niche Finder |
| `src/lib/templates/competitor-analysis-playbook.ts` | Template Competitor Analysis |
| `src/lib/templates/signal-based-outreach-playbook.ts` | Template Signal-Based Outreach |

---

## Integración con createProject()

Al crear un proyecto, el sistema debe:

1. Obtener el template según `playbook_type`
2. Aplicar `flow_config.steps` a `legacy_flow_config`
3. Aplicar `variable_definitions` al proyecto
4. Mostrar `campaign_docs_guide` en la UI

```typescript
// En useProjects.ts createProject()
const template = getPlaybookTemplate(data.playbook_type)
if (template) {
  await supabase
    .from('projects')
    .update({
      legacy_flow_config: { steps: template.flow_config.steps },
      variable_definitions: template.variable_definitions,
    })
    .eq('id', newProject.id)
}
```

---

## Cómo Agregar un Nuevo Playbook

### Resumen de Archivos a Modificar

| Archivo | Qué agregar |
|---------|-------------|
| `src/lib/templates/[nombre]-playbook.ts` | Template con prompts y flow_config |
| `src/lib/templates/index.ts` | Import y registro en getPlaybookTemplate() |
| `src/components/playbook/configs/[nombre].config.ts` | **Config visual** (fases, pasos, tipos) |
| `src/components/playbook/configs/index.ts` | Registro de la config visual |
| `src/types/database.types.ts` | Tipo en PlaybookType |
| `src/lib/playbook-metadata.ts` | Metadata para UI (icon, description, steps) |
| `supabase/migrations/` | 2 migraciones: enum + insert |
| `docs/playbook-templates.md` | Documentación del template |

---

### Paso 1: Crear el Template TypeScript

1. Crear archivo en `src/lib/templates/[nombre]-playbook.ts`
2. Implementar la interface `PlaybookTemplate`
3. Exportar una función `get[Nombre]Template(): PlaybookTemplate`

**Estructura mínima del template:**

```typescript
import type { PlaybookTemplate } from './types'

export function getNuevoPlaybookTemplate(): PlaybookTemplate {
  return {
    template_id: 'nuevo_playbook_v1',
    name: 'Nombre del Playbook',
    description: 'Descripción breve',
    playbook_type: 'nuevo_playbook',

    flow_config: {
      version: '1.0',
      description: 'Descripción del flujo',
      steps: [
        {
          id: 'step-uuid-1',
          name: 'Paso 1',
          order: 0,
          type: 'llm',
          model: 'openai/gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 4000,
          output_format: 'markdown',
          description: 'Descripción del paso',
          prompt: `Tu prompt aquí con {{variables}}`,
          auto_receive_from: [], // IDs de pasos anteriores
          base_doc_ids: ['product', 'research'], // Categorías de docs
        },
        // ... más pasos
      ],
    },

    variable_definitions: [
      {
        name: 'variable_name',
        default_value: '',
        required: true,
        description: 'Descripción para el usuario',
      },
    ],

    required_documents: {
      product: ['Descripción del producto'],
      competitor: [],
      research: ['Datos de mercado'],
    },

    campaign_docs_guide: `
## Documentos Recomendados

### Producto
- Descripción del producto

### Research
- Datos de mercado
`,
  }
}
```

---

### Paso 2: Crear Configuración Visual (PlaybookConfig)

Crear archivo en `src/components/playbook/configs/[nombre].config.ts`:

```typescript
import { PlaybookConfig } from '../types'

export const nuevoPlaybookConfig: PlaybookConfig = {
  id: 'nuevo_playbook',
  type: 'nuevo_playbook',
  name: 'Nombre del Playbook',
  description: 'Descripción breve',
  icon: '🚀',

  phases: [
    {
      id: 'configuracion',
      name: 'Configuración',
      description: 'Define los parámetros iniciales',
      steps: [
        {
          id: 'definir_contexto',
          name: 'Definir Contexto',
          description: 'El sistema genera sugerencias, el usuario selecciona',
          type: 'suggestion',  // suggestion | auto | decision | input | display | action
          executor: 'llm',     // llm | job | api | none
          promptKey: 'suggest_context', // Clave del prompt en flow_config
          suggestionConfig: {
            generateFrom: 'project',
            allowAdd: true,
            allowEdit: true,
            minSelections: 1,
          },
        },
        {
          id: 'revisar_config',
          name: 'Revisar Configuración',
          type: 'auto_with_preview',
          executor: 'llm',
          promptKey: 'generate_config',
          dependsOn: ['definir_contexto'],
        },
      ],
    },
    {
      id: 'ejecucion',
      name: 'Ejecución',
      description: 'Procesa los datos',
      steps: [
        {
          id: 'procesar_datos',
          name: 'Procesar Datos',
          type: 'auto',
          executor: 'job',  // job = proceso largo con indicador de progreso
          jobType: 'proceso_largo',
          dependsOn: ['revisar_config'],
        },
        {
          id: 'analizar_resultados',
          name: 'Analizar Resultados',
          type: 'auto',
          executor: 'llm',
          promptKey: 'analyze_results',
          dependsOn: ['procesar_datos'],
        },
      ],
    },
    {
      id: 'resultados',
      name: 'Resultados',
      description: 'Revisa y exporta',
      steps: [
        {
          id: 'seleccionar',
          name: 'Seleccionar Resultados',
          type: 'decision',
          executor: 'none',
          dependsOn: ['analizar_resultados'],
          decisionConfig: {
            question: '¿Qué resultados quieres usar?',
            optionsFrom: 'previous_step',
            multiSelect: true,
            minSelections: 1,
          },
        },
        {
          id: 'exportar',
          name: 'Exportar',
          type: 'action',
          executor: 'none',
          dependsOn: ['seleccionar'],
          actionConfig: {
            label: 'Exportar Resultados',
            actionType: 'export',
          },
        },
      ],
    },
  ],

  // Variables que se piden en el wizard de nueva campaña
  variables: [
    {
      key: 'client_name',
      label: 'Nombre del Cliente',
      type: 'text',
      required: true,
    },
    {
      key: 'context_type',
      label: 'Tipo de Contexto',
      type: 'select',
      required: true,
      defaultValue: 'both',
      options: [
        { value: 'personal', label: 'B2C (Personal)' },
        { value: 'business', label: 'B2B (Empresas)' },
        { value: 'both', label: 'Ambos' },
      ],
    },
  ],
}

export default nuevoPlaybookConfig
```

**Registrar en** `src/components/playbook/configs/index.ts`:

```typescript
import nuevoPlaybookConfig from './nuevo.config'

export const playbookConfigs: Record<string, PlaybookConfig> = {
  niche_finder: nicheFinderConfig,
  nuevo_playbook: nuevoPlaybookConfig, // ← Agregar
}
```

---

### Paso 3: Registrar en templates/index.ts

En `src/lib/templates/index.ts`:

```typescript
// 1. Agregar import
import { getNuevoPlaybookTemplate } from './nuevo-playbook'

// 2. Agregar al switch de getPlaybookTemplate()
case 'nuevo_playbook':
  return getNuevoPlaybookTemplate()

// 3. Agregar a getAllPlaybookTemplates()
export function getAllPlaybookTemplates(): PlaybookTemplate[] {
  return [
    getECPPositioningTemplate(),
    getNicheFinderPlaybookTemplate(),
    getCompetitorAnalysisTemplate(),
    getSignalBasedOutreachTemplate(),
    getNuevoPlaybookTemplate(), // ← Agregar aquí
  ]
}

// 4. Agregar al array de hasPlaybookTemplate()
export function hasPlaybookTemplate(type: string): boolean {
  return ['ecp', 'niche_finder', 'competitor_analysis', 'signal_based_outreach', 'nuevo_playbook'].includes(type)
}
```

---

### Paso 4: Actualizar Tipos

En `src/types/database.types.ts`:
```typescript
export type PlaybookType = 'ecp' | 'niche_finder' | 'competitor_analysis' | 'signal_based_outreach' | 'nuevo_playbook' | 'custom'
```

---

### Paso 5: Agregar Metadata para UI

En `src/lib/playbook-metadata.ts`, agregar al objeto `playbookMetadata`:

```typescript
export const playbookMetadata: Record<string, PlaybookMeta> = {
  // ... otros playbooks ...

  nuevo_playbook: {
    // Información básica (requerida)
    purpose: 'Qué hace este playbook',
    whenToUse: [
      'Situación 1 donde usarlo',
      'Situación 2 donde usarlo',
    ],
    outcome: 'Qué resultado produce',
    relatedPlaybooks: ['ecp', 'niche_finder'],
    targetAudience: 'Para quién es',
    steps: {
      paso_1: 'Descripción breve del paso 1',
      paso_2: 'Descripción breve del paso 2',
    },

    // Información extendida (opcional pero recomendada)
    icon: '🚀', // Emoji para el playbook
    description: 'Descripción larga del playbook...',
    objectives: [
      'Objetivo 1',
      'Objetivo 2',
    ],
    requirements: [
      'Requisito 1',
      'Requisito 2',
    ],
    duration: '15-30 minutos',
    detailedSteps: {
      paso_1: {
        brief: 'Descripción corta',
        detailed: 'Descripción larga del paso',
        tips: ['Tip 1', 'Tip 2'],
      },
    },
    examples: [
      {
        title: 'Caso de uso',
        description: 'Descripción del ejemplo',
      },
    ],
    faqs: [
      {
        question: 'Pregunta frecuente?',
        answer: 'Respuesta',
      },
    ],
  },
}

// También actualizar getPlaybookName()
export const getPlaybookName = (type: string): string => {
  const names: Record<string, string> = {
    niche_finder: 'Niche Finder',
    ecp: 'ECP Positioning',
    competitor_analysis: 'Competitor Analysis',
    signal_based_outreach: 'Signal-Based Outreach',
    nuevo_playbook: 'Nuevo Playbook', // ← Agregar
  }
  return names[type] || type
}
```

---

### Paso 6: Migraciones de Base de Datos (IMPORTANTE)

Para que el playbook aparezca en la UI, se necesitan **DOS migraciones separadas**:

**Migración 1: Agregar al enum + actualizar constraint**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_nuevo_playbook_type.sql

-- Agregar al enum (no se puede usar en la misma transacción)
ALTER TYPE playbook_type ADD VALUE IF NOT EXISTS 'nuevo_playbook';

-- Actualizar el check constraint para incluir el nuevo tipo
ALTER TABLE playbooks DROP CONSTRAINT IF EXISTS playbooks_playbook_type_check;
ALTER TABLE playbooks ADD CONSTRAINT playbooks_playbook_type_check
  CHECK (playbook_type IN ('ecp', 'niche_finder', 'competitor_analysis', 'signal_based_outreach', 'nuevo_playbook', 'video_viral_ia', 'custom'));
```

**Migración 2: Insertar el playbook** (en archivo separado o con timestamp posterior)
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_insert_nuevo_playbook.sql

DO $$
DECLARE
  sys_agency_id UUID;
BEGIN
  SELECT id INTO sys_agency_id FROM agencies WHERE id = '00000000-0000-0000-0000-000000000001';
  IF sys_agency_id IS NULL THEN
    SELECT id INTO sys_agency_id FROM agencies LIMIT 1;
  END IF;

  DELETE FROM playbooks WHERE slug = 'nuevo-playbook';

  INSERT INTO playbooks (agency_id, name, slug, description, playbook_type, type, is_public, version, config)
  VALUES (
    sys_agency_id,
    'Nuevo Playbook',
    'nuevo-playbook',
    'Descripcion del nuevo playbook.',
    'nuevo_playbook',
    'nuevo_playbook',
    true,
    '1.0.0',
    '{"steps": ["paso1", "paso2", "paso3"]}'::jsonb
  );
END $$;
```

**⚠️ NOTA IMPORTANTE**: Si las dos operaciones están en el mismo archivo, Postgres dará error `unsafe use of new value`. El enum value necesita ser commiteado antes de usarse en un INSERT.

---

### Paso 7: Aplicar Migraciones

```bash
npx supabase db push
```

Si hay conflictos:
```bash
npx supabase migration repair --status reverted YYYYMMDDHHMMSS
npx supabase db push
```

---

### Paso 8: Documentar el Playbook

1. Actualizar la tabla de verificación en este documento
2. Agregar una sección con detalles del template
3. Si es complejo, crear un instructivo separado en `docs/[nombre]-playbook.md`

---

### Paso 9 (Opcional): Agregar a PlaybooksDashboard

Si quieres que aparezca también en la vista estática `PlaybooksDashboard.tsx`:

```typescript
// En src/components/playbooks/PlaybooksDashboard.tsx
// Agregar al array PLAYBOOK_TEMPLATES

{
  id: 'nuevo_playbook',
  name: 'Nuevo Playbook',
  description: 'Descripcion corta',
  icon: IconComponent, // Importar de lucide-react
  color: 'blue', // blue, purple, green, orange
  status: 'available',
  badge: 'Beta', // opcional
},
```

---

### Checklist Final

- [ ] Template creado en `src/lib/templates/`
- [ ] Registrado en `templates/index.ts` (import, switch, array)
- [ ] **Config visual** creada en `src/components/playbook/configs/`
- [ ] **Config visual** registrada en `configs/index.ts`
- [ ] Tipo agregado a `database.types.ts`
- [ ] Metadata en `playbook-metadata.ts`
- [ ] Migración 1: ALTER TYPE + constraint
- [ ] Migración 2: INSERT playbook
- [ ] Migraciones aplicadas con `npx supabase db push`
- [ ] Documentación actualizada
- [ ] (Opcional) Agregado a PlaybooksDashboard

---

## Actualización de este Documento

Al completar cada template, actualizar la tabla de verificación:
1. Cambiar ❌ por ✅ para elementos completados
2. Actualizar la sección del template con detalles finales
3. Agregar fecha de última actualización

**Última actualización**: 2026-01-18
