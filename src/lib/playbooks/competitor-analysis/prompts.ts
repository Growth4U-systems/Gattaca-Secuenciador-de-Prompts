/**
 * Competitor Analysis Playbook - Prompts
 *
 * Todos los prompts del playbook de análisis de competidores.
 * Separado del template original para facilitar exportación.
 *
 * Variables disponibles:
 * - {{competitor_name}} - Nombre del competidor
 * - {{competitor_description}} - Descripción del competidor
 * - {{company_name}} - Tu empresa
 * - {{company_description}} - Descripción de tu empresa
 * - {{industry}} - Industria
 * - {{country}} - País/región
 * - {{target_audience}} - Audiencia objetivo
 * - {{analysis_focus}} - Enfoque del análisis
 * - {{step:Step Name}} - Output de paso anterior
 */

// ============================================
// DEEP RESEARCH PROMPT (Documento Fundacional)
// ============================================

export const DEEP_RESEARCH_PROMPT = `Actúa como analista de inteligencia competitiva experto.

COMPETIDOR A ANALIZAR: {{competitor_name}}
{{#if competitor_description}}DESCRIPCIÓN: {{competitor_description}}{{/if}}
INDUSTRIA: {{industry}}
PAÍS/REGIÓN: {{country}}

TAREA:
Realiza una investigación profunda del competidor {{competitor_name}} usando búsqueda web.

INVESTIGA:
1. **Información General**:
   - Historia y fundación de la empresa
   - Tamaño (empleados, revenue estimado)
   - Ubicación y mercados donde opera
   - Rondas de inversión (si aplica)

2. **Producto/Servicio**:
   - Qué ofrece exactamente
   - Modelo de negocio y pricing
   - Propuesta de valor principal
   - Integraciones y tecnología

3. **Mercado y Clientes**:
   - Segmentos objetivo
   - Casos de uso principales
   - Clientes conocidos/testimonios

4. **Presencia Digital**:
   - Website principal
   - Redes sociales activas
   - Blog/contenido educativo
   - Presencia en review sites

5. **Noticias Recientes**:
   - Lanzamientos de producto
   - Expansiones o cambios
   - Menciones en prensa

OUTPUT FORMAT:
## Deep Research: {{competitor_name}}

### Información General
[Resumen ejecutivo de la empresa]

### Producto/Servicio
[Descripción detallada de la oferta]

### Mercado y Clientes
[Análisis del target y posicionamiento]

### Presencia Digital
[Canales y estrategia de contenido]

### Noticias y Desarrollos Recientes
[Últimas novedades relevantes]

### Datos Clave para Análisis
[Bullet points de los insights más importantes]`

// ============================================
// PASO 1: AUTOPERCEPCIÓN
// ============================================

export const AUTOPERCEPCION_PROMPT = `Actúa como analista de comunicación y branding.

COMPETIDOR: {{competitor_name}}
{{#if competitor_description}}DESCRIPCIÓN: {{competitor_description}}{{/if}}

DEEP RESEARCH PREVIO:
{{step:Deep Research}}

DOCUMENTOS DISPONIBLES:
Los documentos adjuntos contienen:
- Contenido scrapeado del website del competidor
- Posts de Facebook
- Videos/transcripciones de YouTube
- Posts de TikTok
- Posts de LinkedIn
- Insights del perfil de empresa en LinkedIn
- Posts de Instagram

TAREA:
Analiza cómo el competidor {{competitor_name}} SE PERCIBE Y SE PRESENTA A SÍ MISMO.

ANALIZA:
1. **Mensaje Central**:
   - ¿Cuál es su propuesta de valor principal?
   - ¿Qué promesa hacen a sus clientes?
   - ¿Qué problema dicen resolver?

2. **Tono y Personalidad**:
   - ¿Cómo se comunican? (formal/informal, técnico/accesible)
   - ¿Qué emociones intentan evocar?
   - ¿Cuál es su "voz" de marca?

3. **Posicionamiento Declarado**:
   - ¿Cómo se definen vs la competencia?
   - ¿Qué diferenciadores destacan?
   - ¿Qué segmento dicen atender?

4. **Consistencia entre Canales**:
   - ¿El mensaje es consistente en web, RRSS?
   - ¿Hay variaciones por canal?
   - ¿Qué canal priorizan?

5. **Contenido y Temas**:
   - ¿De qué hablan más?
   - ¿Qué temas evitan?
   - ¿Qué tipo de contenido publican?

OUTPUT FORMAT:
## Autopercepción: {{competitor_name}}

### Mensaje Central y Propuesta de Valor
[Análisis del mensaje principal]

### Tono y Personalidad de Marca
[Descripción del voice & tone]

### Posicionamiento Declarado
[Cómo se posicionan ellos mismos]

### Consistencia Cross-Channel
[Análisis de consistencia entre canales]

### Temas y Contenido Prioritario
[Qué comunican y qué evitan]

### Insights Clave de Autopercepción
[Resumen de hallazgos principales]`

// ============================================
// PASO 2: PERCEPCIÓN DE TERCEROS
// ============================================

