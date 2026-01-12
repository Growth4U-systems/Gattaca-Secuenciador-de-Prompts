import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Documentos de ejemplo para Tier 1
const EXAMPLE_DOCUMENTS = [
  {
    title: 'Brand DNA - Acme Corp',
    document_type: 'brand_dna',
    tier: 1,
    content: `# Brand DNA - Acme Corp

## Misión
Democratizar la tecnología para empoderar a pequeños negocios en América Latina.

## Visión
Ser el partner tecnológico #1 para PyMEs en LATAM para 2030.

## Valores Fundamentales
1. **Innovación Accesible** - Hacemos la tecnología de punta accesible para todos
2. **Cercanía** - Hablamos el idioma de nuestros clientes, no jerga técnica
3. **Confiabilidad** - Cumplimos lo que prometemos, siempre
4. **Agilidad** - Nos movemos rápido y adaptamos constantemente

## Propuesta de Valor Única
"Tecnología empresarial con corazón de startup" - Ofrecemos soluciones de nivel enterprise
con la flexibilidad, precio y atención personalizada que las PyMEs necesitan.

## Personalidad de Marca
- **Tono:** Cercano pero profesional
- **Voz:** Como un amigo experto que te explica las cosas claras
- **Actitud:** Optimista, proactivo, resolutivo

## Diferenciadores Clave
1. Soporte en español 24/7 con humanos reales
2. Precios en moneda local sin sorpresas
3. Implementación en días, no meses
4. Integraciones nativas con sistemas locales (SAT, AFIP, SII)

## Arquetipos de Cliente Ideal
- Dueños de PyMEs con 5-50 empleados
- Gerentes de operaciones buscando eficiencia
- CFOs de empresas medianas en crecimiento`,
    content_format: 'markdown',
    authority_score: 1.0,
    token_count: 850,
  },
  {
    title: 'Tone of Voice - Acme Corp',
    document_type: 'tone_of_voice',
    tier: 1,
    content: `# Tone of Voice - Acme Corp

## Principios de Comunicación

### 1. Claridad Ante Todo
- Usamos palabras simples, evitamos tecnicismos innecesarios
- Si hay que usar un término técnico, lo explicamos
- Frases cortas y directas

### 2. Cercanía Sin Perder Profesionalismo
✅ "Te ayudamos a automatizar tu negocio"
❌ "Proveemos soluciones de automatización empresarial"

✅ "¿Tienes dudas? Escríbenos por WhatsApp"
❌ "Para consultas, contacte a nuestro departamento de soporte"

### 3. Optimismo Realista
- Siempre positivos pero sin prometer imposibles
- Celebramos los logros de nuestros clientes
- Reconocemos los retos pero mostramos el camino

## Vocabulario de Marca

### Palabras que Usamos
- Solución, herramienta, plataforma
- Crecer, escalar, optimizar
- Acompañar, guiar, apoyar
- Simple, claro, directo

### Palabras que Evitamos
- Disruptivo, innovador (muy gastadas)
- Sinergia, apalancamiento (jerga corporativa)
- Líder del mercado (pretencioso)
- Problema (usamos "reto" o "oportunidad")

## Formato y Estilo

### En Redes Sociales
- Emojis con moderación (1-2 por post)
- Hashtags relevantes (máximo 5)
- Preguntas para generar engagement
- Historias de clientes reales

### En Email Marketing
- Asunto: Máximo 50 caracteres, con beneficio claro
- Saludo personalizado cuando sea posible
- Un solo CTA por email
- P.S. para información adicional

### En Contenido Largo
- Títulos que prometen beneficio concreto
- Subtítulos cada 200-300 palabras
- Listas y bullets para facilitar lectura
- Ejemplos reales de LATAM`,
    content_format: 'markdown',
    authority_score: 1.0,
    token_count: 920,
  },
  {
    title: 'ICP - Buyer Persona Principal',
    document_type: 'icp',
    tier: 1,
    content: `# Ideal Customer Profile (ICP) - Acme Corp

## Perfil Demográfico

### Datos Básicos
- **Nombre arquetipo:** "Carlos el Emprendedor"
- **Edad:** 35-50 años
- **Género:** 65% masculino, 35% femenino
- **Ubicación:** Ciudades principales de México, Colombia, Argentina, Chile
- **Educación:** Universidad completa, frecuentemente MBA o especialización

### Rol y Empresa
- **Cargo:** CEO, Director General, o Dueño de PyME
- **Tamaño empresa:** 10-100 empleados
- **Facturación anual:** $500K - $5M USD
- **Industrias principales:** Retail, servicios, manufactura ligera, distribución

## Perfil Psicográfico

### Metas y Aspiraciones
1. Escalar el negocio sin perder control
2. Competir con empresas más grandes
3. Profesionalizar operaciones
4. Liberar tiempo para estrategia

### Frustraciones y Dolores
1. "Paso demasiado tiempo en tareas operativas"
2. "Mi equipo usa Excel para todo y perdemos información"
3. "Los sistemas empresariales son muy caros o complicados"
4. "No tengo visibilidad real de mi negocio"

### Miedos
- Invertir en tecnología que no funcione
- Que el equipo no adopte las herramientas
- Depender de proveedores que no entienden su realidad
- Quedar atrás frente a la competencia

## Comportamiento de Compra

### Proceso de Decisión
1. **Trigger:** Crisis operativa o oportunidad de crecimiento
2. **Investigación:** Google, recomendaciones de colegas, LinkedIn
3. **Evaluación:** Demo, prueba gratuita, referencias
4. **Decisión:** 2-8 semanas, involucra 1-3 personas

### Criterios de Selección (en orden)
1. Facilidad de uso
2. Soporte en español
3. Precio justo y predecible
4. Casos de éxito similares
5. Tiempo de implementación

### Objeciones Comunes
- "Ya tenemos un sistema" → Mostrar integración
- "Es muy caro" → ROI en 3 meses
- "Mi equipo no lo va a usar" → Capacitación incluida
- "No tengo tiempo para implementarlo" → Setup en 48hrs

## Dónde Encontrarlos

### Canales Digitales
- LinkedIn (grupos de emprendedores)
- WhatsApp (grupos de negocios)
- YouTube (buscan tutoriales)
- Podcasts de negocios en español

### Eventos y Comunidades
- Cámaras de comercio locales
- Eventos de emprendimiento
- Ferias sectoriales
- Masterminds de empresarios`,
    content_format: 'markdown',
    authority_score: 1.0,
    token_count: 1200,
  },
]

