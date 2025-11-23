// Supabase Edge Function: Execute Flow Step (Generic)
// Executes a single step from a dynamic flow configuration

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SYSTEM_INSTRUCTION = `You are a strict strategic analyst.
Your knowledge base is STRICTLY LIMITED to the context provided below.
Do NOT use your internal training data to answer facts about the client or competitors.
If the information is not in the provided documents, explicitly state: "Information not found in the provided documents."`

const TOKEN_LIMIT = 2_000_000

type OutputFormat = 'text' | 'markdown' | 'json' | 'csv' | 'html' | 'xml'

interface FlowStep {
  id: string
  name: string
  prompt: string
  base_doc_ids: string[]
  auto_receive_from: string[]
  output_format?: OutputFormat
  model?: string
  temperature?: number
  max_tokens?: number
}

interface RequestPayload {
  campaign_id: string
  step_config: FlowStep
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
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as valid HTML. Use semantic tags like <h1>, <h2>, <p>, <ul>, <li>, <table>, <strong>, <em>, etc. Include proper structure.'
    case 'xml':
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as valid XML. Use proper tag structure with opening and closing tags, attributes where appropriate, and proper nesting.'
    case 'text':
    default:
      return 'OUTPUT FORMAT REQUIREMENT: Format your response as plain text. Use clear paragraphs, simple structure, and avoid special formatting characters.'
  }
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
    const { campaign_id, step_config } = await req.json() as RequestPayload

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
    const promptWithFormat = finalPrompt + '\n\n' + formatInstructions

    // Call Gemini
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')!
    const modelName = step_config.model || 'gemini-1.5-pro-002' // Gemini 1.5 Pro - Higher quota limits for paid API

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              parts: [
                { text: contextString },
                { text: '\n\n--- TASK ---\n\n' + promptWithFormat },
              ],
            },
          ],
          generationConfig: {
            temperature: step_config.temperature || 0.7,
            maxOutputTokens: step_config.max_tokens || 8192,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      throw new Error(`Gemini API error: ${errorText}`)
    }

    const geminiData = await geminiResponse.json()
    const outputText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const usage = geminiData.usageMetadata || {}
    const outputTokens = Math.ceil(outputText.length / 4)

    // Save output to campaign.step_outputs
    const currentStepOutputs = campaign.step_outputs || {}
    currentStepOutputs[step_config.id] = {
      step_name: step_config.name,
      output: outputText,
      tokens: outputTokens,
      status: 'completed',
      completed_at: new Date().toISOString(),
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
        input_tokens: usage.promptTokenCount || totalTokens,
        output_tokens: usage.candidatesTokenCount || outputTokens,
        duration_ms: duration,
        model_used: modelName,
      })
      .eq('id', logEntry.id)

    return new Response(
      JSON.stringify({
        success: true,
        output: outputText,
        tokens: {
          input: usage.promptTokenCount || totalTokens,
          output: usage.candidatesTokenCount || outputTokens,
          total: (usage.promptTokenCount || totalTokens) + (usage.candidatesTokenCount || outputTokens),
        },
        duration_ms: duration,
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
