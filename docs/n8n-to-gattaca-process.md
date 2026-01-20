# Proceso de Conversión n8n → Gattaca Playbooks

Este documento define el proceso recurrente para convertir workflows de n8n en playbooks funcionales de Gattaca.

**Última actualización**: 2026-01-20

---

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

**Estos 3 archivos son los más olvidados y causan que el playbook no aparezca en la UI:**

1. **`src/components/playbook/index.ts`** - Debe exportar el nuevo config:
   ```typescript
   export { playbookConfigs, getPlaybookConfig, nicheFinderConfig, [nuevoConfig] } from './configs'
   ```

2. **`src/components/[nombre]/[Nombre]Playbook.tsx`** - Componente wrapper:
   ```typescript
   import { PlaybookShell, [nuevoConfig] } from '../playbook'

   export default function [Nombre]Playbook({ projectId }) {
     return <PlaybookShell projectId={projectId} playbookConfig={[nuevoConfig]} />
   }
   ```

3. **`src/app/projects/[projectId]/page.tsx`** - Integración en la página:
   - Agregar import del componente wrapper
   - Agregar nuevo tipo a `TabType`
   - Agregar condición en `useEffect` para tab inicial
   - Agregar array de tabs específicos para el nuevo tipo
   - Agregar renderizado en el switch de contenido de tabs

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
- [ ] Config registrada en `src/components/playbook/configs/index.ts`
- [ ] **Config exportada desde `src/components/playbook/index.ts`** ⚠️
- [ ] **Componente wrapper creado** (`src/components/[nombre]/[Nombre]Playbook.tsx`) ⚠️
- [ ] **Componente integrado en página del proyecto** (`src/app/projects/[projectId]/page.tsx`) ⚠️
  - [ ] Import del componente
  - [ ] Nuevo tipo en `TabType`
  - [ ] Condición en `useEffect` para tab inicial
  - [ ] Array de tabs específicos
  - [ ] Renderizado en switch de contenido
- [ ] PlaybookType agregado a `src/types/database.types.ts`
- [ ] Metadata agregada a `src/lib/playbook-metadata.ts`
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
