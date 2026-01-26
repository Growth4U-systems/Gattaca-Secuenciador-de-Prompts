# Proceso de Conversión n8n → Gattaca Playbooks

Este documento define el proceso recurrente para convertir workflows de n8n en playbooks funcionales de Gattaca.

**Última actualización**: 2026-01-25

---

## Conversor Automatizado

Para conversiones rápidas, usa el **n8n Converter** automatizado:

```typescript
import { convertN8nWorkflow } from '@/lib/n8n-converter'

const result = await convertN8nWorkflow(jsonString, {
  playbookId: 'my-playbook',
  outputDir: 'src/app/api/playbook/my-playbook',
})
```

O la interfaz web en `/api/n8n-converter/convert`.

**Documentación técnica completa**: [docs/n8n-converter/README.md](./n8n-converter/README.md)

---

## Proceso Manual (para casos complejos)

El proceso manual sigue siendo útil para:
- Workflows con lógica de negocio compleja
- Nodos no soportados por el conversor
- Personalización avanzada de playbooks

## Resumen del Proceso

```
Workflow n8n → Análisis → PRD Intermedio → Gap Analysis → Implementación → Testing
```

**Ejecutor**: Claude (con supervisión del usuario)

---

## Fase 1: Análisis del Workflow n8n

### Qué hacer
1. Obtener JSON del workflow (archivo o MCP tools de n8n)
2. Identificar nodos por categoría:
   - **Triggers**: webhook, schedule, form
   - **LLM/AI**: lmChatOpenAi, lmChatAnthropic, agent
   - **Logic**: if, switch, filter
   - **Transform**: code, set, function
   - **Data**: httpRequest, googleSheets, supabase
   - **Output**: slack, email, respondToWebhook
3. Mapear conexiones y flujo de datos
4. Extraer variables del workflow

### Checklist de análisis

```markdown
## Checklist de Análisis - Workflow: [NOMBRE]

### Información Básica
- [ ] Nombre y propósito del workflow
- [ ] Tipo de trigger (webhook, schedule, manual)
- [ ] Número total de nodos
- [ ] Número de conexiones

### Nodos por Tipo
- [ ] Triggers: [lista]
- [ ] LLM/AI nodes: [lista]
- [ ] HTTP requests: [lista]
- [ ] Logic nodes (if/switch): [lista]
- [ ] Transform nodes (code/set): [lista]
- [ ] Data nodes (sheets/db): [lista]
- [ ] Output nodes: [lista]

### Flujo de Datos
- [ ] Entrada principal: [descripción]
- [ ] Transformaciones intermedias: [lista]
- [ ] Salidas esperadas: [descripción]

### Variables Identificadas
- [ ] Variables de entrada (del trigger)
- [ ] Variables de configuración
- [ ] Variables dinámicas (de pasos anteriores)

### Credenciales Requeridas
- [ ] [servicio]: [tipo de credencial]
```

---

## Fase 2: PRD Intermedio

Crear documento en `docs/prd/[nombre]-prd.md`

### Template del PRD

```markdown
# PRD: [Nombre del Workflow] → Playbook Gattaca

## 1. Información General
| Campo | Valor |
|-------|-------|
| Workflow n8n origen | [nombre] |
| Playbook destino | [nombre_propuesto] |
| Fecha de análisis | [fecha] |

## 2. Objetivo
- **Qué hace**: [descripción en 2-3 oraciones]
- **Para quién**: [persona/rol que usará el playbook]
- **Resultado**: [output concreto que produce]

## 3. Variables

### Requeridas
| Variable | Tipo | Descripción | Origen n8n |
|----------|------|-------------|------------|
| `{{variable_name}}` | text/select/number | [descripción] | [nodo origen] |

### Opcionales
| Variable | Tipo | Default | Descripción |
|----------|------|---------|-------------|
| `{{variable_name}}` | text | "" | [descripción] |

## 4. Fases y Pasos

### FASE 1: [Nombre]
**Objetivo de fase:** [descripción]

#### Paso 1.1: [Nombre]
- **Tipo**: input | suggestion | auto | auto_with_review | decision | action
- **Ejecutor**: llm | job | api | none
- **Dependencias**: [pasos anteriores]
- **Nodos n8n mapeados**: [lista de nodos]
- **Input**: [qué recibe]
- **Output**: [qué produce]
- **Prompt (si aplica)**:
```
[prompt completo con {{variables}}]
```

[Repetir para cada paso...]

## 5. Conexiones y Dependencias
```
Paso 1 ──→ Paso 2 ──→ Paso 3
              │
              └──→ Paso 4 ──→ Paso 5
