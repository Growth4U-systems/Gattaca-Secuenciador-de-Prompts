# Signal-Based Outreach: Instructivo Operativo v2

## Guía práctica para ejecutar campañas de LinkedIn usando señales de intención

**Versión:** 2.0
**Fecha:** 2026-01-17
**Owner:** Growth4U

---

## Quick Start (TL;DR)

**¿Qué es?** Un sistema para hacer outreach en LinkedIn usando:
1. **Creadores de contenido** cuya audiencia coincide con tu ICP
2. **Señales de intención** (reacciones a posts virales)
3. **Lead magnet** como primer gesto de valor

**¿Por qué funciona?**
- Identificas creadores cuya audiencia ES tu ICP
- Contactas personas que ya mostraron interés en temas relevantes
- Tienes contexto compartido (el post, el creador)
- Ofreces valor primero (lead magnet), no pides reunión

**Resultado esperado:**
- De ~5% respuestas (outreach frío) a **>15% respuestas**
- De esas, **>30% positivas** (vs <10% en frío)

**Tiempo total:** ~2-3 días de trabajo estructurado para 500+ leads ICP

---

## Flujo Completo (11 Pasos en 3 Fases)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FASE 1: DISCOVERY DE CREADORES                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Mapear         2. Buscar        3. Evaluar       4. Seleccionar        │
│  Propuesta →       Creadores →      Creadores →      Creadores             │
│  Temas                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FASE 2: DISCOVERY DE POSTS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  5. Scrapear       6. Evaluar       7. Seleccionar                         │
│  Posts del    →    Posts       →    Posts                                  │
│  Creador           (loop por creador)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FASE 3: LEADS + OUTREACH                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  8. Scrapear   9. Filtrar    10. Lead Magnet   11. Export y                │
│  Engagers  →   ICP       →   + Mensajes    →   Lanzamiento                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# FASE 1: DISCOVERY DE CREADORES

## Paso 1: Mapear Propuesta de Valor → Temas

### Qué hacer
Traducir la propuesta de valor del cliente a un ecosistema de temas de contenido que atraigan al ICP.

### Por qué es importante
El ICP no solo consume contenido sobre el tema principal. También sigue temas **adyacentes** y **tangenciales**. Ampliar el radar aumenta el pool de creadores.

### Ejemplo
| Propuesta de Valor | Tema Principal | Temas Adyacentes | Temas Tangenciales |
|--------------------|----------------|------------------|-------------------|
| Asesor financiero | Finanzas personales | Bienestar financiero, libertad financiera | Productividad, autosuperación, emprendimiento |
| Software de growth | Product-led growth | Growth loops, métricas SaaS | Startups, liderazgo, trabajo remoto |
| Coaching ejecutivo | Liderazgo | Gestión de equipos, comunicación | Bienestar, mindfulness, productividad |

### Template de Mapeo

```markdown
## Mapeo de Propuesta → Temas

**Cliente:** [nombre]
**Propuesta de valor:** [qué problema resuelve y para quién]

### Temas Identificados

| Categoría | Temas | Keywords | Hashtags |
|-----------|-------|----------|----------|
| Principal | | | |
| Adyacente 1 | | | |
| Adyacente 2 | | | |
| Tangencial 1 | | | |
| Tangencial 2 | | | |
```

---

## Paso 2: Buscar Creadores

### Qué hacer
Generar una lista de creadores candidatos cuya audiencia podría coincidir con el ICP.

### Métodos de Búsqueda

#### 1. Búsqueda Manual en LinkedIn
```
Queries sugeridos:
- "[tema] site:linkedin.com/in"
- "Creator [industria] LinkedIn [país]"
- Explorar hashtags → ver quién escribe los posts top
```

#### 2. Perplexity / Web Search
```
Queries sugeridos:
- "Top LinkedIn influencers [tema] [país] 2025"
- "Creadores de contenido LinkedIn [industria] español"
- "Mejores perfiles LinkedIn sobre [tema]"
- "LinkedIn creators [ICP topic] most followed"
```

