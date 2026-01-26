/**
 * Parser Tests
 *
 * Tests for n8n workflow JSON parsing and validation.
 */

import { describe, it, expect } from 'vitest'
import { parseN8nWorkflow, validateN8nWorkflow, N8nParseError } from '../parser'
import simpleWorkflow from './fixtures/simple-workflow.json'
import branchingWorkflow from './fixtures/branching-workflow.json'
import aiWorkflow from './fixtures/ai-workflow.json'

describe('parseN8nWorkflow', () => {
  it('should parse a valid simple workflow', () => {
    const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))

    expect(workflow.name).toBe('Simple Test Workflow')
    expect(workflow.nodes).toHaveLength(3)
    expect(workflow.connections).toBeDefined()
  })

  it('should parse a workflow with branching', () => {
    const workflow = parseN8nWorkflow(JSON.stringify(branchingWorkflow))

    expect(workflow.name).toBe('Branching Workflow')
    expect(workflow.nodes).toHaveLength(4)

    // Check IF node connections have two outputs
    const ifConnections = workflow.connections['Check Condition']
    expect(ifConnections?.main).toHaveLength(2)
  })

  it('should parse an AI workflow', () => {
    const workflow = parseN8nWorkflow(JSON.stringify(aiWorkflow))

    expect(workflow.name).toBe('AI Processing Workflow')
    expect(workflow.nodes).toHaveLength(3)

    // Check AI node has credentials
    const openAiNode = workflow.nodes.find(n => n.name === 'OpenAI Chat')
    expect(openAiNode?.credentials).toBeDefined()
    expect(openAiNode?.credentials?.openAiApi).toBeDefined()
  })

  it('should throw on invalid JSON', () => {
    expect(() => parseN8nWorkflow('not valid json')).toThrow(N8nParseError)
  })

  it('should throw on missing nodes', () => {
    const invalidWorkflow = {
      name: 'Invalid',
      connections: {},
    }
    expect(() => parseN8nWorkflow(JSON.stringify(invalidWorkflow))).toThrow()
  })

  it('should parse workflow with empty nodes array', () => {
    const emptyWorkflow = {
      name: 'Empty',
      nodes: [],
      connections: {},
    }
    // Parser accepts empty nodes (validation happens at analysis level)
    const result = parseN8nWorkflow(JSON.stringify(emptyWorkflow))
    expect(result.nodes).toHaveLength(0)
  })
})

describe('validateN8nWorkflow', () => {
  it('should validate a correct workflow', () => {
    const result = validateN8nWorkflow(JSON.stringify(simpleWorkflow))

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.nodeCount).toBe(3)
    expect(result.workflowName).toBe('Simple Test Workflow')
  })

  it('should detect invalid JSON', () => {
    const result = validateN8nWorkflow('not valid json')

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should detect missing nodes array', () => {
    const invalidWorkflow = {
      name: 'Invalid',
      connections: {},
    }
    const result = validateN8nWorkflow(JSON.stringify(invalidWorkflow))

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
