# PRD: Video Viral IA

**Conversión de workflow n8n → Playbook Gattaca**

**Última actualización**: 2026-01-20

---

## 1. Información General

| Campo | Valor |
|-------|-------|
| Workflow n8n origen | Generate AI Videos with Seedance & Blotato |
| URL original | https://n8n.io/workflows/5338 |
| Playbook destino | `video_viral_ia` |
| Versión | 1.0.0 |

---

## 2. Objetivo

- **Qué hace**: Genera videos virales ASMR usando IA (idea → escenas → clips → audio → video final)
- **Para quién**: Creadores de contenido que quieren automatizar producción de videos cortos
- **Resultado**: Video MP4 listo para publicar + metadata (caption, hashtags)

---

## 3. Variables

### Requeridas

| Variable | Tipo | Descripción | Origen n8n |
|----------|------|-------------|------------|
| `{{content_theme}}` | text | Tema del contenido (ej: "cutting ASMR", "satisfying slime") | Prompt hardcoded |
| `{{content_style}}` | select | Estilo: ASMR, satisfying, educational | System prompt |
| `{{video_duration}}` | number | Duración total en segundos (default: 30) | duration: 10 x 3 scenes |
| `{{aspect_ratio}}` | select | 9:16 (vertical), 16:9 (horizontal), 1:1 (cuadrado) | aspect_ratio param |
| `{{target_platforms}}` | multiselect | TikTok, YouTube, Instagram, etc. | Blotato nodes |

### Opcionales

| Variable | Default | Descripción |
|----------|---------|-------------|
| `{{num_scenes}}` | 3 | Número de escenas/clips |
| `{{sound_style}}` | "ASMR" | Estilo de audio |
| `{{hashtag_count}}` | 12 | Número de hashtags |

---

## 4. Fases y Pasos

### FASE 1: Ideación

#### Paso 1.1: Generar Idea Viral
- **Tipo**: auto_with_review
- **Ejecutor**: llm
- **Nodos n8n mapeados**:
  - `Generate Creative Video Idea` (Agent)
  - `LLM: Generate Raw Idea (GPT-5)`
  - `Parse AI Output (Idea, Environment, Sound)`
- **Output**: JSON con Caption, Idea, Environment, Sound, Status

**Prompt base** (adaptado de n8n):
```
Genera UNA idea de video viral sobre {{content_theme}}.

REGLAS:
1. Idea: máximo 13 palabras, describe un momento viral
2. Caption: título corto con 1 emoji + 12 hashtags (4 del tema, 4 populares, 4 trending)
3. Environment: máximo 20 palabras, describe el entorno visual
4. Sound: máximo 15 palabras, describe el sonido principal

OUTPUT FORMAT (JSON):
{
  "caption": "Título viral con emoji #hashtags",
  "idea": "Descripción de la idea",
  "environment": "Descripción del entorno visual",
  "sound": "Descripción del sonido"
}
```

#### Paso 1.2: Revisar Idea
- **Tipo**: decision
- **Ejecutor**: none
- **Descripción**: Usuario revisa y aprueba/edita la idea generada

---

### FASE 2: Producción de Escenas

#### Paso 2.1: Generar Prompts de Escenas
- **Tipo**: auto_with_review
- **Ejecutor**: llm
- **Nodos n8n mapeados**:
  - `Generate Detailed Video Prompts` (Agent)
  - `LLM: Draft Video Prompt Details (GPT-4.1)`
  - `Parse Structured Video Prompt Output`
- **Dependencias**: Paso 1.1
- **Output**: JSON con Scene 1, Scene 2, Scene 3...

**Prompt base**:
```
Genera {{num_scenes}} descripciones de escenas para video basado en:

Idea: {{previous_step_output.idea}}
Environment: {{previous_step_output.environment}}
Sound: {{previous_step_output.sound}}

Cada escena debe:
- Tener entre 1,000 y 2,000 caracteres
- Describir la acción en detalle cinematográfico
- Incluir detalles de textura, luz, movimiento
- Ser apta para generación de video con IA

OUTPUT FORMAT (JSON):
{
  "scene_1": "Descripción detallada...",
  "scene_2": "Descripción detallada...",
  "scene_3": "Descripción detallada..."
}
```

#### Paso 2.2: Generar Clips de Video
- **Tipo**: auto
- **Ejecutor**: job (async)
- **Nodos n8n mapeados**:
  - `Extract Individual Scene Descriptions` (Code)
  - `Generate Video Clips (seedance)` (HTTP)
  - `Wait for Clip Generation` (Wait 4min)
  - `Retrieve Video Clips` (HTTP)
- **Dependencias**: Paso 2.1
- **API**: Wavespeed AI / Seedance
- **Output**: Array de URLs de clips

**Estado**: GAP - Requiere desarrollo de endpoint async

---

### FASE 3: Post-Producción

#### Paso 3.1: Generar Audio ASMR
- **Tipo**: auto
- **Ejecutor**: job (async)
- **Nodos n8n mapeados**:
  - `Generate ASMR Sound (Fal AI)` (HTTP)
  - `Wait for Sound Generation` (Wait 4min)
  - `Retrieve Final Sound Output` (HTTP)
- **Dependencias**: Paso 2.2
- **API**: Fal AI (mmaudio-v2)
- **Output**: URL de audio

**Estado**: GAP - Requiere desarrollo de endpoint async