#### 3. Scrapers (Apify / Phantombuster)

**Apify: LinkedIn Profile Scraper**
```json
{
  "searchUrl": "https://www.linkedin.com/search/results/people/?keywords=[tema]",
  "maxProfiles": 50,
  "filters": {
    "connections": "2nd",
    "locations": ["España"]
  }
}
```

**Phantombuster: LinkedIn Search Export**
```
Search URL: [URL de búsqueda LinkedIn]
Number of profiles: 50
Session cookie: [requerido]
```

#### 4. Análisis de Creadores Conocidos
Si ya conoces creadores que atraen a tu ICP:
- Revisa quién comenta frecuentemente en sus posts
- Mira a quién mencionan o repostean
- Busca colaboraciones y podcasts

### Template de Lista de Creadores Candidatos

```markdown
## Creadores Candidatos

| # | Nombre | LinkedIn URL | Tema principal | Seguidores (est.) | Fuente | Status |
|---|--------|--------------|----------------|-------------------|--------|--------|
| 1 | | | | | Manual | Pendiente evaluar |
| 2 | | | | | Perplexity | Pendiente evaluar |
| 3 | | | | | Apify | Pendiente evaluar |
```

---

## Paso 3: Evaluar Creadores

### Qué hacer
Evaluar cada creador candidato para determinar si vale la pena scrapear sus posts.

### Criterios de Evaluación

| Criterio | Peso | Cómo evaluar | Mínimo aceptable |
|----------|------|--------------|------------------|
| **Actividad** | 20% | Posts/mes | ≥8 posts |
| **Viralidad** | 25% | Avg likes últimos 5 posts | ≥50 |
| **Alineamiento temático** | 30% | Revisar últimos 10 posts | ≥2 temas relevantes |
| **Calidad audiencia** | 25% | Revisar 10 comentaristas | ≥30% ICP |

### Sistema de Scoring

| Criterio | 5 puntos | 4 puntos | 3 puntos | 2 puntos | 1 punto |
|----------|----------|----------|----------|----------|---------|
| Actividad | >12 posts/mes | 8-12 | 4-8 | 2-4 | <2 |
| Viralidad | >200 avg | 100-200 | 50-100 | 20-50 | <20 |
| Alineamiento | Directo | Adyacente | Tangencial | Parcial | Bajo |
| Calidad aud. | >70% ICP | 50-70% | 30-50% | 10-30% | <10% |

**Score mínimo para scrapear:** 3.5/5 (ponderado)

### Checklist de Evaluación Rápida (5 min por creador)

- [ ] Abrir perfil de LinkedIn
- [ ] Anotar número de seguidores
- [ ] Contar posts del último mes
- [ ] Revisar últimos 5 posts → anotar avg likes
- [ ] Revisar últimos 10 posts → anotar temas
- [ ] Revisar 10 comentaristas → % dentro de ICP
- [ ] Calcular score ponderado
- [ ] Decisión: ✅ Scrapear / ⚠️ Revisar / ❌ Descartar

### Template de Evaluación

```markdown
## Evaluación: [Nombre del Creador]

**LinkedIn:** [URL]
**Seguidores:** X

### Métricas
| Dato | Valor |
|------|-------|
| Posts último mes | |
| Avg likes (5 posts) | |
| Avg comentarios | |
| Post más viral | [URL] |

### Análisis de Contenido
- **Temas principales:**
- **Formato preferido:** (texto, carrusel, video)
- **Tono:** (educativo, inspiracional, polémico)

### Análisis de Audiencia (10 comentaristas)
| Comentarista | Cargo | Empresa | ¿ICP? |
|--------------|-------|---------|-------|
| | | | ✅/❌ |
| | | | ✅/❌ |
| | | | ✅/❌ |
...
**% ICP estimado:** X%

### Scores
| Criterio | Peso | Score | Ponderado |
|----------|------|-------|-----------|
| Actividad | 20% | /5 | |
| Viralidad | 25% | /5 | |
| Alineamiento | 30% | /5 | |
| Calidad aud. | 25% | /5 | |
| **TOTAL** | 100% | | **/5** |

### Decisión
⬜ ✅ SCRAPEAR - Alta probabilidad de ICP
⬜ ⚠️ REVISAR - Necesita más análisis
⬜ ❌ DESCARTAR - No alineado
```