/**
 * POST /api/v2/seed/example-documents
 * Crea documentos de ejemplo para probar playbooks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId } = body

    if (!clientId) {
      return NextResponse.json(
        { error: 'Missing clientId parameter' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()
    const createdDocs = []

    for (const doc of EXAMPLE_DOCUMENTS) {
      const slug = doc.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36)

      const { data, error } = await supabase
        .from('documents')
        .insert({
          client_id: clientId,
          title: doc.title,
          slug,
          tier: doc.tier,
          document_type: doc.document_type,
          content: doc.content,
          content_format: doc.content_format,
          approval_status: 'approved',  // Pre-aprobados para usar inmediatamente
          authority_score: doc.authority_score,
          token_count: doc.token_count,
          validity_start: new Date().toISOString().split('T')[0],
          source_type: 'manual',
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating document:', error)
        continue
      }

      createdDocs.push(data)
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdDocs.length} example documents`,
      documents: createdDocs,
    })
  } catch (error) {
    console.error('Seed documents error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v2/seed/example-documents
 * Muestra información sobre los documentos de ejemplo disponibles.
 */
export async function GET() {
  return NextResponse.json({
    message: 'Example documents seed endpoint',
    usage: 'POST with { clientId: "your-client-id" } to create example Tier 1 documents',
    documents: EXAMPLE_DOCUMENTS.map(d => ({
      title: d.title,
      type: d.document_type,
      tier: d.tier,
      tokens: d.token_count,
    })),
  })
}
