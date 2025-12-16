import { FlowConfig } from '@/types/flow.types'

/**
 * Default flow configuration with 7 steps
 */
export const DEFAULT_FLOW_CONFIG: FlowConfig = {
  steps: [
    {
      id: 'step-1-deep-research',
      name: 'Deep Research',
      description: 'Investigación profunda del mercado y necesidades',
      order: 1,
      prompt: `ACT AS: Senior Market Researcher

CONTEXT PROVIDED:
- Market research documents
- Industry reports

TASK:
Conduct a thorough analysis of the unmet financial need for ECP: '{{ecp_name}}' with Pain: '{{problem_core}}' in {{country}} {{industry}} market.

Your analysis should cover:
1. Market size and trends
2. Current solutions and their gaps
3. Target audience pain points
4. Opportunity areas

Be specific and data-driven. If information is not in the documents, state it clearly.`,
      base_doc_ids: [],
      auto_receive_from: [],
      output_format: 'markdown',
      model: 'gemini-3-pro',
      temperature: 0.7,
      max_tokens: 8192,
    },
    {
      id: 'step-2-competitor-analysis',
      name: 'Competitor Analysis',
      description: 'Análisis detallado de competidores',
      order: 2,
      prompt: `ACT AS: Competitive Intelligence Analyst

PREVIOUS RESEARCH:
{{step:Deep Research}}

CONTEXT PROVIDED:
- Competitor analysis documents
- Market positioning reports

TASK:
Analyze the competitive landscape for {{ecp_name}} in {{country}} {{industry}} market.

For each major competitor, identify:
1. Their value proposition
2. Strengths and weaknesses
3. Market positioning
4. Pricing strategy
5. Target audience overlap

Focus only on information from the provided documents.`,
      base_doc_ids: [],
      auto_receive_from: ['step-1-deep-research'],
      output_format: 'markdown',
      model: 'gemini-3-pro',
      temperature: 0.7,
      max_tokens: 8192,
    },
    {
      id: 'step-3-company-analysis',
      name: 'Company Analysis',
      description: 'Análisis de capacidades de la empresa/producto',
      order: 3,
      prompt: `ACT AS: Product Strategy Consultant

MARKET CONTEXT:
{{step:Deep Research}}

COMPETITIVE CONTEXT:
{{step:Competitor Analysis}}

CONTEXT PROVIDED:
- Product specifications
- Company capabilities
- Technical documentation

TASK:
Analyze our company's capabilities and product features for {{ecp_name}}.

Document:
1. Core product features and benefits
2. Technical capabilities
3. Unique differentiators
4. Current positioning
5. Gaps vs. market needs (from Deep Research)

Base analysis strictly on provided documents.`,
      base_doc_ids: [],
      auto_receive_from: ['step-1-deep-research', 'step-2-competitor-analysis'],
      output_format: 'markdown',
      model: 'gemini-3-pro',
      temperature: 0.7,
      max_tokens: 8192,
    },
    {
      id: 'step-4-find-place',
      name: 'Find Market Place',
      description: 'Identificar posicionamiento óptimo en el mercado',
      order: 4,
      prompt: `ACT AS: Strategic Positioning Consultant

PREVIOUS ANALYSIS:
- Market Research: {{step:Deep Research}}
- Competitors: {{step:Competitor Analysis}}
- Our Capabilities: {{step:Company Analysis}}

TASK:
Based on the comprehensive analysis above, identify the optimal market positioning for {{ecp_name}} in {{country}}.

Define:
1. Top 3-5 value criteria that matter most to target audience
2. How competitors perform on each criteria
3. How our capabilities align with market needs
4. Positioning gaps and opportunities
5. Recommended positioning strategy

RESTRICTION: Synthesize insights from previous steps. Do not introduce new information.`,
      base_doc_ids: [],
      auto_receive_from: ['step-1-deep-research', 'step-2-competitor-analysis', 'step-3-company-analysis'],
      output_format: 'json',
      model: 'gemini-3-pro',
      temperature: 0.7,
      max_tokens: 8192,
    },
    {
      id: 'step-5-select-assets',
      name: 'Select Assets',
      description: 'Seleccionar y mapear assets del producto',
      order: 5,
      prompt: `ACT AS: Product Marketing Manager

STRATEGIC POSITIONING:
{{step:Find Market Place}}

OUR CAPABILITIES:
{{step:Company Analysis}}

TASK:
Map our product assets to the positioning strategy identified above.

For each Value Criteria from the positioning strategy:
1. List relevant product features/benefits
2. Explain how they address the criteria
3. Rate competitive strength: Strong / Medium / Weak
4. Identify any gaps

Focus on the asset-to-value mapping. Be specific and factual.`,
      base_doc_ids: [],
      auto_receive_from: ['step-4-find-place', 'step-3-company-analysis'],
      output_format: 'markdown',
      model: 'gemini-3-pro',
      temperature: 0.7,
      max_tokens: 8192,
    },
    {
      id: 'step-6-proof-points',
      name: 'Proof Points',
      description: 'Definir pruebas de legitimidad',
      order: 6,
      prompt: `ACT AS: Brand Credibility Strategist

SELECTED ASSETS:
{{step:Select Assets}}

CONTEXT PROVIDED:
- Case studies
- Testimonials
- Certifications
- Performance data

TASK:
For each asset/claim from the Select Assets step, define Proof Points that validate the claim.

For each asset:
1. Type of proof: Data / Testimonial / Case Study / Certification / Award
2. Specific proof statement
3. Source (from documents)
4. Credibility level: High / Medium / Low

Only use proof that exists in the provided documents.`,
      base_doc_ids: [],
      auto_receive_from: ['step-5-select-assets'],
      output_format: 'json',
      model: 'gemini-3-pro',
      temperature: 0.7,
      max_tokens: 8192,
    },
    {
      id: 'step-7-final-output',
      name: 'Final Output',
      description: 'Generar VP y USPs finales',
      order: 7,
      prompt: `ACT AS: Senior Copywriter

COMPLETE ANALYSIS:
- Market Research: {{step:Deep Research}}
- Competitive Landscape: {{step:Competitor Analysis}}
- Our Capabilities: {{step:Company Analysis}}
- Strategic Positioning: {{step:Find Market Place}}
- Selected Assets: {{step:Select Assets}}
- Proof Points: {{step:Proof Points}}

TASK:
Generate final Value Proposition and USPs for {{country}} market.

DELIVERABLES:

1. VALUE PROPOSITION (English):
   - One sentence (max 20 words)
   - Clear, compelling, differentiated

2. VALUE PROPOSITION (Spanish):
   - Translation adapted for {{country}}

3. TOP 3 USPs (English):
   - Benefit-focused
   - Each with proof point
   - Max 15 words each

4. TOP 3 USPs (Spanish):
   - Culturally adapted for {{country}}

STYLE: Professional, confident, customer-focused.
TONE: Appropriate for {{country}} {{industry}} market.`,
      base_doc_ids: [],
      auto_receive_from: [
        'step-1-deep-research',
        'step-2-competitor-analysis',
        'step-3-company-analysis',
        'step-4-find-place',
        'step-5-select-assets',
        'step-6-proof-points',
      ],
      output_format: 'markdown',
      model: 'gemini-3-pro',
      temperature: 0.8,
      max_tokens: 8192,
    },
  ],
}
