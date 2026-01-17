/**
 * ECP Positioning Playbook Template
 * Strategic positioning process for ECPs (Exceptional Customer Pain)
 *
 * Based on real campaign flow_config from production database
 */

import type { PlaybookTemplate, VariableDefinition } from './types'
import type { FlowStep } from '@/types/flow.types'

// ============================================
// STEP PROMPTS (from real campaigns)
// ============================================

export const STEP_1_COMPETITOR_ANALYSIS_PROMPT = `Act as a senior {{industry}} product strategist. Conduct a targeted competitive analysis of competitors that offer features aligned with the ECP persona: {{ecp_name}}

**Core User Pain Point:**
{{problem_core}}

**Research Objective:**
Identify how {{client_name}} top competitors are currently addressing this user pain point through specific product features and UX strategies. Include both direct competitors and indirect alternatives.

Use the provided documents as supporting reference to understand market trends and validate which features are most responsive to this need in the {{country}} market.

**For each competitor, provide:**
- A short product overview (with target segment focus)
- A summary of the relevant features to the ECP
- A detailed explanation of how those features work
- How each functionality addresses both operational friction (e.g., visibility, automation, segmentation) and emotional friction (e.g., motivation, pressure, satisfaction of progress)

OUTPUT FORMAT:
## Competitor Landscape Overview

### Competitor 1: [Name]
- **Overview**:
- **Target Segment**:
- **Key Features**:
- **Operational Friction**:
- **Emotional Friction**:

[Repeat for each competitor]

## Key Competitive Insights`

export const STEP_2_COMPANY_ANALYSIS_PROMPT = `Conduct a detailed and structured analysis focused exclusively on {{client_name}}, the company, by addressing the following two main areas:

1. 🏦 **General Company Overview**
- Provide a concise history of the company, including founding context, major milestones, and current positioning.
- Describe the company's business model, detailing revenue streams and core customer segments.
- Define the company's Unique Value Proposition (UVP) and explain how it is reflected in its product, UX, and brand messaging.
- List and briefly describe the app's main features, highlighting those central to the company's core user experience and ecosystem.

2. 📱 **In-Depth Functional Review for ECP Persona:**
{{ecp_name}}

**Core User Pain Point:**
{{problem_core}}

Please include:
- A complete list of {{client_name}}'s features supporting the ECP needs
- For each feature: provide a concise summary (name, purpose, capabilities)
- Describe the full end-to-end user flow for the ECP need using the company's core products and features
- Explain how each feature reduces both operational and emotional friction for this ECP

Focus strictly on the company; exclude competitor analysis.

OUTPUT FORMAT:
## Company Overview
### History & Milestones
### Business Model
### Unique Value Proposition

## Product Features for ECP
| Feature | Purpose | Capabilities | ECP Benefit |
|---------|---------|--------------|-------------|

## User Flow Analysis`

export const STEP_3_FIND_PLACE_PROMPT = `**Objective:** To conduct a comprehensive competitive analysis in the {{industry}} sector to identify key customer selection criteria and create a scorable competitive map. The primary goal is to determine the most viable strategic positioning for {{client_name}} by identifying underserved market needs.

**Persona:** Act as an expert Market Research Analyst with a specialization in the {{industry}} industry. Your analysis should be from the perspective of {{ecp_name}}.

**Input Data:** You will primarily analyze the attached files containing competitor data. Supplement this data with deep web research to identify market trends, common alternatives, and customer sentiment not covered in the documents.

**Step-by-Step Research & Analysis Protocol:**

1. **Generate Evaluation Criteria:**
Based on the analysis, generate a comprehensive list of evaluation criteria relevant to understand both the functional and emotional drivers behind customer decisions.

Ensure the list integrates both tangible aspects—such as pricing model, ease of use, digital accessibility, user experience, brand reputation—and intangible factors like trust, perceived safety, empowerment, and sense of control.

2. **Map the Competitive Landscape:**
Using the attached files and additional research, identify all competitive alternatives relevant to {{ecp_name}}.

3. **Execute Scoring and Analysis:**
For each criterion, score every competitor on a scale of 0 to 5:
- **0** = Extremely Poorly Positioned
- **5** = Market Leader

For each criterion, add an "Analysis & Opportunity" column:
- **Red Ocean (4-5):** High Competition
- **No Market (0-1):** Low Customer Value
- **Opportunity Zone (2-3):** Key Opportunity for Differentiation

**Final Deliverable:**
1. Value criteria table with relevance and justification
2. Competitive Positioning Map table
3. Top 3-5 "Opportunity Zones" for {{client_name}}
4. Detailed explanation of scores with sources`

