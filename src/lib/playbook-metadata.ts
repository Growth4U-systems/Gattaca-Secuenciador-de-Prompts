/**
 * Playbook Metadata
 * Información enriquecida sobre cada playbook para mostrar en la UI
 */

export interface PlaybookStep {
  brief: string
  detailed: string
  tips?: string[]
}

export interface PlaybookMeta {
  // Información básica (para vista expandida)
  purpose: string
  whenToUse: string[]
  outcome: string
  relatedPlaybooks: string[]
  targetAudience?: string
  steps: Record<string, string>

  // Información extendida (para página de librería)
  icon?: string
  description?: string
  objectives?: string[]
  requirements?: string[]
  duration?: string
  detailedSteps?: Record<string, PlaybookStep>
  examples?: {
    title: string
    description: string
  }[]
  faqs?: {
    question: string
    answer: string
  }[]
}

export const playbookMetadata: Record<string, PlaybookMeta> = {
  niche_finder: {
    // Información básica
    purpose:
      'Descubre nichos de mercado rentables analizando foros, Reddit y búsquedas de Google.',
    whenToUse: [
      'Lanzar un nuevo producto y no sabes a quién venderle',
      'Encontrar audiencias no saturadas',
      'Validar si hay demanda real antes de invertir',
    ],
    outcome:
      'Lista priorizada de nichos con pain points, tamaño de mercado y facilidad de alcance.',
    relatedPlaybooks: ['ecp', 'competitor_analysis'],
    targetAudience: 'Fundadores, product managers, growth marketers',
    steps: {
      suggest_niches: 'IA genera combinaciones de contextos × producto',
      serp_analysis: 'Busca URLs relevantes en Google y Reddit',
      scrape_sources: 'Extrae el contenido de cada URL encontrada',
      extract_insights: 'Identifica nichos y pain points con IA',
      analyze_results: 'Puntúa y prioriza los nichos encontrados',
    },
    // Información extendida
    icon: '🔍',
    description: `El Niche Finder es un playbook de investigación de mercado que utiliza inteligencia artificial para descubrir nichos rentables donde tu producto puede tener éxito.

Combina búsquedas en Google, análisis de Reddit y foros especializados para identificar pain points reales de audiencias específicas. El resultado es una lista priorizada de nichos con scoring de viabilidad.`,
    objectives: [
      'Identificar 10-20 nichos potenciales para tu producto',
      'Descubrir pain points reales expresados por usuarios',
      'Evaluar el tamaño y accesibilidad de cada nicho',
      'Priorizar nichos por potencial de éxito',
    ],
    requirements: [
      'Descripción clara de tu producto o servicio',
      'Contexto B2B o B2C definido',
      'Idea general del tipo de cliente que buscas',
    ],
    duration: '15-30 minutos',
    detailedSteps: {
      suggest_niches: {
        brief: 'IA genera combinaciones de contextos × producto',
        detailed:
          'La IA analiza tu producto y genera múltiples combinaciones de contextos de uso, audiencias potenciales y casos de aplicación. Esto crea una matriz inicial de nichos a explorar.',
        tips: [
          'Sé específico en la descripción de tu producto',
          'Indica si prefieres B2B, B2C o ambos',
          'Menciona nichos que ya conoces para evitar repetición',
        ],
      },
      serp_analysis: {
        brief: 'Busca URLs relevantes en Google y Reddit',
        detailed:
          'Para cada nicho sugerido, el sistema busca en Google y Reddit contenido relevante: discusiones, quejas, reviews y foros donde la audiencia objetivo habla de sus problemas.',
        tips: [
          'Los resultados de Reddit suelen tener insights más honestos',
          'Las búsquedas en foros especializados revelan pain points técnicos',
        ],
      },
      scrape_sources: {
        brief: 'Extrae el contenido de cada URL encontrada',
        detailed:
          'Se extrae el texto completo de cada URL encontrada, incluyendo comentarios y respuestas. Este contenido crudo se preparará para análisis con IA.',
      },
      extract_insights: {
        brief: 'Identifica nichos y pain points con IA',
        detailed:
          'La IA analiza todo el contenido extraído para identificar patrones: qué problemas mencionan más, qué soluciones buscan, qué frustraciones tienen con alternativas actuales.',
        tips: [
          'Los pain points más mencionados suelen ser los más importantes',
          'Busca frustración con soluciones existentes como señal de oportunidad',
        ],
      },
      analyze_results: {
        brief: 'Puntúa y prioriza los nichos encontrados',
        detailed:
          'Cada nicho recibe un score basado en: volumen de menciones, intensidad del pain point, facilidad de alcance y fit con tu producto. Los nichos se ordenan por potencial.',
      },
    },
    examples: [
      {
        title: 'SaaS de gestión de inventario',
        description:
          'Descubrió que restaurantes pequeños tienen más pain points que retail, pivoteando el producto hacia hostelería.',
      },
      {
        title: 'App de productividad',
        description:
          'Encontró un nicho no saturado en profesores universitarios que preparan clases, con pain points específicos.',
      },
    ],
    faqs: [
      {
        question: '¿Cuántos nichos debería explorar?',
        answer:
          'Recomendamos empezar con 5-10 nichos y luego profundizar en los 2-3 más prometedores.',
      },
      {
        question: '¿Funciona para productos B2B?',
        answer:
          'Sí, el playbook ajusta las fuentes de búsqueda para B2B, incluyendo LinkedIn y foros profesionales.',
      },
    ],
  },
  ecp: {
    // Información básica
    purpose:
      'Define el Early Customer Profile (ECP) ideal para tu producto e identifica los primeros adoptantes.',
    whenToUse: [
      'Lanzar un nuevo producto al mercado',
      'Reposicionar un producto existente',
      'Crear messaging diferenciado de la competencia',
    ],
    outcome: 'Assets de marketing con posicionamiento claro y diferenciado.',
    relatedPlaybooks: ['niche_finder', 'competitor_analysis'],
    targetAudience: 'Marketers, brand managers, fundadores',
    steps: {
      deep_research: 'Investiga mercado, competencia y audiencia',
      find_place: 'Encuentra tu posicionamiento único',
      select_assets: 'Selecciona qué assets crear',
      proof_legit: 'Recopila pruebas y testimonios',
      final_output: 'Genera los assets finales',
    },
    // Información extendida
    icon: '🎯',
    description: `El ECP (Early Customer Profile) es un framework para identificar a los primeros adoptantes ideales de tu producto.

Define quiénes son los clientes que:
• Tienen el problema más urgente que tu producto resuelve
• Están dispuestos a probar soluciones nuevas
• Pueden convertirse en evangelistas de tu marca

Este playbook te guía para identificar, validar y priorizar tus primeros clientes objetivo.`,
    objectives: [
      'Definir tu propuesta de valor única',
      'Identificar tus diferenciadores vs competencia',
      'Crear messaging consistente para todos los canales',
      'Generar assets de marketing listos para usar',
    ],
    requirements: [
      'Conocimiento de tu producto y sus beneficios',
      'Información sobre tus clientes actuales o ideales',
      'Testimonios o casos de éxito (idealmente)',
    ],
    duration: '30-45 minutos',
    detailedSteps: {
      deep_research: {
        brief: 'Investiga mercado, competencia y audiencia',
        detailed:
          'Se analiza el contexto competitivo: quiénes son tus competidores, cómo se posicionan, qué dicen sus clientes. También se investiga a tu audiencia objetivo y sus motivaciones.',
        tips: [
          'Incluye competidores indirectos también',
          'Los reviews de competidores revelan gaps de mercado',
        ],
      },
      find_place: {
        brief: 'Encuentra tu posicionamiento único',
        detailed:
          'Basado en la investigación, la IA propone posicionamientos diferenciados que puedes ocupar. Se evalúa cada opción por viabilidad y potencial.',
      },
      select_assets: {
        brief: 'Selecciona qué assets crear',
        detailed:
          'Decides qué piezas de marketing necesitas: taglines, descripciones, pitch deck, landing page copy, etc.',
      },
      proof_legit: {
        brief: 'Recopila pruebas y testimonios',
        detailed:
          'Se integran las pruebas que validan tu posicionamiento: testimonios de clientes, métricas de éxito, certificaciones, premios.',
      },
      final_output: {
        brief: 'Genera los assets finales',
        detailed:
          'La IA genera los assets seleccionados con el posicionamiento y pruebas integrados, listos para usar en tus canales.',
      },
    },
    examples: [
      {
        title: 'Startup de fintech',
        description:
          'Pasó de "somos más baratos" a "la única plataforma construida por ex-banqueros para PyMEs".',
      },
    ],
    faqs: [
      {
        question: '¿Necesito tener testimonios previos?',
        answer:
          'No es obligatorio, pero mejora significativamente el resultado. Puedes empezar con métricas internas o experiencia del equipo.',
      },
    ],
  },
  competitor_analysis: {
    // Información básica
    purpose:
      'Analiza a fondo a tus competidores para encontrar oportunidades de diferenciación.',
    whenToUse: [
      'Entrar a un mercado con competidores establecidos',
      'Entender por qué los clientes eligen a otros',
      'Encontrar gaps en el mercado',
    ],
    outcome:
      'Matriz comparativa y recomendaciones estratégicas de posicionamiento.',
    relatedPlaybooks: ['ecp', 'niche_finder'],
    targetAudience: 'Estrategas, product managers, fundadores',
    steps: {
      identify_competitors: 'Lista los competidores principales',
      analyze_positioning: 'Analiza cómo se posiciona cada uno',
      compare_features: 'Compara precios, features y propuestas',
      find_gaps: 'Identifica oportunidades no cubiertas',
      recommendations: 'Genera estrategia de diferenciación',
    },
    // Información extendida
    icon: '📊',
    description: `El Competitor Analysis es un playbook de inteligencia competitiva que te ayuda a entender el panorama de tu mercado.

Analiza sistemáticamente a tus competidores: cómo se posicionan, qué ofrecen, cuánto cobran, y qué dicen sus clientes. El resultado es un mapa claro del mercado con oportunidades de diferenciación.`,
    objectives: [
      'Mapear el landscape competitivo completo',
      'Identificar fortalezas y debilidades de cada competidor',
      'Encontrar gaps de mercado no atendidos',
      'Definir una estrategia de diferenciación viable',
    ],
    requirements: [
      'Lista de competidores conocidos (mínimo 2-3)',
      'URLs de sus sitios web',
      'Conocimiento básico de tu mercado',
    ],
    duration: '20-40 minutos',
    detailedSteps: {
      identify_competitors: {
        brief: 'Lista los competidores principales',
        detailed:
          'Se identifican competidores directos e indirectos. La IA puede sugerir competidores adicionales basándose en búsquedas de mercado.',
        tips: [
          'Incluye tanto líderes como newcomers',
          'No ignores competidores indirectos (alternativas diferentes al mismo problema)',
        ],
      },
      analyze_positioning: {
        brief: 'Analiza cómo se posiciona cada uno',
        detailed:
          'Para cada competidor se analiza: propuesta de valor, mensajes clave, audiencia objetivo y tono de comunicación.',
      },
      compare_features: {
        brief: 'Compara precios, features y propuestas',
        detailed:
          'Se crea una matriz comparativa de características, precios y propuestas de valor. Esto revela dónde hay paridad y dónde hay diferencias.',
      },
      find_gaps: {
        brief: 'Identifica oportunidades no cubiertas',
        detailed:
          'Analizando la matriz y los reviews de clientes, se identifican necesidades no atendidas o mal atendidas por la competencia.',
      },
      recommendations: {
        brief: 'Genera estrategia de diferenciación',
        detailed:
          'Basado en los gaps encontrados y tus fortalezas, se propone una estrategia de diferenciación concreta y actionable.',
      },
    },
    examples: [
      {
        title: 'Plataforma de e-learning',
        description:
          'Descubrió que todos los competidores se enfocaban en contenido, dejando un gap en comunidad y networking.',
      },
    ],
    faqs: [
      {
        question: '¿Cuántos competidores debería analizar?',
        answer:
          'Entre 3 y 7 es ideal. Menos no da suficiente contexto, más puede diluir el análisis.',
      },
      {
        question: '¿Incluyo competidores internacionales?',
        answer:
          'Sí, especialmente si operan en tu mercado o podrían entrar. Su estrategia puede anticipar tendencias.',
      },
    ],
  },
  video_viral_ia: {
    // Información básica
    purpose:
      'Genera videos virales ASMR/satisfying usando IA - desde la idea hasta el video listo para publicar.',
    whenToUse: [
      'Crear contenido viral para TikTok, Reels o Shorts',
      'Automatizar la producción de videos cortos',
      'Generar ideas y escenas con IA antes de producir',
    ],
    outcome:
      'Video MP4 listo para publicar con caption viral y hashtags optimizados.',
    relatedPlaybooks: ['niche_finder'],
    targetAudience: 'Creadores de contenido, social media managers, marketers',
    steps: {
      generate_idea: 'IA genera idea viral con caption y hashtags',
      review_idea: 'Revisa y aprueba la idea generada',
      generate_scenes: 'Genera prompts detallados para cada escena',
      generate_clips: '[En desarrollo] Genera clips con Seedance/Wavespeed',
      generate_audio: '[En desarrollo] Genera audio ASMR con Fal AI',
      compose_video: '[En desarrollo] Une clips y audio con FFmpeg',
      preview: 'Revisa el video final',
      export: 'Exporta o publica a plataformas',
    },
    // Información extendida
    icon: '🎬',
    description: `Video Viral IA automatiza la creación de videos virales usando inteligencia artificial.

El proceso completo:
1. **Ideación**: La IA genera ideas virales con caption, hashtags y descripción del entorno visual
2. **Producción**: Se generan prompts detallados para cada escena del video
3. **Post-Producción**: Generación de clips, audio y composición final
4. **Publicación**: Preview y exportación a múltiples plataformas

⚠️ **Estado actual**: Los pasos de generación de video y audio están en desarrollo. Los pasos de ideación y generación de escenas funcionan completamente con IA.`,
    objectives: [
      'Generar ideas virales con IA en segundos',
      'Crear prompts de escenas cinematográficas detallados',
      'Producir videos cortos listos para publicar',
      'Optimizar hashtags para máximo alcance',
    ],
    requirements: [
      'Tema o nicho definido para el contenido',
      'Preferencia de estilo (ASMR, satisfying, etc.)',
      'Plataformas destino seleccionadas',
    ],
    duration: '15-30 minutos (pasos LLM) + tiempo de generación de video',
    detailedSteps: {
      generate_idea: {
        brief: 'IA genera idea viral con caption y hashtags',
        detailed:
          'La IA analiza el tema y estilo seleccionado para generar una idea viral con: caption con emoji, 12 hashtags optimizados, descripción del entorno visual y prompt de audio.',
        tips: [
          'Sé específico en el tema para mejores resultados',
          'Los temas de nicho suelen generar más engagement',
          'Revisa los hashtags para tu mercado específico',
        ],
      },
      generate_scenes: {
        brief: 'Genera prompts detallados para cada escena',
        detailed:
          'Para cada escena del video, la IA genera una descripción cinematográfica detallada de 500-1000 caracteres con información sobre materiales, texturas, movimientos y ángulos de cámara.',
        tips: [
          'Cada escena debe mostrar un momento distinto',
          'Las descripciones deben ser muy visuales y específicas',
          'Incluye detalles de textura y comportamiento de materiales',
        ],
      },
      generate_clips: {
        brief: '[En desarrollo] Genera clips con Seedance/Wavespeed',
        detailed:
          'Este paso generará clips de video usando APIs de generación de video IA. Actualmente requiere uso externo de Wavespeed AI o similar.',
      },
      preview: {
        brief: 'Revisa el video final',
        detailed:
          'Visualiza el video completo con audio antes de publicar. Verifica que el caption y hashtags son apropiados para las plataformas seleccionadas.',
      },
    },
    examples: [
      {
        title: 'Cutting ASMR',
        description:
          'Generó una idea de "Obsidian shaped like a chess piece being sliced" con 1.2M views en TikTok.',
      },
      {
        title: 'Satisfying Slime',
        description:
          'Creó serie de 10 videos satisfying con prompts generados por IA, alcanzando 5M views combinados.',
      },
    ],
    faqs: [
      {
        question: '¿Qué partes funcionan ahora?',
        answer:
          'La ideación y generación de escenas funcionan 100% con IA. Los pasos de generación de video y audio requieren herramientas externas mientras se desarrollan los endpoints.',
      },
      {
        question: '¿Qué herramientas externas necesito?',
        answer:
          'Para la generación de video: Wavespeed AI, Seedance, o Runway. Para audio: Fal AI mmaudio. Para composición: cualquier editor de video o Fal AI FFmpeg.',
      },
      {
        question: '¿Qué duración funciona mejor?',
        answer:
          'Videos de 15-30 segundos tienen mejor retention en TikTok/Reels. Para YouTube Shorts puedes ir hasta 60 segundos.',
      },
    ],
  },
  signal_based_outreach: {
    // Información básica
    purpose:
      'LinkedIn outreach usando señales de intención + lead magnet para 3x mejores tasas de respuesta.',
    whenToUse: [
      'Generar leads B2B cualificados en LinkedIn',
      'Contactar personas que ya mostraron interés en temas relevantes',
      'Ofrecer valor antes de pedir reuniones',
    ],
    outcome:
      'Lista de 500+ leads ICP con mensajes personalizados y lead magnet listo para lanzar.',
    relatedPlaybooks: ['niche_finder', 'ecp'],
    targetAudience: 'SDRs, growth marketers, fundadores B2B',
    steps: {
      map_topics: 'Mapea propuesta de valor a temas de contenido',
      find_creators: 'Busca creadores cuya audiencia es tu ICP',
      evaluate_creators: 'Evalua actividad, viralidad y calidad de audiencia',
      select_creators: 'Prioriza creadores para scrapear',
      scrape_posts: 'Extrae posts recientes con metricas',
      evaluate_posts: 'Puntua posts por engagement y alineamiento',
      select_posts: 'Selecciona posts para scrapear engagers',
      scrape_engagers: 'Extrae perfiles de quienes interactuaron',
      filter_icp: 'Clasifica leads en ICP / Dudoso / Fuera',
      lead_magnet_messages: 'Crea lead magnet y mensajes personalizados',
      export_launch: 'Exporta CSV y lanza campana',
    },
    // Información extendida
    icon: '📨',
    description: `Signal-Based Outreach es un sistema para hacer outreach en LinkedIn usando:
1. Creadores de contenido cuya audiencia coincide con tu ICP
2. Señales de intención (reacciones a posts virales)
3. Lead magnet como primer gesto de valor

Resultado: De ~5% respuestas (outreach frío) a >15% respuestas.`,
    objectives: [
      'Identificar creadores cuya audiencia ES tu ICP',
      'Contactar personas con contexto compartido',
      'Generar 500+ leads ICP cualificados',
      'Lograr >15% tasa de respuesta',
    ],
    requirements: [
      'Definición clara de ICP (cargo, industria, tamaño empresa)',
      'Lead magnet listo o definido',
      'Cuenta LinkedIn activa',
      'Acceso a herramientas de scraping (Apify/Phantombuster)',
    ],
    duration: '2-3 días',
    detailedSteps: {
      map_topics: {
        brief: 'Mapea propuesta de valor a temas de contenido',
        detailed:
          'Traduce la propuesta de valor del cliente a un ecosistema de temas de contenido que atraigan al ICP. Incluye temas principales, adyacentes y tangenciales.',
        tips: [
          'El ICP no solo consume contenido sobre el tema principal',
          'Ampliar el radar aumenta el pool de creadores',
        ],
      },
      find_creators: {
        brief: 'Busca creadores cuya audiencia es tu ICP',
        detailed:
          'Genera una lista de creadores candidatos usando búsqueda manual en LinkedIn, Perplexity, scrapers (Apify/Phantombuster) o análisis de creadores conocidos.',
      },
      evaluate_creators: {
        brief: 'Evalúa actividad, viralidad y calidad de audiencia',
        detailed:
          'Evalúa cada creador por: actividad (posts/mes), viralidad (avg likes), alineamiento temático y calidad de audiencia (% comentaristas que son ICP).',
        tips: [
          'Score mínimo para scrapear: 3.5/5 ponderado',
          'Revisar 10 comentaristas para estimar % ICP',
        ],
      },
      select_creators: {
        brief: 'Prioriza creadores para scrapear',
        detailed:
          'Consolida la lista final de creadores y priorízalos. Alta prioridad: score ≥4.0 + tema directo. Media: 3.5-4.0 + tema adyacente.',
      },
      scrape_posts: {
        brief: 'Extrae posts recientes con métricas',
        detailed:
          'Obtén los últimos 20-30 posts de cada creador con sus métricas usando Apify LinkedIn Profile Scraper o Phantombuster.',
      },
      evaluate_posts: {
        brief: 'Puntúa posts por engagement y alineamiento',
        detailed:
          'Evalúa posts por: interacciones totales (mín ≥40), recencia (<90 días), tema alineado y calidad de comentarios. Score 1-10.',
        tips: [
          '8-10: Excelente, scrapear primero',
          '6-7: Bueno, scrapear si hay capacidad',
          '1-5: Descartar',
        ],
      },
      select_posts: {
        brief: 'Selecciona posts para scrapear engagers',
        detailed:
          'Consolida posts seleccionados de todos los creadores. Para 500 leads ICP necesitas ~8-12 posts.',
      },
      scrape_engagers: {
        brief: 'Extrae perfiles de quienes interactuaron',
        detailed:
          'Scrapea personas que interactuaron con los posts usando Apify LinkedIn Post Reactions Scraper. Incluye likes, comentarios y reposts.',
      },
      filter_icp: {
        brief: 'Clasifica leads en ICP / Dudoso / Fuera',
        detailed:
          'Filtra leads por cargo, industria/empresa, geografía y señal de intención. Score mínimo ≥3 para contactar.',
        tips: [
          'Comentario con pregunta = +5 puntos',
          'Comentario cualquiera = +3 puntos',
          'Repost = +2 puntos',
          'Like = +1 punto',
        ],
      },
      lead_magnet_messages: {
        brief: 'Crea lead magnet y mensajes personalizados',
        detailed:
          'Define/produce el lead magnet (checklist, template, mini-guía) y crea templates de mensajes personalizados para comentaristas, likes y reposts.',
        tips: [
          'Ofrece valor primero, no pidas reunión',
          'Máximo 300 caracteres para connection request',
          'Personaliza citando el post o comentario',
        ],
      },
      export_launch: {
        brief: 'Exporta CSV y lanza campaña',
        detailed:
          'Prepara CSV final con campos: linkedin_url, nombre, cargo, empresa, tipo de interacción, mensaje personalizado, score ICP. Lanza respetando límites de LinkedIn (20-25 requests/día).',
      },
    },
    examples: [
      {
        title: 'Agencia de Growth',
        description:
          'Identificó creadores de contenido sobre Product-Led Growth, scrapeó engagers de posts virales y logró 22% tasa de respuesta con lead magnet de checklist.',
      },
      {
        title: 'SaaS de Finanzas',
        description:
          'Encontró CFOs que comentaban posts de fintech influencers, ofreció template de métricas y convirtió 8% en demos.',
      },
    ],
    faqs: [
      {
        question: '¿Cuántos creadores necesito?',
        answer:
          '5-10 creadores seleccionados es suficiente para generar 500+ leads ICP.',
      },
      {
        question: '¿Qué tipo de lead magnet funciona mejor?',
        answer:
          'Checklists y templates tienen la mejor conversión. Deben ser consumibles en <10 minutos.',
      },
      {
        question: '¿Cuál es la tasa de respuesta esperada?',
        answer:
          'Con signal-based outreach + lead magnet: 15-25% respuestas vs 3-8% en outreach frío tradicional.',
      },
    ],
  },
  'seo-seed-keywords': {
    // Información básica
    purpose:
      'Genera 15-20 seed keywords SEO basadas en tu Ideal Customer Profile usando análisis de IA.',
    whenToUse: [
      'Iniciar una estrategia SEO desde cero',
      'Encontrar keywords que tu ICP realmente busca',
      'Validar ideas de contenido antes de producir',
    ],
    outcome:
      'Lista de seed keywords alineadas con pain points y goals de tu ICP.',
    relatedPlaybooks: ['niche_finder', 'ecp'],
    targetAudience: 'SEO managers, content marketers, fundadores',
    steps: {
      define_icp: 'Define tu Ideal Customer Profile',
      generate_keywords: 'IA genera keywords basadas en tu ICP',
      review_keywords: 'Revisa y selecciona las keywords finales',
    },
    // Información extendida
    icon: '🔑',
    description: `SEO Seed Keywords Generator usa IA para generar keywords basadas en tu ICP.

En lugar de adivinar keywords, este playbook analiza:
• Pain points de tu cliente ideal
• Goals y objetivos que quieren lograr
• Cómo buscan soluciones actualmente
• Nivel de expertise técnico

El resultado son keywords que tu audiencia realmente busca.`,
    objectives: [
      'Generar 15-20 seed keywords relevantes',
      'Alinear keywords con pain points reales',
      'Identificar intención de búsqueda del ICP',
      'Crear base para estrategia de contenido',
    ],
    requirements: [
      'Descripción clara de tu producto/servicio',
      'Conocimiento de pain points de tus clientes',
      'Goals y objetivos de tu audiencia',
    ],
    duration: '10-15 minutos',
    detailedSteps: {
      define_icp: {
        brief: 'Define tu Ideal Customer Profile',
        detailed:
          'Completa información sobre tu ICP: producto/servicio, pain points, goals, soluciones actuales, nivel de expertise e industria.',
        tips: [
          'Sé específico en los pain points',
          'Incluye el lenguaje que usa tu audiencia',
          'Menciona cómo buscan soluciones actualmente',
        ],
      },
      generate_keywords: {
        brief: 'IA genera keywords basadas en tu ICP',
        detailed:
          'La IA analiza tu ICP para generar keywords que reflejan cómo tu audiencia busca soluciones a sus problemas.',
      },
      review_keywords: {
        brief: 'Revisa y selecciona las keywords finales',
        detailed:
          'Revisa las keywords generadas, elimina las irrelevantes y selecciona las que mejor se alinean con tu estrategia.',
      },
    },
    examples: [
      {
        title: 'SaaS de Project Management',
        description:
          'Generó keywords como "cómo organizar proyectos freelance", "herramientas gestión equipo remoto" basadas en pain points de equipos distribuidos.',
      },
    ],
    faqs: [
      {
        question: '¿Cuántas keywords debo esperar?',
        answer:
          'El playbook genera 15-20 seed keywords. Puedes expandirlas luego con herramientas SEO tradicionales.',
      },
      {
        question: '¿Son keywords long-tail o head?',
        answer:
          'Son principalmente seed keywords (2-4 palabras) que luego puedes expandir a long-tail según tu estrategia.',
      },
    ],
  },
  'linkedin-post-generator': {
    // Información básica
    purpose:
      'Genera posts virales de LinkedIn basados en tu perfil de creador y contenido existente.',
    whenToUse: [
      'Mantener presencia activa en LinkedIn sin escribir desde cero',
      'Replicar el estilo de posts exitosos',
      'Escalar producción de contenido personal',
    ],
    outcome:
      'Post de LinkedIn listo para publicar con estructura viral y hook optimizado.',
    relatedPlaybooks: ['video_viral_ia', 'ecp'],
    targetAudience: 'Creadores de contenido, personal branding, thought leaders',
    steps: {
      input_profile: 'Define tu perfil de creador',
      add_reference: 'Agrega contenido de referencia',
      generate_post: 'IA genera el post',
      review_post: 'Revisa y aprueba antes de publicar',
    },
    // Información extendida
    icon: '💼',
    description: `LinkedIn Post Generator automatiza la creación de posts usando IA.

El proceso:
1. **Perfil de creador**: Define tu tono, audiencia y temas
2. **Contenido de referencia**: Agrega posts exitosos como inspiración
3. **Generación**: IA crea posts en tu estilo con hooks virales
4. **Review**: Revisa y ajusta antes de publicar

Mantén tu presencia en LinkedIn sin el bloqueo de escritor.`,
    objectives: [
      'Generar posts con estructura viral probada',
      'Mantener consistencia de voz y estilo',
      'Reducir tiempo de creación de contenido',
      'Optimizar hooks para engagement',
    ],
    requirements: [
      'Definición de tu audiencia objetivo',
      'Tono y estilo de comunicación preferido',
      'Ejemplos de posts exitosos (opcional)',
    ],
    duration: '5-10 minutos por post',
    detailedSteps: {
      input_profile: {
        brief: 'Define tu perfil de creador',
        detailed:
          'Especifica tu audiencia objetivo, tono de comunicación, temas principales y cualquier restricción de estilo.',
        tips: [
          'Define si tu tono es profesional, casual o mixto',
          'Lista 3-5 temas principales que cubres',
          'Menciona qué tipo de CTAs prefieres',
        ],
      },
      add_reference: {
        brief: 'Agrega contenido de referencia',
        detailed:
          'Proporciona posts exitosos (tuyos o de otros) como referencia de estructura y estilo. Estos ayudan a la IA a entender qué funciona.',
      },
      generate_post: {
        brief: 'IA genera el post',
        detailed:
          'La IA genera un post completo con hook, cuerpo y CTA basado en tu perfil y referencias proporcionadas.',
      },
      review_post: {
        brief: 'Revisa y aprueba antes de publicar',
        detailed:
          'Revisa el post generado, haz ajustes si es necesario y aprueba para publicación.',
        tips: [
          'Personaliza con anécdotas propias',
          'Ajusta el hook si no te convence',
          'Verifica que el CTA sea claro',
        ],
      },
    },
    examples: [
      {
        title: 'Founder de SaaS',
        description:
          'Genera 3 posts semanales sobre lecciones de emprendimiento, manteniendo engagement promedio de 200+ reacciones.',
      },
    ],
    faqs: [
      {
        question: '¿Necesito dar ejemplos de posts?',
        answer:
          'Es opcional pero muy recomendado. Los ejemplos mejoran significativamente la calidad del output.',
      },
      {
        question: '¿Qué longitud tienen los posts?',
        answer:
          'Se optimizan para el sweet spot de LinkedIn: 150-300 palabras con estructura de whitespace para legibilidad.',
      },
    ],
  },
  'github-fork-to-crm': {
    // Información básica
    purpose:
      'Convierte forks de GitHub en leads de CRM automáticamente usando la API de Pipedrive.',
    whenToUse: [
      'Tienes un producto open source y quieres capturar leads',
      'Quieres hacer outreach a desarrolladores que forkearon tu repo',
      'Necesitas enriquecer datos de GitHub con info de CRM',
    ],
    outcome:
      'Lead creado en Pipedrive con datos de GitHub enriquecidos y notas automáticas.',
    relatedPlaybooks: ['signal_based_outreach'],
    targetAudience: 'DevRel, sales de productos developer-focused, fundadores OSS',
    steps: {
      input_fork: 'Ingresa datos del fork de GitHub',
      fetch_github_user: 'Obtén información del usuario de GitHub',
      check_contact: 'Verifica si existe en Pipedrive',
      decide_create_lead: 'Decide si crear el lead',
      create_lead: 'Crea persona y lead en Pipedrive',
    },
    // Información extendida
    icon: '🔀',
    description: `GitHub Fork to CRM automatiza la captura de leads de desarrolladores.

Cuando alguien forkea tu repositorio:
1. Extrae datos del usuario de GitHub (nombre, email, bio, empresa)
2. Verifica si ya existe en tu CRM
3. Crea automáticamente persona + lead en Pipedrive
4. Agrega notas con contexto del fork

Ideal para productos developer-focused y estrategias DevRel.`,
    objectives: [
      'Capturar leads de desarrolladores interesados',
      'Automatizar entrada de datos a CRM',
      'Enriquecer perfiles con datos de GitHub',
      'Habilitar follow-up personalizado',
    ],
    requirements: [
      'API key de Pipedrive',
      'Token de GitHub (opcional, mejora rate limits)',
      'Repositorio con forks activos',
    ],
    duration: '2-3 minutos por fork',
    detailedSteps: {
      input_fork: {
        brief: 'Ingresa datos del fork de GitHub',
        detailed:
          'Proporciona el username de GitHub, nombre del repositorio y URL del fork.',
      },
      fetch_github_user: {
        brief: 'Obtén información del usuario de GitHub',
        detailed:
          'Se consulta la API de GitHub para obtener: nombre, email (si es público), bio, empresa, ubicación, repos públicos y seguidores.',
      },
      check_contact: {
        brief: 'Verifica si existe en Pipedrive',
        detailed:
          'Busca en Pipedrive por email (si disponible) o username de GitHub para evitar duplicados.',
      },
      decide_create_lead: {
        brief: 'Decide si crear el lead',
        detailed:
          'Revisa los datos obtenidos y decide si crear el lead o saltarlo.',
        tips: [
          'Verifica que el perfil sea de una persona real',
          'Considera la relevancia del fork para tu producto',
        ],
      },
      create_lead: {
        brief: 'Crea persona y lead en Pipedrive',
        detailed:
          'Crea la persona (si no existe) y el lead con título descriptivo. Agrega notas con detalles de GitHub y del fork.',
      },
    },
    examples: [
      {
        title: 'CLI Tool Open Source',
        description:
          'Automatizó captura de 50+ leads/mes de forks, resultando en 5 enterprise trials.',
      },
    ],
    faqs: [
      {
        question: '¿Funciona con otros CRMs?',
        answer:
          'Actualmente soporta Pipedrive. Soporte para HubSpot y Salesforce está en roadmap.',
      },
      {
        question: '¿Qué pasa si el usuario no tiene email público?',
        answer:
          'Se crea el lead con el username de GitHub. Puedes enriquecer manualmente después.',
      },
    ],
  },
}

/**
 * Obtiene el nombre legible de un playbook
 */
export const getPlaybookName = (type: string): string => {
  const names: Record<string, string> = {
    niche_finder: 'Niche Finder',
    ecp: 'ECP Positioning',
    competitor_analysis: 'Competitor Analysis',
    signal_based_outreach: 'Signal-Based Outreach',
    video_viral_ia: 'Video Viral IA',
    'seo-seed-keywords': 'SEO Seed Keywords Generator',
    'linkedin-post-generator': 'LinkedIn Post Generator',
    'github-fork-to-crm': 'GitHub Fork to CRM',
  }
  return names[type] || type
}

/**
 * Formatea el nombre de un paso de snake_case a Title Case
 */
export const formatStepName = (step: string): string => {
  return step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
