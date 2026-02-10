/**
 * Metadata Extractor
 *
 * Uses AI to analyze a competitor's website and extract:
 * - Business description (1-2 lines)
 * - Industry/category
 * - Target audience
 */

import type { CompetitorMetadata } from './types'

interface MetadataExtractionOptions {
  openrouterApiKey?: string
  perplexityApiKey?: string
}

/**
 * Extract competitor metadata from their website using AI
 */
export async function extractCompetitorMetadata(
  competitorName: string,
  websiteUrl: string,
  options: MetadataExtractionOptions
): Promise<CompetitorMetadata | null> {
  console.log(`[metadataExtractor] Extracting metadata for ${competitorName} from ${websiteUrl}`)

  try {
    // Prefer Perplexity for web analysis (has better web search)
    if (options.perplexityApiKey) {
      return await extractWithPerplexity(competitorName, websiteUrl, options.perplexityApiKey)
    } else if (options.openrouterApiKey) {
      return await extractWithOpenRouter(competitorName, websiteUrl, options.openrouterApiKey)
    } else {
      console.warn('[metadataExtractor] No API keys available for metadata extraction')
      return null
    }
  } catch (error) {
    console.error('[metadataExtractor] Error extracting metadata:', error)
    return null
  }
}

/**
 * Extract metadata using Perplexity API
 */
async function extractWithPerplexity(
  competitorName: string,
  websiteUrl: string,
  apiKey: string
): Promise<CompetitorMetadata> {
  const websiteDomain = new URL(websiteUrl).hostname.replace('www.', '')

  const prompt = `Analyze the company "${competitorName}" (website: ${websiteUrl})

Your task: Extract key business information by visiting their website.

REQUIRED OUTPUT (JSON format):
{
  "description": "Brief 1-2 sentence description of what the company does",
  "industry": "Primary industry/category (e.g., 'Fintech', 'E-commerce', 'SaaS', 'Healthcare')",
  "targetAudience": "Primary target customer segment (e.g., 'SMBs', 'Consumers', 'Enterprise', 'Developers')",
  "confidence": "high/medium/low - your confidence in this information"
}

CRITICAL INSTRUCTIONS:
1. Visit ${websiteUrl} to get accurate information
2. Description should be concise and factual (no marketing fluff)
3. Industry should be a clear category, not too broad or too specific
4. Target audience should be the PRIMARY customer segment
5. Set confidence to:
   - "high" if information is clearly stated on the website
   - "medium" if you had to infer from context
   - "low" if website has limited information

Return ONLY valid JSON, nothing else.`

  console.log('[metadataExtractor] Calling Perplexity API...')

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Perplexity API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  console.log('[metadataExtractor] Perplexity response:', content)

  // Parse JSON response
  try {
    // Extract JSON from response (might have extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const metadata = JSON.parse(jsonMatch[0])

    // Validate required fields
    if (!metadata.description || !metadata.industry || !metadata.targetAudience) {
      throw new Error('Missing required fields in metadata')
    }

    return {
      description: metadata.description,
      industry: metadata.industry,
      targetAudience: metadata.targetAudience,
      confidence: metadata.confidence || 'medium',
    }
  } catch (parseError) {
    console.error('[metadataExtractor] Error parsing Perplexity response:', parseError)
    throw new Error(`Failed to parse metadata: ${parseError}`)
  }
}

/**
 * Extract metadata using OpenRouter API (Deep Research)
 */
async function extractWithOpenRouter(
  competitorName: string,
  websiteUrl: string,
  apiKey: string
): Promise<CompetitorMetadata> {
  const websiteDomain = new URL(websiteUrl).hostname.replace('www.', '')

  const prompt = `Analyze the company "${competitorName}" (website: ${websiteUrl})

Your task: Extract key business information by visiting their website.

REQUIRED OUTPUT (JSON format):
{
  "description": "Brief 1-2 sentence description of what the company does",
  "industry": "Primary industry/category (e.g., 'Fintech', 'E-commerce', 'SaaS', 'Healthcare')",
  "targetAudience": "Primary target customer segment (e.g., 'SMBs', 'Consumers', 'Enterprise', 'Developers')",
  "confidence": "high/medium/low - your confidence in this information"
}

CRITICAL INSTRUCTIONS:
1. Visit ${websiteUrl} to get accurate information
2. Description should be concise and factual (no marketing fluff)
3. Industry should be a clear category, not too broad or too specific
4. Target audience should be the PRIMARY customer segment
5. Set confidence to:
   - "high" if information is clearly stated on the website
   - "medium" if you had to infer from context
   - "low" if website has limited information

Return ONLY valid JSON, nothing else.`

  console.log('[metadataExtractor] Calling OpenRouter API (Deep Research)...')

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': websiteUrl,
      'X-Title': 'Gattaca Competitor Discovery',
    },
    body: JSON.stringify({
      model: 'perplexity/sonar-pro',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''

  console.log('[metadataExtractor] OpenRouter response:', content)

  // Parse JSON response
  try {
    // Extract JSON from response (might have extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const metadata = JSON.parse(jsonMatch[0])

    // Validate required fields
    if (!metadata.description || !metadata.industry || !metadata.targetAudience) {
      throw new Error('Missing required fields in metadata')
    }

    return {
      description: metadata.description,
      industry: metadata.industry,
      targetAudience: metadata.targetAudience,
      confidence: metadata.confidence || 'medium',
    }
  } catch (parseError) {
    console.error('[metadataExtractor] Error parsing OpenRouter response:', parseError)
    throw new Error(`Failed to parse metadata: ${parseError}`)
  }
}
