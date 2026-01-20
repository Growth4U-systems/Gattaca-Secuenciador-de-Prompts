# Plan: Conversión "Video Viral IA" (n8n → Gattaca)

## Resumen

Convertir el workflow de n8n "Generate AI Videos with Seedance & Blotato" en un playbook funcional de Gattaca llamado `video_viral_ia`.

**Estado actual:** Implementación casi completa ✅. Solo falta un fix de TypeScript.

---

## Estado de Implementación (Actualizado)

### Completado ✅
1. Template creado: `src/lib/templates/video-viral-ia-playbook.ts`
2. Config visual creada: `src/components/playbook/configs/video-viral-ia.config.ts`
3. Registrado en `index.ts` files
4. Registrado en `playbook-metadata.ts`
5. **API Endpoints reales implementados (NO placeholders):**
   - `src/app/api/playbook/video-viral/generate-clips/route.ts` - Wavespeed API
   - `src/app/api/playbook/video-viral/generate-audio/route.ts` - Fal AI MMAudio
   - `src/app/api/playbook/video-viral/compose-video/route.ts` - Fal AI FFmpeg
6. Execute-step routing actualizado para `video_viral_ia`
7. ServiceName type actualizado en `src/lib/getUserApiKey.ts` (agregados: `wavespeed`, `fal`)

### Pendiente ❌
1. **Fix TypeScript**: Actualizar ServiceName en `src/app/api/user/api-keys/check/route.ts`
   - Cambiar línea 7 de:
     ```typescript
     type ServiceName = 'apify' | 'firecrawl' | 'openrouter' | 'perplexity' | 'phantombuster' | 'linkedin_cookie' | 'serper'
     ```
   - A:
     ```typescript
     type ServiceName = 'apify' | 'firecrawl' | 'openrouter' | 'perplexity' | 'phantombuster' | 'linkedin_cookie' | 'serper' | 'wavespeed' | 'fal'
     ```
2. Verificar build (`npx tsc --noEmit` y `npm run build`)
3. Test en UI

## Verificación Final

1. `npx tsc --noEmit` - debe pasar sin errores
2. `npm run build` - debe compilar exitosamente
3. En UI:
   - Crear proyecto tipo `video_viral_ia`
   - Crear campaña con variables de prueba
   - Ejecutar paso "Generar Idea" (LLM)
   - Los pasos de video/audio/compose requieren API keys de Wavespeed y Fal

---

---

## Análisis del Workflow (Fase 1 ✅)

### Información General
| Campo | Valor |
|-------|-------|
| Nombre n8n | Generate AI Videos with Seedance & Blotato |
| URL | https://n8n.io/workflows/5338 |
| Playbook destino | `video_viral_ia` |
| Nodos totales | 35 |

### Flujo Resumido
```
Schedule → LLM (idea) → LLM (escenas) → Seedance (clips) → Fal AI (audio)
    → FFmpeg (stitch) → Blotato (publicar x9) → Google Sheets (log)
```

### APIs Requeridas
- OpenAI (GPT)
- Wavespeed AI / Seedance (video)
- Fal AI (audio + ffmpeg)
- Google Sheets (logging)
- Blotato (publicación)

---

## PRD: Video Viral IA (Fase 2)

### Objetivo del Playbook
- **Qué hace**: Genera videos virales ASMR usando IA (idea → escenas → clips → audio → video final)
- **Para quién**: Creadores de contenido que quieren automatizar producción de videos cortos
- **Resultado**: Video MP4 listo para publicar + metadata (caption, hashtags)

### Variables Requeridas

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `{{content_theme}}` | text | Tema del contenido (ej: "cutting ASMR", "satisfying slime") |
| `{{content_style}}` | select | Estilo: ASMR, satisfying, educational, etc. |
| `{{video_duration}}` | number | Duración total en segundos (default: 30) |
| `{{aspect_ratio}}` | select | 9:16 (vertical), 16:9 (horizontal), 1:1 (cuadrado) |
| `{{target_platforms}}` | multiselect | TikTok, YouTube, Instagram, etc. |

### Variables Opcionales

| Variable | Default | Descripción |
|----------|---------|-------------|
| `{{num_scenes}}` | 3 | Número de escenas/clips |
| `{{sound_style}}` | "ASMR" | Estilo de audio |
| `{{hashtag_count}}` | 12 | Número de hashtags |

