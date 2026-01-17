/**
 * Competitor Analysis Playbook Template
 * Deep competitor analysis and strategic positioning
 */

import type { PlaybookTemplate, VariableDefinition } from './types'
import type { FlowStep } from '@/types/flow.types'

// ============================================
// STEP PROMPTS
// ============================================

export const STEP_0_COMPETITOR_MAPPING_PROMPT = `ACT AS: Competitive Intelligence Analyst

CONTEXT:
- Company: {{company_name}}
- Industry: {{industry}}
- Country: {{country}}
- Known competitors: {{competitors}}

CONTEXT PROVIDED:
- Competitor websites and materials
- Market research documents

TASK:
Create a comprehensive competitor map for {{company_name}} in the {{industry}} market of {{country}}.

ANALYZE:
1. **Direct Competitors**: Same product/service, same target market
2. **Indirect Competitors**: Different product but same need
3. **Potential Disruptors**: New entrants or adjacent players

For each competitor, extract:
- Company name and size (employees, revenue if available)
- Target market segments
- Main product/service offering
- Pricing model (if visible)
- Key differentiators claimed
- Weaknesses observed

OUTPUT FORMAT:
## Competitor Landscape Overview

### Direct Competitors
| Competitor | Size | Target Segment | Main Offering | Pricing | Key Differentiator |
|------------|------|----------------|---------------|---------|-------------------|

### Indirect Competitors
[Same table format]

### Potential Disruptors
[Same table format]

## Market Share Estimation
## Key Observations`

export const STEP_1_FEATURE_COMPARISON_PROMPT = `ACT AS: Product Analyst

COMPETITOR MAP:
{{step:Competitor Mapping}}

PRODUCT INFORMATION PROVIDED:
- Your product features and capabilities
- Competitor product information

TASK:
Create a detailed feature-by-feature comparison between {{company_name}} and the main competitors identified.

ANALYZE:
1. Core features (must-have for the category)
2. Differentiating features (unique capabilities)
3. Price/value ratio
4. User experience elements
5. Integration capabilities
6. Support and service levels

OUTPUT FORMAT:
## Feature Comparison Matrix

| Feature Category | {{company_name}} | Competitor 1 | Competitor 2 | Competitor 3 |
|-----------------|------------------|--------------|--------------|--------------|
| Core Features | | | | |
| Feature 1 | ✅/❌/⚠️ | | | |
| Feature 2 | | | | |
| ... | | | | |
| Differentiators | | | | |
| ... | | | | |

Legend: ✅ Strong | ⚠️ Partial | ❌ Missing | 🏆 Best-in-class

## Feature Gap Analysis
### Where {{company_name}} Leads
### Where {{company_name}} Trails
### Parity Features

## Strategic Implications`

export const STEP_2_POSITIONING_ANALYSIS_PROMPT = `ACT AS: Brand Strategist

FEATURE COMPARISON:
{{step:Feature Comparison}}

MARKET CONTEXT:
{{step:Competitor Mapping}}

TASK:
Analyze the positioning of each competitor and identify the optimal positioning for {{company_name}}.

ANALYZE:
1. **Current Positioning** of each competitor:
   - Brand promise / tagline
   - Target persona
   - Value proposition
   - Tone of voice

2. **Positioning Map**:
   - Define 2 key axes (e.g., Price vs Quality, Simple vs Powerful)
   - Place competitors on the map
   - Identify white spaces

3. **Messaging Analysis**:
   - Key claims made by competitors
   - Proof points used
   - Emotional vs rational appeals

OUTPUT FORMAT:
## Competitor Positioning Analysis

### Competitor 1: [Name]
- **Positioning Statement**:
- **Target Persona**:
- **Key Message**:
- **Proof Points**:

[Repeat for each competitor]

## Positioning Map

\`\`\`
         High Price
              |
    [Comp A]  |  [Comp B]
              |
Simple -------+------- Powerful
              |
    [Comp C]  |  [White Space?]
              |
         Low Price
\`\`\`

## White Space Opportunities
## Recommended Positioning for {{company_name}}`

export const STEP_3_SWOT_SYNTHESIS_PROMPT = `ACT AS: Strategic Consultant

ALL PREVIOUS ANALYSIS:
- Competitor Map: {{step:Competitor Mapping}}
- Feature Comparison: {{step:Feature Comparison}}
- Positioning Analysis: {{step:Positioning Analysis}}

TASK:
Synthesize all competitive intelligence into a strategic SWOT analysis for {{company_name}} and provide actionable recommendations.

OUTPUT FORMAT:
## SWOT Analysis: {{company_name}} vs Competition

### Strengths (Internal Advantages)
| Strength | Evidence | Competitive Impact |
|----------|----------|-------------------|

### Weaknesses (Internal Gaps)
| Weakness | Evidence | Risk Level |
|----------|----------|------------|

### Opportunities (External Factors)
| Opportunity | Source | Strategic Action |
|-------------|--------|-----------------|

### Threats (External Risks)
| Threat | Source | Mitigation Strategy |
|--------|--------|---------------------|

## Strategic Recommendations

### Immediate Actions (0-3 months)
1.
2.
3.

### Medium-term Initiatives (3-12 months)
1.
2.
3.

### Long-term Strategy (12+ months)
1.
2.

## Key Battle Cards

### Against [Competitor 1]
- **Their weakness**:
- **Our counter**:
- **Key message**:

[Repeat for main competitors]

## Executive Summary
[3-5 bullet points summarizing the competitive landscape and recommended strategy]`

