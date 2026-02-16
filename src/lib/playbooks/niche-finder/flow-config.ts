/**
 * Niche Finder Analysis Flow Steps
 *
 * Defines the 4 analysis steps as FlowStep[] for use with the campaign system.
 * Step 1 processes all scraped docs as context (no loop).
 * Steps 2-4 chain via auto_receive_from.
 */

import type { FlowStep } from '@/types/flow.types'
import {
  STEP_1_FIND_PROBLEMS_PROMPT,
  STEP_2_CLEAN_FILTER_PROMPT,
  STEP_3_SCORING_PROMPT,
  STEP_4_CONSOLIDATE_PROMPT,
} from '@/lib/templates/niche-finder-playbook'

/**
 * Bulk extraction prompt — adapted from STEP_1_FIND_PROBLEMS_PROMPT.
 * Instead of processing one forum conversation, it processes ALL scraped documents
 * provided as context and outputs a single CSV with one row per valid problem.
 */
export const BULK_EXTRACTION_PROMPT = `ROLE
You are a Customer Research Analyst and Product Strategist working for a company in the {{industry}} industry.

CONTEXT — PRODUCT & MARKET
Category: {{category}}
Product Description: {{product}}
Target Audience: {{target}}

Your responsibility is to analyze ALL forum conversations provided as documents below and determine whether they describe functional, solvable problems that fall within the scope of this company's product and audience.

INSTRUCTIONS:
1. Read EVERY document provided as context. Each document is a scraped forum conversation.
2. For each document, apply the relevance check below.
3. If a document is NOT relevant, skip it entirely (do not output anything for it).
4. If a document IS relevant, extract one or more rows following the extraction format.
5. Output a SINGLE CSV table combining all valid extractions from all documents.

RELEVANCE CHECK (per document):
1. Read the entire conversation carefully.
2. Identify the main issue, friction, or recurring pain point.
3. Is this problem related to {{category}} or the functional space that {{product}} operates in?
4. Could {{company_name}} reasonably help or solve this type of problem for {{target}}?
5. If NO → skip this document entirely.
6. If YES → proceed to extraction.

OUTPUT FORMAT:
First line MUST be the CSV header:
"Problem";"Persona";"Functional Cause";"Emotional or Cognitive Load";"Evidence";"Alternatives";"Source URL"

Then one line per distinct persona/problem pair found across ALL documents.

FIELD DEFINITIONS:
- Problem: Functional, solvable pain point. Focus on actions or tasks, not feelings.
- Persona: Type of user or business context (e.g., freelancer, family, small business).
- Functional Cause: Root process, dependency, or system creating the problem.
- Emotional or Cognitive Load: Stress, confusion, or mental load visible in text.
- Evidence: Two or three literal quotes from the conversation, separated by "|".
- Alternatives: Current workaround, tool, or method the user mentions.
- Source URL: The forum link or source (from the document metadata/title).

OUTPUT RULES:
- One line per distinct persona/problem pair.
- Exactly 7 quoted fields, separated by semicolons (;).
- Include the CSV header as the first line.
- Do not include bullet points, explanations, or markdown formatting.
- Do not infer or invent missing information — use only what appears in the conversations.
- All text must be on a single line per record; no line breaks inside quoted text.
- If NO relevant problems are found across ALL documents, output only the header line.

QUALITY CHECK:
Before finalizing, confirm for each row that:
- The problem could reasonably be solved by a product like {{product}}.
- The persona aligns with {{target}}.
- The evidence supports the described pain point.`

export const NICHE_FINDER_FLOW_STEPS: FlowStep[] = [
  {
    id: 'nf-step-1-extract',
    name: 'Extraer Problemas',
    order: 1,
    type: 'llm',
    prompt: BULK_EXTRACTION_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.3,
    max_tokens: 16384,
    output_format: 'csv',
    description: 'Analiza todos los documentos scrapeados y extrae problemas funcionales en formato CSV',
    base_doc_ids: [],
    auto_receive_from: [],
    retrieval_mode: 'full',
  },
  {
    id: 'nf-step-2-filter',
    name: 'Limpiar y Filtrar',
    order: 2,
    type: 'llm',
    prompt: STEP_2_CLEAN_FILTER_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.5,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Deduplica, filtra y consolida a 30-50 nichos válidos',
    base_doc_ids: [],
    auto_receive_from: ['nf-step-1-extract'],
    retrieval_mode: 'full',
  },
  {
    id: 'nf-step-3-scoring',
    name: 'Scoring (Deep Research)',
    order: 3,
    type: 'llm',
    prompt: STEP_3_SCORING_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.8,
    max_tokens: 16384,
    output_format: 'markdown',
    description: 'Pain Score, Market Size, Reachability con investigación web',
    base_doc_ids: [],
    auto_receive_from: ['nf-step-2-filter'],
    retrieval_mode: 'full',
  },
  {
    id: 'nf-step-4-consolidate',
    name: 'Tabla Final Consolidada',
    order: 4,
    type: 'llm',
    prompt: STEP_4_CONSOLIDATE_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.3,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Combina tabla filtrada con scores en tabla final',
    base_doc_ids: [],
    auto_receive_from: ['nf-step-2-filter', 'nf-step-3-scoring'],
    retrieval_mode: 'full',
  },
]