---

## Paso 4: Seleccionar Creadores

### Qué hacer
Consolidar la lista final de creadores y priorizarlos para el scraping.

### Criterios de Priorización

| Prioridad | Criterio |
|-----------|----------|
| 🥇 Alta | Score ≥4.0 + tema directo |
| 🥈 Media | Score 3.5-4.0 + tema adyacente |
| 🥉 Baja | Score 3.0-3.5 (backup) |

### Template de Lista Final

```markdown
## Creadores Seleccionados

**Total evaluados:** X
**Seleccionados:** X
**Descartados:** X

### Lista Priorizada

| Prioridad | Creador | LinkedIn URL | Score | Tema | Est. Leads/post |
|-----------|---------|--------------|-------|------|-----------------|
| 🥇 1 | | | /5 | | ~X |
| 🥈 2 | | | /5 | | ~X |
| 🥉 3 | | | /5 | | ~X |

### Creadores Backup
| Creador | Score | Por qué backup |
|---------|-------|----------------|
| | /5 | |

### Próximo Paso
Comenzar con creador #1: [nombre]
```

---

# FASE 2: DISCOVERY DE POSTS

## Paso 5: Scrapear Posts del Creador

### Qué hacer
Obtener los últimos posts de cada creador seleccionado con sus métricas.

### Herramientas

#### Apify: LinkedIn Profile Scraper (modo actividad)
```json
{
  "profileUrls": ["https://linkedin.com/in/creador"],
  "scrapeActivities": true,
  "maxActivities": 30,
  "activityTypes": ["post"],
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

#### Phantombuster: LinkedIn Activity Extractor
```
Profile URL: https://linkedin.com/in/creador
Number of activities: 30
Activity type: Posts only
Session cookie: [requerido]
```

### Campos a Extraer

| Campo | Descripción | Uso |
|-------|-------------|-----|
| post_url | URL del post | Scraping de engagers |
| post_date | Fecha de publicación | Filtrar recientes |
| post_text | Texto (primeros 500 chars) | Contexto para mensajes |
| likes_count | Número de likes | Filtrar por tracción |
| comments_count | Número de comentarios | Filtrar por engagement |
| reposts_count | Número de reposts | Señal de viralidad |
| post_type | Tipo (texto, carrusel, video) | Análisis |

### Output Esperado
- **Posts por creador:** 20-30
- **Tiempo:** 5-10 minutos por creador
- **Formato:** CSV/JSON

---

## Paso 6: Evaluar Posts

### Qué hacer
Evaluar los posts scrapeados y seleccionar los mejores para scrapear engagers.

### Criterios de Selección

| Criterio | Mínimo | Ideal |
|----------|--------|-------|
| Interacciones totales | ≥40 | ≥100 |
| Recencia | <90 días | <30 días |
| Tema alineado | Tangencial | Directo |
| Calidad comentarios | Algunos ICP | Mayoría ICP |

### Sistema de Scoring de Posts (1-10)

| Rango | Significado |
|-------|-------------|
| 8-10 | Excelente: scrapear primero |
| 6-7 | Bueno: scrapear si hay capacidad |
| 4-5 | Regular: solo si faltan leads |
| 1-3 | Descartar |

### Checklist de Evaluación Rápida

- [ ] ¿Tiene ≥40 interacciones? → Si no, descartar
- [ ] ¿Es de los últimos 90 días? → Preferir recientes
- [ ] ¿El tema es relevante para el ICP? → Score 1-5
- [ ] Revisar 5 comentaristas: ¿son ICP? → Score 1-5
- [ ] ¿Genera debate o solo aplausos? → Debate es mejor

### Template de Evaluación de Posts

```markdown
## Evaluación de Posts: [Creador]

