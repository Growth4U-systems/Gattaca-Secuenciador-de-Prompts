# n8n to Gattaca Converter

Biblioteca TypeScript para convertir workflows de n8n a playbooks de Gattaca de forma automatizada.

**Versión**: 1.0.0
**Última actualización**: 2026-01-25

---

## Introducción

El n8n Converter analiza workflows de n8n en formato JSON y genera:

1. **Playbook Config** - Configuración visual completa del playbook
2. **API Routes** - Endpoints Next.js para cada paso del workflow
3. **Conversion Report** - Reporte detallado del proceso de conversión
4. **Environment Variables** - Variables de entorno necesarias

El código generado es **100% nativo TypeScript/Next.js** y no requiere n8n en tiempo de ejecución.

---

## Instalación y Uso

### API Endpoint

```typescript
// POST /api/n8n-converter/convert
const response = await fetch('/api/n8n-converter/convert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflow: jsonString,        // JSON del workflow n8n
    playbookId: 'my-playbook',   // ID opcional
    validateOnly: false          // Solo validar sin generar código
  })
})
```

### Uso Programático

```typescript
import { convertN8nWorkflow, validateForConversion } from '@/lib/n8n-converter'

// Validación rápida
const validation = await validateForConversion(jsonString)
console.log(validation.supportedCount, '/', validation.nodeCount, 'nodos soportados')

// Conversión completa
const result = await convertN8nWorkflow(jsonString, {
  playbookId: 'my-playbook',
  outputDir: 'src/app/api/playbook/my-playbook',
  skipUnsupported: false,
})

if (result.success) {
  console.log('Archivos generados:', result.generatedFiles.map(f => f.path))
} else {
  console.log('Warnings:', result.warnings)
}
```

---

## Nodos Soportados

### Triggers

| Nodo n8n | Tipo Gattaca | Notas |
|----------|--------------|-------|
| `manualTrigger` | `input` | Inicio manual |
| `webhook` | `input` | Webhook HTTP |
| `scheduleTrigger` | `input` | Programado (requiere adaptación) |
| `formTrigger` | `input` | Formulario |
| `chatTrigger` | `input` | Chat/AI |

### HTTP/API

| Nodo n8n | Tipo Gattaca | Notas |
|----------|--------------|-------|
| `httpRequest` | `auto` | Peticiones HTTP directas |
| `respondToWebhook` | `action` | Respuesta webhook |

### AI/LLM

| Nodo n8n | Tipo Gattaca | Notas |
|----------|--------------|-------|
| `lmChatOpenAi` | `auto` (llm) | OpenAI Chat |
| `lmChatAnthropic` | `auto` (llm) | Claude |
| `lmChatGoogleGemini` | `auto` (llm) | Gemini |
| `openAi` | `auto` (llm) | OpenAI Legacy |
| `chatTrigger` (langchain) | `input` | AI Chat Trigger |

### Lógica

| Nodo n8n | Tipo Gattaca | Notas |
|----------|--------------|-------|
| `if` | `decision` | Condicional binario |
| `switch` | `decision` | Múltiples ramas |
| `filter` | `auto` | Filtrado de items |
| `merge` | `auto` | Unión de flujos |

### Transformación

| Nodo n8n | Tipo Gattaca | Notas |
|----------|--------------|-------|
| `set` | `auto` | Establecer valores |
| `code` | `auto` | Código JS/Python |
| `function` | `auto` | Funciones legacy |
| `splitInBatches` | `auto` | Procesamiento batch |
| `aggregate` | `auto` | Agregación |

---

## Arquitectura

### Módulos Principales

