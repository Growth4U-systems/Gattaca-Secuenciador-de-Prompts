/**
 * Signal-Based Outreach Playbook Template
 * LinkedIn outreach using creator discovery + viral post signals + lead magnet
 *
 * FLUJO EN 3 FASES:
 * - FASE 1: Discovery de Creadores (pasos 1-4)
 * - FASE 2: Discovery de Posts (pasos 5-7)
 * - FASE 3: Leads + Outreach (pasos 8-11)
 *
 * Owner: Growth4U (Martin)
 */

import type { PlaybookTemplate, VariableDefinition } from './types'
import type { FlowStep } from '@/types/flow.types'

// ============================================
// FASE 1: DISCOVERY DE CREADORES
// ============================================

export const STEP_1_VALUE_PROP_TOPICS_PROMPT = `Actúa como un experto en estrategia de contenido y segmentación de audiencias.

**Contexto del Cliente:**
- Cliente: {{client_name}}
- Propuesta de valor: {{value_proposition}}
- ICP (Ideal Customer Profile): {{icp_description}}
- Industria: {{industry}}
- País: {{country}}

**Tu Objetivo:**
Mapear la propuesta de valor del cliente a un ecosistema de temas de contenido que atraigan al ICP. No solo el tema principal, sino también temas adyacentes y tangencialmente relacionados.

**Ejemplo:**
Si el cliente es un asesor financiero:
- Tema principal: finanzas personales, inversiones
- Temas adyacentes: bienestar financiero, libertad financiera
- Temas tangenciales: productividad, autosuperación, bienestar personal, emprendimiento

**OUTPUT FORMAT:**

## Mapeo de Propuesta de Valor → Temas

### Propuesta de Valor Analizada
**Problema que resuelve:** ...
**Beneficio principal:** ...
**Diferenciador clave:** ...

### Tema Principal
| Tema | Relevancia | Por qué atrae al ICP |
|------|------------|----------------------|
| ... | ⭐⭐⭐⭐⭐ | ... |

### Temas Adyacentes (Alta Relevancia)
| Tema | Relevancia | Conexión con propuesta de valor |
|------|------------|--------------------------------|
| ... | ⭐⭐⭐⭐ | ... |

### Temas Tangenciales (Media Relevancia)
| Tema | Relevancia | Por qué el ICP los consume |
|------|------------|---------------------------|
| ... | ⭐⭐⭐ | ... |

### Keywords y Hashtags por Tema
| Tema | Keywords ES | Keywords EN | Hashtags |
|------|-------------|-------------|----------|
| Principal | | | |
| Adyacente 1 | | | |
| Adyacente 2 | | | |
| Tangencial 1 | | | |

### Perfil de Contenido del ICP
- **Qué tipo de contenido consume:** ...
- **En qué formato prefiere:** (posts largos, carruseles, videos, etc.)
- **Qué tono resuena:** (profesional, casual, inspiracional, educativo)
- **Cuándo está más activo:** (horarios, días)`

export const STEP_2_SEARCH_CREATORS_PROMPT = `Actúa como un experto en LinkedIn y research de influencers B2B.

**Contexto:**
- Cliente: {{client_name}}
- ICP: {{icp_description}}
- Industria: {{industry}}
- País: {{country}}
- Creadores conocidos (input del usuario): {{known_creators}}

**Temas identificados (paso anterior):**
{{previous_step_output}}

**Tu Objetivo:**
Generar una estrategia completa para encontrar creadores de contenido en LinkedIn cuya audiencia coincida con el ICP del cliente.

**Métodos de Búsqueda a Cubrir:**
1. Búsqueda manual en LinkedIn (queries específicos)
2. Queries para Perplexity/búsqueda web
3. Configuración de scrapers (Apify/Phantombuster)
4. Análisis de creadores conocidos para encontrar similares

**OUTPUT FORMAT:**

## Estrategia de Búsqueda de Creadores

### 1. Búsqueda Manual en LinkedIn
**Queries de búsqueda por tema:**
| Tema | Query LinkedIn | Filtros sugeridos |
|------|----------------|-------------------|
| ... | "..." | Ubicación: {{country}}, Conexiones: 5K+ |

**Hashtags a explorar:**
- #... → buscar top posts y ver quién los escribió

### 2. Queries para Perplexity / Web Search
\`\`\`
"Top LinkedIn influencers [tema] [país] 2025"
"Creadores de contenido LinkedIn [industria] español"
"LinkedIn creators [ICP topic] most followed"
"Mejores perfiles LinkedIn sobre [tema]"
\`\`\`

### 3. Configuración de Scrapers

#### Apify: LinkedIn Profile Scraper
\`\`\`json
{
  "searchUrl": "https://www.linkedin.com/search/results/people/?keywords=[tema]&origin=GLOBAL_SEARCH_HEADER",
  "maxProfiles": 50,
  "filters": {
    "connections": "2nd",
    "locations": ["{{country}}"]
  }
}
\`\`\`

#### Phantombuster: LinkedIn Search Export
\`\`\`
Search URL: [URL de búsqueda LinkedIn]
Number of profiles: 50
Session cookie: [requerido]
\`\`\`

### 4. Análisis de Creadores Conocidos
**Creadores base para análisis:**
{{known_creators}}

**Para cada creador conocido, buscar:**
- Quién comenta frecuentemente en sus posts
- A quién mencionan o repostean
- Colaboraciones y podcasts
- Autores citados en sus posts

### 5. Lista Inicial de Creadores Candidatos
| # | Nombre | LinkedIn URL | Tema principal | Seguidores (est.) | Prioridad |
|---|--------|--------------|----------------|-------------------|-----------|
| 1 | | | | | Alta |
| 2 | | | | | Alta |
| 3 | | | | | Media |
| ... | | | | | |

### 6. Próximos Pasos
1. Ejecutar búsquedas manuales → agregar a lista
2. Correr queries en Perplexity → agregar sugerencias
3. Ejecutar scrapers → importar resultados
4. Evaluar cada creador (siguiente paso)`

