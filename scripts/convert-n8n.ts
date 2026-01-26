#!/usr/bin/env npx tsx
/**
 * n8n to Gattaca Converter CLI
 *
 * Usage:
 *   npx tsx scripts/convert-n8n.ts ./workflow.json --output ./src/playbooks/my-playbook
 *   npx tsx scripts/convert-n8n.ts ./workflow.json --validate-only
 *   npx tsx scripts/convert-n8n.ts ./workflow.json --dry-run
 *
 * Options:
 *   --output, -o     Output directory (default: ./src/playbooks/<workflow-name>)
 *   --playbook-id    Custom playbook ID (default: derived from workflow name)
 *   --validate-only  Only validate, don't generate files
 *   --dry-run        Preview what would be generated without writing files
 *   --skip-unsupported  Skip unsupported nodes instead of creating placeholders
 *   --help, -h       Show help
 */

import * as fs from 'fs'
import * as path from 'path'
import { convertN8nWorkflow, validateForConversion, parseN8nWorkflow } from '../src/lib/n8n-converter'

// ============================================
// CLI Argument Parsing
// ============================================

interface CliArgs {
  inputFile: string
  outputDir?: string
  playbookId?: string
  validateOnly: boolean
  dryRun: boolean
  skipUnsupported: boolean
  help: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = {
    inputFile: '',
    validateOnly: false,
    dryRun: false,
    skipUnsupported: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      result.help = true
    } else if (arg === '--output' || arg === '-o') {
      result.outputDir = args[++i]
    } else if (arg === '--playbook-id') {
      result.playbookId = args[++i]
    } else if (arg === '--validate-only') {
      result.validateOnly = true
    } else if (arg === '--dry-run') {
      result.dryRun = true
    } else if (arg === '--skip-unsupported') {
      result.skipUnsupported = true
    } else if (!arg.startsWith('-')) {
      result.inputFile = arg
    }
  }

  return result
}

function showHelp(): void {
  console.log(`
n8n to Gattaca Converter CLI

Usage:
  npx tsx scripts/convert-n8n.ts <workflow.json> [options]

Arguments:
  workflow.json       Path to n8n workflow JSON file

Options:
  --output, -o <dir>  Output directory (default: ./src/playbooks/<workflow-name>)
  --playbook-id <id>  Custom playbook ID (default: derived from workflow name)
  --validate-only     Only validate workflow, don't generate files
  --dry-run           Preview what would be generated without writing files
  --skip-unsupported  Skip unsupported nodes instead of creating placeholders
  --help, -h          Show this help message

Examples:
  npx tsx scripts/convert-n8n.ts my-workflow.json
  npx tsx scripts/convert-n8n.ts my-workflow.json --output ./src/playbooks/custom
  npx tsx scripts/convert-n8n.ts my-workflow.json --validate-only
  npx tsx scripts/convert-n8n.ts my-workflow.json --dry-run
`)
}

// ============================================
// CLI Output Helpers
// ============================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string): void {
  console.log(message)
}

function logSuccess(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`)
}

function logWarning(message: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`)
}

function logError(message: string): void {
  console.log(`${colors.red}✗${colors.reset} ${message}`)
}

function logInfo(message: string): void {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`)
}

function logHeader(message: string): void {
  console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}`)
}

// ============================================
// Main CLI Logic
// ============================================

