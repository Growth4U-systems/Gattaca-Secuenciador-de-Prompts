# Arquitectura: Playbook de Video Viral con IA

## Resumen Ejecutivo

Este documento define la arquitectura completa para el Playbook "Generador de Videos Virales con IA", basado en el workflow de n8n #5338 pero mejorado con las capacidades únicas de Gattaca.

### Mejoras vs n8n Original

| Aspecto | n8n Original | Gattaca Mejorado |
|---------|--------------|------------------|
| Contexto de marca | Ninguno | Inyección automática de Brand DNA, ICP, ToV |
| Aprobación humana | Ninguna | 3 puntos HITL críticos |
| Personalización | Manual | Auto-adaptado por plataforma |
| Iteración | Requiere re-ejecutar todo | Iteración por bloque |
| Costo tracking | No visible | Por bloque con totales |
| Output | JSON disperso | Brief estructurado + assets |

---

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PLAYBOOK: VIDEO VIRAL IA                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  CONTEXT     │    │   INPUT      │    │   OUTPUT     │                   │
│  │  LAKE        │    │   SCHEMA     │    │   CONFIG     │                   │
│  │              │    │              │    │              │                   │
│  │  - Brand DNA │    │  - Tema      │    │  → Asset     │                   │
│  │  - ToV       │    │  - Plataforma│    │    Library   │                   │
│  │  - ICP       │    │  - Duración  │    │  → Context   │                   │
│  │  - Campaigns │    │  - Estilo    │    │    Lake T3   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   ▲                            │
│         ▼                   ▼                   │                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         BLOQUES DE EJECUCIÓN                         │   │
│  │                                                                      │   │
│  │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐             │   │
│  │   │ Ideación│──▶│ HITL 1  │──▶│ Escenas │──▶│ HITL 2  │             │   │
│  │   │   IA    │   │ Revisar │   │   IA    │   │ Aprobar │             │   │
│  │   └─────────┘   │  Idea   │   └─────────┘   │ Escenas │             │   │
│  │                 └─────────┘                 └─────────┘             │   │
│  │                                                    │                │   │
│  │   ┌─────────┐   ┌─────────┐   ┌─────────┐         │                │   │
│  │   │  Copy   │◀──│ HITL 3  │◀──│ Script  │◀────────┘                │   │
│  │   │  Redes  │   │  Final  │   │  Audio  │                          │   │
│  │   └─────────┘   └─────────┘   └─────────┘                          │   │
│  │        │                                                            │   │
│  │        ▼                                                            │   │
│  │   ┌─────────────────────────────────────────┐                      │   │
│  │   │    DISTRIBUCIÓN (Multi-plataforma)      │                      │   │
│  │   │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │                      │   │
│  │   │  │ TT  │ │ IG  │ │ YT  │ │ LI  │ ...   │                      │   │
│  │   │  └─────┘ └─────┘ └─────┘ └─────┘       │                      │   │
│  │   └─────────────────────────────────────────┘                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Ideación (Bloque 1)

### Objetivo
Generar una idea viral de video optimizada para la plataforma objetivo.

### Input
```typescript
{
  tema: string,           // "5 hábitos de millonarios"
  plataforma: string,     // "TikTok" | "Instagram Reels" | "YouTube Shorts"
  duracion: number,       // 15 | 30 | 60 segundos
  estilo: string,         // "Cinematográfico" | "Energético" | etc.
  tiene_narracion: boolean
}
```