export const STEP_3_EVALUATE_CREATORS_PROMPT = `Actúa como un experto en análisis de influencers y marketing de contenidos.

**Contexto:**
- Cliente: {{client_name}}
- ICP: {{icp_description}}
- Propuesta de valor: {{value_proposition}}

**Creadores candidatos (paso anterior):**
{{previous_step_output}}

**Tu Objetivo:**
Crear un sistema de evaluación para determinar qué creadores vale la pena scrapear. El objetivo es identificar creadores cuya audiencia tenga alta probabilidad de coincidir con el ICP.

**Criterios Clave:**
1. **Actividad**: ¿Publica regularmente? (mínimo 2-3 posts/semana)
2. **Viralidad**: ¿Sus posts tienen buen engagement? (>50 interacciones promedio)
3. **Alineamiento temático**: ¿Habla de temas relevantes para el ICP?
4. **Calidad de audiencia**: ¿Quiénes comentan? ¿Son del ICP?

**OUTPUT FORMAT:**

## Sistema de Evaluación de Creadores

### Checklist de Evaluación Rápida (5 min por creador)

#### Datos a Obtener
| Dato | Cómo obtenerlo | Mínimo aceptable |
|------|----------------|------------------|
| Seguidores | Perfil LinkedIn | >5,000 |
| Posts/mes | Scroll en actividad | >8 posts |
| Avg likes | Revisar últimos 5 posts | >50 |
| Avg comentarios | Revisar últimos 5 posts | >10 |
| Temas que cubre | Revisar últimos 10 posts | ≥2 temas relevantes |

#### Scorecard por Creador

| Criterio | Peso | Score 1-5 | Cómo evaluar |
|----------|------|-----------|--------------|
| Actividad (posts/mes) | 20% | | >12=5, 8-12=4, 4-8=3, 2-4=2, <2=1 |
| Viralidad (avg engagement) | 25% | | >200=5, 100-200=4, 50-100=3, 20-50=2, <20=1 |
| Alineamiento temático | 30% | | Directo=5, Adyacente=4, Tangencial=3, Parcial=2, Bajo=1 |
| Calidad audiencia | 25% | | >70% ICP=5, 50-70%=4, 30-50%=3, 10-30%=2, <10%=1 |

**Score mínimo para scrapear:** 3.5/5

### Template de Evaluación Individual

\`\`\`markdown
## Creador: [Nombre]
**LinkedIn:** [URL]
**Seguidores:** X

### Métricas de Actividad
- Posts último mes: X
- Avg likes: X
- Avg comentarios: X
- Post más viral reciente: [URL] (X likes, X comentarios)

### Análisis de Contenido
- Temas principales: ...
- Formato preferido: (texto largo, carrusel, video)
- Tono: (educativo, inspiracional, polémico)

### Análisis de Audiencia (revisar 10 comentaristas)
| Comentarista | Cargo | Empresa | ¿Es ICP? |
|--------------|-------|---------|----------|
| | | | ✅/❌ |
| | | | ✅/❌ |
...
**% ICP estimado:** X%

### Scores
| Criterio | Score |
|----------|-------|
| Actividad | /5 |
| Viralidad | /5 |
| Alineamiento | /5 |
| Calidad audiencia | /5 |
| **TOTAL PONDERADO** | /5 |

### Decisión
⬜ ✅ SCRAPEAR - Alta probabilidad de ICP
⬜ ⚠️ REVISAR - Necesita más análisis
⬜ ❌ DESCARTAR - No alineado
\`\`\`

### Creadores Evaluados

| # | Creador | Score | Decisión | Notas |
|---|---------|-------|----------|-------|
| 1 | | /5 | | |
| 2 | | /5 | | |
| 3 | | /5 | | |`

