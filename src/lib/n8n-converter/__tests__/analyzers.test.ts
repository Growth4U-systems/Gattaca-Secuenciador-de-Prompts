/**
 * Flow Analyzer Tests
 *
 * Tests for workflow analysis and pattern detection.
 */

import { describe, it, expect } from 'vitest'
import { parseN8nWorkflow } from '../parser'
import { analyzeFlow, getDependentNodes, getUpstreamNodes } from '../analyzers'
import simpleWorkflow from './fixtures/simple-workflow.json'
import branchingWorkflow from './fixtures/branching-workflow.json'
import aiWorkflow from './fixtures/ai-workflow.json'

describe('analyzeFlow', () => {
  describe('execution order', () => {
    it('should determine correct execution order for simple workflow', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
      const analysis = analyzeFlow(workflow)

      expect(analysis.executionOrder).toHaveLength(3)
      expect(analysis.executionOrder[0]).toBe('Manual Trigger')
      expect(analysis.executionOrder[1]).toBe('HTTP Request')
      expect(analysis.executionOrder[2]).toBe('Set Data')
    })

    it('should determine execution order for branching workflow', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(branchingWorkflow))
      const analysis = analyzeFlow(workflow)

      expect(analysis.executionOrder).toHaveLength(4)
      // Webhook should be first
      expect(analysis.executionOrder[0]).toBe('Webhook')
      // Check Condition should come after Webhook
      expect(analysis.executionOrder.indexOf('Check Condition')).toBe(1)
    })
  })

  describe('entry points', () => {
    it('should identify trigger as entry point', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
      const analysis = analyzeFlow(workflow)

      expect(analysis.entryPoints).toHaveLength(1)
      expect(analysis.entryPoints[0]).toBe('Manual Trigger')
    })

    it('should identify webhook as entry point', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(branchingWorkflow))
      const analysis = analyzeFlow(workflow)

      expect(analysis.entryPoints).toContain('Webhook')
    })
  })

  describe('terminals', () => {
    it('should identify terminal nodes (no outputs)', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
      const analysis = analyzeFlow(workflow)

      expect(analysis.terminals).toHaveLength(1)
      expect(analysis.terminals[0]).toBe('Set Data')
    })

    it('should identify multiple terminals in branching workflow', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(branchingWorkflow))
      const analysis = analyzeFlow(workflow)

      expect(analysis.terminals).toContain('Premium Handler')
      expect(analysis.terminals).toContain('Standard Handler')
    })
  })

  describe('pattern detection', () => {
    it('should detect linear flow', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
      const analysis = analyzeFlow(workflow)

      expect(analysis.patterns.hasLinearFlow).toBe(true)
      expect(analysis.patterns.hasBranches).toBe(false)
    })

    it('should detect branches in IF workflow', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(branchingWorkflow))
      const analysis = analyzeFlow(workflow)

      expect(analysis.patterns.hasBranches).toBe(true)
    })
  })

  describe('node analysis', () => {
    it('should analyze each node correctly', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
      const analysis = analyzeFlow(workflow)

      const httpNode = analysis.nodes.get('HTTP Request')
      expect(httpNode).toBeDefined()
      expect(httpNode?.dependencies).toContain('Manual Trigger')
      expect(httpNode?.dependents).toContain('Set Data')
      expect(httpNode?.pattern).toBe('linear')
    })

    it('should identify branch pattern for IF node', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(branchingWorkflow))
      const analysis = analyzeFlow(workflow)

      const ifNode = analysis.nodes.get('Check Condition')
      expect(ifNode).toBeDefined()
      expect(ifNode?.pattern).toBe('branch')
      expect(ifNode?.branches).toBeDefined()
      expect(ifNode?.branches?.length).toBe(2)
    })
  })

  describe('suggested phases', () => {
    it('should suggest phases for workflow', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
      const analysis = analyzeFlow(workflow)

      expect(analysis.suggestedPhases.length).toBeGreaterThan(0)
      // First phase should be trigger
      expect(analysis.suggestedPhases[0].name.toLowerCase()).toContain('trigger')
    })
  })
})

describe('getDependentNodes', () => {
  it('should get all downstream nodes', () => {
    const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
    const analysis = analyzeFlow(workflow)

    const dependents = getDependentNodes(analysis, 'Manual Trigger')
    expect(dependents).toContain('HTTP Request')
    expect(dependents).toContain('Set Data')
  })

  it('should return empty for terminal nodes', () => {
    const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
    const analysis = analyzeFlow(workflow)

    const dependents = getDependentNodes(analysis, 'Set Data')
    expect(dependents).toHaveLength(0)
  })
})

describe('getUpstreamNodes', () => {
  it('should get all upstream nodes', () => {
    const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
    const analysis = analyzeFlow(workflow)

    const upstream = getUpstreamNodes(analysis, 'Set Data')
    expect(upstream).toContain('HTTP Request')
    expect(upstream).toContain('Manual Trigger')
  })

  it('should return empty for entry points', () => {
    const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
    const analysis = analyzeFlow(workflow)

    const upstream = getUpstreamNodes(analysis, 'Manual Trigger')
    expect(upstream).toHaveLength(0)
  })
})