```

## 6. Documentos Requeridos
- **Product**: [lista]
- **Research**: [lista]

## 7. Integraciones Externas
| Servicio | Uso | API Key Requerida |
|----------|-----|-------------------|
| [servicio] | [descripción] | Sí/No |

## 8. Notas de Implementación
- [consideraciones especiales]
- [limitaciones conocidas]
```

---

## Fase 3: Gap Analysis

### Tabla de Mapeo de Capacidades

| Capacidad n8n | Equivalente Gattaca | Estado |
|---------------|---------------------|--------|
| **TRIGGERS** |||
| webhook | Inicio de campaña (input) | DIRECTO |
| formTrigger | Wizard de campaña | DIRECTO |
| schedule | N/A | GAP |
| **LLM/AI** |||
| lmChatOpenAi | FlowStep type='llm' | DIRECTO |
| lmChatAnthropic | FlowStep type='llm' | DIRECTO |
| agent (AI Agent) | Múltiples steps LLM | ADAPTACIÓN |
| chain | Secuencia de steps | DIRECTO |
| **HTTP/API** |||
| httpRequest | executor='api' o 'job' | DIRECTO |
| respondToWebhook | action type='export' | ADAPTACIÓN |
| **LOGIC** |||
| if | decision step | ADAPTACIÓN |
| switch | decision multiSelect | ADAPTACIÓN |
| filter | Lógica en prompt LLM | ADAPTACIÓN |
| **TRANSFORM** |||
| set | Variables en prompt | DIRECTO |
| code (JS/Python) | LLM prompt | ADAPTACIÓN |
| **DATA** |||
| googleSheets | executor='job' | DIRECTO |
| supabase | Nativo (interno) | DIRECTO |
| **SCRAPING** |||
| httpRequest (scrape) | executor='job' + Apify | DIRECTO |
| **OUTPUT** |||
| slack | N/A | GAP |
| email | N/A | GAP |

### Checklist de Gap Analysis

```markdown
## Gap Analysis - Workflow: [NOMBRE]

### A. Mapeo Directo ✓
- [ ] [capacidad]: [nodo n8n] → [componente Gattaca]

### B. Requiere Adaptación ⚠️
- [ ] [capacidad]: [nodo n8n]
  - **Cambio**: [descripción del cambio de paradigma]
  - **Impacto**: Bajo/Medio/Alto
  - **Solución**: [cómo adaptarlo]

### C. Requiere Desarrollo ❌
- [ ] [capacidad]: [nodo n8n]
  - **Razón**: [por qué no existe]
  - **Esfuerzo**: [estimación horas/días]
  - **Workaround temporal**: [alternativa]
  - **Archivos a crear/modificar**: [lista]

### D. No Aplica / Ignorar
- [ ] [capacidad]: [razón por la que no aplica]

### Resumen
| Categoría | Cantidad | % del Total |
|-----------|----------|-------------|
| Mapeo directo | X | X% |
| Adaptación | X | X% |
| Desarrollo nuevo | X | X% |
| No aplica | X | X% |

### Decisión: Proceder / Pausar / Rechazar
**Recomendación**: [decisión]
**Justificación**: [razón]
```

### Árbol de Decisión para Gaps

```
Gap detectado
    │
    ▼
¿Es crítico para el funcionamiento?
    │
  No └──→ Workaround temporal + Issue para futuro
    │
  Sí ▼
¿Esfuerzo < 4 horas?
    │
  No └──→ Crear issue detallado + Pausar conversión
    │
  Sí ▼
Desarrollar inline (Claude implementa)
```

---

## Fase 4: Implementación

### Archivos a crear/modificar