export const STEP_4_SELECT_CREATORS_PROMPT = `Actúa como un gestor de proyecto de growth marketing.

**Contexto:**
- Cliente: {{client_name}}
- Objetivo de leads: {{target_leads_count}}

**Creadores evaluados (paso anterior):**
{{previous_step_output}}

**Tu Objetivo:**
Consolidar la lista final de creadores seleccionados, priorizarlos, y preparar la documentación para guardar en la base de conocimiento del proyecto.

**OUTPUT FORMAT:**

## Creadores Seleccionados para Scraping

### Resumen Ejecutivo
- **Total creadores evaluados:** X
- **Creadores seleccionados:** X
- **Creadores descartados:** X
- **Leads potenciales estimados:** X (basado en avg engagement)

### Lista Final Priorizada

| Prioridad | Creador | LinkedIn URL | Score | Tema | Est. Leads/post | Acción |
|-----------|---------|--------------|-------|------|-----------------|--------|
| 🥇 1 | | | /5 | | ~X | Scrapear primero |
| 🥈 2 | | | /5 | | ~X | |
| 🥉 3 | | | /5 | | ~X | |
| 4 | | | /5 | | ~X | |
| 5 | | | /5 | | ~X | |

### Registro para Base de Conocimiento

\`\`\`json
{
  "creators": [
    {
      "name": "",
      "linkedin_url": "",
      "followers": 0,
      "avg_engagement": 0,
      "topics": ["", ""],
      "icp_match_score": 0,
      "status": "selected",
      "priority": 1,
      "notes": ""
    }
  ],
  "selection_date": "{{date}}",
  "campaign": "{{client_name}} - Signal Based Outreach"
}
\`\`\`

### Próximos Pasos por Creador

| Creador | Paso siguiente | Responsable | Deadline |
|---------|----------------|-------------|----------|
| [1] | Scrapear últimos 20 posts | | |
| [2] | Scrapear últimos 20 posts | | |
| [3] | Esperar evaluación de posts de [1] y [2] | | |

### Notas para el Equipo
- **Creadores backup:** [lista de creadores con score 3.0-3.5 por si se necesitan más]
- **Creadores a monitorear:** [creadores prometedores pero con poca data actual]
- **Alerta:** [cualquier riesgo identificado]`

// ============================================
// FASE 2: DISCOVERY DE POSTS
// ============================================

export const STEP_5_SCRAPE_CREATOR_POSTS_PROMPT = `Actúa como un experto en automatización y scraping de LinkedIn.

**Contexto:**
- Creador a scrapear: {{current_creator_name}} ({{current_creator_url}})
- Herramienta: {{scraping_tool}}

**Creadores seleccionados (paso anterior):**
{{previous_step_output}}

**Tu Objetivo:**
Configurar y documentar el proceso de scraping de posts para el creador seleccionado.

**OUTPUT FORMAT:**

## Scraping de Posts: {{current_creator_name}}

### Configuración del Scraper

#### Apify: LinkedIn Profile Scraper
\`\`\`json
{
  "profileUrls": ["{{current_creator_url}}"],
  "scrapeActivities": true,
  "maxActivities": 30,
  "activityTypes": ["post"],
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
\`\`\`

#### Phantombuster: LinkedIn Activity Extractor
\`\`\`
Profile URL: {{current_creator_url}}
Number of activities: 30
Activity type: Posts only
Session cookie: [requerido]
\`\`\`

### Campos a Extraer por Post
| Campo | Descripción | Uso |
|-------|-------------|-----|
| post_url | URL del post | Scraping de engagers |
| post_date | Fecha de publicación | Filtrar recientes |
| post_text | Texto del post (primeros 500 chars) | Contexto para mensajes |
| likes_count | Número de likes | Filtrar por tracción |
| comments_count | Número de comentarios | Filtrar por engagement |
| reposts_count | Número de reposts | Señal de viralidad |
| post_type | Tipo (texto, carrusel, video, etc.) | Análisis |

### Proceso de Ejecución
1. [ ] Configurar actor/automation con los parámetros
2. [ ] Ejecutar scraping
3. [ ] Descargar resultados (JSON/CSV)
4. [ ] Importar a tabla de Posts del proyecto
5. [ ] Verificar que los datos están completos

### Output Esperado
- **Posts scrapeados:** ~30
- **Formato:** CSV/JSON
- **Tiempo estimado:** 5-10 minutos

### Troubleshooting
| Problema | Causa probable | Solución |
|----------|----------------|----------|
| 0 resultados | Perfil privado o bloqueado | Verificar URL, cambiar cuenta |
| Datos incompletos | Rate limit | Esperar 1h, reducir velocidad |
| Error de login | Cookie expirada | Actualizar session cookie |`

export const STEP_6_EVALUATE_POSTS_PROMPT = `Actúa como un analista de contenido especializado en LinkedIn engagement.

**Contexto:**
- Cliente: {{client_name}}
- ICP: {{icp_description}}
- Creador: {{current_creator_name}}

**Posts scrapeados (paso anterior o importados):**
{{previous_step_output}}

**Tu Objetivo:**
Evaluar los posts scrapeados y seleccionar los mejores candidatos para scrapear sus engagers.

**Criterios de Selección:**
1. **Tracción mínima:** ≥40 interacciones (likes + comentarios)
2. **Recencia:** Preferir posts de últimos 30 días
3. **Tema alineado:** Relevante para el ICP
4. **Calidad de comentarios:** Revisar si los comentaristas parecen ICP
5. **Tipo de contenido:** Preferir posts que generan debate

**OUTPUT FORMAT:**

## Evaluación de Posts: {{current_creator_name}}

### Resumen de Posts Scrapeados
- **Total posts:** X
- **Posts con ≥40 interacciones:** X
- **Posts últimos 30 días:** X
- **Posts candidatos:** X

### Ranking de Posts

| # | Post URL | Fecha | Likes | Comments | Total | Tema | Score | Decisión |
|---|----------|-------|-------|----------|-------|------|-------|----------|
| 1 | [URL] | | | | | | /10 | ✅ Scrapear |
| 2 | [URL] | | | | | | /10 | ✅ Scrapear |
| 3 | [URL] | | | | | | /10 | ⚠️ Revisar |
| 4 | [URL] | | | | | | /10 | ❌ Skip |

### Evaluación Detallada de Top 5

#### Post #1
- **URL:** [link]
- **Fecha:**
- **Engagement:** X likes, X comments
- **Tema:**
- **Texto (resumen):** "..."
- **Muestra de comentaristas:**
  | Nombre | Cargo | ¿ICP? |
  |--------|-------|-------|
  | | | ✅/❌ |
  | | | ✅/❌ |
- **% ICP estimado:** X%
- **Decisión:** ✅ SCRAPEAR

[Repetir para posts 2-5]

### Posts Seleccionados para Scraping

| # | Post URL | Engagement | Est. Leads ICP | Prioridad |
|---|----------|------------|----------------|-----------|
| 1 | | | ~X | 🥇 |
| 2 | | | ~X | 🥈 |
| 3 | | | ~X | 🥉 |

### Métricas del Creador
- **Total leads potenciales:** ~X (sumando engagement de posts seleccionados)
- **% ICP estimado promedio:** X%
- **Leads ICP estimados:** ~X
- **Calidad del creador confirmada:** ✅/❌`