**Total posts scrapeados:** X
**Posts con ≥40 interacciones:** X
**Posts últimos 30 días:** X

### Ranking de Posts

| # | Post URL | Fecha | Likes | Comments | Total | Tema | Score | Decisión |
|---|----------|-------|-------|----------|-------|------|-------|----------|
| 1 | | | | | | | /10 | ✅ |
| 2 | | | | | | | /10 | ✅ |
| 3 | | | | | | | /10 | ⚠️ |
| 4 | | | | | | | /10 | ❌ |

### Posts Seleccionados para Scraping
| # | Post URL | Engagement | Est. Leads ICP |
|---|----------|------------|----------------|
| 1 | | | ~X |
| 2 | | | ~X |
| 3 | | | ~X |

**Total leads ICP estimados:** ~X
```

---

## Paso 7: Seleccionar Posts (Consolidar)

### Qué hacer
Consolidar los posts seleccionados de todos los creadores y planificar el scraping.

### Cuántos Posts Necesitas

| Objetivo Leads ICP | Posts Necesarios (est.) |
|--------------------|-------------------------|
| 100 | 2-3 posts |
| 250 | 4-6 posts |
| 500 | 8-12 posts |
| 1,000 | 15-20 posts |

*Estimación: ~50% de engagers serán ICP*

### Template de Consolidación

```markdown
## Posts Seleccionados para Scraping

### Resumen por Creador
| Creador | Posts evaluados | Posts seleccionados | Est. Leads | Est. ICP |
|---------|-----------------|---------------------|------------|----------|
| [1] | X | X | X | X |
| [2] | X | X | X | X |
| **TOTAL** | | | | |

### Lista Consolidada
| # | Creador | Post URL | Engagement | Tema | Status |
|---|---------|----------|------------|------|--------|
| 1 | | | | | Pendiente |
| 2 | | | | | Pendiente |
| 3 | | | | | Pendiente |

### Plan de Scraping
**Batch 1 (inmediato):** Posts 1-5 (top engagement)
**Batch 2 (si necesario):** Posts 6-10
**Batch 3 (backup):** Posts 11+

### Loop Check
¿Alcanzamos objetivo de leads?
- ✅ Sí → Continuar a Fase 3
- ❌ No → Volver a Paso 5 con siguiente creador
```

---

# FASE 3: LEADS + OUTREACH

## Paso 8: Scrapear Engagers

### Qué hacer
Scrapear personas que interactuaron con los posts seleccionados.

### Herramientas

#### Apify: LinkedIn Post Reactions Scraper
```json
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
```

#### Phantombuster: LinkedIn Post Likers
```
Post URL: [una URL por ejecución]
Number of likers: 200
Session cookie: [requerido]
```

### Campos a Extraer

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
| source_creator | Nombre del creador | ✅ Esencial |

### Proceso Post-Scraping

1. [ ] Descargar todos los CSVs/JSONs
2. [ ] Consolidar en un solo archivo
3. [ ] Eliminar duplicados (por linkedin_url)
4. [ ] Agregar columna "campaign_id"
5. [ ] Verificar completitud de datos

### Output Esperado
- **Por post:** 50-500 perfiles
- **Total campaña:** 200-1,500 leads brutos
- **Formato:** CSV consolidado

---

## Paso 9: Filtrar por ICP

### Qué hacer
Clasificar los leads en: ✅ Dentro ICP, ⚠️ Dudoso, ❌ Fuera ICP

### Criterios de Filtrado

#### Por Cargo (Title)

| Categoría | Incluir | Excluir |
|-----------|---------|---------|
| **Principal** | Growth Manager, Head of Growth, VP Growth | Intern, Student, Retired |
| **Secundario** | Marketing Manager, CMO, Founder | HR, Legal, Finance (no relacionado) |
| **Keywords** | growth, marketing, revenue, acquisition | support, admin, assistant |

#### Por Industria/Empresa

| Incluir | Excluir |
|---------|---------|
| SaaS, Tech, E-commerce, Fintech | Government, NGO |
| Startups, Scale-ups | Recruitment agencies |

#### Por Geografía

| Incluir | Excluir |
|---------|---------|
| [País objetivo] | Países fuera de scope |

#### Por Señal de Intención

| Señal | Puntos | Por qué |
|-------|--------|---------|
| Comentó con pregunta | +5 | Alta intención |
| Comentó (cualquier texto) | +3 | Engagement activo |
| Reposteó | +2 | Amplificación |
| Like/Reacción | +1 | Interés pasivo |

**Mínimo para contactar:** Score ≥3

### Reglas de Clasificación

```
SI (cargo_match AND industria_match AND pais_match) → ✅ DENTRO ICP
SI (cargo_match OR industria_match) AND pais_match → ⚠️ DUDOSO
SI (cargo_excluido OR industria_excluida) → ❌ FUERA ICP
```

### Template de Resultados

```markdown
## Filtrado de Leads

