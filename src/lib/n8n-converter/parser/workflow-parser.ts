/**
 * n8n Workflow Parser
 *
 * Parses and validates n8n workflow JSON into typed structures.
 */

import {
  N8nWorkflow,
  N8nNode,
  N8nConnections,
  N8nNodeConnections,
  N8nConnectionInfo,
} from '../types'

// ============================================
// Parser Errors
// ============================================

export class N8nParseError extends Error {
  constructor(
    message: string,
    public field?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'N8nParseError'
  }
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate that a value is a non-empty string
 */
function validateString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new N8nParseError(`${fieldName} must be a string`, fieldName, { received: typeof value })
  }
  return value
}

/**
 * Validate that a value is a number
 */
function validateNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number') {
    throw new N8nParseError(`${fieldName} must be a number`, fieldName, { received: typeof value })
  }
  return value
}

/**
 * Validate that a value is an array
 */
function validateArray<T>(value: unknown, fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new N8nParseError(`${fieldName} must be an array`, fieldName, { received: typeof value })
  }
  return value as T[]
}

/**
 * Validate position tuple [x, y]
 */
function validatePosition(value: unknown, nodeName: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new N8nParseError(
      `Node "${nodeName}" position must be [x, y] array`,
      'position',
      { received: value }
    )
  }
  const [x, y] = value
  if (typeof x !== 'number' || typeof y !== 'number') {
    throw new N8nParseError(
      `Node "${nodeName}" position coordinates must be numbers`,
      'position',
      { received: value }
    )
  }
  return [x, y]
}

/**
 * Validate and parse a single node
 */
function parseNode(nodeData: unknown, index: number): N8nNode {
  if (!nodeData || typeof nodeData !== 'object') {
    throw new N8nParseError(`Node at index ${index} is not an object`)
  }

  const node = nodeData as Record<string, unknown>

  // Required fields
  const id = node.id ? validateString(node.id, `nodes[${index}].id`) : `node_${index}`
  const name = validateString(node.name, `nodes[${index}].name`)
  const type = validateString(node.type, `nodes[${index}].type`)
  const position = validatePosition(node.position, name)

  // Type version can be number or array of numbers
  let typeVersion: number | number[]
  if (Array.isArray(node.typeVersion)) {
    typeVersion = node.typeVersion.map((v, i) =>
      validateNumber(v, `nodes[${index}].typeVersion[${i}]`)
    )
  } else if (typeof node.typeVersion === 'number') {
    typeVersion = node.typeVersion
  } else {
    typeVersion = 1 // Default
  }

  // Parameters (optional, defaults to empty object)
  // Cast to N8nNodeParameters - runtime validation happens through usage
  const parameters = (node.parameters || {}) as N8nNode['parameters']

  // Build node object
  const parsedNode: N8nNode = {
    id,
    name,
    type,
    typeVersion,
    position,
    parameters,
  }

  // Optional fields
  if (node.credentials) {
    parsedNode.credentials = node.credentials as N8nNode['credentials']
  }
  if (typeof node.disabled === 'boolean') {
    parsedNode.disabled = node.disabled
  }
  if (typeof node.notes === 'string') {
    parsedNode.notes = node.notes
  }
  if (typeof node.continueOnFail === 'boolean') {
    parsedNode.continueOnFail = node.continueOnFail
  }
  if (typeof node.executeOnce === 'boolean') {
    parsedNode.executeOnce = node.executeOnce
  }
  if (typeof node.retryOnFail === 'boolean') {
    parsedNode.retryOnFail = node.retryOnFail
  }
  if (typeof node.maxTries === 'number') {
    parsedNode.maxTries = node.maxTries
  }
  if (typeof node.waitBetweenTries === 'number') {
    parsedNode.waitBetweenTries = node.waitBetweenTries
  }
  if (typeof node.alwaysOutputData === 'boolean') {
    parsedNode.alwaysOutputData = node.alwaysOutputData
  }
  if (typeof node.webhookId === 'string') {
    parsedNode.webhookId = node.webhookId
  }

  return parsedNode
}

/**
 * Validate and parse connection info
 */
function parseConnectionInfo(conn: unknown, path: string): N8nConnectionInfo {
  if (!conn || typeof conn !== 'object') {
    throw new N8nParseError(`${path} is not an object`)
  }

  const c = conn as Record<string, unknown>

  return {
    node: validateString(c.node, `${path}.node`),
    type: validateString(c.type, `${path}.type`),
    index: typeof c.index === 'number' ? c.index : 0,
  }
}

/**
 * Validate and parse connections from a node
 */
function parseNodeConnections(
  connData: unknown,
  sourceName: string
): N8nNodeConnections {
  if (!connData || typeof connData !== 'object') {
    return {}
  }

  const conn = connData as Record<string, unknown>
  const result: N8nNodeConnections = {}

  // Parse each connection type
  const connectionTypes: (keyof N8nNodeConnections)[] = [
    'main',
    'ai_languageModel',
    'ai_tool',
    'ai_memory',
    'ai_outputParser',
    'ai_retriever',
    'ai_document',
    'ai_embedding',
    'ai_vectorStore',
    'ai_textSplitter',
  ]

  for (const connType of connectionTypes) {
    if (conn[connType] && Array.isArray(conn[connType])) {
      const outputs = conn[connType] as unknown[][]
      result[connType] = outputs.map((outputConnections, outputIndex) => {
        if (!Array.isArray(outputConnections)) {
          return []
        }
        return outputConnections.map((c, connIndex) =>
          parseConnectionInfo(c, `connections.${sourceName}.${connType}[${outputIndex}][${connIndex}]`)
        )
      })
    }
  }

  return result
}