export const STEP_4_SELECT_ASSETS_PROMPT = `Connect the assets from the Company Analysis output document, match each of the value criteria from "Find Your Place to Win" output document, focused on {{ecp_name}}.

This step is about identifying {{client_name}}'s unique strengths and determining how they can be leveraged to differentiate its product. We want to avoid competing on price.

1. **Map All Your Assets:**
   - List everything the company has that could be valuable: features, team abilities, skills, knowledge, technology.

2. **Categorize Assets: Qualifiers vs. Differentiators:**
   - **Qualifiers**: Market standard; what's expected to "play the game". You must have these.
   - **Differentiators**: What makes you unique. What do you have that no one else does?

   Avoid vague words like "empower," "elevate," or "level up" in your value proposition. Be specific and clear.

**Output Format:**
Present the output as a structured table with the following columns:

| {{client_name}} Asset | Value Criteria | Category | Justification for Differentiation |
|----------------------|----------------|----------|-----------------------------------|

Instructions:
- Each row should represent a single unique asset
- In Category column, define whether the asset acts as a Qualifier or a Differentiator
- Justification should explain why this asset provides strategic or competitive value`

export const STEP_5_PROOF_POINTS_PROMPT = `You are a market analyst responsible for evaluating the strengths of {{client_name}} product for the ECP segment {{ecp_name}} in {{country}}.

Using the different assets highlighted in the "Select Assets" output document, complete the table below. For each row, fill in:

- **Unique asset**: Use the assets from the "Select Assets" document
- **Competitive advantage**: What kind of advantage does the company gain by owning or deploying that asset over its competitors?
- **User benefit**: What does the user get from that asset? Why would the user care?
- **Proof**: How can you demonstrate that the company really has that asset and that users really get the benefit? What message or image should we include? How can I demonstrate this to the customer? Testimonials, images of the app, tutorials, advertisements with a message. Clearly indicate the message to be displayed. Adapt the message to the ECP.

**Output Format:**

| **Unique Asset** | **Competitive Advantage** | **Benefit for the User** | **Proof** |
|------------------|--------------------------|-------------------------|-----------|
| ... | ... | ... | ... |

Provide the responses in table form, with one row per criterion/asset.`

export const STEP_6_POSITIONING_MESSAGING_PROMPT = `Using the document from "Prove that you are legit" step, conduct a strategic and evidence-based analysis of {{client_name}}'s Unique Value Proposition (UVP) and Unique Selling Proposition (USP).

### OBJECTIVE:
Develop a **messaging playbook** grounded in {{client_name}}'s brand tone and validated user pain points. Your final output will be a **messaging table** that includes polished, bilingual copy ready for marketing and product channels.

### TASKS:

1. **Extract and clearly define UVP and USP:**
   - Use evidence from the "Prove your value" document
   - Clearly distinguish between the core value promise (UVP) and the product differentiators (USPs)

2. **Translate findings into a messaging table** with the following format:

| Message Category | Hypothesis (Why it will work) | Value Criteria | Objective | Final Message (English) | Final Message ({{country}} Spanish) |
|-----------------|-------------------------------|----------------|-----------|------------------------|-------------------------------------|

3. **For the "Final Message" columns**, generate marketing-ready messages that are:
   - Short, direct, and emotionally resonant
   - Consistent with {{client_name}}'s tone
   - Connect the message with the ECP

4. **Ensure each message row focuses on a distinct strategic emphasis**, such as:
   - Core UVP (emotional and logistical clarity)
   - Automation
   - Fairness
   - Transparency & Accountability
   - Flexibility
   - Speed and ease

### OUTPUT REQUIREMENTS:
- 1 row for {{client_name}}'s **UVP Core Promise**
- At least 4-5 rows for **different USPs**, each with unique positioning
- Fully completed bilingual messaging table
- Short, sharp, emotionally intelligent copy`

// ============================================
// VARIABLE DEFINITIONS
// ============================================

export const ECP_VARIABLE_DEFINITIONS: VariableDefinition[] = [
  {
    name: 'ecp_name',
    default_value: '',
    required: true,
    description: 'Nombre del ECP (Exceptional Customer Pain) - el problema específico a resolver',
  },
  {
    name: 'problem_core',
    default_value: '',
    required: true,
    description: 'El pain principal o núcleo del problema que experimenta el cliente',
  },
  {
    name: 'country',
    default_value: 'España',
    required: true,
    description: 'País objetivo para el posicionamiento (afecta idioma y adaptación cultural)',
  },
  {
    name: 'industry',
    default_value: '',
    required: true,
    description: 'Industria o sector del mercado objetivo',
  },
  {
    name: 'client_name',
    default_value: '',
    required: false,
    description: 'Nombre del cliente o empresa (opcional, para personalización)',
  },
]

// ============================================
// FLOW STEPS (matching real campaign structure)
// ============================================

