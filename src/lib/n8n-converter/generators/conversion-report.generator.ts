/**
 * Conversion Report Generator
 *
 * Generates a detailed markdown report of the n8n to Gattaca conversion process.
 * Includes workflow analysis, conversion statistics, warnings, and next steps.
 */

import { N8nWorkflow } from '../types'
import { ConversionResult, ConvertedStep, ConversionWarning, EnvVariable } from '../types'
import { FlowAnalysis } from '../analyzers'

// ============================================
// Types
// ============================================

export interface ReportGenerationOptions {
  /** Include detailed node-by-node breakdown */
  includeNodeDetails?: boolean

  /** Include generated code snippets */
  includeCodeSnippets?: boolean

  /** Include visual flow diagram (mermaid syntax) */
  includeFlowDiagram?: boolean

  /** Include environment variable setup guide */
  includeEnvGuide?: boolean

  /** Report format */
  format?: 'markdown' | 'html' | 'json'
}

export interface ConversionReport {
  /** Report content */
  content: string

  /** Report format */
  format: 'markdown' | 'html' | 'json'

  /** Report sections for programmatic access */
  sections: {
    summary: string
    analysis: string
    conversionDetails: string
    warnings: string
    envVariables: string
    nextSteps: string
    flowDiagram?: string
  }
}

// ============================================
// Main Generator
// ============================================

/**
 * Generate a detailed conversion report
 */
export function generateConversionReport(
  workflow: N8nWorkflow,
  result: ConversionResult,
  flowAnalysis: FlowAnalysis,
  options: ReportGenerationOptions = {}
): ConversionReport {
  const {
    includeNodeDetails = true,
    includeCodeSnippets = false,
    includeFlowDiagram = true,
    includeEnvGuide = true,
    format = 'markdown',
  } = options

  // Generate each section
  const summary = generateSummarySection(workflow, result)
  const analysis = generateAnalysisSection(workflow, flowAnalysis)
  const conversionDetails = generateConversionDetailsSection(result, includeNodeDetails)
  const warnings = generateWarningsSection(result.warnings)
  const envVariables = generateEnvVariablesSection(result.envVariables, includeEnvGuide)
  const nextSteps = generateNextStepsSection(result)
  const flowDiagram = includeFlowDiagram ? generateFlowDiagram(workflow, flowAnalysis) : undefined

  // Combine sections
  const sections = {
    summary,
    analysis,
    conversionDetails,
    warnings,
    envVariables,
    nextSteps,
    flowDiagram,
  }

  let content: string

  switch (format) {
    case 'html':
      content = generateHtmlReport(sections, workflow.name)
      break
    case 'json':
      content = JSON.stringify({
        workflow: {
          name: workflow.name,
          nodeCount: workflow.nodes.length,
        },
        result: {
          success: result.success,
          stats: result.stats,
        },
        sections,
      }, null, 2)
      break
    case 'markdown':
    default:
      content = generateMarkdownReport(sections, workflow.name)
      break
  }

  return {
    content,
    format,
    sections,
  }
}

// ============================================
// Section Generators
// ============================================

function generateSummarySection(workflow: N8nWorkflow, result: ConversionResult): string {
  const status = result.success ? '✅ Successful' : '⚠️ Partial'
  const conversionRate = result.stats.totalNodes > 0
    ? Math.round((result.stats.convertedNodes / result.stats.totalNodes) * 100)
    : 0

  return `
## Summary

| Property | Value |
|----------|-------|
| **Workflow Name** | ${workflow.name || 'Untitled'} |
| **Status** | ${status} |
| **Total Nodes** | ${result.stats.totalNodes} |
| **Converted** | ${result.stats.convertedNodes} (${conversionRate}%) |
| **Partial** | ${result.stats.partialNodes} |
| **Unsupported** | ${result.stats.unsupportedNodes} |
| **Phases Generated** | ${result.stats.phasesGenerated} |
| **Steps Generated** | ${result.stats.stepsGenerated} |
| **API Routes** | ${result.stats.apiRoutesGenerated} |
| **Conversion Time** | ${result.stats.conversionTimeMs}ms |
`.trim()
}