### Fases y Pasos Propuestos

#### FASE 1: Ideación (2 pasos)
| Step | Tipo | Ejecutor | Descripción |
|------|------|----------|-------------|
| 1.1 Generar Idea | auto_with_review | llm | LLM genera idea viral + caption + hashtags |
| 1.2 Revisar Idea | decision | none | Usuario aprueba/edita la idea |

#### FASE 2: Producción de Escenas (2 pasos)
| Step | Tipo | Ejecutor | Descripción |
|------|------|----------|-------------|
| 2.1 Generar Prompts | auto_with_review | llm | LLM genera descripciones detalladas por escena |
| 2.2 Generar Clips | auto | job | **[GAP]** Job async: Seedance/Wavespeed genera clips |

#### FASE 3: Post-Producción (2 pasos)
| Step | Tipo | Ejecutor | Descripción |
|------|------|----------|-------------|
| 3.1 Generar Audio | auto | job | **[GAP]** Job async: Fal AI genera audio ASMR |
| 3.2 Componer Video | auto | job | **[GAP]** Job async: Fal AI FFmpeg une clips + audio |

#### FASE 4: Publicación (2 pasos)
| Step | Tipo | Ejecutor | Descripción |
|------|------|----------|-------------|
| 4.1 Preview Final | display | none | Muestra video + metadata para revisión |
| 4.2 Publicar | action | api | **[GAP]** Blotato publica a plataformas seleccionadas |

---

## Gap Analysis (Fase 3)

### A. Mapeo Directo ✅
| Capacidad | n8n | Gattaca |
|-----------|-----|---------|
| Generación de idea | Agent + GPT | FlowStep type='llm' |
| Prompts estructurados | outputParserStructured | output_format='json' |
| Guardar metadata | Google Sheets | playbook_step_outputs (interno) |

### B. Requiere Adaptación ⚠️
| Capacidad | Cambio | Solución |
|-----------|--------|----------|
| Schedule trigger | Automático → Manual | Usuario inicia campaña manualmente |
| Merge paralelo | n8n nativo | Secuencial o custom job |

### C. Requiere Desarrollo ❌

#### GAP 1: Jobs Asíncronos con Polling
**Problema:** n8n usa `wait` (4 min) + `httpRequest` para polling. Gattaca no tiene este patrón.

**Solución propuesta:**
```typescript
// Nuevo executor type o patrón en jobs existentes
executor: 'async_job'
asyncConfig: {
  submitEndpoint: 'https://api.wavespeed.ai/...',
  pollEndpoint: 'https://api.wavespeed.ai/.../result',
  pollInterval: 30000, // 30 segundos
  maxWaitTime: 300000, // 5 minutos
}
```

**Archivos a crear/modificar:**
- `src/app/api/playbook/async-job/route.ts` - Endpoint para jobs async
- `src/lib/async-job-manager.ts` - Lógica de submit + polling
- `src/components/playbook/WorkArea.tsx` - UI de progreso

**Esfuerzo:** ~8-12 horas

#### GAP 2: Integraciones de Video (Wavespeed/Seedance)
**Problema:** No existe integración con APIs de generación de video.

**Solución propuesta:**
```typescript
// Endpoint específico para video generation
POST /api/playbook/generate-video-clips
{
  provider: 'wavespeed' | 'seedance' | 'runway',
  scenes: string[],
  aspectRatio: '9:16',
  duration: 10
}
```

**Archivos a crear:**
- `src/app/api/playbook/generate-video-clips/route.ts`

**Esfuerzo:** ~4-6 horas

#### GAP 3: Integración Fal AI (Audio + FFmpeg)
**Problema:** No existe integración con Fal AI.

**Solución propuesta:**
```typescript
// Endpoints para audio y composición
POST /api/playbook/generate-audio
POST /api/playbook/compose-video
```

**Archivos a crear:**
- `src/app/api/playbook/generate-audio/route.ts`
- `src/app/api/playbook/compose-video/route.ts`

**Esfuerzo:** ~4-6 horas

#### GAP 4: Publicación Multi-Plataforma (Blotato)
**Problema:** No existe integración con Blotato ni APIs de redes sociales.

**Solución propuesta (MVP):**
- Opción A: Integrar Blotato API directamente
- Opción B: Export manual (URL del video + caption copiable)

**Para MVP:** Usar action type='export' con URL del video