| Clasificación | Cantidad | % del Total |
|---------------|----------|-------------|
| ✅ Dentro ICP | X | X% |
| ⚠️ Dudoso | X | X% |
| ❌ Fuera ICP | X | X% |
| **TOTAL** | X | 100% |

### Objetivo vs Real
- **Objetivo:** X leads ICP
- **Obtenidos:** X leads ICP
- **% alcanzado:** X%

### Acción si < 100% objetivo
⬜ Scrapear más posts de creadores actuales
⬜ Añadir creadores del backup
⬜ Reducir objetivo (justificar)
```

---

## Paso 10: Lead Magnet + Mensajes

### Qué hacer
1. Definir/producir el lead magnet
2. Crear templates de mensajes personalizados

### Tipos de Lead Magnet

| Tipo | Formato | Tiempo producción | Conversión |
|------|---------|-------------------|------------|
| **Checklist** | Notion/PDF | 2-3h | ⭐⭐⭐⭐ |
| **Template** | Notion/Sheets | 3-4h | ⭐⭐⭐⭐ |
| **Mini-guía** | PDF/Notion | 4-6h | ⭐⭐⭐ |
| **Herramienta** | Sheets/Airtable | 4-8h | ⭐⭐⭐⭐⭐ |
| **Curación** | Notion | 1-2h | ⭐⭐⭐ |

### Estructura del Lead Magnet

```markdown
# [Título atractivo con beneficio]

## Para quién es esto
[1-2 líneas describiendo el ICP]

## Qué vas a conseguir
- [Beneficio 1]
- [Beneficio 2]
- [Beneficio 3]

## El contenido
[Checklist / Template / Guía]

## Próximos pasos (opcional)
[CTA suave hacia tu producto/servicio]
```

### Checklist de Calidad del Lead Magnet

- [ ] Título con beneficio claro
- [ ] Resuelve un problema específico del ICP
- [ ] Consumible en <10 minutos
- [ ] Visualmente limpio y profesional
- [ ] Link público funcionando
- [ ] Sin gates adicionales (no pedir email)

### Templates de Mensajes

#### Template 1: Para Comentaristas (máxima personalización)
```
Hola {{first_name}},

Vi tu comentario en el post de [autor] sobre [tema] — me gustó tu punto sobre [parafrasear].

Como {{title}}, seguro estás pensando en [problema relacionado].

Armé un [tipo de lead magnet] con [beneficio principal] que creo te puede servir: [link]

¿Te interesa?

[Tu nombre]
```

#### Template 2: Para Likes/Reacciones
```
Hola {{first_name}},

Vi que te gustó el post de [autor] sobre [tema].

Como {{title}} en {{company}}, quizás te sirva este [tipo de lead magnet] que armé sobre [tema]: [link]

Es gratis y sin catch. ¿Lo quieres?

[Tu nombre]
```

#### Template 3: Para Reposts
```
Hola {{first_name}},

Vi que compartiste el post de [autor] sobre [tema] — claramente es un tema que te importa.

Tengo un [tipo de lead magnet] que profundiza en [aspecto específico]: [link]