#### Paso 3.2: Componer Video Final
- **Tipo**: auto
- **Ejecutor**: job (async)
- **Nodos n8n mapeados**:
  - `List Clip URLs for Stitching` (Code)
  - `Merge Clips into Final Video (Fal AI)` (HTTP)
  - `Wait for Video Rendering` (Wait 4min)
  - `Retrieve Final Merged Video` (HTTP)
- **Dependencias**: Paso 3.1
- **API**: Fal AI (ffmpeg-api)
- **Output**: URL de video final

**Estado**: GAP - Requiere desarrollo de endpoint async

---

### FASE 4: Publicación

#### Paso 4.1: Preview Final
- **Tipo**: display
- **Ejecutor**: none
- **Dependencias**: Paso 3.2
- **Descripción**: Muestra video final + caption + hashtags para revisión

#### Paso 4.2: Publicar/Exportar
- **Tipo**: action
- **Ejecutor**: api (o none para MVP)
- **Nodos n8n mapeados**:
  - `Upload Video to BLOTATO` (Blotato)
  - 9 nodos de publicación (TikTok, YouTube, Instagram, etc.)
  - `Merge` (sincronizar)
  - `Update Status to "DONE"` (Google Sheets)
- **Dependencias**: Paso 4.1

**Estado**: GAP - Para MVP: Export manual (URL + caption copiable)

---

## 5. Documentos Requeridos

- **Product**: No aplica (el producto es el video generado)
- **Research**: No aplica

---

## 6. Integraciones Externas

| Servicio | Uso | API Key Requerida |
|----------|-----|-------------------|
| OpenAI | GPT para generación de ideas y escenas | Sí (OpenRouter) |
| Wavespeed AI / Seedance | Generación de clips de video | Sí |
| Fal AI | Audio ASMR + FFmpeg stitching | Sí |
| Blotato (opcional) | Publicación multi-plataforma | Sí |

---

## 7. Gap Analysis

### Mapeo Directo ✅

| Capacidad n8n | Componente Gattaca |
|---------------|-------------------|
| Agent + GPT | FlowStep type='llm' |
| outputParserStructured | output_format='json' |
| Google Sheets (logging) | playbook_step_outputs |

### Requiere Adaptación ⚠️

| Capacidad | Solución |
|-----------|----------|
| Schedule trigger | Usuario inicia manualmente |
| Code (extract scenes) | Procesamiento en prompt LLM |

### Requiere Desarrollo ❌

| Gap | Esfuerzo | MVP Workaround |
|-----|----------|----------------|
| Jobs async con polling | 8-12h | Paso manual_research |
| Wavespeed/Seedance API | 4-6h | Usuario genera externamente |
| Fal AI API | 4-6h | Usuario compone externamente |
| Blotato publicación | 8-12h | Export URL + copy caption |

---

## 8. Notas de Implementación

### Estrategia: Híbrido Progresivo

1. Implementar pasos LLM como funcionales
2. Pasos de video/audio como `auto` con endpoints placeholder
3. Desarrollar endpoints async a medida que se necesiten

### Consideraciones

- Los prompts originales de n8n son muy específicos para "cutting ASMR" - generalizar para cualquier tema
- El workflow original usa GPT-5 y GPT-4.1 - usar modelos disponibles en OpenRouter
- Los waits de 4 minutos indican procesos largos - UI debe mostrar progreso

### Orden de desarrollo sugerido

1. Template + Config con pasos LLM funcionales
2. Endpoint para Wavespeed/Seedance (genera clips)
3. Endpoint para Fal AI audio
4. Endpoint para Fal AI compose
5. Integración Blotato (opcional)

---

## 9. Flujo Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VIDEO VIRAL IA PLAYBOOK                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FASE 1: IDEACIÓN                                                       │
│  ┌─────────────────┐    ┌─────────────────┐                             │
│  │ 1.1 Generar     │───►│ 1.2 Revisar     │                             │
│  │ Idea (LLM) ✅   │    │ Idea (user) ✅  │                             │
│  └─────────────────┘    └────────┬────────┘                             │
│                                  │                                       │
│  FASE 2: PRODUCCIÓN              ▼                                       │
│  ┌─────────────────┐    ┌─────────────────┐                             │
│  │ 2.1 Generar     │───►│ 2.2 Generar     │                             │
│  │ Escenas (LLM) ✅│    │ Clips (API) ❌  │                             │
│  └─────────────────┘    └────────┬────────┘                             │
│                                  │                                       │
│  FASE 3: POST-PRODUCCIÓN         ▼                                       │
│  ┌─────────────────┐    ┌─────────────────┐                             │
│  │ 3.1 Generar     │───►│ 3.2 Componer    │                             │
│  │ Audio (API) ❌  │    │ Video (API) ❌  │                             │
│  └─────────────────┘    └────────┬────────┘                             │
│                                  │                                       │
│  FASE 4: PUBLICACIÓN             ▼                                       │
│  ┌─────────────────┐    ┌─────────────────┐                             │
│  │ 4.1 Preview     │───►│ 4.2 Publicar/   │                             │
│  │ Final ✅        │    │ Export ⚠️       │                             │
│  └─────────────────┘    └─────────────────┘                             │
│                                                                          │
│  ✅ = Implementable ahora  ❌ = Requiere desarrollo  ⚠️ = MVP export    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Referencias

- [Workflow original en n8n.io](https://n8n.io/workflows/5338)
- [Documentación Wavespeed AI](https://docs.wavespeed.ai/)
- [Documentación Fal AI](https://fal.ai/docs)
- [Documentación Blotato](https://docs.blotato.com/)
- [Guía de playbooks Gattaca](../playbook-templates.md)
