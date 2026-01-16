import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  STEP_1_CLEAN_FILTER_PROMPT,
  STEP_2_SCORING_PROMPT,
  STEP_3_CONSOLIDATE_PROMPT,
} from '@/lib/templates/niche-finder-playbook'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for LLM analysis

type Params = { params: Promise<{ id: string }> }

// Step configurations
const ANALYSIS_STEPS = [
  {
    number: 1,
    name: 'clean_filter',
    displayName: 'Limpiar y Filtrar Nichos',
    prompt: STEP_1_CLEAN_FILTER_PROMPT,
    model: 'openai/gpt-4o-mini',
    temperature: 0.5,
    maxTokens: 8192,
    status: 'analyzing_1',
  },
  {
    number: 2,
    name: 'scoring',
    displayName: 'Scoring (Deep Research)',
    prompt: STEP_2_SCORING_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.8,
    maxTokens: 16384,
    status: 'analyzing_2',
  },
  {
    number: 3,
    name: 'consolidate',
    displayName: 'Tabla Final Consolidada',
    prompt: STEP_3_CONSOLIDATE_PROMPT,
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 8192,
    status: 'analyzing_3',
  },
]

// OpenRouter API call
async function callOpenRouter(
  model: string,
  prompt: string,
  content: string,
  temperature: number,
  maxTokens: number,
  apiKey: string
): Promise<{ output: string; tokens_input: number; tokens_output: number }> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://gattaca.app',
      'X-Title': 'Gattaca Niche Finder',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: content,
        },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${error}`)
  }

  const data = await response.json()
  return {
    output: data.choices?.[0]?.message?.content || '',
    tokens_input: data.usage?.prompt_tokens || 0,
    tokens_output: data.usage?.completion_tokens || 0,
  }
}

// Calculate cost based on model and tokens
function calculateCost(model: string, tokensInput: number, tokensOutput: number): number {
  // Prices per 1M tokens (approximate)
  const pricing: Record<string, { input: number; output: number }> = {
    'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
    'openai/gpt-4o': { input: 2.5, output: 10 },
    'google/gemini-2.5-pro-preview': { input: 1.25, output: 5 },
    'anthropic/claude-sonnet-4': { input: 3, output: 15 },
  }
  const price = pricing[model] || { input: 0.5, output: 1.5 }
  return (tokensInput * price.input + tokensOutput * price.output) / 1_000_000
}

// Replace variables in prompt
function replaceVariables(prompt: string, variables: Record<string, string>): string {
  let result = prompt
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
  }
  return result
}

// Custom step configuration from request body
interface CustomStepConfig {
  prompt?: string
  model?: string
}

interface RequestBody {
  steps?: {
    step1?: CustomStepConfig
    step2?: CustomStepConfig
    step3?: CustomStepConfig
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const openrouterApiKey = process.env.OPENROUTER_API_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  if (!openrouterApiKey) {
    return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id: jobId } = await params

  // Parse request body for custom step configurations
  let customSteps: RequestBody['steps'] = {}
  try {
    const body: RequestBody = await request.json()
    customSteps = body.steps || {}
  } catch {
    // No body or invalid JSON - use defaults
  }

  try {
    // Get job with project info
    const { data: job, error: jobError } = await supabase
      .from('niche_finder_jobs')
      .select('*, projects(name, description, settings)')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check if job is ready for analysis
    const validStatuses = ['extract_done', 'extracting', 'analyzing_1', 'analyzing_2', 'analyzing_3']
    if (!validStatuses.includes(job.status) && job.status !== 'completed') {
      // If extracting just completed, we can start analysis
      if (job.status === 'extracting' || job.niches_extracted > 0) {
        // Allow to proceed
      } else {
        return NextResponse.json(
          { error: `Cannot analyze job in status: ${job.status}. Need extract_done or extracting with niches.` },
          { status: 400 }
        )
      }
    }

    // Get all extracted niches
    const { data: niches, error: nichesError } = await supabase
      .from('niche_finder_extracted')
      .select('*')
      .eq('job_id', jobId)

    if (nichesError || !niches || niches.length === 0) {
      return NextResponse.json(
        { error: 'No niches found for analysis. Run extraction first.' },
        { status: 400 }
      )
    }

    // Get project variables for prompt replacement
    const projectSettings = job.projects?.settings || {}
    const variables: Record<string, string> = {
      company_name: projectSettings.company_name || job.projects?.name || 'la empresa',
      product: projectSettings.product || 'el producto',
      industry: projectSettings.industry || 'la industria',
      target: projectSettings.target || 'usuarios objetivo',
      country: projectSettings.country || 'España',
    }

    // Format niches as CSV input for Step 1
    const nichesCSV = niches
      .map(
        (n) =>
          `"${n.problem || ''}";"${n.persona || ''}";"${n.functional_cause || ''}";"${n.emotional_load || ''}";"${n.evidence || ''}";"${n.alternatives || ''}";"${n.source_url || ''}"`
      )
      .join('\n')

    const csvHeader =
      '"Problem";"Persona";"Functional Cause";"Emotional Load";"Evidence";"Alternatives";"URL"'
    let currentInput = `${csvHeader}\n${nichesCSV}`

    // Update job status to start analysis
    await supabase
      .from('niche_finder_jobs')
      .update({
        status: 'analyzing_1',
        current_analysis_step: 1,
        analysis_started_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    const stepOutputs: { step: number; output: string; tokens: number; cost: number }[] = []

    // Execute each analysis step
    for (const step of ANALYSIS_STEPS) {
      // Get custom configuration for this step (if provided)
      const customConfig = customSteps?.[`step${step.number}` as keyof typeof customSteps]
      const stepPrompt = customConfig?.prompt || step.prompt
      const stepModel = customConfig?.model || step.model

      // Update job status for current step
      await supabase
        .from('niche_finder_jobs')
        .update({
          status: step.status,
          current_analysis_step: step.number,
        })
        .eq('id', jobId)

      // Create step output record
      const { data: stepRecord, error: stepRecordError } = await supabase
        .from('niche_finder_step_outputs')
        .insert({
          job_id: jobId,
          step_number: step.number,
          step_name: step.name,
          input_content: currentInput.substring(0, 50000), // Limit stored input
          model: stepModel,
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (stepRecordError) {
        console.error('Error creating step record:', stepRecordError)
      }

      try {
        // Build prompt with variables (use custom prompt if provided)
        const finalPrompt = replaceVariables(stepPrompt, variables)

        // For Step 2, include Step 1 output
        // For Step 3, include Step 1 and Step 2 outputs
        let inputForStep = currentInput
        if (step.number === 3 && stepOutputs.length >= 2) {
          inputForStep = `## TABLA DE NICHOS FILTRADOS (Step 1):\n${stepOutputs[0].output}\n\n## ANÁLISIS DE SCORING (Step 2):\n${stepOutputs[1].output}`
        }

        // Call OpenRouter
        const result = await callOpenRouter(
          stepModel,
          finalPrompt,
          inputForStep,
          step.temperature,
          step.maxTokens,
          openrouterApiKey
        )

        const cost = calculateCost(stepModel, result.tokens_input, result.tokens_output)

        // Update step output record
        if (stepRecord) {
          await supabase
            .from('niche_finder_step_outputs')
            .update({
              output_content: result.output,
              tokens_input: result.tokens_input,
              tokens_output: result.tokens_output,
              cost_usd: cost,
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', stepRecord.id)
        }

        // Record cost
        await supabase.from('niche_finder_costs').insert({
          job_id: jobId,
          cost_type: `llm_analysis_${step.number}`,
          service: 'openrouter',
          units: result.tokens_input + result.tokens_output,
          cost_usd: cost,
          metadata: {
            model: stepModel,
            tokens_input: result.tokens_input,
            tokens_output: result.tokens_output,
            step_name: step.name,
          },
        })

        stepOutputs.push({
          step: step.number,
          output: result.output,
          tokens: result.tokens_input + result.tokens_output,
          cost,
        })

        // Use output as input for next step
        currentInput = result.output
      } catch (stepError) {
        // Update step output record with error
        if (stepRecord) {
          await supabase
            .from('niche_finder_step_outputs')
            .update({
              status: 'failed',
              error_message: stepError instanceof Error ? stepError.message : 'Unknown error',
              completed_at: new Date().toISOString(),
            })
            .eq('id', stepRecord.id)
        }

        // Update job status
        await supabase
          .from('niche_finder_jobs')
          .update({
            status: 'failed',
            error_message: `Failed at step ${step.number} (${step.displayName}): ${stepError instanceof Error ? stepError.message : 'Unknown error'}`,
          })
          .eq('id', jobId)

        throw stepError
      }
    }

    // All steps completed successfully
    await supabase
      .from('niche_finder_jobs')
      .update({
        status: 'completed',
        current_analysis_step: 3,
        analysis_completed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    const totalCost = stepOutputs.reduce((sum, s) => sum + s.cost, 0)
    const totalTokens = stepOutputs.reduce((sum, s) => sum + s.tokens, 0)

    return NextResponse.json({
      success: true,
      jobId,
      steps_completed: stepOutputs.length,
      total_tokens: totalTokens,
      total_cost_usd: totalCost,
      message: 'Analysis completed successfully',
    })
  } catch (error) {
    console.error('Analysis error:', error)

    // Update job status on error
    await supabase
      .from('niche_finder_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error during analysis',
      })
      .eq('id', jobId)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error during analysis' },
      { status: 500 }
    )
  }
}