export const STEP_7_SELECT_POSTS_PROMPT = `Actúa como un coordinador de campaña de outreach.

**Contexto:**
- Cliente: {{client_name}}
- Objetivo total de leads: {{target_leads_count}}
- Leads ICP objetivo: {{target_leads_count}} × 50% = X

**Posts evaluados (pasos anteriores):**
{{previous_step_output}}

**Tu Objetivo:**
Consolidar los posts seleccionados de todos los creadores evaluados y preparar la lista final para scraping de engagers.

**OUTPUT FORMAT:**

## Posts Seleccionados para Scraping de Engagers

### Resumen por Creador

| Creador | Posts evaluados | Posts seleccionados | Est. Leads | Est. ICP |
|---------|-----------------|---------------------|------------|----------|
| [Creador 1] | X | X | X | X |
| [Creador 2] | X | X | X | X |
| **TOTAL** | | | | |

### Lista Consolidada de Posts

| # | Creador | Post URL | Engagement | Tema | Est. ICP | Status |
|---|---------|----------|------------|------|----------|--------|
| 1 | | | | | | Pendiente |
| 2 | | | | | | Pendiente |
| 3 | | | | | | Pendiente |
| ... | | | | | | |

### Plan de Scraping

**Orden de ejecución:**
1. Posts con mayor engagement primero
2. Diversificar creadores (no scrapear todos de uno solo)
3. Pausar si alcanzamos objetivo de leads ICP

**Batches sugeridos:**
| Batch | Posts | Est. Leads | Cuándo ejecutar |
|-------|-------|------------|-----------------|
| 1 | 3-5 posts top | ~X | Inmediato |
| 2 | 3-5 posts | ~X | Si batch 1 < objetivo |
| 3 | Resto | ~X | Solo si necesario |

### Tracking de Progreso

| Creador | Posts totales | Posts scrapeados | Leads obtenidos | Leads ICP |
|---------|---------------|------------------|-----------------|-----------|
| | | 0 | 0 | 0 |
| | | 0 | 0 | 0 |
| **TOTAL** | | 0 | 0 | 0 |

### Siguiente Creador a Procesar
Si se necesitan más leads después de scrapear estos posts:
- **Creador siguiente:** [nombre]
- **Razón:** [por qué está en cola]
- **Acción:** Volver al Paso 5 con este creador`

// ============================================
// FASE 3: LEADS + OUTREACH
// ============================================

export const STEP_8_SCRAPE_ENGAGERS_PROMPT = `Actúa como un experto en scraping y automatización.

**Contexto:**
- Posts a scrapear: [lista de URLs]
- Herramienta: {{scraping_tool}}
- Objetivo: {{target_leads_count}} leads

**Posts seleccionados (paso anterior):**
{{previous_step_output}}

**Tu Objetivo:**
Configurar y ejecutar el scraping de personas que interactuaron (liked, comentaron, repostearon) con los posts seleccionados.

**OUTPUT FORMAT:**

## Scraping de Engagers

### Configuración por Herramienta

#### Apify: LinkedIn Post Reactions Scraper
\`\`\`json
{
  "postUrls": [
    "URL_POST_1",
    "URL_POST_2",
    "URL_POST_3"
  ],
  "maxReactions": 500,
  "includeComments": true,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
\`\`\`

#### Phantombuster: LinkedIn Post Likers
\`\`\`
Post URL: [una URL por ejecución]
Number of likers: 200
Session cookie: [requerido]
\`\`\`

### Campos a Extraer por Engager
| Campo | Descripción | Prioridad |
|-------|-------------|-----------|
| linkedin_url | URL del perfil | ✅ Esencial |
| full_name | Nombre completo | ✅ Esencial |
| first_name | Primer nombre | ✅ Esencial |
| last_name | Apellido | ✅ Esencial |
| title | Cargo actual | ✅ Esencial |
| company | Empresa | ✅ Esencial |
| location | Ubicación | ⚠️ Importante |
| interaction_type | like/comment/repost | ✅ Esencial |
| comment_text | Texto del comentario | ⚠️ Si aplica |
| source_post_url | URL del post origen | ✅ Esencial |

### Plan de Ejecución

| # | Post URL | Herramienta | Max perfiles | Status |
|---|----------|-------------|--------------|--------|
| 1 | | Apify | 500 | Pendiente |
| 2 | | Apify | 500 | Pendiente |
| 3 | | Apify | 500 | Pendiente |

### Post-Scraping
1. [ ] Descargar todos los CSVs/JSONs
2. [ ] Consolidar en un solo archivo
3. [ ] Eliminar duplicados (por linkedin_url)
4. [ ] Agregar columna "campaign_id"
5. [ ] Importar a BBDD del proyecto

### Output Esperado
- **Leads brutos totales:** ~X
- **Leads únicos (sin duplicados):** ~X
- **Formato:** CSV consolidado`

