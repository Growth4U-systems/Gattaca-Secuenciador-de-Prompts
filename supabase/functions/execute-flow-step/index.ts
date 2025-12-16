// Supabase Edge Function: Execute Flow Step (Multi-Provider)
// Supports Gemini, OpenAI, and Perplexity

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SYSTEM_INSTRUCTION = `You are a strict strategic analyst.
Your knowledge base is STRICTLY LIMITED to the context provided below.
Do NOT use your internal training data to answer facts about the client or competitors.
If the information is not in the provided documents, explicitly state: "Information not found in the provided documents."`

const TOKEN_LIMIT = 2_000_000

type OutputFormat = 'text' | 'markdown' | 'json' | 'csv' | 'html' | 'xml'
type AIProvider = 'gemini' | 'openai' | 'perplexity'

interface FlowStep {
  id: string
  name: string
  prompt: string
  base_doc_ids: string[]
  auto_receive_from: string[]
  output_format?: OutputFormat
  model?: string
  provider?: AIProvider
  temperature?: number
  max_tokens?: number
}

interface RequestPayload {
  campaign_id: string
  step_config: FlowStep
  model?: string
  provider?: AIProvider
}

function getFormatInstructions(format: OutputFormat): string {
  switch (format) {
    case 'markdown':
      return 'OUTPUT FORMAT REQUIREMENT: Format your response using Markdown syntax with proper headings (#, ##, ###), lists (- or 1.), **bold**, *italic*, code blocks (```), and tables where appropriate.'
    case 'json':
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as valid JSON. Use proper structure with objects {}, arrays [], strings "", numbers, and booleans. Ensure the JSON is parseable.'
    case 'csv':
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as CSV (Comma-Separated Values). Use the first row for headers, separate columns with commas, and wrap fields containing commas in double quotes.'
    case 'html':
      return `OUTPUT FORMAT REQUIREMENT: Format your response as clean, well-structured HTML suitable for Google Docs import.
Requirements:
- Start with <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Document</title></head><body>
- Use semantic tags: <h1>, <h2>, <h3> for headings
- Use <p> for paragraphs, <ul>/<ol> and <li> for lists
- Use <strong> for bold, <em> for italic
- Use <table>, <thead>, <tbody>, <tr>, <th>, <td> for tables
- Add proper spacing with <br> where needed
- Close with </body></html>
- Keep it clean and professional - Google Docs compatible`
    case 'xml':
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as valid XML. Use proper tag structure with opening and closing tags, attributes where appropriate, and proper nesting.'
    case 'text':
    default:
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as plain text. Use clear paragraphs, simple structure, and avoid special formatting characters.'
  }
}