function generateAnalysisSection(workflow: N8nWorkflow, flowAnalysis: FlowAnalysis): string {
  const triggers = workflow.nodes.filter(n => n.type.toLowerCase().includes('trigger'))
  const aiNodes = workflow.nodes.filter(n =>
    n.type.toLowerCase().includes('openai') ||
    n.type.toLowerCase().includes('anthropic') ||
    n.type.toLowerCase().includes('llm')
  )
  const httpNodes = workflow.nodes.filter(n => n.type.toLowerCase().includes('http'))

  const patternAnalysis: string[] = []

  if (flowAnalysis.patterns.hasParallelPaths) {
    patternAnalysis.push('- Contains parallel execution paths')
  }
  if (flowAnalysis.patterns.hasBranches) {
    patternAnalysis.push('- Contains conditional branching (IF/Switch)')
  }
  if (flowAnalysis.patterns.hasLoops) {
    patternAnalysis.push('- Contains loop patterns')
  }
  if (flowAnalysis.patterns.hasMerges) {
    patternAnalysis.push('- Contains merge points')
  }

  return `
## Workflow Analysis

### Node Distribution

| Category | Count |
|----------|-------|
| Triggers | ${triggers.length} |
| AI/LLM Nodes | ${aiNodes.length} |
| HTTP Requests | ${httpNodes.length} |
| Other | ${workflow.nodes.length - triggers.length - aiNodes.length - httpNodes.length} |

### Execution Flow

- **Entry Points**: ${flowAnalysis.entryPoints.map((e: string) => `\`${e}\``).join(', ') || 'None detected'}
- **Exit Points**: ${flowAnalysis.terminals.map((e: string) => `\`${e}\``).join(', ') || 'None detected'}
- **Total Nodes**: ${flowAnalysis.executionOrder.length}

### Detected Patterns

${patternAnalysis.length > 0 ? patternAnalysis.join('\n') : '- Linear workflow (no complex patterns)'}

### Suggested Phases

${flowAnalysis.suggestedPhases.map((p, i) => `${i + 1}. **${p.name}** - ${p.reason}`).join('\n')}
`.trim()
}

function generateConversionDetailsSection(result: ConversionResult, includeDetails: boolean): string {
  if (!includeDetails) {
    return `
## Conversion Details

${result.stats.stepsGenerated} steps were generated across ${result.stats.phasesGenerated} phases.
`.trim()
  }

  const phaseDetails = result.phases.map(convertedPhase => {
    const stepList = convertedPhase.steps.map(convertedStep => {
      const warning = convertedStep.warnings?.length > 0 ? ' ⚠️' : ''
      const manual = convertedStep.requiresManualImplementation ? ' 🔧' : ''
      return `  - \`${convertedStep.step.id}\`: ${convertedStep.step.name}${warning}${manual}`
    }).join('\n')

    return `
### Phase: ${convertedPhase.phase.name}

${convertedPhase.phase.description || 'No description'}

**Steps:**
${stepList}
`
  }).join('\n')

  return `
## Conversion Details

${phaseDetails}

**Legend:**
- ⚠️ Has warnings
- 🔧 Requires manual implementation
`.trim()
}

function generateWarningsSection(warnings: ConversionWarning[]): string {
  if (warnings.length === 0) {
    return `
## Warnings

No warnings generated during conversion.
`.trim()
  }

  const grouped = {
    error: warnings.filter(w => w.severity === 'error'),
    warning: warnings.filter(w => w.severity === 'warning'),
    info: warnings.filter(w => w.severity === 'info'),
  }

  const sections: string[] = []

  if (grouped.error.length > 0) {
    sections.push(`
### ❌ Errors (${grouped.error.length})

${grouped.error.map(w => `- **${w.message}**${w.suggestion ? `\n  - 💡 ${w.suggestion}` : ''}`).join('\n')}
`)
  }

  if (grouped.warning.length > 0) {
    sections.push(`
### ⚠️ Warnings (${grouped.warning.length})

${grouped.warning.map(w => `- ${w.message}${w.suggestion ? `\n  - 💡 ${w.suggestion}` : ''}`).join('\n')}
`)
  }

  if (grouped.info.length > 0) {
    sections.push(`
### ℹ️ Info (${grouped.info.length})

${grouped.info.map(w => `- ${w.message}`).join('\n')}
`)
  }

  return `
## Warnings

${sections.join('\n')}
`.trim()
}

function generateEnvVariablesSection(envVariables: EnvVariable[], includeGuide: boolean): string {
  if (envVariables.length === 0) {
    return `
## Environment Variables

No environment variables required.
`.trim()
  }

  const table = `
| Variable | Required | Description |
|----------|----------|-------------|
${envVariables.map(e => `| \`${e.name}\` | ${e.required ? 'Yes' : 'No'} | ${e.description} |`).join('\n')}
`

  if (!includeGuide) {
    return `
## Environment Variables

${table}
`.trim()
  }

  const envExample = envVariables.map(e => {
    return `# ${e.description}
${e.name}=${e.example || 'your-value-here'}`
  }).join('\n\n')

  return `
## Environment Variables

${table}

### Setup Guide