export const STEP_9_FILTER_ICP_PROMPT = `Actúa como un experto en segmentación B2B y calificación de leads.

**Contexto:**
- Cliente: {{client_name}}
- ICP: {{icp_description}}
- Industria: {{industry}}
- País: {{country}}

**Leads scrapeados (paso anterior):**
{{previous_step_output}}

**Tu Objetivo:**
Definir y aplicar filtros para clasificar los leads scrapeados en:
- ✅ **Dentro de ICP**: Alta prioridad para outreach
- ⚠️ **Dudoso**: Requiere revisión manual
- ❌ **Fuera de ICP**: Excluir

**OUTPUT FORMAT:**

## Filtrado de Leads por ICP

### Filtros Definidos

#### Por Cargo (Title)
| Categoría | Incluir | Excluir |
|-----------|---------|---------|
| **Principal** | Growth Manager, Head of Growth, VP Growth | Intern, Student, Retired |
| **Secundario** | Marketing Manager, CMO, Founder | HR, Legal, Finance (no relacionado) |
| **Keywords** | growth, marketing, revenue, acquisition | support, admin, assistant |

#### Por Industria/Empresa
| Incluir | Excluir |
|---------|---------|
| SaaS, Tech, E-commerce, Fintech | Government, NGO, Education (salvo EdTech) |
| Startups, Scale-ups, Enterprise | Recruitment agencies |

#### Por Geografía
| Incluir | Excluir |
|---------|---------|
| {{country}} | Países fuera de scope |
| [Países adicionales] | |

#### Por Señal de Intención
| Señal | Peso | Score |
|-------|------|-------|
| Comentó con pregunta | +5 | Alta intención |
| Comentó (cualquier texto) | +3 | Buena intención |
| Reposteó | +2 | Interés activo |
| Like/Reacción | +1 | Interés pasivo |

### Reglas de Clasificación

\`\`\`
SI (cargo_match AND industria_match AND pais_match) → ✅ DENTRO ICP
SI (cargo_match OR industria_match) AND pais_match → ⚠️ DUDOSO
SI (cargo_excluido OR industria_excluida) → ❌ FUERA ICP
\`\`\`

### Resultados del Filtrado

| Clasificación | Cantidad | % del Total |
|---------------|----------|-------------|
| ✅ Dentro ICP | X | X% |
| ⚠️ Dudoso | X | X% |
| ❌ Fuera ICP | X | X% |
| **TOTAL** | X | 100% |

### Sample de Leads ICP (Top 10)

| Nombre | Cargo | Empresa | Interacción | Score |
|--------|-------|---------|-------------|-------|
| | | | | |

### Leads Dudosos a Revisar

| Nombre | Cargo | Empresa | Por qué dudoso | Decisión |
|--------|-------|---------|----------------|----------|
| | | | | ⬜ ICP / ⬜ Excluir |

### Métricas Finales
- **Leads ICP confirmados:** X
- **Objetivo:** {{target_leads_count}}
- **% del objetivo alcanzado:** X%
- **Acción si < 100%:** Scrapear más posts o creadores`

