/**
 * Node Type Registry
 *
 * Extensible registry for mapping n8n node types to Gattaca step converters.
 * New converters can be registered without modifying core code.
 */

import { N8nNode, ConvertedStep, GeneratedCode, ConversionWarning } from '../types'
import { AnalyzedNode } from '../analyzers'
import { ExpressionContext } from '../converters/expression.converter'

// ============================================
// Types
// ============================================

/**
 * Context provided to node converters
 */
export interface NodeConversionContext {
  /** Workflow-level expression context */
  expressionContext: ExpressionContext

  /** The analyzed node info */
  analyzedNode: AnalyzedNode

  /** Playbook ID being generated */
  playbookId: string

  /** Project ID */
  projectId?: string

  /** Output directory for generated files */
  outputDir: string

  /** All nodes in the workflow (for reference) */
  allNodes: N8nNode[]

  /** All analyzed nodes */
  allAnalyzedNodes: Map<string, AnalyzedNode>
}

/**
 * Node converter interface
 *
 * Implement this to add support for a new n8n node type.
 */
export interface NodeConverter {
  /**
   * Node types this converter handles
   * Can be exact match ('n8n-nodes-base.httpRequest')
   * or pattern ('n8n-nodes-base.*')
   */
  nodeTypes: string[]

  /**
   * Priority (higher = checked first)
   * Default converters have priority 0
   * Custom converters should use 10+
   */
  priority?: number

  /**
   * Check if this converter can handle the node
   */
  canConvert(node: N8nNode): boolean

  /**
   * Convert the node to a Gattaca step
   */
  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep

  /**
   * Generate code for this step (API route, etc.)
   * Returns undefined if no code generation needed
   */
  generateCode?(node: N8nNode, context: NodeConversionContext): GeneratedCode | undefined
}

// ============================================
// Registry Implementation
// ============================================

/**
 * Registry entry with metadata
 */
interface RegistryEntry {
  converter: NodeConverter
  priority: number
  registeredAt: Date
}

/**
 * Global node converter registry
 */
class NodeConverterRegistry {
  private converters: RegistryEntry[] = []
  private typeCache: Map<string, NodeConverter | null> = new Map()

  /**
   * Register a new node converter
   *
   * @example
   * ```typescript
   * registry.register({
   *   nodeTypes: ['n8n-nodes-base.httpRequest'],
   *   canConvert: (node) => true,
   *   convert: (node, ctx) => ({ ... }),
   * })
   * ```
   */
  register(converter: NodeConverter): void {
    const entry: RegistryEntry = {
      converter,
      priority: converter.priority ?? 0,
      registeredAt: new Date(),
    }

    this.converters.push(entry)

    // Sort by priority (highest first)
    this.converters.sort((a, b) => b.priority - a.priority)

    // Clear cache
    this.typeCache.clear()
  }

  /**
   * Unregister a converter by reference
   */
  unregister(converter: NodeConverter): boolean {
    const index = this.converters.findIndex(e => e.converter === converter)
    if (index >= 0) {
      this.converters.splice(index, 1)
      this.typeCache.clear()
      return true
    }
    return false
  }

  /**
   * Get converter for a specific node
   * Returns null if no converter found
   */
  getConverter(node: N8nNode): NodeConverter | null {
    // Check cache first
    const cacheKey = node.type
    if (this.typeCache.has(cacheKey)) {
      return this.typeCache.get(cacheKey)!
    }

    // Find matching converter
    for (const entry of this.converters) {
      // Check if type matches
      const typeMatches = entry.converter.nodeTypes.some(pattern => {
        if (pattern.endsWith('*')) {
          // Wildcard match
          const prefix = pattern.slice(0, -1)
          return node.type.startsWith(prefix)
        }
        return node.type === pattern
      })

      if (typeMatches && entry.converter.canConvert(node)) {
        this.typeCache.set(cacheKey, entry.converter)
        return entry.converter
      }
    }

    this.typeCache.set(cacheKey, null)
    return null
  }

  /**
   * Check if a node type is supported
   */
  isSupported(nodeType: string): boolean {
    // Create a minimal node to test
    const testNode: N8nNode = {
      id: 'test',
      name: 'test',
      type: nodeType,
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    }
    return this.getConverter(testNode) !== null
  }

  /**
   * List all supported node types
   */
  listSupportedTypes(): string[] {
    const types = new Set<string>()
    for (const entry of this.converters) {
      for (const type of entry.converter.nodeTypes) {
        types.add(type)
      }
    }
    return Array.from(types).sort()
  }

  /**
   * Get all registered converters
   */
  getAllConverters(): NodeConverter[] {
    return this.converters.map(e => e.converter)
  }

  /**
   * Get converter count
   */
  get count(): number {
    return this.converters.length
  }

  /**
   * Clear all converters (for testing)
   */
  clear(): void {
    this.converters = []
    this.typeCache.clear()
  }
}

// ============================================
// Global Registry Instance
// ============================================

/**
 * Global node converter registry
 */
export const nodeRegistry = new NodeConverterRegistry()

/**
 * Register a node converter
 */
export function registerNodeConverter(converter: NodeConverter): void {
  nodeRegistry.register(converter)
}

/**
 * Get converter for a node
 */
export function getNodeConverter(node: N8nNode): NodeConverter | null {
  return nodeRegistry.getConverter(node)
}

/**
 * Check if node type is supported
 */
export function isNodeTypeSupported(nodeType: string): boolean {
  return nodeRegistry.isSupported(nodeType)
}

/**
 * List all supported node types
 */
export function listSupportedNodeTypes(): string[] {
  return nodeRegistry.listSupportedTypes()
}

// ============================================
// Fallback Converter
// ============================================

/**
 * Fallback converter for unsupported nodes
 * Generates a manual implementation placeholder
 */
export const fallbackConverter: NodeConverter = {
  nodeTypes: ['*'],
  priority: -100, // Lowest priority

  canConvert(): boolean {
    return true // Handles anything as last resort
  },

  convert(node: N8nNode, context: NodeConversionContext): ConvertedStep {
    return {
      step: {
        id: node.name.toLowerCase().replace(/\s+/g, '_'),
        name: node.name,
        description: `[Manual Implementation Required] ${node.type}`,
        type: 'manual_research',
        executor: 'none',
        dependsOn: context.analyzedNode.dependencies.map(
          d => d.toLowerCase().replace(/\s+/g, '_')
        ),
      },
      warnings: [
        {
          severity: 'warning',
          message: `Node type "${node.type}" is not supported for automatic conversion`,
          suggestion: `Manual implementation required. Original node configuration is preserved in comments.`,
          nodeId: node.id,
        },
      ],
      requiresManualImplementation: true,
      sourceNode: {
        id: node.id,
        name: node.name,
        type: node.type,
      },
    }
  },

  generateCode(node: N8nNode): GeneratedCode {
    const nodeConfig = JSON.stringify(node.parameters, null, 2)

    return {
      utilities: [
        {
          path: `_manual/${node.name.toLowerCase().replace(/\s+/g, '_')}.ts`,
          content: `/**
 * MANUAL IMPLEMENTATION REQUIRED
 *
 * Original n8n Node: ${node.type}
 * Node Name: ${node.name}
 *
 * Original Configuration:
 * ${nodeConfig.split('\n').map(l => ' * ' + l).join('\n')}
 *
 * TODO: Implement the equivalent functionality for Gattaca
 */

export async function execute(input: unknown): Promise<unknown> {
  throw new Error('Not implemented: ${node.name}')
}
`,
        },
      ],
    }
  },
}

// Register fallback as default
nodeRegistry.register(fallbackConverter)
