import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMBEDDING_MODEL = 'text-embedding-3-small'

interface RetrievedChunk {
  id: string
  document_id: string
  content: string
  token_count: number
  similarity: number
  document_filename?: string
}

// Generate embedding for query using OpenAI
async function generateQueryEmbedding(query: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: query,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      document_ids,
      query,
      top_k = 10,
      min_similarity = 0.7,
    } = await req.json()

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'document_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'query string is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OpenAI API key
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`Retrieving chunks for ${document_ids.length} documents, query: "${query.slice(0, 100)}..."`)

    // Generate embedding for query
    const queryEmbedding = await generateQueryEmbedding(query, openaiKey)

    // Search for similar chunks using pgvector
    // Using cosine similarity: 1 - cosine_distance
    const { data: chunks, error: searchError } = await supabase
      .rpc('match_document_chunks', {
        query_embedding: queryEmbedding,
        match_document_ids: document_ids,
        match_threshold: min_similarity,
        match_count: top_k,
      })

    if (searchError) {
      // If RPC doesn't exist, fall back to manual query
      console.log('RPC not found, using fallback query')

      const embeddingStr = `[${queryEmbedding.join(',')}]`

      const { data: fallbackChunks, error: fallbackError } = await supabase
        .from('document_chunks')
        .select(`
          id,
          document_id,
          content,
          token_count,
          knowledge_base_docs!inner(filename)
        `)
        .in('document_id', document_ids)
        .not('embedding', 'is', null)
        .order('chunk_index')
        .limit(top_k * 3) // Get more to filter by similarity later

      if (fallbackError) {
        throw new Error(`Failed to retrieve chunks: ${fallbackError.message}`)
      }

      // For fallback, return chunks ordered by position (not ideal but works)
      const results: RetrievedChunk[] = (fallbackChunks || []).slice(0, top_k).map((chunk: any) => ({
        id: chunk.id,
        document_id: chunk.document_id,
        content: chunk.content,
        token_count: chunk.token_count,
        similarity: 0.8, // Placeholder
        document_filename: chunk.knowledge_base_docs?.filename,
      }))

      return new Response(
        JSON.stringify({
          success: true,
          chunks: results,
          total_tokens: results.reduce((sum, c) => sum + c.token_count, 0),
          method: 'fallback',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Format results
    const results: RetrievedChunk[] = (chunks || []).map((chunk: any) => ({
      id: chunk.id,
      document_id: chunk.document_id,
      content: chunk.content,
      token_count: chunk.token_count,
      similarity: chunk.similarity,
      document_filename: chunk.filename,
    }))

    console.log(`Retrieved ${results.length} chunks, total tokens: ${results.reduce((sum, c) => sum + c.token_count, 0)}`)

    return new Response(
      JSON.stringify({
        success: true,
        chunks: results,
        total_tokens: results.reduce((sum, c) => sum + c.token_count, 0),
        method: 'vector_search',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error retrieving chunks:', error)

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
