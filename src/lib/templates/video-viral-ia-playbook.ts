/**
 * Video Viral IA Playbook Template
 * Genera videos virales ASMR usando IA (idea → escenas → clips → audio → video final)
 *
 * Convertido desde n8n workflow: "Generate AI Videos with Seedance & Blotato"
 * URL original: https://n8n.io/workflows/5338
 */

import type { PlaybookTemplate, VariableDefinition } from './types'
import type { FlowStep } from '@/types/flow.types'

// ============================================
// STEP PROMPTS
// ============================================

/**
 * Step 1.1: Generate Viral Idea
 * Adapted from n8n node: "Generate Creative Video Idea"
 */
export const STEP_1_1_GENERATE_IDEA_PROMPT = `**Role:**
You are an AI designed to generate **one immersive, realistic idea** for a viral video based on the user-provided topic. Your output must be formatted as a **JSON object** and follow the rules below exactly.

---

### CONTEXT
- **Content Theme**: {{content_theme}}
- **Content Style**: {{content_style}}
- **Target Platforms**: {{target_platforms}}

---

### RULES

1. **Number of ideas**
   - Return **only one idea**.

2. **Idea**
   - Maximum 13 words.
   - Describe a viral-worthy, original, or surreal moment related to the topic.
   - Must be visually compelling and suitable for {{content_style}} style.

3. **Caption**
   - Short, punchy, viral-friendly.
   - Include **one emoji**.
   - Exactly **{{hashtag_count}} hashtags** in this order:
     1. 4 topic-relevant hashtags
     2. 4 all-time most popular hashtags
     3. 4 currently trending hashtags
   - All in lowercase.

4. **Environment**
   - Maximum 20 words.
   - Must match the action in the Idea exactly.
   - Specify location, visual details (dust particles, polished surface, subtle reflections…), and style (macro close-up, cinematic slow-motion, minimalist…).

5. **Sound**
   - Maximum 15 words.
   - Describe the primary sound for the scene (to feed into an audio model).
   - Should match the {{content_style}} style.

---

### OUTPUT FORMAT (JSON)

\`\`\`json
{
  "caption": "Your short viral title with emoji #hashtags...",
  "idea": "Your idea under 13 words",
  "environment": "Your vivid setting under 20 words matching the action",
  "sound": "Your primary sound description under 15 words"
}
\`\`\`

Generate the idea now based on the theme: {{content_theme}}`

/**
 * Step 2.1: Generate Scene Prompts
 * Adapted from n8n node: "Generate Detailed Video Prompts"
 */
export const STEP_2_1_GENERATE_SCENES_PROMPT = `**Role:**
You are a prompt-generation AI specializing in cinematic, {{content_style}} video prompts. Your task is to generate a multi-scene video sequence based on the approved idea.

---

### INPUT FROM PREVIOUS STEP
- **Idea**: {{previous_step_output.idea}}
- **Environment**: {{previous_step_output.environment}}
- **Sound**: {{previous_step_output.sound}}

### VIDEO CONFIGURATION
- **Number of scenes**: {{num_scenes}}
- **Duration per scene**: {{video_duration}} seconds total / {{num_scenes}} scenes
- **Aspect Ratio**: {{aspect_ratio}}

---

### WRITING STYLE

Your writing must follow this style:
- Sharp, precise cinematic realism
- Macro-level detail with tight focus on the main action
- Always show motion and dynamic action - never static or idle
- Camera terms are allowed (e.g., macro view, tight angle, over-the-shoulder shot)

Each scene must contain all of the following, expressed through detailed visual language:
- The main object or subject (from the Idea)
- The environment or surface (from the Environment)
- The texture, structure, and behavior of materials
- Dynamic action and movement

### DESCRIPTIONS SHOULD SHOW:
- The physical makeup of materials — translucent, brittle, dense, reflective, granular, fibrous, layered
- How materials respond to action — resistance, cracking, tearing, smooth separation, tension
- Visual details — light reflection, particles, shimmer, subtle movement
- ASMR-relevant sensory cues shown visually, not narrated

### TONE:
- Clean, clinical, visual
- No poetic metaphors, emotion, or storytelling
- Avoid fantasy or surreal imagery
- All description must feel physically grounded and logically accurate

### LENGTH:
- Each scene must be between 500 and 1,000 characters
- No shallow or repetitive scenes — each must be immersive, descriptive, and specific
- Each scene should explore a distinct phase, different camera perspective, or new behavior

---

### OUTPUT FORMAT (JSON)

\`\`\`json
{
  "idea": "{{previous_step_output.idea}}",
  "environment": "{{previous_step_output.environment}}",
  "sound": "{{previous_step_output.sound}}",
  "scene_1": "Detailed description of scene 1...",
  "scene_2": "Detailed description of scene 2...",
  "scene_3": "Detailed description of scene 3..."
}
\`\`\`

Generate {{num_scenes}} scenes now.`