export const PERCEPCION_TERCEROS_PROMPT = `Actúa como analista de relaciones públicas y SEO.

COMPETIDOR: {{competitor_name}}
CONTEXTO PREVIO:
{{step:Deep Research}}

DOCUMENTOS DISPONIBLES:
Los documentos adjuntos contienen:
- Datos de SEO/SERP (posicionamiento en buscadores, keywords orgánicas)
- Corpus de noticias (menciones en prensa y medios)

TAREA:
Analiza cómo TERCEROS (medios, buscadores, industria) perciben al competidor {{competitor_name}}.

ANALIZA:
1. **Visibilidad SEO**:
   - ¿Por qué keywords rankean?
   - ¿Cuál es su autoridad de dominio estimada?
   - ¿Qué términos dominan vs cuáles no?

2. **Cobertura de Medios**:
   - ¿Qué medios hablan de ellos?
   - ¿El tono es positivo, neutral o negativo?
   - ¿Qué aspectos destacan los periodistas?

3. **Reconocimiento de Industria**:
   - ¿Aparecen en rankings o premios?
   - ¿Son citados como referentes?
   - ¿Qué posición ocupan en el mercado según terceros?

4. **Narrative de Terceros**:
   - ¿Cómo los describen externamente?
   - ¿Coincide con su autopercepción?
   - ¿Hay gaps entre lo que dicen y lo que otros dicen?

OUTPUT FORMAT:
## Percepción de Terceros: {{competitor_name}}

### Visibilidad y Posicionamiento SEO
[Análisis de presencia en buscadores]

### Cobertura Mediática
[Resumen de menciones en prensa]

### Reconocimiento de Industria
[Premios, rankings, menciones como referente]

### Narrativa Externa vs Autopercepción
[Comparación de cómo los ven vs cómo se ven]

### Insights Clave de Percepción de Terceros
[Resumen de hallazgos principales]`

// ============================================
// PASO 3: PERCEPCIÓN RRSS (COMENTARIOS)
// ============================================

export const PERCEPCION_RRSS_PROMPT = `Actúa como analista de social listening y sentiment analysis.

COMPETIDOR: {{competitor_name}}
CONTEXTO PREVIO:
{{step:Deep Research}}
{{step:Autopercepción}}

DOCUMENTOS DISPONIBLES:
Los documentos adjuntos contienen comentarios de usuarios en:
- LinkedIn (comentarios en posts)
- Instagram (comentarios en publicaciones)
- TikTok (comentarios en videos)
- YouTube (comentarios en videos)
- Facebook (comentarios en publicaciones)

TAREA:
Analiza qué dicen los CONSUMIDORES Y USUARIOS sobre {{competitor_name}} en redes sociales.

ANALIZA:
1. **Sentimiento General**:
   - ¿Predominan comentarios positivos, negativos o neutros?
   - ¿Cuál es el engagement promedio?
   - ¿Hay defensores de marca activos?

2. **Temas Recurrentes**:
   - ¿De qué se quejan más?
   - ¿Qué elogian frecuentemente?
   - ¿Qué preguntas hacen?

3. **Pain Points Detectados**:
   - ¿Qué problemas mencionan los usuarios?
   - ¿Hay quejas recurrentes?
   - ¿Qué funcionalidades piden?

4. **Comparaciones con Competencia**:
   - ¿Mencionan alternativas?
   - ¿Cómo los comparan?
   - ¿Por qué eligieron o dejaron el producto?

5. **Análisis por Canal**:
   - ¿El sentimiento varía por red social?
   - ¿Qué canal tiene mejor/peor percepción?

OUTPUT FORMAT:
## Percepción del Consumidor (RRSS): {{competitor_name}}

### Análisis de Sentimiento General
[Resumen del sentiment predominante]

### Temas Recurrentes en Comentarios
[Qué dicen más frecuentemente]

### Pain Points y Quejas Detectadas
[Problemas mencionados por usuarios]

### Comparaciones con Competencia
[Cómo los comparan con alternativas]

### Análisis por Canal Social
[Diferencias de percepción por red]

### Insights Clave de Percepción RRSS
[Resumen de hallazgos principales]`

// ============================================
// PASO 4: PERCEPCIÓN REVIEWS
// ============================================

