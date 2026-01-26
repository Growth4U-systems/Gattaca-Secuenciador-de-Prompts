/**
 * Test script for n8n to Gattaca converter
 */

import fs from 'fs'
import path from 'path'
import { convertN8nWorkflow, validateForConversion } from '../src/lib/n8n-converter'

async function testWorkflow(workflowPath: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing: ${path.basename(workflowPath)}`)
  console.log('='.repeat(60))

  const workflowJson = fs.readFileSync(workflowPath, 'utf8')

  // Validate first
  console.log('\n--- Validation ---')
  const validation = await validateForConversion(workflowJson)
  console.log(`Valid: ${validation.valid}`)
  console.log(`Nodes: ${validation.nodeCount}`)
  console.log(`Supported: ${validation.supportedCount}`)
  if (validation.unsupportedNodes.length > 0) {
    console.log(`Unsupported:`)
    validation.unsupportedNodes.forEach(n => console.log(`  - ${n}`))
  }
  if (validation.warnings.length > 0) {
    console.log(`Warnings:`)
    validation.warnings.forEach(w => console.log(`  - ${w}`))
  }

  // Convert
  console.log('\n--- Conversion ---')
  const playbookId = path.basename(workflowPath, '.json')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const result = await convertN8nWorkflow(workflowJson, {
    playbookId,
    outputDir: `/tmp/n8n-test/${playbookId}`,
    validateOnly: true,
  })

  console.log(`Success: ${result.success}`)
  console.log(`Stats:`)
  console.log(`  Total nodes: ${result.stats.totalNodes}`)
  console.log(`  Converted: ${result.stats.convertedNodes}`)
  console.log(`  Partial: ${result.stats.partialNodes}`)
  console.log(`  Unsupported: ${result.stats.unsupportedNodes}`)
  console.log(`  Phases: ${result.stats.phasesGenerated}`)
  console.log(`  Steps: ${result.stats.stepsGenerated}`)
  console.log(`  Time: ${result.stats.conversionTimeMs}ms`)

  if (result.envVariables.length > 0) {
    console.log(`\nEnvironment Variables:`)
    result.envVariables.forEach(e => console.log(`  - ${e.name}: ${e.description}`))
  }

  console.log(`\nPhases & Steps:`)
  result.phases.forEach(phase => {
    console.log(`  📁 ${phase.phase.name}`)
    phase.steps.forEach(step => {
      const status = step.requiresManualImplementation ? '⚠️' : '✅'
      console.log(`     ${status} ${step.step.name} (${step.step.type})`)
    })
  })

  if (result.manualSteps.length > 0) {
    console.log(`\nManual Implementation Required:`)
    result.manualSteps.forEach(s => console.log(`  - ${s}`))
  }

  if (result.warnings.length > 0) {
    console.log(`\nWarnings (${result.warnings.length}):`)
    result.warnings.slice(0, 10).forEach(w => console.log(`  [${w.severity}] ${w.message}`))
    if (result.warnings.length > 10) {
      console.log(`  ... and ${result.warnings.length - 10} more`)
    }
  }

  return result
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    // Test with the SEO workflow
    await testWorkflow('./n8n - vibe marketing/Generate SEO Seed Keywords Using AI.json')
  } else if (args[0] === '--all') {
    // Test all workflows in the directory
    const dir = './n8n - vibe marketing'
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))

    let successCount = 0
    let partialCount = 0
    let failCount = 0

    for (const file of files.slice(0, 10)) { // Limit to first 10 for initial test
      try {
        const result = await testWorkflow(path.join(dir, file))
        if (result.success && result.stats.partialNodes === 0) {
          successCount++
        } else if (result.success) {
          partialCount++
        } else {
          failCount++
        }
      } catch (error) {
        console.error(`Error processing ${file}:`, error)
        failCount++
      }
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`SUMMARY (first 10 workflows)`)
    console.log('='.repeat(60))
    console.log(`  ✅ Full success: ${successCount}`)
    console.log(`  ⚠️  Partial: ${partialCount}`)
    console.log(`  ❌ Failed: ${failCount}`)
  } else {
    // Test specific file
    await testWorkflow(args[0])
  }
}

main().catch(console.error)