/**
 * Step 2.2: Generate Video Clips (placeholder - requires API)
 * Maps to n8n nodes: "Generate Video Clips (seedance)", "Wait for Clip Generation", "Retrieve Video Clips"
 */
export const STEP_2_2_GENERATE_CLIPS_DESCRIPTION = `Este paso genera los clips de video usando Wavespeed AI / Seedance.

**Configuración:**
- Aspect Ratio: {{aspect_ratio}}
- Duration per clip: {{video_duration}} / {{num_scenes}} segundos
- Scenes a generar: {{num_scenes}}

**Estado actual:** GAP - Requiere implementación de endpoint async con polling.

**Workaround temporal:**
1. Copia los prompts de escenas del paso anterior
2. Ve a https://wavespeed.ai o tu herramienta de video IA preferida
3. Genera cada clip manualmente
4. Sube las URLs de los clips generados`

/**
 * Step 3.1: Generate Audio (placeholder - requires API)
 * Maps to n8n nodes: "Generate ASMR Sound (Fal AI)", "Wait for Sound Generation", "Retrieve Final Sound Output"
 */
export const STEP_3_1_GENERATE_AUDIO_DESCRIPTION = `Este paso genera el audio {{content_style}} usando Fal AI.

**Prompt de audio:**
"{{content_style}} Soothing sound effects. {{previous_step_output.sound}}"

**Duración:** {{video_duration}} segundos

**Estado actual:** GAP - Requiere implementación de endpoint async.

**Workaround temporal:**
1. Ve a https://fal.ai/models/fal-ai/mmaudio-v2
2. Usa el prompt de audio mostrado arriba
3. Sube el video de referencia (primer clip generado)
4. Descarga el audio generado y sube la URL`

/**
 * Step 3.2: Compose Final Video (placeholder - requires API)
 * Maps to n8n nodes: "List Clip URLs for Stitching", "Merge Clips into Final Video (Fal AI)", "Wait", "Retrieve"
 */
export const STEP_3_2_COMPOSE_VIDEO_DESCRIPTION = `Este paso une los clips de video con el audio usando FFmpeg en Fal AI.

**Clips a unir:** {{num_scenes}} clips
**Audio:** Generado en paso anterior
**Duración total:** {{video_duration}} segundos

**Estado actual:** GAP - Requiere implementación de endpoint async.

**Workaround temporal:**
1. Ve a https://fal.ai/models/fal-ai/ffmpeg-api
2. Sube los clips de video en orden
3. Añade el audio generado
4. Descarga el video final y sube la URL`

/**
 * Step 4.1: Preview Final Output
 */
export const STEP_4_1_PREVIEW_DESCRIPTION = `Revisa el video final antes de publicar.

**Video:** {{previous_step_output.video_url}}
**Caption:** {{step_1_1_output.caption}}
**Idea:** {{step_1_1_output.idea}}

Verifica que:
- El video se ve correctamente
- El audio está sincronizado
- El caption y hashtags son apropiados para {{target_platforms}}`

/**
 * Step 4.2: Export/Publish (placeholder - requires Blotato API)
 */