export const PERCEPCION_REVIEWS_PROMPT = `Actúa como analista de customer experience y product reviews.

COMPETIDOR: {{competitor_name}}
CONTEXTO PREVIO:
{{step:Deep Research}}
{{step:Autopercepción}}

DOCUMENTOS DISPONIBLES:
Los documentos adjuntos contienen reseñas de:
- Trustpilot
- G2 Crowd
- Capterra
- Google Play Store
- Apple App Store

TAREA:
Analiza las RESEÑAS DE CLIENTES que han usado el producto de {{competitor_name}}.

ANALIZA:
1. **Rating y Tendencia**:
   - ¿Cuál es el rating promedio por plataforma?
   - ¿La tendencia es ascendente o descendente?
   - ¿Cuántas reseñas tienen?

2. **Pros Más Mencionados**:
   - ¿Qué valoran más los clientes?
   - ¿Qué features destacan positivamente?
   - ¿Qué los hace recomendar el producto?

3. **Cons Más Mencionados**:
   - ¿Qué frustraciones tienen los usuarios?
   - ¿Qué features faltan o son débiles?
   - ¿Por qué darían malas reviews?

4. **Perfiles de Reviewers**:
   - ¿Qué tipo de empresas/usuarios reviewean?
   - ¿Hay patrones por tamaño de empresa?
   - ¿Qué casos de uso mencionan?

5. **Competencia Mencionada**:
   - ¿De qué producto migraron?
   - ¿A qué producto se van si cancelan?
   - ¿Cómo los comparan con alternativas?

OUTPUT FORMAT:
## Percepción del Consumidor (Reviews): {{competitor_name}}

### Rating y Volumen de Reviews
[Métricas por plataforma]

### Fortalezas Según Clientes
[Lo que más valoran]

### Debilidades y Frustraciones
[Quejas y features faltantes]

### Perfil de Usuarios que Reviewean
[Quiénes son y qué casos de uso tienen]

### Competencia Mencionada en Reviews
[Migraciones y comparaciones]

### Insights Clave de Reviews
[Resumen de hallazgos principales]`

// ============================================
// PASO 5: SÍNTESIS Y BATTLE CARD
// ============================================

export const SINTESIS_PROMPT = `Actúa como estratega de inteligencia competitiva senior.

COMPETIDOR: {{competitor_name}}
EMPRESA QUE ANALIZA: {{company_name}}
{{#if company_description}}DESCRIPCIÓN DE TU EMPRESA: {{company_description}}{{/if}}
{{#if target_audience}}AUDIENCIA OBJETIVO: {{target_audience}}{{/if}}

ANÁLISIS PREVIOS COMPLETOS:
1. Deep Research:
{{step:Deep Research}}

2. Autopercepción (cómo se ven ellos):
{{step:Autopercepción}}

3. Percepción de Terceros (medios y SEO):
{{step:Percepción Terceros}}

4. Percepción de Consumidores en RRSS:
{{step:Percepción del consumidor RRSS}}

5. Percepción de Consumidores en Reviews:
{{step:Percepción del consumidor Reviews}}

TAREA:
Sintetiza TODAS las percepciones anteriores en un análisis triangulado que compare cómo el competidor se ve a sí mismo vs cómo lo ven terceros y consumidores.

SINTETIZA:
1. **Triangulación de Percepciones**:
   - ¿Coincide la autopercepción con la realidad?
   - ¿Hay gaps entre lo que prometen y lo que entregan?
   - ¿La percepción de terceros coincide con la de consumidores?

2. **Fortalezas Reales** (confirmadas por múltiples fuentes):
   - ¿Qué fortalezas son consistentes entre todas las perspectivas?
   - ¿Qué ventajas competitivas son reales?

3. **Debilidades Reales** (confirmadas por múltiples fuentes):
   - ¿Qué debilidades aparecen consistentemente?
   - ¿Qué promesas no cumplen?

4. **Oportunidades para {{company_name}}**:
   - ¿Dónde puede atacar {{company_name}}?
   - ¿Qué pain points puede resolver mejor?
   - ¿Qué segmentos están desatendidos?

5. **Battle Card**:
   - Argumentos para vender contra este competidor
   - Respuestas a objeciones comunes
   - Diferenciadores clave a destacar

OUTPUT FORMAT:
## Resumen Ejecutivo: Análisis de {{competitor_name}}

### Triangulación de Percepciones
| Aspecto | Autopercepción | Terceros | Consumidores | Realidad |
|---------|---------------|----------|--------------|----------|

### Fortalezas Confirmadas
[Lo que realmente hacen bien]

### Debilidades Confirmadas
[Lo que realmente hacen mal]

### Gaps Percepción vs Realidad
[Diferencias entre lo que dicen y lo que entregan]

### Oportunidades para {{company_name}}
[Donde podemos ganarles]

---

## Battle Card: {{company_name}} vs {{competitor_name}}

### Cuándo Elegir {{company_name}}
[Escenarios donde somos mejor opción]

### Cuándo Considerar {{competitor_name}}
[Ser honestos sobre sus fortalezas]

### Argumentos de Venta
[Puntos clave para el pitch]

### Manejo de Objeciones
| Objeción | Respuesta |
|----------|-----------|

### Diferenciadores Clave
[Top 3 razones para elegirnos]`

// ============================================
// EXPORT ALL PROMPTS
// ============================================

export const ALL_PROMPTS = {
  deepResearch: DEEP_RESEARCH_PROMPT,
  autopercepcion: AUTOPERCEPCION_PROMPT,
  percepcionTerceros: PERCEPCION_TERCEROS_PROMPT,
  percepcionRRSS: PERCEPCION_RRSS_PROMPT,
  percepcionReviews: PERCEPCION_REVIEWS_PROMPT,
  sintesis: SINTESIS_PROMPT,
} as const

export type PromptKey = keyof typeof ALL_PROMPTS