async function main(): Promise<void> {
  const args = parseArgs()

  if (args.help) {
    showHelp()
    process.exit(0)
  }

  if (!args.inputFile) {
    logError('No input file specified')
    showHelp()
    process.exit(1)
  }

  // Read input file
  const inputPath = path.resolve(args.inputFile)

  if (!fs.existsSync(inputPath)) {
    logError(`File not found: ${inputPath}`)
    process.exit(1)
  }

  log(`\n${colors.bright}n8n to Gattaca Converter${colors.reset}`)
  log('─'.repeat(40))

  const json = fs.readFileSync(inputPath, 'utf-8')

  // Parse to get workflow name for defaults
  let workflowName: string
  try {
    const workflow = parseN8nWorkflow(json)
    workflowName = workflow.name
    logSuccess(`Parsed workflow: ${workflowName}`)
    logInfo(`Nodes: ${workflow.nodes.length}`)
  } catch (error) {
    logError(`Failed to parse workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }

  // Determine playbook ID and output directory
  const playbookId = args.playbookId || workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const outputDir = args.outputDir || `./src/playbooks/${playbookId}`

  // Validate only mode
  if (args.validateOnly) {
    logHeader('Validation Results')

    const validation = await validateForConversion(json)

    log(`Nodes: ${validation.nodeCount}`)
    log(`Supported: ${validation.supportedCount}`)
    log(`Unsupported: ${validation.unsupportedNodes.length}`)

    if (validation.unsupportedNodes.length > 0) {
      logWarning('Unsupported nodes:')
      for (const node of validation.unsupportedNodes) {
        log(`  - ${node}`)
      }
    }

    if (validation.warnings.length > 0) {
      logWarning('Warnings:')
      for (const warning of validation.warnings) {
        log(`  - ${warning}`)
      }
    }

    if (validation.valid) {
      logSuccess('Workflow is fully convertible!')
    } else {
      logWarning('Workflow has unsupported nodes. Manual implementation will be required.')
    }

    process.exit(validation.valid ? 0 : 1)
  }

  // Full conversion
  logHeader('Converting...')
  log(`Playbook ID: ${playbookId}`)
  log(`Output: ${outputDir}`)

  const result = await convertN8nWorkflow(json, {
    playbookId,
    outputDir,
    skipUnsupported: args.skipUnsupported,
    validateOnly: args.dryRun,
  })

  // Show stats
  logHeader('Conversion Stats')
  log(`Total nodes: ${result.stats.totalNodes}`)
  log(`Converted: ${result.stats.convertedNodes}`)
  log(`Partial: ${result.stats.partialNodes}`)
  log(`Unsupported: ${result.stats.unsupportedNodes}`)
  log(`Phases: ${result.stats.phasesGenerated}`)
  log(`Steps: ${result.stats.stepsGenerated}`)
  log(`API routes: ${result.stats.apiRoutesGenerated}`)
  log(`Time: ${result.stats.conversionTimeMs}ms`)

  // Show warnings
  if (result.warnings.length > 0) {
    logHeader('Warnings')
    for (const warning of result.warnings) {
      if (warning.severity === 'error') {
        logError(warning.message)
      } else if (warning.severity === 'warning') {
        logWarning(warning.message)
      } else {
        logInfo(warning.message)
      }
      if (warning.suggestion) {
        log(`  ${colors.dim}→ ${warning.suggestion}${colors.reset}`)
      }
    }
  }

  // Show manual steps needed
  if (result.manualSteps.length > 0) {
    logHeader('Manual Steps Required')
    for (const step of result.manualSteps) {
      log(`  • ${step}`)
    }
  }

  // Show environment variables needed
  if (result.envVariables.length > 0) {
    logHeader('Environment Variables Required')
    for (const env of result.envVariables) {
      log(`  ${env.name}`)
      log(`  ${colors.dim}${env.description}${colors.reset}`)
    }
  }

  // Show generated files
  if (result.generatedFiles.length > 0) {
    logHeader('Generated Files')
    for (const file of result.generatedFiles) {
      log(`  ${file.path}`)
      log(`  ${colors.dim}${file.description}${colors.reset}`)
    }
  }

  // Write files (unless dry-run)
  if (!args.dryRun && result.generatedFiles.length > 0) {
    logHeader('Writing Files')

    for (const file of result.generatedFiles) {
      const filePath = path.resolve(file.path)
      const dir = path.dirname(filePath)

      // Create directory
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Write file
      fs.writeFileSync(filePath, file.content, 'utf-8')
      logSuccess(`Created: ${file.path}`)
    }
  }

  // Final summary
  logHeader('Summary')
  if (result.success) {
    logSuccess('Conversion completed successfully!')
    if (!args.dryRun) {
      logInfo(`Next steps:`)
      log(`  1. Review generated files in ${outputDir}`)
      log(`  2. Set environment variables from .env.example`)
      if (result.manualSteps.length > 0) {
        log(`  3. Implement ${result.manualSteps.length} manual step(s)`)
      }
      log(`  4. Import playbook config in your app`)
    }
  } else {
    logWarning('Conversion completed with issues. Review warnings above.')
  }

  process.exit(result.success ? 0 : 1)
}

main().catch(error => {
  logError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exit(1)
})
