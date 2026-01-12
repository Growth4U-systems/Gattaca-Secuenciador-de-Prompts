// Supabase Edge Function: Generate ECP Step
// Executes a single step of the ECP generation process using Gemini AI

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// System instruction to prevent hallucinations
const SYSTEM_INSTRUCTION = `You are a strict strategic analyst.
Your knowledge base is STRICTLY LIMITED to the context provided below.
Do NOT use your internal training data to answer facts about the client or competitors.
If the information is not in the provided documents, explicitly state: "Information not found in the provided documents."
`

const TOKEN_LIMIT = 2_000_000 // 2M tokens hard limit

interface RequestPayload {
  campaignId: string
  stepName: 'deep_research' | 'step_1' | 'step_2' | 'step_3' | 'step_4'
  selectedDocIds?: string[] // Optional: if not provided, uses project config
}

serve(async (req) => {
  // Handle CORS
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
    const { campaignId, stepName, selectedDocIds } = await req.json() as RequestPayload

    if (!campaignId || !stepName) {
      return new Response(
        JSON.stringify({ error: 'Missing campaignId or stepName' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Load campaign and project data
    const { data: campaign, error: campaignError } = await supabase
      .from('ecp_campaigns')
      .select('*, projects_legacy(*)')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const project = campaign.projects_legacy

    // Log start of execution
    const startTime = Date.now()
    const { data: logEntry } = await supabase
      .from('execution_logs')
      .insert({
        campaign_id: campaignId,
        step_name: stepName,
        status: 'started',
      })
      .select()
      .single()

    // Get document IDs to use for this step
    let docIds = selectedDocIds
    if (!docIds && project.context_config && project.context_config[stepName]) {
      docIds = project.context_config[stepName] as string[]
    }

    // Load documents
    let contextString = ''
    let totalTokens = 0

    if (docIds && docIds.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from('knowledge_base_docs')
        .select('*')
        .in('id', docIds)

      if (docsError) {
        throw new Error('Failed to load documents')
      }

      // Build context from documents
      for (const doc of docs || []) {
        contextString += `\n--- START DOCUMENT: ${doc.filename} (${doc.category}) ---\n`
        contextString += doc.extracted_content
        contextString += `\n--- END DOCUMENT ---\n`
        totalTokens += doc.token_count || 0
      }
    }

    // Add deep research if available (for steps after research)
    if (stepName !== 'deep_research' && campaign.deep_research_text) {
      contextString += `\n--- START DEEP RESEARCH: ${campaign.ecp_name} ---\n`
      contextString += campaign.deep_research_text
      contextString += `\n--- END DEEP RESEARCH ---\n`
      totalTokens += campaign.deep_research_tokens || 0
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

    // Get the prompt template for this step
    let promptTemplate = ''
    switch (stepName) {
      case 'deep_research':
        promptTemplate = project.prompt_deep_research
        break
      case 'step_1':
        promptTemplate = project.prompt_1_find_place
        break
      case 'step_2':
        promptTemplate = project.prompt_2_select_assets
        break
      case 'step_3':
        promptTemplate = project.prompt_3_proof_legit
        break
      case 'step_4':
        promptTemplate = project.prompt_4_final_output
        break
    }

    // Replace variables in prompt
    const finalPrompt = promptTemplate
      .replace(/\{\{client\}\}/g, project.name)
      .replace(/\{\{ecp\}\}/g, campaign.ecp_name)
      .replace(/\{\{problem_core\}\}/g, campaign.problem_core)
      .replace(/\{\{country\}\}/g, campaign.country)
      .replace(/\{\{industry\}\}/g, campaign.industry)

    // Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')!
    const modelName = 'gemini-2.5-pro' // Gemini 2.5 Pro - Maximum quality (2025)

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
                { text: '\n\n--- TASK ---\n\n' + finalPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
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

    // Estimate output tokens
    const outputTokens = Math.ceil(outputText.length / 4)

    // Save output to campaign
    const updateField =
      stepName === 'deep_research'
        ? { deep_research_text: outputText, deep_research_tokens: outputTokens }
        : stepName === 'step_1'
        ? { output_1_find_place: outputText, output_1_tokens: outputTokens }
        : stepName === 'step_2'
        ? { output_2_select_assets: outputText, output_2_tokens: outputTokens }
        : stepName === 'step_3'
        ? { output_3_proof_legit: outputText, output_3_tokens: outputTokens }
        : { output_final_messages: outputText, output_final_tokens: outputTokens }

    await supabase
      .from('ecp_campaigns')
      .update({
        ...updateField,
        status: stepName === 'step_4' ? 'completed' : `${stepName}_complete`,
      })
      .eq('id', campaignId)

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