| Archivo | Propósito |
|---------|-----------|
| `src/lib/templates/[nombre]-playbook.ts` | Template con prompts y flow_config |
| `src/lib/templates/index.ts` | Registrar template |
| `src/components/playbook/configs/[nombre].config.ts` | Config visual (fases, steps) |
| `src/components/playbook/configs/index.ts` | Registrar config visual + exportar config |
| `src/components/playbook/index.ts` | **CRÍTICO**: Exportar el config para uso externo |
| `src/components/[nombre]/[Nombre]Playbook.tsx` | **CRÍTICO**: Componente wrapper que usa PlaybookShell |
| `src/components/[nombre]/index.ts` | Export del componente wrapper |
| `src/app/projects/[projectId]/page.tsx` | **CRÍTICO**: Agregar tabs y renderizado para el nuevo tipo |
| `src/types/database.types.ts` | Agregar PlaybookType |
| `src/lib/playbook-metadata.ts` | Metadata para UI |
| `supabase/migrations/[ts]_add_[nombre].sql` | Enum + constraint |
| `supabase/migrations/[ts]_insert_[nombre].sql` | Insert playbook |

### ⚠️ CRÍTICO: Pasos frecuentemente olvidados

**Estos 3 archivos son los más olvidados y causan que el playbook no aparezca en la UI. SIN ESTOS PASOS, EL PLAYBOOK NO FUNCIONA:**

#### 1. Registrar config en `src/components/playbook/configs/index.ts`

**Este es el paso que hace que el playbook aparezca en la sección de playbooks:**

```typescript
// Agregar import del nuevo config
import [nombre]Config from './[nombre].config'

// Agregar al objeto playbookConfigs
export const playbookConfigs: Record<string, PlaybookConfig> = {
  niche_finder: nicheFinderConfig,
  video_viral_ia: videoViralIAConfig,
  '[nombre-con-guiones]': [nombre]Config,  // ← AGREGAR AQUÍ
}

// Exportar el config individual
export { [nombre]Config }
```

#### 2. Exportar config desde `src/components/playbook/index.ts`

```typescript
// Agregar el nuevo config al export existente
export { playbookConfigs, getPlaybookConfig, nicheFinderConfig, videoViralIAConfig, [nombre]Config } from './configs'
```

#### 3. Crear componente wrapper en `src/components/[nombre]/`

**Archivo: `src/components/[nombre]/[Nombre]Playbook.tsx`**
```typescript
'use client'

import { useState, useEffect } from 'react'
import { PlaybookShell, [nombre]Config } from '../playbook'
import { PlaybookState } from '../playbook/types'

interface [Nombre]PlaybookProps {
  projectId: string
}

export default function [Nombre]Playbook({ projectId }: [Nombre]PlaybookProps) {
  const [initialState, setInitialState] = useState<Partial<PlaybookState> | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadState() {
      try {
        const response = await fetch(`/api/projects/${projectId}/playbook-state`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.state) {
            setInitialState(data.state)
          }
        }
      } catch (error) {
        console.error('Error loading playbook state:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadState()
  }, [projectId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <PlaybookShell
      projectId={projectId}
      playbookConfig={[nombre]Config}
      initialState={initialState}
    />
  )
}
```

**Archivo: `src/components/[nombre]/index.ts`**
```typescript
export { default as [Nombre]Playbook } from './[Nombre]Playbook'
```

#### 4. Agregar metadata en `src/lib/playbook-metadata.ts`

**Este paso es CRÍTICO para que el playbook aparezca en el catálogo (`/playbooks`):**

```typescript
// Agregar al objeto playbookMetadata
export const playbookMetadata: Record<string, PlaybookMeta> = {
  // ... playbooks existentes
  '[nombre-con-guiones]': {
    // Información básica (requerida)
    purpose: 'Descripción breve del propósito',
    whenToUse: [
      'Caso de uso 1',
      'Caso de uso 2',
    ],
    outcome: 'Qué output concreto produce',
    relatedPlaybooks: ['niche_finder', 'ecp'],
    targetAudience: 'Para quién es',
    steps: {
      step_1: 'Descripción del paso 1',
      step_2: 'Descripción del paso 2',
    },
    // Información extendida (para página de librería)
    icon: '🔍',  // Emoji representativo
    description: `Descripción larga del playbook...`,
    objectives: ['Objetivo 1', 'Objetivo 2'],
    requirements: ['Requisito 1', 'Requisito 2'],
    duration: '15-30 minutos',
  },
}

// Agregar al objeto names en getPlaybookName
export const getPlaybookName = (type: string): string => {
  const names: Record<string, string> = {
    // ... nombres existentes
    '[nombre-con-guiones]': '[Nombre Display]',
  }
  return names[type] || type
}
```