**Esfuerzo:**
- Opción A: ~8-12 horas
- Opción B (MVP): ~2 horas

### Resumen de Gaps

| Gap | Criticidad | Esfuerzo | MVP Workaround |
|-----|------------|----------|----------------|
| Jobs async + polling | ALTA | 8-12h | Proceso manual con URLs |
| Wavespeed/Seedance | ALTA | 4-6h | Usuario genera externamente |
| Fal AI audio/compose | ALTA | 4-6h | Usuario compone externamente |
| Blotato publicación | MEDIA | 8-12h | Export URL + copy caption |

**Total para implementación completa:** ~24-36 horas de desarrollo
**Total para MVP (solo LLM steps):** ~4-6 horas

---

## Decisión: Estrategia de Implementación

### Opción A: MVP Solo Ideación
Implementar solo Fase 1 (Ideación con LLM). Las fases de producción quedan como `manual_research` donde el usuario ejecuta externamente.

**Pros:** Rápido, sin desarrollo de infraestructura
**Contras:** No es un playbook end-to-end funcional

### Opción B: Implementación Completa con Jobs Async
Desarrollar primero la infraestructura de jobs async, luego implementar el playbook completo.

**Pros:** Playbook 100% funcional, reutilizable para otros workflows
**Contras:** Requiere ~24-36h de desarrollo previo

### Opción C: Híbrido Progresivo (RECOMENDADO)
1. Implementar playbook con pasos LLM funcionales
2. Pasos de video/audio como `auto` con `executor: 'api'` que llaman endpoints placeholder
3. Ir desarrollando los endpoints a medida que se necesiten

**Pros:** Playbook usable desde día 1, mejora incremental
**Contras:** Algunos pasos fallarán hasta completar desarrollo

---

## Plan de Implementación (si se aprueba Opción C)

### Paso 1: Crear Template y Config (4-6h)
- `src/lib/templates/video-viral-ia-playbook.ts`
- `src/components/playbook/configs/video-viral-ia.config.ts`
- Registrar en index.ts
- Agregar metadata

### Paso 2: Crear Endpoints Placeholder (2h)
- `/api/playbook/generate-video-clips` → returns mock/error
- `/api/playbook/generate-audio` → returns mock/error
- `/api/playbook/compose-video` → returns mock/error

### Paso 3: Migraciones DB (1h)
- Ya existe `video_viral_ia` en el enum ✅
- Insertar playbook en tabla

### Paso 4: Desarrollo de Jobs Async (8-12h) - FUTURO
- Cuando se quiera funcionalidad completa

### Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `src/lib/templates/video-viral-ia-playbook.ts` | CREAR |
| `src/lib/templates/index.ts` | MODIFICAR |
| `src/components/playbook/configs/video-viral-ia.config.ts` | CREAR |
| `src/components/playbook/configs/index.ts` | MODIFICAR |
| `src/lib/playbook-metadata.ts` | MODIFICAR |
| `src/app/api/playbook/generate-video-clips/route.ts` | CREAR (placeholder) |
| `src/app/api/playbook/generate-audio/route.ts` | CREAR (placeholder) |
| `src/app/api/playbook/compose-video/route.ts` | CREAR (placeholder) |
| `supabase/migrations/[ts]_insert_video_viral_ia.sql` | CREAR |

---

## Verificación

### Tests Manuales
1. Crear proyecto tipo `video_viral_ia`
2. Crear campaña con variables de prueba
3. Ejecutar paso 1.1 (Generar Idea) → debe generar output LLM
4. Ejecutar paso 2.1 (Generar Prompts) → debe generar escenas
5. Pasos de video/audio → mostrar mensaje de "funcionalidad en desarrollo"

### Checklist
- [ ] Playbook aparece en lista
- [ ] Wizard de variables funciona
- [ ] Pasos LLM ejecutan correctamente
- [ ] Pasos de video muestran placeholder/error controlado

---

## Plan de Ejecución Final

**Estrategia elegida:** Híbrido Progresivo

### Orden de Implementación

1. **Crear PRD permanente** → `docs/prd/video-viral-ia-prd.md`

2. **Crear Template** → `src/lib/templates/video-viral-ia-playbook.ts`
   - Prompts para ideación y generación de escenas
   - Variables definidas
   - flow_config con 8 pasos

3. **Crear Config Visual** → `src/components/playbook/configs/video-viral-ia.config.ts`
   - 4 fases: Ideación, Producción, Post-Producción, Publicación
   - Tipos de step apropiados

