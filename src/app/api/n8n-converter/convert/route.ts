/**
 * N8n Workflow Conversion API
 *
 * POST /api/n8n-converter/convert
 * Converts an n8n workflow JSON to a Gattaca playbook
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { convertN8nWorkflow, validateForConversion } from '@/lib/n8n-converter'

interface ConvertRequest {
  workflow: string
  playbookId?: string
  validateOnly?: boolean
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request
    const body: ConvertRequest = await request.json()

    if (!body.workflow) {
      return NextResponse.json(
        { success: false, message: 'Workflow JSON is required' },
        { status: 400 }
      )
    }

    // Extract workflow name for ID generation
    let workflowData
    try {
      workflowData = JSON.parse(body.workflow)
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Generate playbook ID if not provided
    const playbookId = body.playbookId || generatePlaybookId(workflowData.name)

    // Validate only mode
    if (body.validateOnly) {
      const validation = await validateForConversion(body.workflow)
      return NextResponse.json({
        success: validation.valid,
        playbookId,
        workflowName: workflowData.name,
        validation,
      })
    }

    // Full conversion
    const result = await convertN8nWorkflow(body.workflow, {
      playbookId,
      outputDir: `src/app/api/playbook/${playbookId}`,
      skipUnsupported: false,
    })

    return NextResponse.json({
      success: result.success,
      playbookId,
      workflowName: workflowData.name,
      stats: result.stats,
      warnings: result.warnings,
      envVariables: result.envVariables,
      manualSteps: result.manualSteps,
      generatedFiles: result.generatedFiles.map(f => ({
        path: f.path,
        type: f.type,
        description: f.description,
      })),
    })
  } catch (error) {
    console.error('[n8n-converter] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Conversion failed',
      },
      { status: 500 }
    )
  }
}

/**
 * Generate playbook ID from workflow name
 */
function generatePlaybookId(name?: string): string {
  if (!name) return `playbook-${Date.now()}`
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}