### Prompt (Mejorado vs n8n)
```markdown
Eres un experto en contenido viral para {{plataforma}} con +10M de views.

## CONTEXTO DE MARCA
{{#tier1:brand_dna}}
{{#tier1:tone_of_voice}}
{{#tier1:icp}}

## TAREA
Genera UNA idea de video de {{duracion}} segundos sobre: {{tema}}

## REQUISITOS VIRALES
1. Hook en 0.5 segundos (texto/visual que detenga el scroll)
2. Retención: algo nuevo cada 3 segundos
3. Formato: funciona en mute (70% ve sin audio)
4. Emoción: elegir UNA (sorpresa, curiosidad, FOMO, aspiración)

## OUTPUT (JSON)
{
  "titulo_interno": "para identificación interna",
  "hook_visual": "descripción del primer frame (0-0.5s)",
  "hook_texto": "texto overlay si aplica",
  "concepto": "2 oraciones máximo",
  "emocion_principal": "una sola emoción",
  "escenas_resumen": ["escena1", "escena2", "escena3"],
  "cta_final": "acción deseada del viewer",
  "caption_preview": "primeras 2 líneas del caption",
  "hashtags": ["#tag1", "#tag2", ...],  // 5-8 hashtags
  "audio_direccion": "descripción del audio ideal"
}

IMPORTANTE: Mantén el tono de voz de la marca según el documento ToV.
```

### Modelo Recomendado
- **Claude 3.5 Sonnet** o **GPT-4o**
- Temperature: 0.9 (creatividad alta)
- Max tokens: 1500

### Context Tiers Usados
- Tier 1: brand_dna, tone_of_voice, icp

---

## Fase 2: Revisión de Idea (HITL 1)

### Tipo de Interfaz
`edit` - El usuario puede modificar la idea generada

### Configuración
```typescript
{
  enabled: true,
  interface_type: 'edit',
  timeout_hours: 24,
  auto_approve_on_timeout: false,
  prompt: "Revisa la idea de video. Puedes editar cualquier campo antes de continuar."
}
```

### UX del HITL
```
┌─────────────────────────────────────────────────────────────┐
│  REVISIÓN DE IDEA DE VIDEO                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Hook Visual:                                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Close-up extremo de mano abriendo caja misteriosa...   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Concepto:                                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Revelar 5 hábitos poco conocidos que comparten los     │ │
│  │ millonarios, con transiciones rápidas y texto overlay  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Escenas:                                                    │
│  [1] _______________  [2] _______________                   │
│  [3] _______________  [4] _______________                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Aprobar    │  │   Editar     │  │  Regenerar   │      │
│  │      ✓       │  │      ✏️       │  │      🔄       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Fase 3: Detalle de Escenas (Bloque 3)

### Objetivo
Convertir la idea aprobada en prompts detallados para generación de video IA.

### Prompt
```markdown
Eres un director de fotografía especializado en videos virales para {{plataforma}}.

## IDEA APROBADA
{{step:Revisar Idea}}

## TAREA
Genera prompts DETALLADOS para cada escena del video. Estos prompts serán usados
en generadores de video IA (Runway, Pika, Seedance, Kling).

## ESPECIFICACIONES TÉCNICAS
- Duración total: {{duracion}} segundos
- Aspect ratio: 9:16 (vertical)
- Estilo: {{estilo}}
- FPS objetivo: 24-30

## PARA CADA ESCENA

### Prompt Visual (CRÍTICO)
Describe con extremo detalle:
- Sujeto principal (qué/quién, posición, acción)
- Ambiente (locación, props, atmósfera)
- Iluminación (tipo, dirección, color, intensidad)
- Textura y detalles (macro si aplica)
- Movimiento (del sujeto, de cámara)

### Parámetros Técnicos
- Movimiento de cámara: static | pan_left | pan_right | zoom_in | zoom_out | tilt | orbit
- Velocidad: slow_motion | normal | fast
- Duración: segundos exactos
- Transición al siguiente: cut | dissolve | wipe | morph

## OUTPUT (JSON)
{
  "total_duracion": {{duracion}},
  "escenas": [
    {
      "numero": 1,
      "nombre": "Hook Opener",
      "duracion_segundos": 2,
      "prompt_visual": "Descripción de 100-200 palabras...",
      "prompt_negativo": "qué evitar (blur, distortion, etc)",
      "camara": {
        "movimiento": "zoom_in",
        "velocidad": "slow_motion",
        "angulo": "eye_level"
      },
      "iluminacion": "golden hour, soft shadows, warm tones",
      "transicion": "cut",
      "texto_overlay": "texto si aplica o null",
      "audio_sync": "descripción del audio en este momento"
    }
  ]
}