```
src/lib/n8n-converter/
├── index.ts                 # Entry point principal
├── types.ts                 # Tipos TypeScript
├── parser/                  # Parsing de JSON
│   ├── workflow-parser.ts   # Parser principal
│   └── index.ts
├── analyzers/               # Análisis de flujo
│   ├── flow-analyzer.ts     # Análisis de ejecución
│   ├── node-categorizer.ts  # Categorización de nodos
│   └── index.ts
├── patterns/                # Detección de patrones
│   ├── linear-detector.ts   # Cadenas lineales
│   ├── branch-detector.ts   # IF/Switch
│   ├── parallel-detector.ts # Flujos paralelos
│   ├── loop-detector.ts     # Bucles
│   └── index.ts
├── converters/              # Conversores de nodos
│   ├── expression.converter.ts  # Expresiones n8n
│   ├── trigger.converter.ts     # Triggers
│   ├── http.converter.ts        # HTTP Request
│   ├── ai.converter.ts          # AI/LLM
│   ├── logic.converter.ts       # IF/Switch
│   ├── transform.converter.ts   # Set/Code/Merge
│   ├── unsupported.converter.ts # Fallback
│   └── index.ts
├── generators/              # Generadores de código
│   ├── playbook-config.generator.ts  # Config visual
│   ├── api-routes.generator.ts       # Endpoints
│   ├── conversion-report.generator.ts # Reportes
│   └── index.ts
└── registry/                # Registro de conversores
    └── node-registry.ts
```

### Flujo de Conversión

```
┌─────────────┐    ┌───────────────┐    ┌────────────────┐
│ JSON n8n    │───▶│ Parser        │───▶│ FlowAnalyzer   │
└─────────────┘    └───────────────┘    └────────────────┘
                                               │
                   ┌───────────────────────────┘
                   ▼
        ┌──────────────────┐    ┌──────────────────┐
        │ Pattern Detectors│───▶│ Node Converters  │
        └──────────────────┘    └──────────────────┘
                                        │
        ┌───────────────────────────────┘
        ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Config Gen    │    │ API Routes    │    │ Report Gen    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            ▼
                   ┌─────────────────┐
                   │ ConversionResult│
                   └─────────────────┘
```

---

## Registro de Conversores

### Crear un Conversor Personalizado

```typescript
import {
  NodeConverter,
  NodeConversionContext,
  registerNodeConverter
} from '@/lib/n8n-converter'

const myCustomConverter: NodeConverter = {
  nodeTypes: ['n8n-nodes-base.myNode'],
  priority: 10, // Mayor = preferencia

  canConvert(node: N8nNode): boolean {
    return node.type === 'n8n-nodes-base.myNode'
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    return {
      step: {
        id: node.name.toLowerCase().replace(/\s+/g, '_'),
        name: node.name,
        description: 'Mi paso personalizado',
        type: 'auto',
        executor: 'api',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
      },
      warnings: [],
      requiresManualImplementation: false,
      sourceNode: {
        id: node.id,
        name: node.name,
        type: node.type,
      },
    }
  },

  generateCode(node: N8nNode, context: NodeConversionContext): GeneratedCode {
    return {
      apiRoute: {
        path: `${context.outputDir}/${node.name}/route.ts`,
        content: `// Generated API route for ${node.name}\n...`,
      },
    }
  },
}

// Registrar
registerNodeConverter(myCustomConverter)
```

---

## Expresiones n8n

El conversor traduce expresiones n8n a referencias de estado Gattaca:

| Expresión n8n | Traducción Gattaca |
|---------------|-------------------|
| `{{ $json.field }}` | `state.currentStep?.input?.field` |
| `{{ $node["Name"].json.data }}` | `state.steps?.["name"]?.output?.data` |
| `{{ $input.all() }}` | `state.currentStep?.input` |
| `{{ $now }}` | `now()` |
| `{{ $if(cond, a, b) }}` | `(cond ? a : b)` |

### Helpers Generados

```typescript
// Incluidos automáticamente cuando son necesarios
function isEmpty(value: unknown): boolean { ... }
function first<T>(arr: T[]): T | undefined { ... }
function last<T>(arr: T[]): T | undefined { ... }
function now(): string { ... }
function today(): string { ... }
```

---

## Detección de Patrones

### Cadenas Lineales

```
Node A → Node B → Node C
```

Detecta secuencias simples sin bifurcaciones para optimizar la ejecución.

### Patrones de Bifurcación (IF/Switch)

```
       ┌→ True Branch