export const STEP_4_2_EXPORT_DESCRIPTION = `Exporta o publica el video a las plataformas seleccionadas.

**Plataformas:** {{target_platforms}}

**Estado actual:** GAP - Integración Blotato pendiente.

**MVP Export:**
- URL del video final para descargar
- Caption y hashtags para copiar
- Instrucciones de publicación manual por plataforma`

// ============================================
// VARIABLE DEFINITIONS
// ============================================

export const VIDEO_VIRAL_IA_VARIABLE_DEFINITIONS: VariableDefinition[] = [
  {
    name: 'content_theme',
    default_value: '',
    required: true,
    description: 'Tema del contenido (ej: "cutting ASMR", "satisfying slime", "kinetic sand")',
  },
  {
    name: 'content_style',
    default_value: 'ASMR',
    required: true,
    description: 'Estilo del contenido: ASMR, satisfying, educational, cinematic',
  },
  {
    name: 'video_duration',
    default_value: '30',
    required: true,
    description: 'Duración total del video en segundos',
  },
  {
    name: 'aspect_ratio',
    default_value: '9:16',
    required: true,
    description: 'Proporción del video: 9:16 (vertical), 16:9 (horizontal), 1:1 (cuadrado)',
  },
  {
    name: 'target_platforms',
    default_value: 'TikTok, Instagram Reels, YouTube Shorts',
    required: true,
    description: 'Plataformas destino para el video',
  },
  {
    name: 'num_scenes',
    default_value: '3',
    required: false,
    description: 'Número de escenas/clips a generar',
  },
  {
    name: 'hashtag_count',
    default_value: '12',
    required: false,
    description: 'Número de hashtags para el caption',
  },
]

// ============================================
// FLOW STEPS
// ============================================

