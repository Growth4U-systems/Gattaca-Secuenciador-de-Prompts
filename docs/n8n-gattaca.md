# Guía Completa: Migración de n8n a Gattaca Playbooks

## Introducción

Esta guía te permite transformar cualquier workflow de n8n en un Playbook de Gattaca, aprovechando las ventajas únicas del sistema: contexto de marca, human-in-the-loop, y ejecución estructurada.

---

## Parte 1: Entendiendo las Diferencias

### Modelo Mental

| Concepto | n8n | Gattaca |
|----------|-----|---------|
| Unidad de trabajo | Workflow | Playbook |
| Pasos | Nodes | Blocks |
| Datos entre pasos | Expresiones $json | `{{step:NombreBloque}}` |
| Contexto externo | Nodos HTTP/DB | Context Lake (Tiers 1-3) |
| Aprobación humana | Manual/Webhook | HITL integrado |
| Variables de usuario | Input inicial | input_schema |
| Configuración de IA | Por nodo | Por bloque |
| Ciclos | Loop nodes | Block type: loop |
| Condicionales | If/Switch nodes | Block type: conditional |

### Lo que Gattaca Agrega

```
┌─────────────────────────────────────────────────────────────────┐
│                    VALOR AGREGADO GATTACA                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CONTEXTO AUTOMÁTICO                                         │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │  Context Lake                                           │ │
│     │  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │ │
│     │  │ Tier 1  │ │ Tier 2  │ │ Tier 3  │                   │ │
│     │  │ Brand   │ │ Campaigns│ │ Outputs │                   │ │
│     │  │ DNA,ToV │ │ Research │ │ Drafts  │                   │ │
│     │  └─────────┘ └─────────┘ └─────────┘                   │ │
│     │         ↓           ↓           ↓                       │ │
│     │     Se inyectan automáticamente en prompts              │ │
│     └─────────────────────────────────────────────────────────┘ │
│                                                                  │
│  2. HUMAN-IN-THE-LOOP NATIVO                                    │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │  Tipos de revisión:                                     │ │
│     │  • approve_reject → Gate de paso                        │ │
│     │  • edit → Usuario puede modificar output                │ │
│     │  • select_option → Elegir entre variaciones             │ │
│     │                                                          │ │
│     │  Características:                                        │ │
│     │  • Timeout configurable                                  │ │
│     │  • Notificaciones automáticas                            │ │
│     │  • Historial de decisiones                               │ │
│     └─────────────────────────────────────────────────────────┘ │
│                                                                  │
│  3. EJECUCIÓN PAUSABLE                                          │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │  • Estado persistido en cada bloque                     │ │
│     │  • Reanudación desde cualquier punto                    │ │
│     │  • Regeneración selectiva de bloques                    │ │
│     │  • Debug por bloque individual                          │ │
│     └─────────────────────────────────────────────────────────┘ │
│                                                                  │
│  4. TRACKING DE COSTOS                                          │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │  • Tokens por bloque                                    │ │
│     │  • Costo estimado en tiempo real                        │ │
│     │  • Histórico de ejecuciones                             │ │
│     └─────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Parte 2: Proceso de Migración Paso a Paso

### Paso 1: Obtener el JSON del Workflow n8n

```bash
# Opción A: Desde la UI de n8n
1. Abrir workflow en n8n
2. Click en menú (⋮) → Download

# Opción B: Desde n8n.io templates
1. Ir a https://n8n.io/workflows/[ID]
2. Usar MCP tool: get_template(templateId: [ID])
```

### Paso 2: Analizar la Estructura del Workflow

Identifica estos elementos clave:

```typescript
interface N8nWorkflowAnalysis {
  // 1. Trigger: Cómo inicia
  trigger: 'manual' | 'webhook' | 'schedule' | 'event'

  // 2. Fases principales
  phases: {
    name: string
    nodes: string[]
    purpose: string
  }[]

  // 3. Nodos de IA
  aiNodes: {
    nodeId: string
    model: string
    prompt: string
    temperature?: number
  }[]

  // 4. Integraciones externas
  integrations: {
    service: string
    action: string
    required: boolean
  }[]

  // 5. Datos de entrada requeridos
  inputs: {
    name: string
    source: 'user' | 'previous_node' | 'external'
  }[]