4. **Registrar en sistema**
   - `src/lib/templates/index.ts`
   - `src/components/playbook/configs/index.ts`
   - `src/lib/playbook-metadata.ts`

5. **Crear endpoints placeholder**
   - `/api/playbook/generate-video-clips/route.ts`
   - `/api/playbook/generate-audio/route.ts`
   - `/api/playbook/compose-video/route.ts`

6. **Migración DB** → `supabase/migrations/[ts]_insert_video_viral_ia.sql`

7. **Verificar en UI**

### Archivos a Crear
- `docs/prd/video-viral-ia-prd.md`
- `src/lib/templates/video-viral-ia-playbook.ts`
- `src/components/playbook/configs/video-viral-ia.config.ts`
- `src/app/api/playbook/generate-video-clips/route.ts`
- `src/app/api/playbook/generate-audio/route.ts`
- `src/app/api/playbook/compose-video/route.ts`
- `supabase/migrations/[ts]_insert_video_viral_ia.sql`

### Archivos a Modificar
- `src/lib/templates/index.ts`
- `src/components/playbook/configs/index.ts`
- `src/lib/playbook-metadata.ts`

---

## Notas del Proceso de Conversión

Este PRD + Gap Analysis sirve como:
1. **Documentación** del workflow original
2. **Roadmap** de desarrollo necesario
3. **Template** para futuros workflows similares

El proceso de conversión n8n → Gattaca ha identificado que workflows con:
- Solo LLM → conversión directa
- HTTP simples → conversión directa
- Jobs async con polling → requiere desarrollo de infraestructura
- Integraciones específicas → requiere endpoints custom

---

## Proceso de Conversión n8n → Gattaca (Referencia)

### Qué hacer
1. Obtener JSON del workflow (via MCP tools o archivo)
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
- [ ] Nombre y propósito del workflow
- [ ] Tipo de trigger
- [ ] Lista de nodos LLM (extraer prompts)
- [ ] Lista de nodos de lógica
- [ ] Variables de entrada identificadas
- [ ] Flujo de datos mapeado
- [ ] Credenciales requeridas
```

---

## Fase 2: PRD Intermedio

### Estructura del PRD (docs/prd/[nombre]-prd.md)

```markdown
# PRD: [Nombre del Workflow] → Playbook Gattaca

## 1. Información General
| Campo | Valor |
|-------|-------|
| Workflow n8n origen | [nombre] |
| Playbook destino | [nombre_propuesto] |

## 2. Objetivo
- **Qué hace**: [descripción]
- **Para quién**: [usuario objetivo]
- **Resultado**: [output esperado]

## 3. Variables
### Requeridas
| Variable | Tipo | Descripción | Origen n8n |
|----------|------|-------------|------------|

### Opcionales
| Variable | Default | Descripción |
|----------|---------|-------------|

## 4. Fases y Pasos
### FASE 1: [Nombre]
#### Paso 1.1: [Nombre]
- **Tipo**: input | suggestion | auto | decision | action
- **Ejecutor**: llm | job | api | none
- **Nodos n8n mapeados**: [lista]
- **Prompt**: [si aplica]
- **Output**: [formato]

## 5. Documentos Requeridos
- Product: [lista]
- Research: [lista]

## 6. Integraciones Externas
| Servicio | API Key |
|----------|---------|

## 7. Notas de Implementación
- [consideraciones especiales]
```

---

## Fase 3: Gap Analysis

### Tabla de Mapeo de Capacidades

| Capacidad n8n | Equivalente Gattaca | Estado |
|---------------|---------------------|--------|
| webhook trigger | Inicio de campaña (input) | DIRECTO |
| lmChatOpenAi | FlowStep type='llm' | DIRECTO |
| lmChatAnthropic | FlowStep type='llm' | DIRECTO |
| agent (AI) | Múltiples steps LLM | ADAPTACIÓN |
| if/switch | decision step | ADAPTACIÓN |
| code (JS) | Lógica en prompt LLM | ADAPTACIÓN |
| httpRequest | executor='api' o 'job' | DIRECTO |
| googleSheets | executor='job' | DIRECTO |
| schedule trigger | N/A | GAP |
| slack/email | N/A (sin integración) | GAP |

### Checklist de Gap Analysis
```markdown
### A. Mapeo Directo ✓
- [ ] [capacidad]: [nodo] → [componente]