#### 5. Integrar en `src/app/projects/[projectId]/page.tsx`

**5a. Agregar imports (cerca del inicio del archivo):**
```typescript
import { [Nombre]Playbook } from '@/components/[nombre]'
import { [IconName] } from 'lucide-react'  // Ej: Video, Search, Users
```

**5b. Agregar al tipo TabType:**
```typescript
type TabType = 'documents' | 'setup' | 'campaigns' | 'export' | 'niche-finder' | 'signal-outreach' | '[nombre-con-guiones]'
```

**5c. Agregar condición para tab inicial (en useEffect):**
```typescript
useEffect(() => {
  if (project && activeTab === null) {
    setActiveTab(
      project.playbook_type === 'niche_finder' ? 'niche-finder' :
      project.playbook_type === 'signal_based_outreach' ? 'signal-outreach' :
      project.playbook_type === '[nombre_con_guion_bajo]' ? '[nombre-con-guiones]' :  // AGREGAR ESTA LÍNEA
      'documents'
    )
  }
}, [project, activeTab])
```

**5d. Agregar array de tabs específicos:**
```typescript
// [Nombre] playbook: Uses unified view with config and campaigns integrated
const [nombre]Tabs = [
  { id: '[nombre-con-guiones]' as TabType, label: '[Nombre Display]', icon: [IconName], description: '[Descripción corta]' },
  { id: 'documents' as TabType, label: 'Documentos', icon: FileText, description: 'Base de conocimiento' },
]
```

**5e. Agregar condición en selección de tabs:**
```typescript
const tabs = project?.playbook_type === 'niche_finder'
  ? nicheFinderTabs
  : project?.playbook_type === 'signal_based_outreach'
    ? signalOutreachTabs
    : project?.playbook_type === '[nombre_con_guion_bajo]'  // AGREGAR ESTA CONDICIÓN
      ? [nombre]Tabs
      : project?.playbook_type === 'ecp'
        ? [...baseTabs, { id: 'export' as TabType, label: 'Export', icon: Table2, description: 'Datos consolidados' }]
        : baseTabs
```

**5f. Agregar renderizado del componente:**
```typescript
{activeTab === '[nombre-con-guiones]' && (
  <[Nombre]Playbook projectId={params.projectId} />
)}
```

### Ejemplo completo: Video Viral IA

Para el playbook `video_viral_ia`, los cambios fueron:

1. **Config export**: `videoViralIAConfig` en `playbook/index.ts`
2. **Componente**: `VideoViralIAPlaybook` en `components/video-viral-ia/`
3. **Page.tsx**:
   - TabType: `'video-viral-ia'`
   - useEffect: `project.playbook_type === 'video_viral_ia' ? 'video-viral-ia'`
   - Tabs: `videoViralIATabs` con icon `Video`
   - Render: `<VideoViralIAPlaybook projectId={params.projectId} />`

### Referencia completa
Ver [playbook-templates.md](playbook-templates.md) para instrucciones detalladas de cada archivo.

---

## Fase 5: Sistema de Verificación

### Tests Unitarios (Prompts)

```typescript
// __tests__/templates/[nombre]-playbook.test.ts

describe('[Nombre] Playbook Template', () => {
  it('todas las variables requeridas están definidas', () => {
    // Verificar VARIABLE_DEFINITIONS
  })

  it('prompts contienen todas las variables', () => {
    // Verificar {{variables}} en prompts
  })

  it('steps están ordenados correctamente', () => {
    // Verificar order en FLOW_STEPS
  })

  it('auto_receive_from referencia steps válidos', () => {
    // Verificar dependencias
  })
})
```