/**
 * Validate and parse all connections
 */
function parseConnections(connectionsData: unknown): N8nConnections {
  if (!connectionsData || typeof connectionsData !== 'object') {
    return {}
  }

  const connections = connectionsData as Record<string, unknown>
  const result: N8nConnections = {}

  for (const [sourceName, nodeConnections] of Object.entries(connections)) {
    result[sourceName] = parseNodeConnections(nodeConnections, sourceName)
  }

  return result
}

// ============================================
// Main Parser Function
// ============================================

/**
 * Parse n8n workflow JSON string into typed structure
 *
 * @param json - Raw JSON string from n8n export
 * @returns Parsed and validated N8nWorkflow
 * @throws N8nParseError if JSON is invalid or missing required fields
 *
 * @example
 * ```typescript
 * const workflow = parseN8nWorkflow(jsonString)
 * console.log(workflow.name, workflow.nodes.length)
 * ```
 */
export function parseN8nWorkflow(json: string): N8nWorkflow {
  // Parse JSON
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (error) {
    throw new N8nParseError(
      'Invalid JSON: ' + (error instanceof Error ? error.message : 'Unknown error'),
      undefined,
      { originalError: error }
    )
  }

  if (!data || typeof data !== 'object') {
    throw new N8nParseError('Workflow must be an object')
  }

  const workflow = data as Record<string, unknown>

  // Required: name
  const name = validateString(workflow.name, 'name')

  // Required: nodes array
  const nodesData = validateArray(workflow.nodes, 'nodes')
  const nodes = nodesData.map((nodeData, index) => parseNode(nodeData, index))

  // Validate unique node names (required for connections)
  const nodeNames = new Set<string>()
  for (const node of nodes) {
    if (nodeNames.has(node.name)) {
      throw new N8nParseError(
        `Duplicate node name: "${node.name}"`,
        'nodes',
        { duplicateName: node.name }
      )
    }
    nodeNames.add(node.name)
  }

  // Required: connections (can be empty object)
  const connections = parseConnections(workflow.connections)

  // Validate that connection targets exist
  for (const [sourceName, nodeConns] of Object.entries(connections)) {
    // Check source exists
    if (!nodeNames.has(sourceName)) {
      throw new N8nParseError(
        `Connection source node "${sourceName}" does not exist`,
        'connections',
        { missingNode: sourceName }
      )
    }

    // Check targets exist
    for (const outputs of Object.values(nodeConns)) {
      if (!outputs) continue
      for (const outputConns of outputs) {
        for (const conn of outputConns) {
          if (!nodeNames.has(conn.node)) {
            throw new N8nParseError(
              `Connection target node "${conn.node}" does not exist`,
              'connections',
              { missingNode: conn.node, source: sourceName }
            )
          }
        }
      }
    }
  }

  // Build workflow object
  const result: N8nWorkflow = {
    name,
    nodes,
    connections,
  }

  // Optional fields
  if (typeof workflow.id === 'string') {
    result.id = workflow.id
  }
  if (workflow.settings && typeof workflow.settings === 'object') {
    result.settings = workflow.settings as N8nWorkflow['settings']
  }
  if (workflow.staticData && typeof workflow.staticData === 'object') {
    result.staticData = workflow.staticData as Record<string, unknown>
  }
  if (workflow.pinData && typeof workflow.pinData === 'object') {
    result.pinData = workflow.pinData as Record<string, unknown[]>
  }
  if (Array.isArray(workflow.tags)) {
    result.tags = workflow.tags as N8nWorkflow['tags']
  }
  if (workflow.meta && typeof workflow.meta === 'object') {
    result.meta = workflow.meta as N8nWorkflow['meta']
  }
  if (typeof workflow.active === 'boolean') {
    result.active = workflow.active
  }
  if (typeof workflow.versionId === 'string') {
    result.versionId = workflow.versionId
  }

  return result
}

/**
 * Parse n8n workflow from object (already parsed JSON)
 */
export function parseN8nWorkflowFromObject(data: unknown): N8nWorkflow {
  return parseN8nWorkflow(JSON.stringify(data))
}

/**
 * Validate n8n workflow JSON without full parsing
 * Returns validation result with errors if any
 */
export function validateN8nWorkflow(json: string): {
  valid: boolean
  errors: string[]
  nodeCount?: number
  workflowName?: string
} {
  try {
    const workflow = parseN8nWorkflow(json)
    return {
      valid: true,
      errors: [],
      nodeCount: workflow.nodes.length,
      workflowName: workflow.name,
    }
  } catch (error) {
    if (error instanceof N8nParseError) {
      return {
        valid: false,
        errors: [error.message],
      }
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}
