/**
 * SEO Seed Keywords Generator Playbook
 *
 * Converted from n8n workflow: "Generate SEO Seed Keywords Using AI"
 *
 * This playbook generates SEO seed keywords based on your Ideal Customer Profile (ICP)
 * using AI to analyze pain points, goals, and search behavior.
 */

import { PlaybookConfig, PlaybookPresentation } from '../types'

/**
 * Presentation metadata for the intro screen
 */
const PRESENTATION: PlaybookPresentation = {
  tagline: 'Descubre las keywords que tu cliente ideal está buscando',
  valueProposition: [
    '15-20 seed keywords de alta relevancia para tu nicho',
    'Keywords basadas en los problemas reales de tu cliente',
    'Análisis de intención de búsqueda incluido',
    'Lista exportable lista para usar en tu estrategia SEO',
  ],
  exampleOutput: {
    type: 'keywords',
    preview: {
      text: 'software contabilidad autónomos, facturación automática freelance, gestión fiscal online, declaración trimestral fácil, app facturas España',
    },
  },
  estimatedTime: '1-2 minutos',
  estimatedCost: '~$0.02 USD',
  requiredServices: [
    {
      key: 'openrouter',
      name: 'OpenRouter (IA)',
      description: 'Genera keywords usando análisis de IA',
    },
  ],
}

export const seoSeedKeywordsConfig: PlaybookConfig = {
  id: 'seo-seed-keywords',
  type: 'seo-seed-keywords',
  name: 'SEO Seed Keywords Generator',
  description: 'Genera 15-20 keywords semilla basadas en tu Perfil de Cliente Ideal usando análisis de IA',
  icon: '🔑',
  presentation: PRESENTATION,
  phases: [
    {
      id: 'input',
      name: 'Define Your ICP',
      description: 'Enter your Ideal Customer Profile details',
      steps: [
        {
          id: 'define_icp',
          name: 'Ideal Customer Profile',
          description: 'Provide details about your ideal customer to generate relevant keywords',
          type: 'input',
          executor: 'none',
        }
      ]
    },
    {
      id: 'generate',
      name: 'Generate Keywords',
      description: 'AI analyzes your ICP and generates seed keywords',
      steps: [
        {
          id: 'generate_keywords',
          name: 'Generate SEO Keywords',
          description: 'Using AI to analyze your ICP and generate relevant seed keywords',
          type: 'auto',
          executor: 'api',
          apiEndpoint: '/api/playbook/seo-seed-keywords/generate',
          dependsOn: ['define_icp'],
          // OpenRouter uses OAuth, not API keys
        }
      ]
    },
    {
      id: 'review',
      name: 'Review & Export',
      description: 'Review generated keywords and export results',
      steps: [
        {
          id: 'review_keywords',
          name: 'Review Keywords',
          description: 'Review the generated keywords and select the ones to use',
          type: 'auto_with_review',
          executor: 'none',
          dependsOn: ['generate_keywords'],
        }
      ]
    }
  ],
  variables: [
    {
      key: 'product',
      label: 'Product/Service',
      description: 'Your product or service description',
      type: 'textarea',
      required: true,
      placeholder: 'Describe your product or service in detail'
    },
    {
      key: 'painPoints',
      label: 'Pain Points',
      description: 'Customer pain points',
      type: 'textarea',
      required: true,
      placeholder: 'List the main pain points your customers experience'
    },
    {
      key: 'goals',
      label: 'Goals',
      description: 'Customer goals and objectives',
      type: 'textarea',
      required: true,
      placeholder: 'What are your customers trying to achieve?'
    },
    {
      key: 'currentSolutions',
      label: 'Current Solutions',
      description: 'How customers currently solve their problems',
      type: 'textarea',
      required: false,
      placeholder: 'How do customers currently solve these problems?'
    },
    {
      key: 'expertiseLevel',
      label: 'Expertise Level',
      description: 'Customer technical expertise',
      type: 'select',
      required: false,
      options: [
        { value: 'beginner', label: 'Beginner' },
        { value: 'intermediate', label: 'Intermediate' },
        { value: 'advanced', label: 'Advanced' },
        { value: 'expert', label: 'Expert' }
      ]
    },
    {
      key: 'industry',
      label: 'Industry',
      description: 'Target industry or niche',
      type: 'text',
      required: false,
      placeholder: 'What industry or niche are you targeting?'
    }
  ]
}

export default seoSeedKeywordsConfig