### Tests de Integración

```typescript
// __tests__/integration/[nombre]-playbook.test.ts

describe('[Nombre] Playbook Integration', () => {
  it('Step ejecuta y genera output válido', async () => {
    // POST /api/playbook/execute-step
  })

  it('Output se guarda en playbook_step_outputs', async () => {
    // Verificar DB
  })
})
```

### Checklist Manual de Verificación

```markdown
## Checklist de Verificación - Playbook: [NOMBRE]

### Pre-Deploy (Archivos)
- [ ] Template TypeScript compila sin errores (`src/lib/templates/[nombre]-playbook.ts`)
- [ ] Template registrado en `src/lib/templates/index.ts`
- [ ] Config visual creada (`src/components/playbook/configs/[nombre].config.ts`)
- [ ] **Config registrada en `src/components/playbook/configs/index.ts`** ⚠️ (import + playbookConfigs + export)
- [ ] **Config exportada desde `src/components/playbook/index.ts`** ⚠️
- [ ] **Componente wrapper creado** (`src/components/[nombre]/[Nombre]Playbook.tsx`) ⚠️
- [ ] **Componente integrado en página del proyecto** (`src/app/projects/[projectId]/page.tsx`) ⚠️
  - [ ] Import del componente
  - [ ] Nuevo tipo en `TabType`
  - [ ] Condición en `useEffect` para tab inicial
  - [ ] Array de tabs específicos
  - [ ] Renderizado en switch de contenido
- [ ] PlaybookType agregado a `src/types/database.types.ts`
- [ ] **Metadata agregada a `src/lib/playbook-metadata.ts`** ⚠️ (playbookMetadata + getPlaybookName)
- [ ] Migraciones creadas (enum + insert)
- [ ] `npx tsc --noEmit` pasa sin errores

### Post-Deploy (UI)
- [ ] Playbook aparece en dropdown de nuevo proyecto
- [ ] Al crear proyecto, se redirige al tab correcto
- [ ] El PlaybookShell se renderiza (panel navegación + work area)
- [ ] Se puede crear nueva campaña
- [ ] Wizard de variables funciona
- [ ] Navegación entre fases funciona

### Ejecución de Steps
| Step | Ejecuta | Output Correcto | Guarda en DB | Notas |
|------|---------|-----------------|--------------|-------|
| 1. [nombre] | [ ] | [ ] | [ ] | |
| 2. [nombre] | [ ] | [ ] | [ ] | |

### Flujo Completo
- [ ] Paso 1 → Paso 2 transfiere output correctamente
- [ ] Variables se sustituyen en todos los prompts
- [ ] Export/action final funciona
```

---

## Proceso Recurrente

### Flujo Usuario-Claude

```
USUARIO                         CLAUDE
───────                         ──────
1. Comparte JSON workflow  →    2. Análisis + checklist
3. Revisa y confirma       ←    4. Presenta análisis
5. Aprueba PRD            →    6. Genera PRD
7. Revisa gaps            ←    8. Gap Analysis
9. Decide: Proceder/Pausar →   10. Implementa o propone dev
11. Prueba en UI          ←    12. Checklist verificación
13. Confirma OK           →    14. Documenta y cierra
```

---

## Archivos Críticos de Referencia

| Archivo | Propósito |
|---------|-----------|
| [playbook-templates.md](playbook-templates.md) | Guía maestra para crear playbooks |
| [signal-based-outreach-playbook.ts](../src/lib/templates/signal-based-outreach-playbook.ts) | Ejemplo completo (11 pasos) |
| [types.ts](../src/components/playbook/types.ts) | Define StepType, ExecutorType |
| [niche-finder.config.ts](../src/components/playbook/configs/niche-finder.config.ts) | Ejemplo de config visual |

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Workflow usa nodo sin equivalente | Gap analysis temprano + workaround |
| Prompts de n8n muy simples | Enriquecer con contexto de Gattaca |
| Lógica condicional compleja | Convertir IF automático → decisión usuario (HITL) |
| Credenciales externas | Usar tabla `user_api_keys` existente |
| Loops/iteraciones | Procesar batch con LLM o job |