  // 6. Outputs finales
  outputs: {
    name: string
    destination: string
    format: string
  }[]
}
```

### Paso 3: Mapear Nodos a Bloques

#### Tabla de Conversión n8n → Gattaca

| Tipo de Nodo n8n | Block Type Gattaca | Notas |
|------------------|-------------------|-------|
| OpenAI Chat | `prompt` | Copiar prompt, ajustar modelo |
| Anthropic Claude | `prompt` | Mismo |
| Basic LLM Chain | `prompt` | Extraer prompt del chain |
| AI Agent | `prompt` + `conditional` | Descomponer en bloques |
| If | `conditional` | Convertir expresión |
| Switch | `conditional` múltiple | Un conditional por caso |
| Loop Over Items | `loop` | Definir items_source |
| Wait | No necesario | HITL pausa automáticamente |
| Set | No necesario | Variables en template |
| HTTP Request | External API (futuro) | Documentar como requisito |
| Code | `prompt` con instrucciones | O API custom |

### Paso 4: Convertir Expresiones

```javascript
// n8n expresiones → Gattaca template syntax

// Referencia a nodo anterior
$('NodeName').item.json.output
→ {{step:NodeName}}

// Variables de input
$input.item.json.topic
→ {{topic}}

// Expresión condicional
{{ $json.status === 'approved' }}
→ condition: "output.status === 'approved'"

// Loop
$items("SomeNode")
→ items_source: "step:SomeNode.items"
```

### Paso 5: Identificar Puntos HITL

Busca en el workflow n8n:

1. **Nodos "Wait"** → Convertir a HITL
2. **Webhooks de aprobación** → HITL approve_reject
3. **Formularios** → HITL edit
4. **Decisiones críticas** → Agregar HITL aunque n8n no lo tenga

**Regla de oro**: Si el output del bloque afecta significativamente el resultado final, considera agregar HITL.

### Paso 6: Definir Input Schema

Extrae todas las variables que el usuario debe proporcionar:

```typescript
// De n8n trigger/set nodes:
{
  "topic": "string",
  "platform": "select",
  "duration": "number"
}