¿Te lo comparto?

[Tu nombre]
```

#### Template 4: Follow-up (7 días)
```
Hola {{first_name}},

¿Llegaste a ver el [tipo de lead magnet] que te compartí?

Si tienes 5 min, me encantaría saber qué te pareció.

[Tu nombre]
```

### Reglas de Personalización

| Si... | Entonces... |
|-------|-------------|
| Comentario >20 palabras | Citar parte específica |
| Cargo = Director/VP/C-level | Tono más ejecutivo |
| Empresa <50 empleados | Mencionar agilidad |
| Empresa >500 empleados | Mencionar escalabilidad |
| Comentó con pregunta | Responder la pregunta primero |

### Límites de Caracteres

| Canal | Límite | Recomendación |
|-------|--------|---------------|
| Connection request | 300 chars | 200-250 chars |
| Direct message | 8,000 chars | 300-500 chars |
| InMail | 1,900 chars | 400-600 chars |

---

## Paso 11: Export y Lanzamiento

### Qué hacer
Preparar el CSV final y lanzar la campaña.

### Estructura del CSV Final

| Campo | Descripción |
|-------|-------------|
| linkedin_url | URL del perfil |
| first_name | Nombre |
| last_name | Apellido |
| full_name | Nombre completo |
| title | Cargo |
| company | Empresa |
| location | Ubicación |
| interaction_type | comment/like/repost |
| comment_text | Texto del comentario |
| source_post | URL del post origen |
| source_creator | Nombre del creador |
| campaign_id | ID de campaña |
| message | Mensaje personalizado |
| icp_score | Score numérico |
| status | pending/sent/replied |
| sent_date | Fecha de envío |
| response | Respuesta recibida |

### Límites Diarios de LinkedIn

| Acción | Límite Seguro | Límite Máximo |
|--------|---------------|---------------|
| Connection requests | 20-25/día | 50/día |
| Messages (conexiones) | 50/día | 150/día |
| InMails | Según plan | 10-50/día |

### Secuencia Recomendada

| Día | Acción | Target |
|-----|--------|--------|
| 0 | Enviar mensaje inicial | 100% leads |
| 7 | Follow-up #1 | No respondieron |
| 14 | Follow-up #2 (opcional) | No respondieron |

### Checklist Pre-Lanzamiento

- [ ] Leads ICP identificados (≥200)
- [ ] Mensajes generados y revisados (muestreo 10%)
- [ ] Lead magnet publicado y link testeado
- [ ] Cuenta LinkedIn calentada (>500 conexiones)
- [ ] Herramienta de tracking configurada
- [ ] Límites diarios definidos

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

#### Para Herramienta de Automatización
1. Importar CSV
2. Mapear campos:
   - linkedin_url → Profile URL
   - first_name → First Name
   - message → Message Content
3. Configurar secuencia (Día 0, Día 7)
4. Activar campaña

---

## Métricas y KPIs

### Métricas por Fase

| Fase | Métrica | Target |
|------|---------|--------|
| **Fase 1** | Creadores evaluados | 10-20 |
| **Fase 1** | Creadores seleccionados | 5-10 |
| **Fase 2** | Posts evaluados/creador | 20-30 |
| **Fase 2** | Posts seleccionados | 8-15 total |
| **Fase 3** | % Leads ICP | >50% |
| **Fase 3** | % Respuestas | >15% |
| **Fase 3** | % Respuestas positivas | >5% |

### Benchmark por Tipo de Outreach

| Tipo | % Respuestas | % Positivas |
|------|--------------|-------------|
| Cold outreach tradicional | 3-8% | 1-3% |
| **Signal-based + lead magnet** | 15-25% | 5-10% |
| Warm intro | 40-60% | 20-30% |

### Dashboard de Campaña

```markdown
## Campaña: [Nombre]
**Fecha:** [inicio] - [fin]

### Fase 1: Creadores
- Creadores evaluados: X
- Creadores seleccionados: X
- Score promedio: X/5

