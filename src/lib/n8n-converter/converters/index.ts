/**
 * n8n Node Converters
 *
 * All converters are registered when this module is imported.
 */

// Expression utilities
export {
  convertExpression,
  convertExpressionsInObject,
  generateHelperCode,
  containsExpression,
  HELPER_FUNCTIONS,
  type ConvertedExpression,
  type ExpressionContext,
} from './expression.converter'

// Import to register converters
import './http-request.converter'
import './trigger.converter'
import './ai-llm.converter'
import './transform.converter'
import './logic.converter'
import './unsupported.converter'

// Re-export converters for direct access if needed
export { httpRequestConverter } from './http-request.converter'
export {
  manualTriggerConverter,
  webhookTriggerConverter,
  scheduleTriggerConverter,
  chatTriggerConverter,
} from './trigger.converter'
export {
  openAiConverter,
  anthropicConverter,
  agentConverter,
} from './ai-llm.converter'
export {
  setNodeConverter,
  codeNodeConverter,
  itemListsConverter,
  mergeNodeConverter,
  dateTimeConverter,
} from './transform.converter'
export {
  ifNodeConverter,
  switchNodeConverter,
  filterNodeConverter,
} from './logic.converter'
export { unsupportedNodeConverter } from './unsupported.converter'