export const STEP_10_LEAD_MAGNET_MESSAGES_PROMPT = `Actúa como un experto en copywriting de outreach y content marketing.

**Contexto:**
- Cliente: {{client_name}}
- ICP: {{icp_description}}
- Propuesta de valor: {{value_proposition}}
- Problema que resuelve: {{problem_core}}
- Lead Magnet: {{lead_magnet_name}} (formato: {{lead_magnet_format}})

**Datos de pasos anteriores:**
{{previous_step_output}}

**Tu Objetivo:**
1. Diseñar el lead magnet ideal para esta campaña
2. Crear templates de mensajes personalizados por tipo de interacción

**OUTPUT FORMAT:**

## Estrategia de Lead Magnet

### Lead Magnet Diseñado
**Nombre:** [Título atractivo y específico]
**Formato:** {{lead_magnet_format}}
**Tiempo de consumo:** 5-10 minutos

### Propuesta de Valor del Lead Magnet
**Hook (una línea):** "..."
**Problema que resuelve:** ...
**Beneficio inmediato:** ...
**Por qué es relevante a los posts:** ...

### Estructura del Contenido
1. [Sección 1]: ...
2. [Sección 2]: ...
3. [Sección 3]: ...
4. [CTA suave hacia cliente]: ...

### Checklist de Producción
- [ ] Crear estructura en {{lead_magnet_format}}
- [ ] Escribir contenido
- [ ] Diseñar/formatear
- [ ] Generar link público
- [ ] Testear acceso desde incógnito

---

## Templates de Mensajes

### Template 1: Comentaristas (máxima personalización)
**Uso:** Leads que comentaron en el post
**Personalización:** [nombre], [cargo], [comentario parafraseado]

\`\`\`
Hola [nombre],

Vi tu comentario en el post de [autor] sobre [tema] — [reacción específica a su comentario].

Como [cargo], seguro te interesa [beneficio del lead magnet].

Armé [tipo de recurso] sobre [tema específico] que creo te va a servir: [link]

Es gratis, sin email ni nada. ¿Te interesa?

[Tu nombre]
\`\`\`

### Template 2: Likes/Reacciones
**Uso:** Leads que solo dieron like
**Personalización:** [nombre], [cargo], [empresa]

\`\`\`
Hola [nombre],

Vi que te gustó el post sobre [tema] de [autor].

Casualmente, acabo de armar un [tipo de recurso] sobre [beneficio] que complementa ese contenido: [link]

¿Te lo comparto?

[Tu nombre]
\`\`\`

### Template 3: Reposts
**Uso:** Leads que compartieron el post

\`\`\`
Hola [nombre],

Vi que compartiste el post de [autor] sobre [tema] — claramente es algo que te importa.

Tengo un [tipo de recurso] que va más profundo en [aspecto específico]: [link]

¿Te sirve?

[Tu nombre]
\`\`\`

### Template 4: Follow-up (7 días sin respuesta)

\`\`\`
Hola [nombre],

Te escribí la semana pasada sobre [tema del lead magnet].

¿Llegaste a verlo? Me encantaría saber si te sirvió.

[Tu nombre]
\`\`\`

### Reglas de Personalización
| Condición | Ajuste |
|-----------|--------|
| Comentario >20 palabras | Citar parte específica |
| Cargo C-level/Director | Tono más ejecutivo |
| Startup (<50 emp) | Mencionar agilidad |
| Enterprise (>500 emp) | Mencionar escalabilidad |
| Mismo país que cliente | Usar español local |

### Variables para Automatización
| Variable | Fuente | Ejemplo |
|----------|--------|---------|
| {{nombre}} | Scraping: first_name | "María" |
| {{cargo}} | Scraping: title | "Head of Growth" |
| {{empresa}} | Scraping: company | "Startup X" |
| {{comentario}} | Scraping: comment_text | "Muy útil" |
| {{autor_post}} | Fijo por post | "Juan García" |
| {{tema_post}} | Fijo por post | "productividad" |
| {{lead_magnet_link}} | Fijo | "notion.so/..." |`

export const STEP_11_EXPORT_LAUNCH_PROMPT = `Actúa como un experto en operaciones de sales y automatización.

**Contexto:**
- Campaña: {{client_name}} - Signal-Based Outreach
- Leads ICP listos: [cantidad del paso anterior]
- Herramienta de outreach: {{outreach_tool}}

**Datos de pasos anteriores:**
{{previous_step_output}}

**Tu Objetivo:**
Preparar el export final y las instrucciones de lanzamiento de la campaña.

**OUTPUT FORMAT:**

## Export Final y Lanzamiento

### Estructura del CSV Final

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| linkedin_url | URL perfil | linkedin.com/in/maria |
| first_name | Nombre | María |
| last_name | Apellido | García |
| full_name | Nombre completo | María García |
| title | Cargo | Head of Growth |
| company | Empresa | Startup X |
| location | Ubicación | Madrid, Spain |
| interaction_type | Tipo | comment |
| comment_text | Comentario | "Muy útil..." |
| source_post | Post origen | linkedin.com/posts/... |
| source_creator | Creador del post | Juan Pérez |
| campaign_id | ID campaña | signal-{{client_name}}-001 |
| message | Mensaje personalizado | "Hola María..." |
| icp_score | Score | 8/10 |
| status | Estado | pending |
| sent_date | Fecha envío | (vacío) |
| response | Respuesta | (vacío) |

### Validación Pre-Launch

| Check | Status | Notas |
|-------|--------|-------|
| Total leads ICP | X | |
| Leads con mensaje generado | X | |
| Lead magnet publicado | ⬜ | [link] |
| Link testeado | ⬜ | |
| Mensajes revisados (10%) | ⬜ | |
| Cuenta LinkedIn lista | ⬜ | |
| Límites diarios definidos | ⬜ | |

### Plan de Envío

#### Límites Diarios (LinkedIn)
| Acción | Límite seguro | Máximo |
|--------|---------------|--------|
| Connection requests | 20-25/día | 50/día |
| Messages (conexiones) | 50/día | 100/día |
| InMails | Según plan | Variable |

#### Secuencia
| Día | Acción | Target |
|-----|--------|--------|
| 0 | Enviar mensaje inicial | 100% leads |
| 7 | Follow-up #1 | No respondieron |
| 14 | Follow-up #2 (opcional) | No respondieron |

#### Calendario de Envío
| Semana | Leads a contactar | Acumulado |
|--------|-------------------|-----------|
| 1 | 100-150 | 100-150 |
| 2 | 100-150 | 200-300 |
| 3 | Resto | Total |

### Instrucciones de Ejecución

#### Para Outreach Manual
1. Descargar CSV final
2. Abrir en Google Sheets
3. Filtrar por status = "pending"
4. Ordenar por icp_score (mayor primero)
5. Por cada lead:
   - Copiar mensaje de columna "message"
   - Enviar en LinkedIn
   - Marcar status = "sent"
   - Agregar fecha en sent_date
6. Máximo 25-30 envíos/día

#### Para Herramienta de Automatización ({{outreach_tool}})
1. Importar CSV
2. Mapear campos:
   - linkedin_url → Profile URL
   - first_name → First Name
   - message → Message Content
3. Configurar secuencia (Día 0, Día 7)
4. Activar campaña

### Tracking de Resultados

| Métrica | Target | Actual | Status |
|---------|--------|--------|--------|
| Mensajes enviados | X | 0 | 🔴 |
| Tasa de respuesta | >15% | 0% | 🔴 |
| Respuestas positivas | >5% | 0% | 🔴 |
| Reuniones agendadas | X | 0 | 🔴 |

### Notas de Campaña
- **Lead Magnet URL:** [link]
- **Creadores usados:** [lista]
- **Posts scrapeados:** [cantidad]
- **Fecha inicio:** [fecha]
- **Responsable:** [nombre]
- **Próxima revisión:** [fecha + 1 semana]`