export const ECP_FLOW_STEPS: FlowStep[] = [
  {
    id: 'step-1-competitor-analysis',
    name: 'Competitor Analysis',
    order: 0,
    type: 'llm',
    prompt: STEP_1_COMPETITOR_ANALYSIS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.7,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Análisis detallado de competidores y cómo abordan el pain point',
    base_doc_ids: [],
    auto_receive_from: [],
    retrieval_mode: 'full',
  },
  {
    id: 'step-2-company-analysis',
    name: 'Company Analysis',
    order: 1,
    type: 'llm',
    prompt: STEP_2_COMPANY_ANALYSIS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.7,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Análisis de capacidades de la empresa/producto para el ECP',
    base_doc_ids: [],
    auto_receive_from: ['step-1-competitor-analysis'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-3-find-place',
    name: 'Find Your Place to Win',
    order: 2,
    type: 'llm',
    prompt: STEP_3_FIND_PLACE_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.7,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Identificar posicionamiento óptimo y oportunidades de diferenciación',
    base_doc_ids: [],
    auto_receive_from: ['step-1-competitor-analysis', 'step-2-company-analysis'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-4-select-assets',
    name: 'Select Assets',
    order: 3,
    type: 'llm',
    prompt: STEP_4_SELECT_ASSETS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.7,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Seleccionar y mapear assets del producto a criterios de valor',
    base_doc_ids: [],
    auto_receive_from: ['step-2-company-analysis', 'step-3-find-place'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-5-proof-points',
    name: 'Prove that you are legit',
    order: 4,
    type: 'llm',
    prompt: STEP_5_PROOF_POINTS_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.7,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Definir pruebas de legitimidad para cada asset',
    base_doc_ids: [],
    auto_receive_from: ['step-2-company-analysis', 'step-3-find-place', 'step-4-select-assets'],
    retrieval_mode: 'full',
  },
  {
    id: 'step-6-positioning-messaging',
    name: 'Positioning and Messaging',
    order: 5,
    type: 'llm',
    prompt: STEP_6_POSITIONING_MESSAGING_PROMPT,
    model: 'google/gemini-2.5-pro-preview',
    temperature: 0.8,
    max_tokens: 8192,
    output_format: 'markdown',
    description: 'Generar UVP, USPs y mensajes finales en inglés y español',
    base_doc_ids: [],
    auto_receive_from: [
      'step-1-competitor-analysis',
      'step-2-company-analysis',
      'step-3-find-place',
      'step-4-select-assets',
      'step-5-proof-points',
    ],
    retrieval_mode: 'full',
  },
]

// ============================================
// TEMPLATE EXPORT
// ============================================

export function getECPPositioningTemplate(): PlaybookTemplate {
  return {
    template_id: 'ecp-positioning-v2',
    name: 'ECP Positioning',
    description: 'Proceso estratégico de posicionamiento para ECPs (Exceptional Customer Pain) en 6 pasos: análisis de competencia, análisis de empresa, posicionamiento, assets, proof points y messaging final.',
    playbook_type: 'ecp',

    flow_config: {
      steps: ECP_FLOW_STEPS,
      version: '2.0.0',
      description: 'ECP Analysis Process - 6 steps from competitor analysis to positioning & messaging',
    },

    variable_definitions: ECP_VARIABLE_DEFINITIONS,

    required_documents: {
      product: [
        'Product specifications and features',
        'Technical capabilities document',
        'Feature comparison matrix',
        'Case studies and success stories',
        'Customer testimonials',
        'Certifications and awards',
      ],
      competitor: [
        'Competitor analysis report',
        'Market positioning comparison',
        'Competitive pricing analysis',
      ],
      research: [
        'Market research report',
        'Industry trends analysis',
        'Customer survey results',
        'Target audience personas',
      ],
    },

    campaign_docs_guide: `## Guía de Documentos para ECP Positioning

### Paso 1: Competitor Analysis
Sube documentos de **competidores**:
- Análisis de competidores principales
- Páginas web de competidores (capturas o scrapes)
- Comparativas de mercado existentes

### Paso 2: Company Analysis
Sube documentos de **tu empresa/producto**:
- Especificaciones del producto
- Lista de features y capacidades
- Materiales de marca y posicionamiento actual

### Paso 3: Find Your Place to Win
Los documentos anteriores serán usados para identificar oportunidades.
Opcionalmente, agrega:
- Estudios de mercado adicionales
- Encuestas de clientes

### Paso 4: Select Assets
El sistema usará el análisis previo para mapear assets.
Sube si tienes:
- Lista de capacidades técnicas
- Diferenciadores únicos documentados

### Paso 5: Prove that you are legit
Sube **evidencia y pruebas**:
- Case studies con resultados
- Testimonios de clientes
- Certificaciones y premios
- Métricas de ROI

### Paso 6: Positioning and Messaging
El sistema generará la propuesta de valor y mensajes finales usando toda la información anterior.

---
💡 **Tip**: Cuanta más información específica y detallada subas, mejores serán los resultados.`,
  }
}
