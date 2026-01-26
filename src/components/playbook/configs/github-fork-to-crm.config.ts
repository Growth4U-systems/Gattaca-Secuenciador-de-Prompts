/**
 * GitHub Fork to CRM Lead Playbook
 *
 * Converted from n8n workflow: "Add a new lead to Pipedrive once GitHub repo is forked"
 *
 * Flow:
 * 1. Receive GitHub fork event (webhook or manual input)
 * 2. Fetch GitHub user information
 * 3. Check if contact exists in CRM (by email)
 * 4. Decision: Create new contact OR use existing
 * 5. Create lead in CRM
 * 6. Add note with GitHub profile URL
 *
 * This playbook demonstrates integration with external APIs and decision logic.
 */

import { PlaybookConfig, PlaybookPresentation } from '../types'

/**
 * Presentation metadata for the intro screen
 */
const PRESENTATION: PlaybookPresentation = {
  tagline: 'Convierte cada fork de GitHub en un lead cualificado para tu CRM',
  valueProposition: [
    'Captura automática de datos del usuario de GitHub',
    'Verificación de contactos existentes en Pipedrive',
    'Creación de leads con información enriquecida',
    'Notas automáticas con perfil de GitHub incluido',
  ],
  exampleOutput: {
    type: 'data',
    preview: {
      text: 'Lead: octocat - Fork de myorg/myrepo\nEmail: octocat@github.com\nPerfil: github.com/octocat',
    },
  },
  estimatedTime: '1-2 minutos',
  estimatedCost: 'Gratis (APIs propias)',
  requiredServices: [
    {
      key: 'github',
      name: 'GitHub API',
      description: 'Para obtener información del perfil del usuario',
    },
    {
      key: 'pipedrive',
      name: 'Pipedrive CRM',
      description: 'Para crear contactos y leads',
    },
  ],
}

export const githubForkToCrmConfig: PlaybookConfig = {
  id: 'github-fork-to-crm',
  type: 'github-fork-to-crm',
  name: 'GitHub Fork → CRM Lead',
  description: 'Automatically create CRM leads from GitHub repository forks with contact deduplication',
  icon: '🔀',
  presentation: PRESENTATION,

  phases: [
    {
      id: 'input',
      name: 'Fork Event',
      description: 'Receive or enter the GitHub fork event data',
      steps: [
        {
          id: 'fork_event',
          name: 'GitHub Fork Data',
          description: 'Enter the details of the GitHub fork event',
          type: 'input',
          executor: 'none',
        }
      ]
    },
    {
      id: 'enrich',
      name: 'Enrich Data',
      description: 'Fetch additional user information from GitHub',
      steps: [
        {
          id: 'fetch_github_user',
          name: 'Fetch GitHub User Info',
          description: 'Getting profile information from GitHub API',
          type: 'auto',
          executor: 'api',
          apiEndpoint: '/api/playbook/github-fork-to-crm/process-fork',
          dependsOn: ['fork_event'],
          // GitHub API (uses token from env or user config)
        }
      ]
    },
    {
      id: 'check',
      name: 'Check CRM',
      description: 'Check if contact already exists in CRM',
      steps: [
        {
          id: 'check_contact',
          name: 'Check Existing Contact',
          description: 'Searching for contact in Pipedrive by email',
          type: 'auto',
          executor: 'api',
          apiEndpoint: '/api/playbook/github-fork-to-crm/check-contact',
          dependsOn: ['fetch_github_user'],
          // Pipedrive API (uses token from env or user config)
        },
        {
          id: 'contact_decision',
          name: 'Contact Exists?',
          description: 'Decide whether to create new contact or use existing',
          type: 'decision',
          executor: 'none',
          dependsOn: ['check_contact'],
          decisionConfig: {
            question: 'A contact with this email was found in Pipedrive. What would you like to do?',
            optionsFrom: 'fixed',
            fixedOptions: [
              {
                id: 'use_existing',
                label: 'Use Existing Contact',
                description: 'Create lead linked to the existing contact'
              },
              {
                id: 'create_new',
                label: 'Create New Contact',
                description: 'Create a new contact even though one exists'
              },
              {
                id: 'skip',
                label: 'Skip',
                description: 'Do not create a lead for this fork'
              }
            ],
            multiSelect: false,
            minSelections: 1,
          }
        }
      ]
    },
    {
      id: 'create',
      name: 'Create Lead',
      description: 'Create contact and lead in CRM',
      steps: [
        {
          id: 'create_lead',
          name: 'Create CRM Lead',
          description: 'Creating lead in Pipedrive with GitHub fork details',
          type: 'auto',
          executor: 'api',
          apiEndpoint: '/api/playbook/github-fork-to-crm/create-lead',
          dependsOn: ['contact_decision'],
          // Pipedrive API (uses token from env or user config)
        }
      ]
    },
    {
      id: 'review',
      name: 'Review',
      description: 'Review the created lead',
      steps: [
        {
          id: 'review_lead',
          name: 'Review Created Lead',
          description: 'Review the lead created in Pipedrive',
          type: 'display',
          executor: 'none',
          dependsOn: ['create_lead'],
        }
      ]
    }
  ],

  variables: [
    {
      key: 'githubUsername',
      label: 'GitHub Username',
      description: 'Username of the person who forked',
      type: 'text',
      required: true,
      placeholder: 'e.g., octocat'
    },
    {
      key: 'repositoryName',
      label: 'Repository',
      description: 'The repository that was forked (owner/repo)',
      type: 'text',
      required: true,
      placeholder: 'e.g., myorg/myrepo'
    },
    {
      key: 'forkUrl',
      label: 'Fork URL',
      description: 'URL to the fork (optional)',
      type: 'text',
      required: false,
      placeholder: 'https://github.com/username/repo'
    }
  ]
}

export default githubForkToCrmConfig
