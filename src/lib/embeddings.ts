/**
 * Centralized embedding generation utilities
 *
 * This module provides functions to trigger embedding generation for documents
 * stored in knowledge_base_docs. Embeddings are generated via Supabase Edge Function.
 */

/**
 * Triggers embedding generation for a document.
 * This is a fire-and-forget operation that calls the Supabase Edge Function.
 *
 * @param documentId - The UUID of the document in knowledge_base_docs
 * @returns Promise that resolves when the request is sent (not when embeddings are complete)
 */
export async function triggerEmbeddingGeneration(documentId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[embeddings] Missing Supabase credentials for embedding generation')
    return
  }

  try {
    console.log(`[embeddings] Triggering embedding generation for document: ${documentId}`)

    const response = await fetch(
      `${supabaseUrl}/functions/v1/generate-embeddings`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_id: documentId }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[embeddings] Failed for doc ${documentId}: ${response.status} - ${errorText}`)
    } else {
      console.log(`[embeddings] Successfully triggered for document: ${documentId}`)
    }
  } catch (error) {
    console.error(`[embeddings] Error triggering embeddings for doc ${documentId}:`, error)
  }
}

/**
 * Triggers embedding generation for multiple documents.
 * Processes documents in parallel with a concurrency limit.
 *
 * @param documentIds - Array of document UUIDs
 * @param concurrency - Maximum concurrent requests (default: 3)
 */
export async function triggerEmbeddingGenerationBatch(
  documentIds: string[],
  concurrency: number = 3
): Promise<void> {
  if (documentIds.length === 0) return

  console.log(`[embeddings] Triggering batch embedding for ${documentIds.length} documents`)

  // Process in batches to avoid overwhelming the edge function
  for (let i = 0; i < documentIds.length; i += concurrency) {
    const batch = documentIds.slice(i, i + concurrency)
    await Promise.all(batch.map(id => triggerEmbeddingGeneration(id)))
  }
}