export const VIDEO_VIRAL_IA_FLOW_STEPS: FlowStep[] = [
  // FASE 1: IDEACIÓN
  {
    id: 'step-1-1-generate-idea',
    name: 'Generar Idea Viral',
    order: 0,
    type: 'llm',
    prompt: STEP_1_1_GENERATE_IDEA_PROMPT,
    model: 'openai/gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 1024,
    output_format: 'json',
    description: 'Genera una idea viral con caption, environment y sound',
    base_doc_ids: [],
    auto_receive_from: [],
    retrieval_mode: 'full',
  },
  {
    id: 'step-1-2-review-idea',
    name: 'Revisar Idea',
    order: 1,
    type: 'llm', // Will be decision in UI config
    prompt: 'Revisa y aprueba la idea generada. Puedes editarla si es necesario.',
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 512,
    output_format: 'json',
    description: 'Usuario revisa y aprueba/edita la idea generada',
    base_doc_ids: [],
    auto_receive_from: ['step-1-1-generate-idea'],
    retrieval_mode: 'full',
  },

  // FASE 2: PRODUCCIÓN DE ESCENAS
  {
    id: 'step-2-1-generate-scenes',
    name: 'Generar Prompts de Escenas',
    order: 2,
    type: 'llm',
    prompt: STEP_2_1_GENERATE_SCENES_PROMPT,
    model: 'openai/gpt-4o',
    temperature: 0.7,
    max_tokens: 4096,
    output_format: 'json',
    description: 'Genera descripciones detalladas para cada escena del video',
    base_doc_ids: [],
    auto_receive_from: ['step-1-2-review-idea'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-2-2-generate-clips',
    name: 'Generar Clips de Video',
    order: 3,
    type: 'llm', // Placeholder - should be 'job' when API is ready
    prompt: STEP_2_2_GENERATE_CLIPS_DESCRIPTION,
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 512,
    output_format: 'markdown',
    description: '[GAP] Genera clips de video con Seedance/Wavespeed AI',
    base_doc_ids: [],
    auto_receive_from: ['step-2-1-generate-scenes'],
    retrieval_mode: 'full',
  },

  // FASE 3: POST-PRODUCCIÓN
  {
    id: 'step-3-1-generate-audio',
    name: 'Generar Audio',
    order: 4,
    type: 'llm', // Placeholder - should be 'job' when API is ready
    prompt: STEP_3_1_GENERATE_AUDIO_DESCRIPTION,
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 512,
    output_format: 'markdown',
    description: '[GAP] Genera audio ASMR con Fal AI',
    base_doc_ids: [],
    auto_receive_from: ['step-2-2-generate-clips'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-3-2-compose-video',
    name: 'Componer Video Final',
    order: 5,
    type: 'llm', // Placeholder - should be 'job' when API is ready
    prompt: STEP_3_2_COMPOSE_VIDEO_DESCRIPTION,
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 512,
    output_format: 'markdown',
    description: '[GAP] Une clips + audio con FFmpeg en Fal AI',
    base_doc_ids: [],
    auto_receive_from: ['step-3-1-generate-audio'],
    retrieval_mode: 'full',
  },

  // FASE 4: PUBLICACIÓN
  {
    id: 'step-4-1-preview',
    name: 'Preview Final',
    order: 6,
    type: 'llm', // Will be display in UI config
    prompt: STEP_4_1_PREVIEW_DESCRIPTION,
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 256,
    output_format: 'markdown',
    description: 'Muestra video final + caption + hashtags para revisión',
    base_doc_ids: [],
    auto_receive_from: ['step-3-2-compose-video'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-4-2-export',
    name: 'Publicar/Exportar',
    order: 7,
    type: 'llm', // Will be action in UI config
    prompt: STEP_4_2_EXPORT_DESCRIPTION,
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 512,
    output_format: 'markdown',
    description: '[GAP] Exporta o publica a plataformas seleccionadas',
    base_doc_ids: [],
    auto_receive_from: ['step-4-1-preview'],
    retrieval_mode: 'full',
  },
]

// ============================================
// TEMPLATE EXPORT
// ============================================

/**
 * Get full playbook template configuration
 */
export function getVideoViralIATemplate(): PlaybookTemplate {
  return {
    template_id: 'video-viral-ia-v1',
    name: 'Video Viral IA',
    description:
      'Genera videos virales usando IA. Crea ideas, escenas, clips, audio y video final listo para publicar en TikTok, YouTube e Instagram.',
    playbook_type: 'video_viral_ia',

    flow_config: {
      steps: VIDEO_VIRAL_IA_FLOW_STEPS,
      version: '1.0.0',
      description:
        'Video Viral IA - De idea a video publicado con IA generativa',
    },

    variable_definitions: VIDEO_VIRAL_IA_VARIABLE_DEFINITIONS,

    required_documents: {
      product: [],
      competitor: [],
      research: [
        'Ejemplos de videos virales del nicho (opcional)',
        'Referencias visuales para estilo (opcional)',
      ],
    },

    campaign_docs_guide: `## Guía de Video Viral IA

### Configuración Inicial
Define las variables para tu video:
- **Tema**: El tema central del video (ej: "cutting ASMR", "satisfying slime")
- **Estilo**: ASMR, satisfying, educational, cinematic
- **Duración**: Segundos totales (recomendado: 30-60s)
- **Formato**: 9:16 para TikTok/Reels, 16:9 para YouTube

### Fase 1: Ideación
El sistema genera una idea viral con:
- Caption con emoji y hashtags
- Descripción del concepto
- Environment para generación visual
- Prompt de audio

Revisa y ajusta la idea antes de continuar.

### Fase 2: Producción de Escenas
Se generan prompts detallados para cada escena.
Actualmente los clips se generan externamente (Wavespeed/Seedance).

### Fase 3: Post-Producción
Audio y composición final.
Actualmente requiere uso externo de Fal AI.

### Fase 4: Publicación
Preview final y exportación.
MVP: URLs y caption para publicación manual.

---
⚠️ **Nota**: Este playbook está en desarrollo híbrido. Los pasos LLM funcionan completamente. Los pasos de video/audio muestran instrucciones para generación externa mientras se desarrollan los endpoints.

💡 **Tip**: Para mejores resultados, sé específico en el tema y revisa bien la idea inicial antes de generar escenas.`,
  }
}