IMPORTANTE: Los prompts visuales deben ser lo suficientemente detallados para
que cualquier modelo de video IA genere resultados consistentes.
```

### Modelo Recomendado
- **Claude 3.5 Sonnet** (mejor para descripciones detalladas)
- Temperature: 0.6
- Max tokens: 3000

---

## Fase 4: Aprobación de Escenas (HITL 2)

### Tipo de Interfaz
`select_option` + `edit`

El usuario puede:
1. Aprobar todas las escenas
2. Marcar escenas para regenerar
3. Editar prompts específicos

### Configuración
```typescript
{
  enabled: true,
  interface_type: 'edit',
  timeout_hours: 48,
  prompt: "Revisa cada escena. Puedes editar los prompts o solicitar regeneración de escenas específicas."
}
```

---

## Fase 5: Script de Audio (Bloque 5)

### Objetivo
Generar el guión de audio sincronizado con las escenas.

### Prompt
```markdown
Eres un director de audio para contenido viral.

## ESCENAS APROBADAS
{{step:Aprobar Escenas}}

## CONFIGURACIÓN
- ¿Tiene narración?: {{tiene_narracion}}
- Plataforma: {{plataforma}}
- Tono de voz: {{#tier1:tone_of_voice}}

## TAREA
{{#if tiene_narracion}}
Genera un script de narración sincronizado con cada escena.
El script debe:
- Ser conversacional y natural
- Tener ganchos cada 3-5 segundos
- Incluir pausas dramáticas
- Adaptarse al tono de voz de la marca
{{else}}
Genera la dirección de audio ambiente y música para cada escena.
{{/if}}

## OUTPUT (JSON)
{
  "tipo_audio": "narracion" | "ambiente" | "mixto",
  "musica": {
    "estilo": "electronic, upbeat, motivational",
    "bpm_sugerido": 120,
    "referencias": ["song1", "song2"],
    "licencia_nota": "buscar royalty-free similar"
  },
  "script_por_escena": [
    {
      "escena_numero": 1,
      "timestamp_inicio": "0:00",
      "timestamp_fin": "0:02",
      "narracion": "texto exacto a narrar" | null,
      "direccion_audio": "descripción del ambiente sonoro",
      "sfx": ["woosh", "impact"] | null,
      "notas_timing": "pausar 0.5s antes del siguiente"
    }
  ],
  "voz_sugerida": {
    "genero": "masculina" | "femenina" | "neutral",
    "edad": "joven" | "adulto",
    "acento": "neutro latinoamericano",
    "ritmo": "energético pero claro"
  }
}
```

---

## Fase 6: Aprobación Final (HITL 3)

### Tipo de Interfaz
`approve_reject`

Este es el gate final antes de generar el copy para distribución.

### Lo que se revisa
1. Coherencia entre escenas y audio
2. Alineación con marca
3. Viabilidad de producción
4. Presupuesto estimado

### Configuración
```typescript
{
  enabled: true,
  interface_type: 'approve_reject',
  timeout_hours: 72,
  prompt: "Revisa el brief completo antes de generar el copy de distribución."
}
```

---

## Fase 7: Copy para Distribución (Bloque 7)

### Objetivo
Generar copy optimizado para cada plataforma seleccionada.

### Prompt
```markdown
Eres un experto en copywriting para redes sociales con foco en {{plataforma}}.

## VIDEO BRIEF APROBADO
Idea: {{step:Revisar Idea}}
Escenas: {{step:Aprobar Escenas}}

## CONTEXTO DE MARCA
{{#tier1:tone_of_voice}}
{{#tier1:icp}}

## TAREA
Genera el copy completo para publicar el video en {{plataforma}}.

## REQUISITOS POR PLATAFORMA

### TikTok
- Caption: 1-2 líneas + CTA + 5-10 hashtags
- Primer comentario: pregunta para engagement
- Duet/stitch potencial

### Instagram Reels
- Caption: 2-3 líneas aspiracionales + CTA
- Hashtags: 10-15 (mix popular + nicho)
- Story teaser copy
- Cross-post note para feed

### YouTube Shorts
- Título: max 60 chars, curiosity gap
- Descripción: 2-3 oraciones + links
- Hashtags: 3-5 relevantes
- End screen CTA

## OUTPUT (JSON)
{
  "plataforma": "{{plataforma}}",
  "caption": {
    "texto_principal": "...",
    "cta": "...",
    "hashtags": ["#tag1", "#tag2"],
    "emojis_usados": ["emoji1", "emoji2"]
  },
  "primer_comentario": "...",
  "horario_sugerido": {
    "dia": "martes-jueves",
    "hora": "19:00-21:00",
    "timezone": "America/Mexico_City",
    "razon": "peak engagement para audiencia LATAM"
  },
  "extras": {
    "story_teaser": "...",
    "titulo_alternativo": "...",
    "cross_post_adaptaciones": ["..."]
  }
}
```

---

## Fase 8: Distribución Multi-plataforma (Loop)

### Objetivo
Adaptar el copy a múltiples plataformas si el usuario lo requiere.

### Configuración
```typescript
{
  type: 'loop',
  items_source: '{{plataformas_adicionales}}',
  loop_block_ids: ['block-copy-adapt']
}
```

### Bloque Loop
```typescript
{
  id: 'block-copy-adapt',
  name: 'Adaptar Copy a {{current_item}}',
  type: 'prompt',
  prompt: `Adapta el copy original para {{current_item}}.

  Copy original ({{plataforma}}):
  {{step:Copy para Distribución}}

  Adapta manteniendo el mensaje pero optimizando para {{current_item}}.
  `
}
```

---

## Integraciones de APIs

### APIs Utilizadas en n8n (Referencia)

| API | Uso | Endpoint |
|-----|-----|----------|
| OpenAI | Ideación, Scripts | gpt-4o, gpt-4o-mini |
| Wavespeed/Seedance | Generación video | /api/v1/generate |
| Fal AI | Audio, FFmpeg | minimax/speech, fal/ffmpeg |
| Blotato | Publicación | /api/v1/publish |

### APIs para Gattaca (A Implementar)

```typescript
// src/lib/integrations/video-apis.ts

export interface VideoGenerationAPI {
  name: string
  generate: (prompt: string, params: VideoParams) => Promise<VideoResult>
  checkStatus: (jobId: string) => Promise<JobStatus>
  supported_durations: number[]
  cost_per_second: number
}

export const VIDEO_APIS: Record<string, VideoGenerationAPI> = {
  runway: {
    name: 'Runway Gen-3',
    // ...
  },
  pika: {
    name: 'Pika Labs',
    // ...
  },
  seedance: {
    name: 'Seedance/Wavespeed',
    // ...
  },
  kling: {
    name: 'Kling AI',
    // ...
  }
}
```

### Fase 2: API de Publicación (Futuro)

```typescript
// src/lib/integrations/social-apis.ts

export interface SocialPublishAPI {
  platform: string
  publish: (content: PublishContent) => Promise<PublishResult>
  schedule: (content: PublishContent, datetime: Date) => Promise<ScheduleResult>
}

export const SOCIAL_APIS = {
  blotato: { /* multi-plataforma */ },
  buffer: { /* scheduler */ },
  native: {
    tiktok: { /* TikTok API */ },
    instagram: { /* Instagram Graph API */ },
    youtube: { /* YouTube Data API */ }
  }
}
```

---

## Estimación de Costos por Ejecución

### Tokens LLM
| Bloque | Modelo | Input Est. | Output Est. | Costo Est. |
|--------|--------|------------|-------------|------------|
| Ideación | Claude Sonnet | 2000 | 800 | $0.012 |
| Escenas | Claude Sonnet | 3000 | 2000 | $0.025 |
| Audio | Claude Sonnet | 2500 | 1000 | $0.015 |
| Copy | Claude Sonnet | 2000 | 600 | $0.010 |
| **Total LLM** | | | | **~$0.06** |

### APIs Externas (si se usan)
| Servicio | Uso | Costo Est. |
|----------|-----|------------|
| Video Gen (30s) | 5 clips | $2-5 |
| Audio Gen | 1 track | $0.50 |
| Publicación | 3 plataformas | $0.10 |
| **Total APIs** | | **$2.60-5.60** |

### Total por Video
- **Solo brief**: ~$0.06 (solo LLM)
- **Brief + generación**: ~$3-6 (con video/audio APIs)

---

## Input Schema Completo

```typescript
const INPUT_SCHEMA: InputSchema = {
  // Básicos (requeridos)
  tema: {
    type: 'textarea',
    required: true,
    label: 'Tema del video',
    description: 'Describe el tema principal. Ej: "5 señales de que estás quemándote en el trabajo"'
  },
  plataforma: {
    type: 'select',
    required: true,
    label: 'Plataforma principal',
    options: ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn']
  },
  duracion: {
    type: 'select',
    required: true,
    label: 'Duración objetivo',
    options: ['15', '30', '60', '90'],
    description: 'Segundos. TikTok/Reels: 15-60, Shorts: 15-60'
  },
  estilo: {
    type: 'select',
    required: true,
    label: 'Estilo visual',
    options: [
      'Cinematográfico',
      'Minimalista',
      'Energético',
      'Aesthetic',
      'Educativo/Whiteboard',
      'Documental',
      'ASMR/Satisfying'
    ]
  },

  // Opcionales
  tiene_narracion: {
    type: 'boolean',
    required: false,
    label: '¿Incluir narración?',
    default: true
  },
  plataformas_adicionales: {
    type: 'select',
    required: false,
    label: 'Plataformas adicionales',
    options: ['Instagram Reels', 'YouTube Shorts', 'LinkedIn', 'Facebook Reels'],
    description: 'Se generará copy adaptado para cada una'
  },
  referencia_visual: {
    type: 'textarea',
    required: false,
    label: 'Referencia visual',
    description: 'URL o descripción de un video de referencia para el estilo'
  },
  objetivo_negocio: {
    type: 'select',
    required: false,
    label: 'Objetivo de negocio',
    options: ['Awareness', 'Engagement', 'Traffic', 'Conversión', 'Educación']
  }
}
```

---

## Context Requirements

```typescript
const CONTEXT_REQUIREMENTS: ContextRequirements = {
  required_documents: ['brand_dna', 'tone_of_voice'],
  required_tiers: [1],
  dynamic_queries: [
    'tier:1 type:icp',           // ICP para personalizar
    'tier:2 type:campaign_brief' // Campaña activa si existe
  ]
}
```

---

## Output Config

```typescript
const OUTPUT_CONFIG: OutputConfig = {
  destination: 'asset_library',
  asset_type: 'video_brief',
  // También guardar en Context Lake como referencia
  secondary_destination: {
    destination: 'context_lake',
    document_tier: 3,
    document_type: 'output'
  }
}
```

---

## Resumen de Bloques

| # | Nombre | Tipo | HITL | Tiers | Dependencias |
|---|--------|------|------|-------|--------------|
| 1 | Generar Idea Viral | prompt | - | 1 | - |
| 2 | Revisar Idea | human_review | edit | - | 1 |
| 3 | Detallar Escenas | prompt | - | - | 2 |
| 4 | Aprobar Escenas | human_review | edit | - | 3 |
| 5 | Generar Script Audio | prompt | - | 1 | 4 |
| 6 | Aprobación Final | human_review | approve | - | 5 |
| 7 | Generar Copy | prompt | - | 1 | 2 |
| 8 | Adaptar Multi-plataforma | loop | - | - | 7 |

---

## Diagrama de Flujo Detallado

```
                    ┌─────────────────┐
                    │     START       │
                    │  User provides  │
                    │    inputs       │
                    └────────┬────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │     BLOCK 1: Generar Idea      │
            │  ┌──────────────────────────┐  │
            │  │ Inject: Brand DNA + ToV  │  │
            │  │ Inject: ICP              │  │
            │  │ Model: Claude Sonnet     │  │
            │  │ Temp: 0.9               │  │
            │  └──────────────────────────┘  │
            └────────────────┬───────────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │    BLOCK 2: HITL - Revisar     │
            │    ┌────────────────────┐      │
            │    │    Interface: edit │      │
            │    │    Timeout: 24h    │      │
            │    └────────────────────┘      │
            │                                │
            │    [Aprobar] [Editar] [Regen]  │
            └────────────────┬───────────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │   BLOCK 3: Detallar Escenas    │
            │  ┌──────────────────────────┐  │
            │  │ Input: Idea aprobada     │  │
            │  │ Output: JSON de escenas  │  │
            │  │ Model: Claude Sonnet     │  │
            │  │ Temp: 0.6               │  │
            │  └──────────────────────────┘  │
            └────────────────┬───────────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │   BLOCK 4: HITL - Escenas      │
            │    ┌────────────────────┐      │
            │    │  Interface: edit   │      │
            │    │  Timeout: 48h      │      │
            │    └────────────────────┘      │
            └────────────────┬───────────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │   BLOCK 5: Script de Audio     │
            │  ┌──────────────────────────┐  │
            │  │ Input: Escenas + ToV     │  │
            │  │ Conditional: narración   │  │
            │  │ Model: Claude Sonnet     │  │
            │  └──────────────────────────┘  │
            └────────────────┬───────────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │   BLOCK 6: HITL - Final        │
            │    ┌─────────────────────┐     │
            │    │ Interface: approve  │     │
            │    │ Timeout: 72h        │     │
            │    │ Gate: antes de copy │     │
            │    └─────────────────────┘     │
            └────────────────┬───────────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │     BLOCK 7: Generar Copy      │
            │  ┌──────────────────────────┐  │
            │  │ Input: Brief completo    │  │
            │  │ Plataforma: {{plataf}}   │  │
            │  │ Model: Claude Sonnet     │  │
            │  └──────────────────────────┘  │
            └────────────────┬───────────────┘
                             │
                             ▼
               ┌─────────────────────────┐
               │  ¿Más plataformas?      │
               └──────────┬──────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
         ┌────────┐              ┌────────┐
         │   Sí   │              │   No   │
         └────┬───┘              └────┬───┘
              │                       │
              ▼                       │
    ┌─────────────────────┐          │
    │  BLOCK 8: Loop      │          │
    │  Adaptar para cada  │          │
    │  plataforma extra   │          │
    └─────────┬───────────┘          │
              │                       │
              └───────────┬───────────┘
                          │
                          ▼
            ┌────────────────────────────────┐
            │          COMPLETE              │
            │  Output: Video Brief JSON      │
            │  Saved: Asset Library + T3     │
            └────────────────────────────────┘
```

---

## Consideraciones de Implementación

### 1. Manejo de Timeouts HITL
```typescript
// Si el HITL expira sin respuesta
if (hitl.timeout_reached && !hitl.auto_approve_on_timeout) {
  execution.status = 'waiting_human'
  // Enviar reminder notification
  await sendHitlReminder(execution)
}
```

### 2. Regeneración Parcial
Permitir regenerar bloques individuales sin perder el progreso:
```typescript
async function regenerateBlock(executionId: string, blockId: string) {
  // Mantener outputs de bloques anteriores
  // Solo regenerar el bloque especificado
  // Invalidar bloques dependientes
}
```

### 3. Variaciones A/B
Generar múltiples versiones para testing:
```typescript
// Futuro: Block type 'variation'
{
  type: 'variation',
  variations: 3,
  criteria: 'hook_style', // Qué variar
  downstream_behavior: 'branch' // Crear paths paralelos
}
```

---

## Próximos Pasos

1. [ ] Implementar template completo en `example-playbooks.ts`
2. [ ] Crear componente `VideoScenePreview` para HITL de escenas
3. [ ] Implementar API routes para video generation (opcional)
4. [ ] Agregar tracking de costos por ejecución
5. [ ] Crear dashboard de métricas de videos generados