// Convertir a Gattaca InputSchema:
const input_schema: InputSchema = {
  topic: {
    type: 'textarea',
    required: true,
    label: 'Tema del contenido',
    description: 'Describe el tema principal'
  },
  platform: {
    type: 'select',
    required: true,
    label: 'Plataforma',
    options: ['TikTok', 'Instagram', 'YouTube']
  },
  duration: {
    type: 'select',
    required: true,
    label: 'Duración',
    options: ['15', '30', '60']
  }
}
```

### Paso 7: Configurar Context Requirements

Analiza qué contexto de marca podría mejorar los prompts:

```typescript
const context_requirements: ContextRequirements = {
  // Documentos fijos requeridos
  required_documents: ['brand_dna', 'tone_of_voice'],

  // Tiers a consultar
  required_tiers: [1, 2],

  // Queries dinámicas
  dynamic_queries: [
    'tier:1 type:icp',
    'tier:2 type:campaign_brief recent:true'
  ]
}
```

### Paso 8: Escribir los Bloques

Template para cada bloque:

```typescript
const block: PlaybookBlock = {
  // Identificador único
  id: 'block-[nombre-slug]',

  // Nombre legible
  name: 'Nombre del Paso',

  // Tipo de bloque
  type: 'prompt', // | 'human_review' | 'conditional' | 'loop'

  // Orden de ejecución
  order: 0,

  // Solo para type: 'prompt'
  prompt: `
    Tu prompt aquí...

    ## CONTEXTO DE MARCA (inyección automática)
    {{#tier1:brand_dna}}
    {{#tier1:tone_of_voice}}

    ## INPUT DEL USUARIO
    Tema: {{topic}}
    Plataforma: {{platform}}

    ## OUTPUT ANTERIOR (si aplica)
    {{step:BloquePrevio}}

    ## INSTRUCCIONES
    ...

    ## OUTPUT FORMAT
    Responde en JSON:
    {
      "campo1": "...",
      "campo2": "..."
    }
  `,

  model: 'claude-3-5-sonnet-20241022',
  provider: 'anthropic',
  temperature: 0.7,
  max_tokens: 2000,

  // Qué documentos del Context Lake usar
  context_tiers: [1, 2],

  // De qué bloques recibe output
  receives_from: ['NombreBloquePrevio'],

  // Formato de output
  output_format: 'json' // | 'markdown' | 'text'
}
```

### Paso 9: Configurar Output

```typescript
const output_config: OutputConfig = {
  // Dónde guardar el resultado final
  destination: 'asset_library', // | 'context_lake' | 'export'

  // Tipo de asset (si destination es asset_library)
  asset_type: 'video_brief',

  // Si también va al Context Lake
  document_tier: 3,
  document_type: 'output'
}
```

---

## Parte 3: Ejemplo Completo de Migración

### Workflow n8n Original (Simplificado)

```json
{
  "nodes": [
    {
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger"
    },
    {
      "name": "Generate Idea",
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "parameters": {
        "prompt": "Generate a viral video idea about: {{ $json.topic }}",
        "model": "gpt-4o"
      }
    },
    {
      "name": "Wait for Approval",
      "type": "n8n-nodes-base.wait",
      "parameters": {
        "resume": "webhook"
      }
    },
    {
      "name": "Generate Script",
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "parameters": {
        "prompt": "Write a script for: {{ $('Generate Idea').item.json.idea }}"
      }
    }
  ]
}
```

### Playbook Gattaca Resultante

```typescript
export const MIGRATED_PLAYBOOK: PlaybookConfig = {
  blocks: [
    {
      id: 'block-idea',
      name: 'Generar Idea',
      type: 'prompt',
      order: 0,
      prompt: `Genera una idea de video viral sobre: {{topic}}

## CONTEXTO DE MARCA
{{#tier1:brand_dna}}
{{#tier1:tone_of_voice}}

## OUTPUT
{
  "idea": "descripción de la idea",
  "hook": "gancho inicial",
  "escenas": ["escena1", "escena2", "escena3"]
}`,
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      temperature: 0.9,
      max_tokens: 1000,
      context_tiers: [1],
      output_format: 'json'
    },
    {
      id: 'block-review',
      name: 'Revisar Idea',
      type: 'human_review',
      order: 1,
      hitl_config: {
        enabled: true,
        interface_type: 'edit',
        timeout_hours: 24,
        prompt: 'Revisa y ajusta la idea antes de continuar'
      },
      receives_from: ['Generar Idea']
    },
    {
      id: 'block-script',
      name: 'Generar Script',
      type: 'prompt',
      order: 2,
      prompt: `Escribe el script completo para este video:

{{step:Revisar Idea}}

El script debe seguir el tono de voz de la marca.

{{#tier1:tone_of_voice}}`,
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      temperature: 0.7,
      max_tokens: 2000,
      receives_from: ['Revisar Idea'],
      output_format: 'markdown'
    }
  ],

  context_requirements: {
    required_documents: ['brand_dna', 'tone_of_voice'],
    required_tiers: [1]
  },

  input_schema: {
    topic: {
      type: 'textarea',
      required: true,
      label: 'Tema del video',
      description: 'Describe el tema para el video viral'
    }
  },

  output_config: {
    destination: 'asset_library',
    asset_type: 'video_script'
  }
}
```

---

## Parte 4: Mejoras que Gattaca Aporta

### 1. Inyección Automática de Contexto

**Antes (n8n)**: Copiar/pegar contexto de marca manualmente en cada prompt.

**Después (Gattaca)**:
```typescript
// En el prompt, simplemente:
{{#tier1:brand_dna}}
{{#tier1:tone_of_voice}}
{{#tier1:icp}}

// Gattaca automáticamente:
// 1. Busca los documentos del cliente
// 2. Los ordena por authority_score
// 3. Los inyecta en el prompt
// 4. Registra qué documentos usó (context_snapshot)
```

### 2. Human-in-the-Loop Estructurado

**Antes (n8n)**: Webhook + formulario externo + lógica manual.

**Después (Gattaca)**:
```typescript
{
  type: 'human_review',
  hitl_config: {
    enabled: true,
    interface_type: 'edit',
    timeout_hours: 24,
    auto_approve_on_timeout: false
  }
}

// La UI automáticamente:
// 1. Pausa la ejecución
// 2. Muestra el output anterior
// 3. Permite editar
// 4. Continúa al aprobar
```

### 3. Tracking de Tokens y Costos

**Antes (n8n)**: No visible sin configuración adicional.

**Después (Gattaca)**:
```typescript
// Cada bloque registra:
block_outputs: {
  'block-idea': {
    output: '...',
    tokens: {
      input: 1523,
      output: 456,
      total: 1979
    },
    model_used: 'claude-3-5-sonnet-20241022',
    duration_ms: 2340
  }
}

// Totales visibles en ejecución y dashboard
```

### 4. Regeneración Selectiva

**Antes (n8n)**: Re-ejecutar todo el workflow.

**Después (Gattaca)**:
```typescript
// Desde la UI o API:
await regenerateBlock(executionId, 'block-script')

// Solo regenera ese bloque
// Mantiene outputs anteriores
// Invalida dependientes
```

### 5. Persistencia de Estado

**Antes (n8n)**: Ejecución atómica, se pierde si falla.

**Después (Gattaca)**:
```typescript
// Estado guardado después de cada bloque
execution: {
  status: 'waiting_human',
  current_block_id: 'block-review',
  block_outputs: {
    'block-idea': { status: 'completed', output: '...' }
  },
  // Puede reanudarse días después
}
```

### 6. Multi-tenancy Nativo

**Antes (n8n)**: Configurar por workflow.

**Después (Gattaca)**:
```
Agency → Client → Documents (Context Lake)
                → Executions
       → Playbooks (reutilizables entre clients)
```

---

## Parte 5: Checklist de Migración

### Pre-migración
- [ ] Obtener JSON del workflow n8n
- [ ] Documentar el objetivo del workflow
- [ ] Listar todas las integraciones externas
- [ ] Identificar variables de usuario

### Análisis
- [ ] Mapear nodos a bloques
- [ ] Identificar fases principales
- [ ] Determinar puntos HITL necesarios
- [ ] Listar contexto de marca útil

### Implementación
- [ ] Crear input_schema
- [ ] Configurar context_requirements
- [ ] Escribir cada bloque
- [ ] Configurar HITL blocks
- [ ] Definir output_config

### Testing
- [ ] Ejecutar con datos de prueba
- [ ] Verificar inyección de contexto
- [ ] Probar flujo HITL
- [ ] Validar outputs

### Mejoras
- [ ] Optimizar prompts con contexto
- [ ] Agregar HITL donde haga falta
- [ ] Configurar timeouts adecuados
- [ ] Documentar el playbook

---

## Parte 6: Patrones Comunes

### Patrón 1: Chain de Prompts

```typescript
// n8n: Node A → Node B → Node C
// Gattaca:
blocks: [
  { id: 'a', name: 'Paso A', type: 'prompt', order: 0 },
  { id: 'b', name: 'Paso B', type: 'prompt', order: 1, receives_from: ['Paso A'] },
  { id: 'c', name: 'Paso C', type: 'prompt', order: 2, receives_from: ['Paso B'] },
]
```

### Patrón 2: Parallel Generation

```typescript
// n8n: Node A splits → B1, B2, B3 → merge
// Gattaca: Loop block
{
  type: 'loop',
  items_source: 'step:PasoA.items',
  loop_block_ids: ['block-process-item']
}
```

### Patrón 3: Conditional Branching

```typescript
// n8n: If node con branches
// Gattaca:
{
  id: 'decision',
  type: 'conditional',
  condition: 'step:PrevStep.output.type === "video"',
  if_block_id: 'block-video-path',
  else_block_id: 'block-text-path'
}
```

### Patrón 4: Wait for Approval

```typescript
// n8n: Wait node + webhook
// Gattaca:
{
  type: 'human_review',
  hitl_config: {
    enabled: true,
    interface_type: 'approve_reject',
    timeout_hours: 48
  }
}
```

### Patrón 5: External API Call

```typescript
// n8n: HTTP Request node
// Gattaca: Documentar como requisito futuro
// Por ahora: Prompt que genera los parámetros para la API
{
  prompt: `
    Genera los parámetros para llamar a la API de generación de video:

    {{step:EscenasAprobadas}}

    Output JSON con los parámetros listos para la API.
  `,
  // En el futuro: block type 'api_call' nativo
}
```

---

## Parte 7: Troubleshooting

### Error: Contexto no se inyecta

```typescript
// Verificar que el cliente tenga documentos
// Verificar context_tiers en el bloque
// Verificar required_documents en context_requirements

// Debug:
console.log(execution.context_snapshot)
```

### Error: HITL no pausa

```typescript
// Verificar hitl_config.enabled = true
// Verificar type = 'human_review'
// Verificar que el bloque anterior completó
```

### Error: receives_from no funciona

```typescript
// El nombre debe coincidir EXACTAMENTE con block.name
// Case sensitive
// Sin espacios extras

receives_from: ['Generar Idea'] // ✓ Correcto
receives_from: ['generar idea'] // ✗ Incorrecto
receives_from: ['Generar Idea '] // ✗ Incorrecto
```

### Error: Output no se guarda

```typescript
// Verificar output_config
// Verificar que todos los bloques completaron
// Verificar execution.status === 'completed'
```

---

## Conclusión

La migración de n8n a Gattaca no es solo un port 1:1. Es una oportunidad para:

1. **Mejorar la calidad** con contexto de marca automático
2. **Agregar control humano** donde antes no existía
3. **Hacer el proceso más robusto** con estado persistido
4. **Trackear costos** de manera transparente
5. **Escalar a múltiples clientes** con multi-tenancy

El tiempo invertido en la migración se recupera rápidamente en:
- Menos errores por falta de contexto
- Outputs más alineados con la marca
- Mejor control de calidad con HITL
- Reutilización entre clientes