// ============================================
// VARIABLE DEFINITIONS
// ============================================

export const SIGNAL_OUTREACH_VARIABLE_DEFINITIONS: VariableDefinition[] = [
  // Variables esenciales
  {
    name: 'client_name',
    default_value: '',
    required: true,
    description: 'Nombre del cliente o empresa para la campaña',
  },
  {
    name: 'value_proposition',
    default_value: '',
    required: true,
    description: 'Propuesta de valor del cliente: qué problema resuelve y para quién',
  },
  {
    name: 'icp_description',
    default_value: '',
    required: true,
    description: 'Descripción del ICP: cargos objetivo, industria, características',
  },
  {
    name: 'industry',
    default_value: '',
    required: true,
    description: 'Industria o sector objetivo',
  },
  {
    name: 'country',
    default_value: 'España',
    required: true,
    description: 'País objetivo para la campaña',
  },
  {
    name: 'problem_core',
    default_value: '',
    required: true,
    description: 'Problema/pain principal que resuelve el producto o servicio',
  },
  // Variables de discovery
  {
    name: 'known_creators',
    default_value: '',
    required: false,
    description: 'URLs de LinkedIn de creadores que ya conoces que atraen a tu ICP',
  },
  {
    name: 'adjacent_topics',
    default_value: '',
    required: false,
    description: 'Temas tangencialmente relacionados con la propuesta de valor',
  },
  // Variables de ejecución
  {
    name: 'current_creator_name',
    default_value: '',
    required: false,
    description: 'Nombre del creador que se está procesando actualmente',
  },
  {
    name: 'current_creator_url',
    default_value: '',
    required: false,
    description: 'URL de LinkedIn del creador que se está procesando',
  },
  // Variables de lead magnet
  {
    name: 'lead_magnet_name',
    default_value: '',
    required: false,
    description: 'Nombre del lead magnet a usar (si ya existe)',
  },
  {
    name: 'lead_magnet_format',
    default_value: 'Notion',
    required: false,
    description: 'Formato del lead magnet: Notion, PDF, Google Sheets, etc.',
  },
  // Variables operativas
  {
    name: 'target_leads_count',
    default_value: '500',
    required: false,
    description: 'Número objetivo de leads ICP por campaña',
  },
  {
    name: 'scraping_tool',
    default_value: 'Apify',
    required: false,
    description: 'Herramienta de scraping: Apify, Phantombuster, etc.',
  },
  {
    name: 'outreach_tool',
    default_value: 'Manual',
    required: false,
    description: 'Herramienta de outreach: Manual, Expandi, Dripify, etc.',
  },
]

// ============================================
// FLOW STEPS (11 pasos en 3 fases)
// ============================================

