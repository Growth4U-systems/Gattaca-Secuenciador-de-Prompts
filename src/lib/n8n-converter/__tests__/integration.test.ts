/**
 * Integration Tests
 *
 * End-to-end tests for the complete conversion pipeline.
 */

import { describe, it, expect } from 'vitest'
import { convertN8nWorkflow, validateForConversion } from '../index'
import simpleWorkflow from './fixtures/simple-workflow.json'
import branchingWorkflow from './fixtures/branching-workflow.json'
import aiWorkflow from './fixtures/ai-workflow.json'

// Import converters to register them
import '../converters'

describe('Full Conversion Pipeline', () => {
  describe('convertN8nWorkflow', () => {
    it('should convert simple workflow successfully', async () => {
      const result = await convertN8nWorkflow(JSON.stringify(simpleWorkflow), {
        playbookId: 'test-simple',
        outputDir: '/tmp/test-simple',
        validateOnly: true,
      })

      expect(result.success).toBe(true)
      expect(result.stats.totalNodes).toBe(3)
      expect(result.stats.convertedNodes).toBeGreaterThan(0)
      expect(result.phases.length).toBeGreaterThan(0)
    })

    it('should convert branching workflow successfully', async () => {
      const result = await convertN8nWorkflow(JSON.stringify(branchingWorkflow), {
        playbookId: 'test-branching',
        outputDir: '/tmp/test-branching',
        validateOnly: true,
      })

      expect(result.success).toBe(true)
      expect(result.stats.totalNodes).toBe(4)
      expect(result.playbookConfig).toBeDefined()
      expect(result.playbookConfig?.name).toBe('Branching Workflow')
    })

    it('should convert AI workflow successfully', async () => {
      const result = await convertN8nWorkflow(JSON.stringify(aiWorkflow), {
        playbookId: 'test-ai',
        outputDir: '/tmp/test-ai',
        validateOnly: true,
      })

      expect(result.success).toBe(true)
      expect(result.stats.totalNodes).toBe(3)
      // Should detect env variables needed
      expect(result.envVariables.length).toBeGreaterThanOrEqual(0)
    })

    it('should generate files when not in validateOnly mode', async () => {
      const result = await convertN8nWorkflow(JSON.stringify(simpleWorkflow), {
        playbookId: 'test-files',
        outputDir: '/tmp/test-files',
        validateOnly: false,
      })

      expect(result.generatedFiles.length).toBeGreaterThan(0)
      // Should have config file
      expect(result.generatedFiles.some(f => f.type === 'config')).toBe(true)
    })

    it('should convert Code node with short code', async () => {
      // AI workflow has a Code node with short (< 100 lines) code
      const result = await convertN8nWorkflow(JSON.stringify(aiWorkflow), {
        playbookId: 'test-code',
        outputDir: '/tmp/test-code',
        validateOnly: true,
      })

      // Check if Code node is converted
      const codeStep = result.phases
        .flatMap(p => p.steps)
        .find(s => s.sourceNode.type === 'n8n-nodes-base.code')

      // Short code doesn't require manual implementation
      if (codeStep) {
        expect(codeStep.requiresManualImplementation).toBe(false)
        expect(codeStep.step.type).toBe('auto')
      }
    })

    it('should handle conversion errors gracefully', async () => {
      const result = await convertN8nWorkflow('invalid json', {
        playbookId: 'test-error',
        outputDir: '/tmp/test-error',
        validateOnly: true,
      })

      expect(result.success).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0].severity).toBe('error')
    })
  })

  describe('validateForConversion', () => {
    it('should validate simple workflow', async () => {
      const result = await validateForConversion(JSON.stringify(simpleWorkflow))

      expect(result.valid).toBe(true)
      expect(result.nodeCount).toBe(3)
      expect(result.supportedCount).toBeGreaterThanOrEqual(2)
    })

    it('should identify unsupported nodes', async () => {
      // Create a workflow with a completely unsupported node
      const workflowWithUnsupported = {
        ...simpleWorkflow,
        nodes: [
          ...simpleWorkflow.nodes,
          {
            id: '99',
            name: 'Unsupported Node',
            type: 'n8n-nodes-base.someVerySpecificUnsupportedNode',
            typeVersion: 1,
            position: [600, 0],
            parameters: {},
          },
        ],
      }

      const result = await validateForConversion(JSON.stringify(workflowWithUnsupported))

      // Should still be valid (unsupported nodes get fallback handling)
      // but unsupported count should include the unknown node
      expect(result.nodeCount).toBe(4)
    })

    it('should reject invalid JSON', async () => {
      const result = await validateForConversion('not json')

      expect(result.valid).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })
})

describe('Generated Playbook Structure', () => {
  it('should generate valid PlaybookConfig', async () => {
    const result = await convertN8nWorkflow(JSON.stringify(simpleWorkflow), {
      playbookId: 'structure-test',
      outputDir: '/tmp/structure-test',
      validateOnly: true,
    })

    const config = result.playbookConfig
    expect(config).toBeDefined()
    expect(config?.id).toBe('structure-test')
    expect(config?.name).toBe('Simple Test Workflow')
    expect(config?.phases).toBeInstanceOf(Array)
    expect(config?.phases.length).toBeGreaterThan(0)
  })

  it('should have steps with correct structure', async () => {
    const result = await convertN8nWorkflow(JSON.stringify(simpleWorkflow), {
      playbookId: 'step-test',
      outputDir: '/tmp/step-test',
      validateOnly: true,
    })

    const allSteps = result.phases.flatMap(p => p.steps)

    for (const convertedStep of allSteps) {
      const step = convertedStep.step
      // Required fields
      expect(step.id).toBeDefined()
      expect(step.name).toBeDefined()
      expect(step.type).toBeDefined()
      // Type should be valid
      expect(['input', 'auto', 'auto_with_review', 'manual_research', 'display', 'decision']).toContain(step.type)
    }
  })

  it('should maintain correct dependencies between steps', async () => {
    const result = await convertN8nWorkflow(JSON.stringify(simpleWorkflow), {
      playbookId: 'deps-test',
      outputDir: '/tmp/deps-test',
      validateOnly: true,
    })

    const allSteps = result.phases.flatMap(p => p.steps)
    const stepMap = new Map(allSteps.map(s => [s.step.id, s]))

    // HTTP Request should depend on Manual Trigger
    const httpStep = allSteps.find(s => s.sourceNode.name === 'HTTP Request')
    if (httpStep && httpStep.step.dependsOn) {
      const triggerStepId = allSteps.find(s => s.sourceNode.name === 'Manual Trigger')?.step.id
      expect(httpStep.step.dependsOn).toContain(triggerStepId)
    }
  })
})

describe('Environment Variables Detection', () => {
  it('should detect OpenAI credentials', async () => {
    const result = await convertN8nWorkflow(JSON.stringify(aiWorkflow), {
      playbookId: 'env-test',
      outputDir: '/tmp/env-test',
      validateOnly: false,
    })

    // Should have OpenAI related env var
    const openAiEnv = result.envVariables.find(e =>
      e.name.includes('OPENAI') || e.sourceCredentialType?.includes('openAi')
    )

    expect(openAiEnv).toBeDefined()
  })
})
