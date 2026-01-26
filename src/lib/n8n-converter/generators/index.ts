/**
 * n8n Generators
 *
 * Generate Gattaca artifacts from n8n workflows.
 */

export {
  generatePlaybookConfig,
  type PlaybookGenerationOptions,
  type PlaybookGenerationResult,
} from './playbook-config.generator'

export {
  generateApiRoutes,
  type ApiRouteGenerationOptions,
  type ApiRouteGenerationResult,
} from './api-routes.generator'

export {
  generateConversionReport,
  type ReportGenerationOptions,
  type ConversionReport,
} from './conversion-report.generator'
