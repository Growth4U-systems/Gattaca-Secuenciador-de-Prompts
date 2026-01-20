# PRD: Video Viral IA

## 1. Información General

| Campo | Valor |
|-------|-------|
| Workflow n8n origen | Generate AI Videos with Seedance & Blotato |
| URL | https://n8n.io/workflows/5338 |
| Playbook destino | `video_viral_ia` |
| Estado | Implementado |

---

## 2. Objetivo

- **Qué hace**: Genera videos virales ASMR usando IA (idea → escenas → clips → audio → video final)
- **Para quién**: Creadores de contenido que quieren automatizar producción de videos cortos
- **Resultado**: Video MP4 listo para publicar + metadata (caption, hashtags)

---

## 3. Variables

### Requeridas

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `{{content_theme}}` | text | Tema del contenido (ej: "cutting ASMR", "satisfying slime") |
| `{{content_style}}` | select | Estilo: ASMR, satisfying, educational, cinematic, comedy |
| `{{video_duration}}` | number | Duración total en segundos (default: 30, min: 10, max: 180) |
| `{{aspect_ratio}}` | select | 9:16 (vertical), 16:9 (horizontal), 1:1 (cuadrado) |
| `{{target_platforms}}` | multiselect | TikTok, Instagram Reels, YouTube Shorts, etc. |

### Opcionales

| Variable | Default | Descripción |
|----------|---------|-------------|
| `{{num_scenes}}` | 3 | Número de escenas/clips (2-10) |
| `{{hashtag_count}}` | 12 | Cantidad de hashtags (5-30) |

---

## 4. Fases y Pasos

### FASE 1: Ideación

#### Paso 1.1: Generar Idea Viral
- **Tipo**: `auto_with_review`
- **Ejecutor**: `llm`
- **Prompt**: Genera idea viral con caption, hashtags, y descripción de audio
- **Output**: JSON con `caption`, `hashtags[]`, `audio_description`, `environment`

#### Paso 1.2: Revisar Idea
- **Tipo**: `decision`
- **Ejecutor**: `none`
- **Opciones**: Aprobar y continuar / Editar idea / Generar nueva idea

### FASE 2: Producción de Escenas

#### Paso 2.1: Generar Prompts de Escenas
- **Tipo**: `auto_with_review`
- **Ejecutor**: `llm`
- **Prompt**: Genera prompts detallados para cada escena basados en la idea aprobada
- **Output**: JSON con array de `scenes[]` con `prompt`, `duration`, `camera_movement`

#### Paso 2.2: Generar Clips de Video
- **Tipo**: `auto_with_review`
- **Ejecutor**: `api`
- **API**: Wavespeed AI / Seedance
- **Endpoint**: `/api/playbook/video-viral/generate-clips`
- **Output**: Array de URLs de video clips

### FASE 3: Post-Producción

#### Paso 3.1: Generar Audio
- **Tipo**: `auto_with_review`
- **Ejecutor**: `api`
- **API**: Fal AI MMAudio V2
- **Endpoint**: `/api/playbook/video-viral/generate-audio`
- **Output**: URL de audio generado

#### Paso 3.2: Componer Video Final
- **Tipo**: `auto_with_review`
- **Ejecutor**: `api`
- **API**: Fal AI FFmpeg
- **Endpoint**: `/api/playbook/video-viral/compose-video`
- **Output**: URL del video final compuesto

### FASE 4: Publicación

#### Paso 4.1: Preview Final
- **Tipo**: `display`
- **Ejecutor**: `none`
- **Muestra**: Video final + caption + hashtags

#### Paso 4.2: Exportar/Publicar
- **Tipo**: `action`
- **Ejecutor**: `none` (futuro: Blotato API)
- **Acción**: Descargar video o publicar a plataformas

---

## 5. Integraciones Externas

| Servicio | Propósito | API Key Name |
|----------|-----------|--------------|
| Wavespeed AI | Generación de video clips | `wavespeed` |
| Fal AI | Audio + FFmpeg composición | `fal` |
| OpenRouter | LLM para ideación y prompts | `openrouter` |

### Costos Estimados por Video

| Servicio | Costo Aproximado |
|----------|------------------|
| Wavespeed | $0.20 por clip de ~5 segundos |
| Fal AI Audio | $0.001 por segundo (~$0.03 por 30s) |
| Fal AI FFmpeg | $0.01 por operación |
| LLM (ideación) | ~$0.02 por ejecución |

**Total estimado**: ~$0.70 - $1.50 por video de 30 segundos con 3 escenas

---

## 6. Archivos Implementados

### Template
- `src/lib/templates/video-viral-ia-playbook.ts`

### Config Visual
- `src/components/playbook/configs/video-viral-ia.config.ts`

### API Endpoints
- `src/app/api/playbook/video-viral/generate-clips/route.ts`
- `src/app/api/playbook/video-viral/generate-audio/route.ts`
- `src/app/api/playbook/video-viral/compose-video/route.ts`

### Registros
- `src/lib/templates/index.ts`
- `src/components/playbook/configs/index.ts`
- `src/lib/playbook-metadata.ts`

---

## 7. Referencias de APIs

### Wavespeed AI / Seedance
- Docs: https://wavespeed.ai/docs/docs-api/bytedance/bytedance-seedance-v1.5-pro-text-to-video
- Endpoint: `POST https://api.wavespeed.ai/api/v3/bytedance/seedance-v1.5-pro/text-to-video`
- Parámetros: `prompt`, `aspect_ratio`, `duration`, `resolution`

### Fal AI MMAudio V2
- Docs: https://fal.ai/models/fal-ai/mmaudio-v2
- Endpoint: `POST https://fal.run/fal-ai/mmaudio-v2`
- Parámetros: `prompt`, `duration`, `video_url` (opcional)

### Fal AI FFmpeg
- Merge Videos: https://fal.ai/models/fal-ai/ffmpeg-api/merge-videos/api
- Merge Audio-Video: https://fal.ai/models/fal-ai/ffmpeg-api/merge-audio-video/api

---

## 8. Notas de Implementación

1. **Jobs Asíncronos**: El endpoint de `generate-clips` implementa polling interno con timeout de 3 minutos por clip. La UI debe mostrar progreso.

2. **Fallback sin Audio**: Si falla la adición de audio, el endpoint `compose-video` retorna el video sin audio en lugar de fallar completamente.

3. **Publicación**: Actualmente solo soporta export/download. Integración con Blotato para publicación automática está pendiente.

4. **Límites de Duración**:
   - Wavespeed: 4-12 segundos por clip
   - Fal Audio: 1-30 segundos
   - Total video: 10-180 segundos

---

## 9. Workflow Original (n8n)

```
Schedule Trigger
    ↓
Agent (GPT) - Genera idea
    ↓
Set - Prepara variables
    ↓
Agent (GPT) - Genera prompts de escenas
    ↓
Loop: Para cada escena
    ├─ Wavespeed API - Submit job
    ├─ Wait 4 min
    └─ Wavespeed API - Get result
    ↓
Fal AI - Genera audio
    ↓
Fal AI FFmpeg - Une clips
    ↓
Fal AI FFmpeg - Agrega audio
    ↓
Loop: Para cada plataforma (x9)
    └─ Blotato API - Publica
    ↓
Google Sheets - Log resultado
```

La conversión a Gattaca simplificó el flujo a 8 pasos secuenciales con revisión humana entre cada fase.
