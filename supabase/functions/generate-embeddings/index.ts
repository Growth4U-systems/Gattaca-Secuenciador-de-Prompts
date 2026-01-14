import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OpenAI embedding model
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSION = 1536
const CHUNK_SIZE = 500 // tokens (approximately 2000 characters)
const CHUNK_OVERLAP = 50 // tokens overlap between chunks

interface ChunkData {
  content: string
  startChar: number
  endChar: number
  tokenCount: number
}

// Simple token estimation (4 chars ≈ 1 token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Split document into chunks
function splitIntoChunks(content: string): ChunkData[] {
  const chunks: ChunkData[] = []
  const chunkCharSize = CHUNK_SIZE * 4 // Convert tokens to chars
  const overlapCharSize = CHUNK_OVERLAP * 4

  let startChar = 0

  while (startChar < content.length) {
    // Find end of chunk
    let endChar = Math.min(startChar + chunkCharSize, content.length)

    // Try to end at sentence boundary
    if (endChar < content.length) {
      const lastPeriod = content.lastIndexOf('.', endChar)
      const lastNewline = content.lastIndexOf('\n', endChar)
      const boundary = Math.max(lastPeriod, lastNewline)

      if (boundary > startChar + chunkCharSize * 0.5) {
        endChar = boundary + 1
      }
    }

    const chunkContent = content.slice(startChar, endChar).trim()

    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        startChar,
        endChar,
        tokenCount: estimateTokens(chunkContent),
      })
    }

    // Move to next chunk with overlap
    startChar = endChar - overlapCharSize
    if (startChar >= content.length - overlapCharSize) break
  }

  return chunks
}

// Generate embeddings using OpenAI API
async function generateEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return data.data.map((item: { embedding: number[] }) => item.embedding)
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { document_id } = await req.json()

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'document_id is required' }),
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

    // Update status to processing
    await supabase
      .from('knowledge_base_docs')
      .update({ embedding_status: 'processing' })
      .eq('id', document_id)

    // Get document content
    const { data: doc, error: docError } = await supabase
      .from('knowledge_base_docs')
      .select('id, extracted_content, filename, token_count')
      .eq('id', document_id)
      .single()

    if (docError || !doc) {
      throw new Error(`Document not found: ${docError?.message || 'Unknown error'}`)
    }

    console.log(`Processing document: ${doc.filename} (${doc.token_count} tokens)`)

    // Delete existing chunks for this document
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', document_id)

    // Split into chunks
    const chunks = splitIntoChunks(doc.extracted_content || '')
    console.log(`Split into ${chunks.length} chunks`)

    if (chunks.length === 0) {
      await supabase
        .from('knowledge_base_docs')
        .update({
          embedding_status: 'completed',
          embedding_created_at: new Date().toISOString(),
        })
        .eq('id', document_id)

      return new Response(
        JSON.stringify({ success: true, chunks: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate embeddings in batches (OpenAI allows up to 2048 inputs)
    const BATCH_SIZE = 100
    const allEmbeddings: number[][] = []

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const texts = batch.map(c => c.content)
      console.log(`Generating embeddings for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`)

      const embeddings = await generateEmbeddings(texts, openaiKey)
      allEmbeddings.push(...embeddings)
    }

    // Insert chunks with embeddings
    const chunkRecords = chunks.map((chunk, index) => ({
      document_id,
      chunk_index: index,
      content: chunk.content,
      token_count: chunk.tokenCount,
      embedding: `[${allEmbeddings[index].join(',')}]`, // pgvector format
      start_char: chunk.startChar,
      end_char: chunk.endChar,
    }))

    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(chunkRecords)

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`)
    }

    // Update document status
    await supabase
      .from('knowledge_base_docs')
      .update({
        embedding_status: 'completed',
        embedding_model: EMBEDDING_MODEL,
        embedding_created_at: new Date().toISOString(),
      })
      .eq('id', document_id)

    console.log(`Successfully processed ${chunks.length} chunks for document ${doc.filename}`)

    return new Response(
      JSON.stringify({
        success: true,
        document_id,
        filename: doc.filename,
        chunks: chunks.length,
        total_tokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error generating embeddings:', error)

    // Try to update status to error
    try {
      const { document_id } = await req.clone().json()
      if (document_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        await supabase
          .from('knowledge_base_docs')
          .update({ embedding_status: 'error' })
          .eq('id', document_id)
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