// Gemini API call
async function callGemini(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')!

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${errorText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const usage = data.usageMetadata || {}

  return {
    text,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || Math.ceil(text.length / 4),
  }
}

// OpenAI API call
async function callOpenAI(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')!

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${errorText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  const usage = data.usage || {}

  return {
    text,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || Math.ceil(text.length / 4),
  }
}

// Perplexity API call
async function callPerplexity(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY')!

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Perplexity API error: ${errorText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  const usage = data.usage || {}

  return {
    text,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || Math.ceil(text.length / 4),
  }
}

// Determine provider from model name
function getProviderFromModel(model: string): AIProvider {
  if (model.startsWith('gemini')) return 'gemini'
  if (model.startsWith('gpt') || model.startsWith('o1')) return 'openai'
  if (model.startsWith('sonar')) return 'perplexity'
  return 'gemini' // default
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const payload = await req.json() as RequestPayload
    const { campaign_id, step_config, model: overrideModel, provider: overrideProvider } = payload

    if (!campaign_id || !step_config) {
      return new Response(
        JSON.stringify({ error: 'Missing campaign_id or step_config' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Load campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('ecp_campaigns')
      .select('*, projects(*)')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const project = campaign.projects
    const startTime = Date.now()

    // Determine model and provider (override > step_config > defaults)
    const modelName = overrideModel || step_config.model || 'gemini-2.5-flash'
    const provider = overrideProvider || step_config.provider || getProviderFromModel(modelName)

    // Log execution start
    const { data: logEntry } = await supabase
      .from('execution_logs')
      .insert({
        campaign_id: campaign_id,
        step_name: step_config.name,
        status: 'started',
      })
      .select()
      .single()

    // Build context
    let contextString = ''
    let totalTokens = 0

    // 1. Load base documents
    if (step_config.base_doc_ids && step_config.base_doc_ids.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from('knowledge_base_docs')
        .select('*')
        .in('id', step_config.base_doc_ids)

      if (docsError) {
        throw new Error(`Failed to load documents: ${docsError.message}`)
      }

      for (const doc of docs || []) {
        contextString += `\n--- START DOCUMENT: ${doc.filename} (${doc.category}) ---\n`
        contextString += doc.extracted_content
        contextString += `\n--- END DOCUMENT ---\n`
        totalTokens += doc.token_count || 0
      }
    }

    // 2. Load outputs from previous steps
    if (step_config.auto_receive_from && step_config.auto_receive_from.length > 0) {
      const stepOutputs = campaign.step_outputs || {}

      for (const prevStepId of step_config.auto_receive_from) {
        const prevOutput = stepOutputs[prevStepId]
        if (prevOutput && prevOutput.output) {
          contextString += `\n--- START PREVIOUS STEP: ${prevOutput.step_name || prevStepId} ---\n`
          contextString += prevOutput.output
          contextString += `\n--- END PREVIOUS STEP ---\n`
          totalTokens += prevOutput.tokens || Math.ceil(prevOutput.output.length / 4)
        }
      }
    }

    // Check token limit
    if (totalTokens > TOKEN_LIMIT) {
      await supabase
        .from('execution_logs')
        .update({
          status: 'error',
          error_details: `Context exceeds token limit: ${totalTokens} > ${TOKEN_LIMIT}`,
          duration_ms: Date.now() - startTime,
        })
        .eq('id', logEntry.id)

      return new Response(
        JSON.stringify({
          error: 'Context exceeds token limit',
          totalTokens,
          limit: TOKEN_LIMIT,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Replace variables in prompt
    let finalPrompt = step_config.prompt
      .replace(/\{\{ecp_name\}\}/g, campaign.ecp_name || '')
      .replace(/\{\{problem_core\}\}/g, campaign.problem_core || '')
      .replace(/\{\{country\}\}/g, campaign.country || '')
      .replace(/\{\{industry\}\}/g, campaign.industry || '')
      .replace(/\{\{client_name\}\}/g, project.name || '')

    // Replace custom variables
    const customVariables = campaign.custom_variables || {}
    for (const [key, value] of Object.entries(customVariables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      finalPrompt = finalPrompt.replace(regex, String(value))
    }

    // Add output format instructions if specified
    const outputFormat = step_config.output_format || 'text'
    const formatInstructions = getFormatInstructions(outputFormat)

    // Combine context and prompt
    const userPrompt = contextString + '\n\n--- TASK ---\n\n' + finalPrompt + '\n\n' + formatInstructions

    // Call the appropriate provider
    const temperature = step_config.temperature || 0.7
    const maxTokens = step_config.max_tokens || 8192

    let result: { text: string; inputTokens: number; outputTokens: number }

    console.log(`Executing with provider: ${provider}, model: ${modelName}`)

    switch (provider) {
      case 'openai':
        result = await callOpenAI(modelName, SYSTEM_INSTRUCTION, userPrompt, temperature, maxTokens)
        break
      case 'perplexity':
        result = await callPerplexity(modelName, SYSTEM_INSTRUCTION, userPrompt, temperature, maxTokens)
        break
      case 'gemini':
      default:
        result = await callGemini(modelName, SYSTEM_INSTRUCTION, userPrompt, temperature, maxTokens)
        break
    }

    // Save output to campaign.step_outputs
    const currentStepOutputs = campaign.step_outputs || {}
    currentStepOutputs[step_config.id] = {
      step_name: step_config.name,
      output: result.text,
      tokens: result.outputTokens,
      status: 'completed',
      completed_at: new Date().toISOString(),
      model: modelName,
      provider: provider,
    }

    await supabase
      .from('ecp_campaigns')
      .update({
        step_outputs: currentStepOutputs,
      })
      .eq('id', campaign_id)

    // Log completion
    const duration = Date.now() - startTime
    await supabase
      .from('execution_logs')
      .update({
        status: 'completed',
        input_tokens: result.inputTokens || totalTokens,
        output_tokens: result.outputTokens,
        duration_ms: duration,
        model_used: `${provider}/${modelName}`,
      })
      .eq('id', logEntry.id)

    return new Response(
      JSON.stringify({
        success: true,
        output: result.text,
        tokens: {
          input: result.inputTokens || totalTokens,
          output: result.outputTokens,
          total: (result.inputTokens || totalTokens) + result.outputTokens,
        },
        duration_ms: duration,
        model: modelName,
        provider: provider,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