export const SIGNAL_OUTREACH_FLOW_STEPS: FlowStep[] = [
  // FASE 1: Discovery de Creadores
  {
    id: 'step-1-value-prop-topics',
    name: '1. Mapear Propuesta → Temas',
    order: 0,
    type: 'llm',
    prompt: STEP_1_VALUE_PROP_TOPICS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.7,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 1: Mapear propuesta de valor del cliente a temas de contenido (principal, adyacentes, tangenciales)',
    base_doc_ids: [],
    auto_receive_from: [],
    retrieval_mode: 'full',
  },
  {
    id: 'step-2-search-creators',
    name: '2. Buscar Creadores',
    order: 1,
    type: 'llm',
    prompt: STEP_2_SEARCH_CREATORS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.7,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 1: Estrategia de búsqueda de creadores (LinkedIn, Perplexity, scrapers)',
    base_doc_ids: [],
    auto_receive_from: ['step-1-value-prop-topics'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-3-evaluate-creators',
    name: '3. Evaluar Creadores',
    order: 2,
    type: 'llm',
    prompt: STEP_3_EVALUATE_CREATORS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 1: Evaluar creadores por actividad, viralidad y alineamiento con ICP',
    base_doc_ids: [],
    auto_receive_from: ['step-1-value-prop-topics', 'step-2-search-creators'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-4-select-creators',
    name: '4. Seleccionar Creadores',
    order: 3,
    type: 'llm',
    prompt: STEP_4_SELECT_CREATORS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.5,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 1: Lista final de creadores seleccionados para scrapear',
    base_doc_ids: [],
    auto_receive_from: ['step-3-evaluate-creators'],
    retrieval_mode: 'full',
  },
  // FASE 2: Discovery de Posts
  {
    id: 'step-5-scrape-posts',
    name: '5. Scrapear Posts del Creador',
    order: 4,
    type: 'llm',
    prompt: STEP_5_SCRAPE_CREATOR_POSTS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.5,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 2: Configuración de scraping de posts de un creador',
    base_doc_ids: [],
    auto_receive_from: ['step-4-select-creators'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-6-evaluate-posts',
    name: '6. Evaluar Posts',
    order: 5,
    type: 'llm',
    prompt: STEP_6_EVALUATE_POSTS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 2: Evaluar posts por tracción, tema y calidad de comentaristas',
    base_doc_ids: [],
    auto_receive_from: ['step-5-scrape-posts'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-7-select-posts',
    name: '7. Seleccionar Posts',
    order: 6,
    type: 'llm',
    prompt: STEP_7_SELECT_POSTS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.5,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 2: Lista consolidada de posts para scrapear engagers',
    base_doc_ids: [],
    auto_receive_from: ['step-6-evaluate-posts'],
    retrieval_mode: 'full',
  },
  // FASE 3: Leads + Outreach
  {
    id: 'step-8-scrape-engagers',
    name: '8. Scrapear Engagers',
    order: 7,
    type: 'llm',
    prompt: STEP_8_SCRAPE_ENGAGERS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.5,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 3: Configuración de scraping de personas que interactuaron con los posts',
    base_doc_ids: [],
    auto_receive_from: ['step-7-select-posts'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-9-filter-icp',
    name: '9. Filtrar por ICP',
    order: 8,
    type: 'llm',
    prompt: STEP_9_FILTER_ICP_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 3: Filtrar leads por cargo, industria, geografía y señales de intención',
    base_doc_ids: [],
    auto_receive_from: ['step-8-scrape-engagers'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-10-lead-magnet-messages',
    name: '10. Lead Magnet + Mensajes',
    order: 9,
    type: 'llm',
    prompt: STEP_10_LEAD_MAGNET_MESSAGES_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.8,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 3: Diseño del lead magnet y templates de mensajes personalizados',
    base_doc_ids: [],
    auto_receive_from: ['step-1-value-prop-topics', 'step-9-filter-icp'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-11-export-launch',
    name: '11. Export y Lanzamiento',
    order: 10,
    type: 'llm',
    prompt: STEP_11_EXPORT_LAUNCH_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.5,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'FASE 3: Preparar CSV final, validaciones y plan de lanzamiento',
    base_doc_ids: [],
    auto_receive_from: ['step-9-filter-icp', 'step-10-lead-magnet-messages'],
    retrieval_mode: 'full',
  },
]

// ============================================
// TEMPLATE EXPORT
// ============================================

export function getSignalBasedOutreachTemplate(): PlaybookTemplate {
  return {
    template_id: 'signal-based-outreach-v2',
    name: 'Signal-Based Outreach',
    description:
      'LinkedIn outreach usando señales de intención. Flujo completo en 3 fases: (1) Discovery de creadores cuya audiencia coincide con ICP, (2) Discovery de posts con alta tracción, (3) Scraping de engagers + mensajes personalizados con lead magnet.',
    playbook_type: 'signal_based_outreach',

    flow_config: {
      steps: SIGNAL_OUTREACH_FLOW_STEPS,
      version: '2.0.0',
      description:
        'Signal-Based LinkedIn Outreach - 11 steps in 3 phases: Creator Discovery → Post Discovery → Leads + Outreach',
    },

    variable_definitions: SIGNAL_OUTREACH_VARIABLE_DEFINITIONS,

    required_documents: {
      product: [
        'Descripción del producto/servicio',
        'Propuesta de valor detallada',
        'Case studies existentes',
        'Recursos de contenido existentes',
      ],
      competitor: [
        'Análisis de campañas de outreach de competidores (opcional)',
        'Benchmarks de tasas de respuesta del sector',
      ],
      research: [
        'Descripción detallada del ICP',
        'Lista de creadores conocidos que atraen al ICP',
        'Lead magnets existentes',
        'Mensajes de outreach que han funcionado',
      ],
    },

    campaign_docs_guide: `## Guía de Documentos para Signal-Based Outreach

### FASE 1: Discovery de Creadores

#### Paso 1: Mapear Propuesta → Temas
Sube documentos con **propuesta de valor**:
- Descripción del producto/servicio
- Problema principal que resuelves
- Quién es tu cliente ideal

#### Paso 2: Buscar Creadores
Sube si tienes:
- Lista de creadores que ya sigues
- Competidores cuya audiencia te interesa
- Hashtags/keywords que ya usas

#### Paso 3-4: Evaluar y Seleccionar Creadores
El sistema generará criterios de evaluación.
Opcionalmente:
- Perfiles de LinkedIn de creadores candidatos

### FASE 2: Discovery de Posts

#### Paso 5-7: Scrapear y Evaluar Posts
El sistema guiará el proceso de scraping.
Sube:
- URLs de posts que ya conoces (opcionales)
- Configuraciones de scrapers anteriores

### FASE 3: Leads + Outreach

#### Paso 8-9: Scrapear y Filtrar Leads
El sistema usará los filtros de ICP.
Sube si tienes:
- Criterios de calificación actuales
- Listas de empresas target/excluir

#### Paso 10: Lead Magnet + Mensajes
Sube **materiales de contenido**:
- Lead magnets existentes
- Mensajes de outreach que han funcionado
- Tono y voz de la marca

#### Paso 11: Export y Lanzamiento
El sistema generará el plan de lanzamiento.

---
💡 **Tip**: Incluir creadores conocidos y mensajes que han funcionado mejora significativamente la calidad del output.

📊 **Métricas objetivo**:
- % leads ICP: >50%
- % respuestas: >15%
- % respuestas positivas: >5%`,
  }
}
