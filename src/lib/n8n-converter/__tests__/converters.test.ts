/**
 * Converter Tests
 *
 * Tests for node conversion to Gattaca steps.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { parseN8nWorkflow } from '../parser'
import { analyzeFlow } from '../analyzers'
import { getNodeConverter, isNodeTypeSupported, listSupportedNodeTypes } from '../registry'
import { convertExpression, containsExpression } from '../converters'
import simpleWorkflow from './fixtures/simple-workflow.json'
import branchingWorkflow from './fixtures/branching-workflow.json'
import aiWorkflow from './fixtures/ai-workflow.json'

// Import converters to register them
import '../converters'

describe('Node Registry', () => {
  describe('supported types', () => {
    it('should support HTTP Request node', () => {
      expect(isNodeTypeSupported('n8n-nodes-base.httpRequest')).toBe(true)
    })

    it('should support Manual Trigger', () => {
      expect(isNodeTypeSupported('n8n-nodes-base.manualTrigger')).toBe(true)
    })

    it('should support IF node', () => {
      expect(isNodeTypeSupported('n8n-nodes-base.if')).toBe(true)
    })

    it('should support Set node', () => {
      expect(isNodeTypeSupported('n8n-nodes-base.set')).toBe(true)
    })

    it('should list supported types', () => {
      const types = listSupportedNodeTypes()
      expect(types.length).toBeGreaterThan(0)
      expect(types).toContain('n8n-nodes-base.httpRequest')
    })
  })

  describe('getNodeConverter', () => {
    it('should return converter for supported node', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
      const httpNode = workflow.nodes.find(n => n.name === 'HTTP Request')

      const converter = getNodeConverter(httpNode!)
      expect(converter).not.toBeNull()
    })

    it('should return fallback for unsupported node', () => {
      const unsupportedNode = {
        id: '1',
        name: 'Unknown',
        type: 'n8n-nodes-base.someUnknownNode',
        typeVersion: 1,
        position: [0, 0] as [number, number],
        parameters: {},
      }

      const converter = getNodeConverter(unsupportedNode)
      // Fallback converter should handle it
      expect(converter).not.toBeNull()
    })
  })
})

describe('Node Conversion', () => {
  describe('HTTP Request conversion', () => {
    it('should convert HTTP Request to step', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
      const analysis = analyzeFlow(workflow)
      const httpNode = workflow.nodes.find(n => n.name === 'HTTP Request')!
      const analyzed = analysis.nodes.get('HTTP Request')!

      const converter = getNodeConverter(httpNode)!
      const result = converter.convert(httpNode, {
        expressionContext: {
          nodeToStepMap: new Map([['HTTP Request', 'http_request']]),
          contextName: 'context',
          stateName: 'state',
        },
        analyzedNode: analyzed,
        playbookId: 'test',
        outputDir: '/test',
        allNodes: workflow.nodes,
        allAnalyzedNodes: analysis.nodes,
      })

      expect(result.step.id).toBe('http_request')
      expect(result.step.name).toBe('HTTP Request')
      expect(result.requiresManualImplementation).toBe(false)
    })
  })

  describe('Trigger conversion', () => {
    it('should convert Manual Trigger to input step', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(simpleWorkflow))
      const analysis = analyzeFlow(workflow)
      const triggerNode = workflow.nodes.find(n => n.name === 'Manual Trigger')!
      const analyzed = analysis.nodes.get('Manual Trigger')!

      const converter = getNodeConverter(triggerNode)!
      const result = converter.convert(triggerNode, {
        expressionContext: {
          nodeToStepMap: new Map([['Manual Trigger', 'manual_trigger']]),
          contextName: 'context',
          stateName: 'state',
        },
        analyzedNode: analyzed,
        playbookId: 'test',
        outputDir: '/test',
        allNodes: workflow.nodes,
        allAnalyzedNodes: analysis.nodes,
      })

      expect(result.step.type).toBe('input')
    })

    it('should convert Webhook to input step', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(branchingWorkflow))
      const analysis = analyzeFlow(workflow)
      const webhookNode = workflow.nodes.find(n => n.name === 'Webhook')!
      const analyzed = analysis.nodes.get('Webhook')!

      const converter = getNodeConverter(webhookNode)!
      const result = converter.convert(webhookNode, {
        expressionContext: {
          nodeToStepMap: new Map([['Webhook', 'webhook']]),
          contextName: 'context',
          stateName: 'state',
        },
        analyzedNode: analyzed,
        playbookId: 'test',
        outputDir: '/test',
        allNodes: workflow.nodes,
        allAnalyzedNodes: analysis.nodes,
      })

      expect(result.step.type).toBe('input')
    })
  })

  describe('IF conversion', () => {
    it('should convert IF node to decision step', () => {
      const workflow = parseN8nWorkflow(JSON.stringify(branchingWorkflow))
      const analysis = analyzeFlow(workflow)
      const ifNode = workflow.nodes.find(n => n.name === 'Check Condition')!
      const analyzed = analysis.nodes.get('Check Condition')!

      const converter = getNodeConverter(ifNode)!
      const result = converter.convert(ifNode, {
        expressionContext: {
          nodeToStepMap: new Map([['Check Condition', 'check_condition']]),
          contextName: 'context',
          stateName: 'state',
        },
        analyzedNode: analyzed,
        playbookId: 'test',
        outputDir: '/test',
        allNodes: workflow.nodes,
        allAnalyzedNodes: analysis.nodes,
      })

      expect(result.step.type).toBe('decision')
    })
  })
})

describe('Expression Conversion', () => {
  describe('containsExpression', () => {
    it('should detect n8n expressions', () => {
      expect(containsExpression('={{ $json.field }}')).toBe(true)
      expect(containsExpression('{{ $json.field }}')).toBe(true)
      expect(containsExpression('$json.field')).toBe(true)
    })

    it('should return false for plain strings', () => {
      expect(containsExpression('just a string')).toBe(false)
      expect(containsExpression('123')).toBe(false)
    })
  })

  describe('convertExpression', () => {
    const context = {
      nodeToStepMap: new Map([
        ['Previous Node', 'previous_node'],
        ['Another Node', 'another_node'],
      ]),
      contextName: 'context',
      stateName: 'state',
    }

    it('should convert $json references', () => {
      const result = convertExpression('={{ $json.field }}', context)
      expect(result.expression).toContain('input')
      expect(result.expression).toContain('field')
    })

    it('should convert $node references', () => {
      const result = convertExpression('={{ $node["Previous Node"].json.data }}', context)
      expect(result.expression).toContain('previous_node')
    })

    it('should handle string concatenation', () => {
      const result = convertExpression('Hello {{ $json.name }}!', context)
      expect(result.expression).toContain('name')
    })
  })
})