### Fase 2: Posts
- Posts evaluados: X
- Posts seleccionados: X
- Engagement promedio: X

### Fase 3: Leads
- Leads scrapeados: X
- Leads ICP: X (Y%)
- Mensajes enviados: X
- Respuestas: X (Y%)
- Respuestas positivas: X (Y%)
- Reuniones: X

### Insights
- Mejor creador (% ICP): [nombre]
- Mejor post (engagement): [URL]
- Mejor mensaje (% respuesta): [template]
```

---

## Troubleshooting

### Problema: Pocas respuestas (<10%)

| Causa posible | Diagnóstico | Solución |
|---------------|-------------|----------|
| Mensaje muy largo | >500 chars | Acortar, ir al grano |
| Sin contexto | No menciona creador/post | Agregar referencia |
| CTA agresivo | Pide reunión directa | Ofrecer valor primero |
| Lead magnet débil | Link sin clicks | Mejorar propuesta de valor |

### Problema: Bajo % ICP (<40%)

| Causa posible | Diagnóstico | Solución |
|---------------|-------------|----------|
| Creadores mal elegidos | Audiencia no coincide | Reevaluar criterios Paso 3 |
| Posts muy genéricos | Tema demasiado amplio | Elegir posts más nicho |
| Filtros muy amplios | Muchos false positives | Ajustar criterios cargo |

### Problema: Pocos creadores calificados

| Causa posible | Solución |
|---------------|----------|
| Temas muy estrechos | Expandir a temas tangenciales |
| Criterios muy estrictos | Bajar score mínimo a 3.0 |
| Mercado pequeño | Considerar otros países/idiomas |

### Problema: Scraping falla

| Error | Causa | Solución |
|-------|-------|----------|
| Rate limit | Muy rápido | Esperar 24h, reducir velocidad |
| Login required | Sesión expirada | Renovar cookies |
| Captcha | Detección bot | Usar proxies rotativos |

---

## Deal Breakers (Cuándo NO seguir)

### DB1: No hay creadores alineados
**Señal:** <3 creadores con score ≥3.0 después de evaluar 20+
**Acción:** Replantear los temas o el ICP

### DB2: Posts sin tracción
**Señal:** Promedio <30 interacciones en creadores seleccionados
**Acción:** Buscar creadores con más engagement o esperar posts virales

### DB3: Muy poco ICP en engagers
**Señal:** <30% leads dentro de ICP después de 5 posts
**Acción:** Cambiar creadores o replantear ICP

### DB4: Lead magnet sin impacto
**Señal:** A/B test muestra 0 diferencia con/sin lead magnet
**Acción:** Rediseñar propuesta de valor

### DB5: Fricción insostenible
**Señal:** >16 horas para procesar 500 leads
**Acción:** Automatizar más pasos o reducir scope

---

## Recursos

### Herramientas Recomendadas

| Categoría | Herramienta | Uso |
|-----------|-------------|-----|
| **Búsqueda** | Perplexity | Encontrar creadores |
| **Scraping posts** | Apify LinkedIn Profile | Actividad de creadores |
| **Scraping engagers** | Apify Post Reactions | Likes y comentarios |
| **BBDD** | Notion/Airtable | Gestión de creadores, posts, leads |
| **Mensajes** | ChatGPT/Claude | Generación de variantes |
| **Outreach** | Manual/Expandi | Envío de mensajes |
| **Tracking** | Google Sheets | Métricas de campaña |

### Links Útiles

- [Apify LinkedIn Scrapers](https://apify.com/store?search=linkedin)
- [Phantombuster LinkedIn](https://phantombuster.com/phantombuster?category=linkedin)
- [LinkedIn Limits Guide](https://www.linkedin.com/help/)

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 2.0 | 2026-01-17 | Reestructuración completa: 11 pasos en 3 fases. Agregada Fase 1 (Discovery de Creadores) |
| 1.0 | 2026-01-17 | Versión inicial (8 pasos) |

---

*Este instructivo es parte del sistema de playbooks de Growth4U. Para soporte, contactar a Martin.*