// ============================================
// VARIABLE DEFINITIONS
// ============================================

export const COMPETITOR_VARIABLE_DEFINITIONS: VariableDefinition[] = [
  {
    name: 'company_name',
    default_value: '',
    required: true,
    description: 'Nombre de tu empresa o producto a analizar',
  },
  {
    name: 'industry',
    default_value: '',
    required: true,
    description: 'Industria o sector del mercado',
  },
  {
    name: 'country',
    default_value: 'España',
    required: true,
    description: 'País o región objetivo del análisis',
  },
  {
    name: 'competitors',
    default_value: '',
    required: true,
    description: 'Lista de competidores principales a analizar (separados por coma)',
  },
  {
    name: 'target_segment',
    default_value: '',
    required: false,
    description: 'Segmento de mercado específico a analizar (opcional)',
  },
]

// ============================================
// FLOW STEPS
// ============================================

export const COMPETITOR_FLOW_STEPS: FlowStep[] = [
  {
    id: 'comp-step-0-mapping',
    name: 'Competitor Mapping',
    order: 0,
    type: 'llm',
    prompt: STEP_0_COMPETITOR_MAPPING_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.6,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Mapeo completo del landscape competitivo',
    base_doc_ids: [],
    auto_receive_from: [],
    retrieval_mode: 'full',
  },
  {
    id: 'comp-step-1-features',
    name: 'Feature Comparison',
    order: 1,
    type: 'llm',
    prompt: STEP_1_FEATURE_COMPARISON_PROMPT,
    model: 'google/gemini-2.0-flash-exp',
    temperature: 0.5,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Comparación feature-by-feature con competidores',
    base_doc_ids: [],
    auto_receive_from: ['comp-step-0-mapping'],
    retrieval_mode: 'full',
  },
  {
    id: 'comp-step-2-positioning',
    name: 'Positioning Analysis',
    order: 2,
    type: 'llm',
    prompt: STEP_2_POSITIONING_ANALYSIS_PROMPT,
    model: 'google/gemini-2.0-flash-exp',
    temperature: 0.7,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Análisis de posicionamiento y white spaces',
    base_doc_ids: [],
    auto_receive_from: ['comp-step-0-mapping', 'comp-step-1-features'],
    retrieval_mode: 'full',
  },
  {
    id: 'comp-step-3-swot',
    name: 'SWOT & Strategy',
    order: 3,
    type: 'llm',
    prompt: STEP_3_SWOT_SYNTHESIS_PROMPT,
    model: 'google/gemini-2.0-flash-exp',
    temperature: 0.7,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Síntesis SWOT y recomendaciones estratégicas',
    base_doc_ids: [],
    auto_receive_from: [
      'comp-step-0-mapping',
      'comp-step-1-features',
      'comp-step-2-positioning',
    ],
    retrieval_mode: 'full',
  },
]

// ============================================
// TEMPLATE EXPORT
// ============================================

export function getCompetitorAnalysisTemplate(): PlaybookTemplate {
  return {
    template_id: 'competitor-analysis-v1',
    name: 'Competitor Analysis',
    description: 'Análisis profundo de competidores en 4 pasos: mapeo, comparación de features, análisis de posicionamiento y síntesis SWOT con recomendaciones.',
    playbook_type: 'competitor_analysis',

    flow_config: {
      steps: COMPETITOR_FLOW_STEPS,
      version: '1.0.0',
      description: 'Competitive Intelligence Process - From mapping to strategic recommendations',
    },

    variable_definitions: COMPETITOR_VARIABLE_DEFINITIONS,

    required_documents: {
      product: [
        'Product features and specifications',
        'Pricing information',
        'Case studies and testimonials',
        'Technical capabilities document',
      ],
      competitor: [
        'Competitor websites (scraped or documented)',
        'Competitor product pages',
        'Competitor pricing pages',
        'Press releases and announcements',
        'Review sites analysis (G2, Capterra, etc.)',
      ],
      research: [
        'Market reports for the industry',
        'Industry analyst reports',
        'Customer feedback and surveys',
      ],
    },

    campaign_docs_guide: `## Guía de Documentos para Análisis de Competencia

### Preparación
Antes de empezar, recopila información de:
- Websites de competidores (puedes usar scrapers o capturas)
- Páginas de producto y pricing
- Perfiles en review sites (G2, Capterra, Trustpilot)

### Paso 1: Competitor Mapping
Sube documentos sobre **competidores**:
- Información de websites competidores
- Análisis de mercado existentes
- Notas de research previo

### Paso 2: Feature Comparison
Sube documentos de **producto propio**:
- Lista de features completa
- Especificaciones técnicas
- Comparativas existentes

### Paso 3: Positioning Analysis
Los documentos anteriores serán usados para analizar posicionamiento.
Opcionalmente, agrega:
- Materiales de marketing de competidores
- Taglines y messaging

### Paso 4: SWOT & Strategy
El sistema sintetizará toda la información para generar el análisis estratégico final.

---
💡 **Tip**: Para mejores resultados, incluye información de al menos 3-5 competidores principales.`,
  }
}
