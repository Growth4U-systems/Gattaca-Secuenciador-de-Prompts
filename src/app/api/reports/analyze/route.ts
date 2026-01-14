import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface CampaignData {
  id: string
  name: string
  country: string
  industry: string
  customVariables: Record<string, string>
  stepOutputs: {
    stepId: string
    stepName: string
    output: string
  }[]
}

interface InconsistencyResult {
  id: string
  type: 'numeric' | 'factual' | 'missing'
  field: string
  description: string
  campaigns: {
    campaignId: string
    campaignName: string
    value: string
    stepId: string
    stepName: string
  }[]
  severity: 'high' | 'medium' | 'low'
  suggestedResolution?: string
}

/**
 * Analyze inconsistencies across multiple campaigns using LLM
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, campaigns, stepIds } = body as {
      projectId: string
      campaigns: CampaignData[]
      stepIds: string[]
    }

    if (!campaigns || campaigns.length < 2) {
      // Need at least 2 campaigns to compare
      return NextResponse.json({
        inconsistencies: [],
        message: 'Need at least 2 campaigns to analyze inconsistencies',
      })
    }

    // Build context for LLM analysis
    const campaignSummaries = campaigns.map(c => {
      const outputs = c.stepOutputs.map(so => `### ${so.stepName}\n${so.output}`).join('\n\n')
      return `## Campaña: ${c.name} (${c.country}, ${c.industry})\n${outputs}`
    }).join('\n\n---\n\n')

    const prompt = `Analiza los siguientes datos de ${campaigns.length} campañas y detecta inconsistencias entre ellas.

IMPORTANTE: Solo reporta inconsistencias REALES donde haya datos contradictorios entre campañas.

Tipos de inconsistencias a buscar:
1. **Numéricas**: Valores numéricos diferentes para el mismo dato (ej: "500 empleados" vs "5000 empleados")
2. **Factuales**: Afirmaciones contradictorias sobre el mismo tema
3. **Faltantes**: Información importante presente en una campaña pero ausente en otras

Para cada inconsistencia encontrada, proporciona:
- field: El campo o dato en conflicto
- type: "numeric", "factual", o "missing"
- severity: "high" (datos críticos contradictorios), "medium" (diferencias importantes), "low" (diferencias menores)
- description: Explicación clara del problema
- campaigns: Lista de campañas involucradas con sus valores específicos
- suggestedResolution: Sugerencia de cómo resolver

DATOS DE LAS CAMPAÑAS:

${campaignSummaries}

---

Responde SOLO con un JSON válido con la estructura:
{
  "inconsistencies": [
    {
      "field": "nombre del campo",
      "type": "numeric|factual|missing",
      "severity": "high|medium|low",
      "description": "descripción del problema",
      "campaigns": [
        {
          "campaignName": "nombre",
          "value": "valor encontrado",
          "stepName": "paso donde se encontró"
        }
      ],
      "suggestedResolution": "sugerencia"
    }
  ]
}

Si no hay inconsistencias, responde: {"inconsistencies": []}`

    // Use OpenAI to analyze (could also use OpenRouter)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un analista experto en detectar inconsistencias en datos. Responde SIEMPRE en JSON válido.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content || '{}'
    let parsed: { inconsistencies: any[] }

    try {
      parsed = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse LLM response:', responseText)
      parsed = { inconsistencies: [] }
    }

    // Add IDs to inconsistencies and map campaign data
    const inconsistencies: InconsistencyResult[] = (parsed.inconsistencies || []).map(
      (inc: any, idx: number) => ({
        id: `inc-${Date.now()}-${idx}`,
        type: inc.type || 'factual',
        field: inc.field || 'Unknown',
        description: inc.description || '',
        campaigns: (inc.campaigns || []).map((c: any) => {
          const campaign = campaigns.find(
            camp => camp.name === c.campaignName || camp.name.includes(c.campaignName)
          )
          const stepOutput = campaign?.stepOutputs.find(so => so.stepName === c.stepName)
          return {
            campaignId: campaign?.id || '',
            campaignName: c.campaignName,
            value: c.value,
            stepId: stepOutput?.stepId || '',
            stepName: c.stepName,
          }
        }),
        severity: inc.severity || 'medium',
        suggestedResolution: inc.suggestedResolution,
      })
    )

    return NextResponse.json({
      inconsistencies,
      analyzed: campaigns.length,
      model: 'gpt-4o-mini',
    })
  } catch (error) {
    console.error('[Reports Analyze] Error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze inconsistencies' },
      { status: 500 }
    )
  }
}