IF ────┤
       └→ False Branch
```

Convierte nodos IF y Switch a pasos de tipo `decision` con rutas configurables.

### Patrones Paralelos

```
      ┌→ Branch 1 ─┐
Start ┼→ Branch 2 ─┼→ Merge
      └→ Branch 3 ─┘
```

Detecta fan-out y fan-in para ejecución paralela.

### Bucles

```
SplitInBatches → Process → [loop back]
```

Identifica patrones de iteración sobre colecciones.

---

## Manejo de Nodos No Soportados

Para nodos sin conversor específico, el sistema:

1. Genera código placeholder con instrucciones
2. Incluye sugerencias de implementación
3. Lista recursos relevantes
4. Detecta variables de entorno necesarias

### Ejemplo de Output No Soportado

```typescript
/**
 * MANUAL IMPLEMENTATION REQUIRED
 *
 * Original n8n Node: n8n-nodes-base.postgres
 * Category: Database
 * Difficulty: easy
 *
 * Implementation Guide:
 * Use @supabase/supabase-js or direct pg client. Consider using Prisma.
 *
 * Resources:
 * - https://supabase.com/docs/reference/javascript
 */
```

---

## UI de Importación

El componente `N8nImportPanel` proporciona una interfaz web para:

1. Pegar JSON del workflow n8n
2. Vista previa del análisis
3. Opciones de conversión
4. Descarga de archivos generados

### Uso en React

```tsx
import { N8nImportPanel } from '@/components/n8n-import'

export default function ImportPage() {
  return (
    <N8nImportPanel
      onConversionComplete={(result) => {
        console.log('Conversión completada:', result)
      }}
    />
  )
}
```

---

## Testing

```bash
# Ejecutar tests
npm run test

# Tests con coverage
npm run test:coverage
```

### Estructura de Tests

```
src/lib/n8n-converter/__tests__/
├── fixtures/
│   ├── simple-workflow.json
│   ├── branching-workflow.json
│   └── ai-workflow.json
├── parser.test.ts        # Tests de parsing
├── analyzers.test.ts     # Tests de análisis
├── converters.test.ts    # Tests de conversores
└── integration.test.ts   # Tests end-to-end
```

---

## Troubleshooting

### Error: "Node type X not supported"

El nodo no tiene un conversor específico. Opciones:
1. Usar `skipUnsupported: true` en las opciones
2. Crear un conversor personalizado
3. Implementar manualmente usando el placeholder generado

### Error: "Connection to non-existent node"

El workflow tiene conexiones rotas. Verificar que todos los nodos referenciados existen.

### Warning: "Unconverted expression"

Una expresión n8n usa funciones no mapeadas. Revisar el código generado y adaptar manualmente.

---

## Referencia API

### `convertN8nWorkflow(json, options)`

Convierte un workflow completo.

**Parámetros:**
- `json`: String JSON del workflow n8n
- `options.playbookId`: ID del playbook generado
- `options.outputDir`: Directorio para archivos generados
- `options.skipUnsupported`: Omitir nodos no soportados
- `options.validateOnly`: Solo validar sin generar código

**Retorna:** `ConversionResult`

### `validateForConversion(json)`

Validación rápida sin conversión completa.

**Retorna:**
```typescript
{
  valid: boolean
  nodeCount: number
  supportedCount: number
  unsupportedNodes: string[]
  warnings: string[]
}
```

### `analyzeFlow(workflow)`

Analiza la estructura del workflow.

**Retorna:** `FlowAnalysis` con orden de ejecución, dependencias y patrones.

### `getNodeConverter(node)`

Obtiene el conversor apropiado para un nodo.

**Retorna:** `NodeConverter | null`

---

## Contribuir

Ver [CONTRIBUTING.md](../CONTRIBUTING.md) para guías de desarrollo.

Para agregar soporte de nuevos nodos:

1. Crear conversor en `converters/`
2. Registrar con `registerNodeConverter()`
3. Agregar tests
4. Actualizar esta documentación