### B. Requiere Adaptación ⚠️
- [ ] [capacidad]: Cambio de paradigma
  - Solución: [cómo adaptarlo]

### C. Requiere Desarrollo ❌
- [ ] [capacidad]: Funcionalidad nueva
  - Esfuerzo: [estimación]
  - Workaround: [temporal]

### Decisión: Proceder / Pausar / Desarrollar primero
```

---

## Fase 4: Implementación

### Archivos a crear/modificar

| Archivo | Propósito |
|---------|-----------|
| `src/lib/templates/[nombre]-playbook.ts` | Template con prompts y flow_config |
| `src/lib/templates/index.ts` | Registrar template |
| `src/components/playbook/configs/[nombre].config.ts` | Config visual (fases, steps) |
| `src/components/playbook/configs/index.ts` | Registrar config visual |
| `src/types/database.types.ts` | Agregar PlaybookType |
| `src/lib/playbook-metadata.ts` | Metadata para UI |
| `supabase/migrations/[ts]_add_[nombre].sql` | Enum + constraint |
| `supabase/migrations/[ts]_insert_[nombre].sql` | Insert playbook |

### Referencia de guía completa
Ver [docs/playbook-templates.md](docs/playbook-templates.md) para instrucciones detalladas de cada archivo.

---

## Fase 5: Sistema de Verificación

### Tests Unitarios (Prompts)
```typescript
// __tests__/templates/[nombre]-playbook.test.ts
- Variables requeridas definidas
- Prompts contienen todas las variables
- Steps ordenados correctamente
- auto_receive_from referencia steps válidos
```

### Tests de Integración
```typescript
// __tests__/integration/[nombre]-playbook.test.ts
- Step ejecuta y genera output
- Output se guarda en playbook_step_outputs
- Variables se sustituyen correctamente
```

### Checklist Manual de Verificación
```markdown
### Pre-Deploy
- [ ] Template compila sin errores
- [ ] Config visual registrada
- [ ] Migraciones creadas

### UI
- [ ] Playbook aparece en lista
- [ ] Wizard de variables funciona
- [ ] Navegación entre fases funciona

### Ejecución
| Step | Ejecuta | Output OK | Guarda DB |
|------|---------|-----------|-----------|
| 1 | [ ] | [ ] | [ ] |

### Flujo Completo
- [ ] Outputs se transfieren entre steps
- [ ] Export final funciona
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

### Decisión de Gaps

```
Gap crítico?
  ├─ No → Workaround + Issue
  └─ Sí → Esfuerzo < 4h?
           ├─ Sí → Desarrollar inline
           └─ No → Issue + Pausar conversión
```

---

## Archivos Críticos de Referencia

1. **[docs/playbook-templates.md](docs/playbook-templates.md)** - Guía maestra para crear playbooks
2. **[src/lib/templates/signal-based-outreach-playbook.ts](src/lib/templates/signal-based-outreach-playbook.ts)** - Ejemplo completo (11 pasos)
3. **[src/components/playbook/types.ts](src/components/playbook/types.ts)** - Define StepType, ExecutorType
4. **[src/components/playbook/configs/niche-finder.config.ts](src/components/playbook/configs/niche-finder.config.ts)** - Ejemplo de config visual

---

## Próximos Pasos

### Inmediato (al aprobar el plan)
1. **Crear documentación permanente** → Guardar este proceso en `docs/n8n-to-gattaca-process.md`

### Caso de Prueba
2. Recibir el JSON del workflow de n8n + URL de explicación
3. Ejecutar Fase 1: Análisis del workflow
4. Ejecutar Fase 2: Generar PRD intermedio
5. Ejecutar Fase 3: Gap Analysis
6. Decidir si proceder con implementación o desarrollar funcionalidades faltantes
7. Ejecutar Fase 4: Implementación del playbook
8. Ejecutar Fase 5: Verificación y testing

---

## Riesgos Identificados

| Riesgo | Mitigación |
|--------|------------|
| Workflow usa nodo sin equivalente | Gap analysis temprano + workaround |
| Prompts de n8n muy simples | Enriquecer con contexto de Gattaca |
| Lógica condicional compleja | Convertir IF automático → decisión usuario |
| Credenciales externas | Usar tabla user_api_keys existente |
| Loops/iteraciones | Procesar batch con LLM o job |