1. Copy the example below to your \`.env.local\` file
2. Replace placeholder values with your actual credentials
3. Restart your development server

\`\`\`bash
${envExample}
\`\`\`

### Obtaining Credentials

${envVariables.map(e => {
  if (e.name.includes('OPENAI')) {
    return `- **${e.name}**: Get from [OpenAI API Keys](https://platform.openai.com/api-keys)`
  }
  if (e.name.includes('ANTHROPIC')) {
    return `- **${e.name}**: Get from [Anthropic Console](https://console.anthropic.com/)`
  }
  return `- **${e.name}**: ${e.sourceCredentialType ? `From your ${e.sourceCredentialType} provider` : 'See service documentation'}`
}).join('\n')}
`.trim()
}

function generateNextStepsSection(result: ConversionResult): string {
  const steps: string[] = []

  // Environment setup
  if (result.envVariables.length > 0) {
    steps.push('1. **Configure Environment Variables** - Copy the required variables to your `.env.local` file')
  }

  // Manual implementations
  if (result.manualSteps.length > 0) {
    steps.push(`2. **Complete Manual Implementations** - ${result.manualSteps.length} step(s) require manual code:`)
    result.manualSteps.slice(0, 3).forEach(step => {
      steps.push(`   - ${step}`)
    })
    if (result.manualSteps.length > 3) {
      steps.push(`   - ...and ${result.manualSteps.length - 3} more`)
    }
  }

  // Testing
  steps.push(`${steps.length + 1}. **Test the Playbook** - Run through each phase to verify functionality`)

  // Review warnings
  if (result.warnings.length > 0) {
    steps.push(`${steps.length + 1}. **Review Warnings** - Address ${result.warnings.length} warning(s) listed above`)
  }

  // Deploy
  steps.push(`${steps.length + 1}. **Deploy** - Once tested, deploy your playbook to production`)

  return `
## Next Steps

${steps.join('\n')}

### Quick Start

\`\`\`bash
# Install dependencies (if new packages were added)
npm install

# Start development server
npm run dev

# Navigate to the playbook
# http://localhost:3000/playbook/${result.playbookConfig?.id || 'your-playbook-id'}
\`\`\`
`.trim()
}

function generateFlowDiagram(workflow: N8nWorkflow, flowAnalysis: FlowAnalysis): string {
  // Generate Mermaid diagram
  const nodes: string[] = []
  const connections: string[] = []
  const nodeShapes: Record<string, string> = {}

  // Define node shapes based on type
  for (const node of workflow.nodes) {
    const id = sanitizeMermaidId(node.name)
    const type = node.type.toLowerCase()

    if (type.includes('trigger')) {
      nodeShapes[id] = `${id}([${node.name}])`  // Stadium shape for triggers
    } else if (type.includes('if') || type.includes('switch')) {
      nodeShapes[id] = `${id}{${node.name}}`  // Diamond for decisions
    } else if (type.includes('openai') || type.includes('anthropic') || type.includes('llm')) {
      nodeShapes[id] = `${id}[/${node.name}/]`  // Parallelogram for AI
    } else {
      nodeShapes[id] = `${id}[${node.name}]`  // Rectangle for others
    }

    nodes.push(nodeShapes[id])
  }

  // Build connections from workflow.connections
  if (workflow.connections) {
    for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
      const sourceId = sanitizeMermaidId(sourceName)

      if (outputs.main) {
        for (let outputIndex = 0; outputIndex < outputs.main.length; outputIndex++) {
          const targets = outputs.main[outputIndex]
          if (!targets) continue

          for (const target of targets) {
            const targetId = sanitizeMermaidId(target.node)
            const label = outputs.main.length > 1 ? ` -- "${outputIndex === 0 ? 'true' : 'false'}" --> ` : ' --> '
            connections.push(`${sourceId}${label}${targetId}`)
          }
        }
      }
    }
  }

  return `
## Flow Diagram

\`\`\`mermaid
flowchart TD
    %% Nodes
    ${nodes.join('\n    ')}

    %% Connections
    ${connections.join('\n    ')}
\`\`\`
`.trim()
}

// ============================================
// Format Generators
// ============================================

function generateMarkdownReport(sections: ConversionReport['sections'], workflowName: string): string {
  return `# Conversion Report: ${workflowName || 'Untitled Workflow'}

Generated: ${new Date().toISOString()}

---

${sections.summary}

---

${sections.analysis}

---

${sections.conversionDetails}

---

${sections.warnings}

---

${sections.envVariables}

---

${sections.flowDiagram || ''}

---

${sections.nextSteps}

---

*Generated by Gattaca n8n Converter*
`
}

function generateHtmlReport(sections: ConversionReport['sections'], workflowName: string): string {
  // Simple HTML wrapper - could be enhanced with styling
  const markdownContent = generateMarkdownReport(sections, workflowName)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversion Report: ${workflowName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f4f4f4;
    }
    code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 4px;
    }
    pre {
      background-color: #f4f4f4;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 2em 0;
    }
  </style>
</head>
<body>
  <pre>${escapeHtml(markdownContent)}</pre>
</body>
</html>`
}

// ============================================
// Helpers
// ============================================

function sanitizeMermaidId(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
