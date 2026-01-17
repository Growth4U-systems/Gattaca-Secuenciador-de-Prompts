import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient as createAdminClient } from '@/lib/supabase-server-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ImportDataRequest {
  projectId: string
  stepId: string
  playbookType: string
  data: unknown[] // Parsed CSV/JSON data
  source?: string // 'phantombuster', 'apify', 'manual'
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized'
    }, { status: 401 })
  }

  try {
    const body: ImportDataRequest = await request.json()
    const { projectId, stepId, playbookType, data, source } = body

    if (!projectId || !stepId || !playbookType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: projectId, stepId, playbookType'
      }, { status: 400 })
    }

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({
        success: false,
        error: 'Data must be an array'
      }, { status: 400 })
    }

    if (data.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Data array is empty'
      }, { status: 400 })
    }

    // Verify project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    // Save imported data to database
    const adminClient = createAdminClient()
    const { error: upsertError } = await adminClient
      .from('playbook_step_outputs')
      .upsert({
        project_id: projectId,
        playbook_type: playbookType,
        step_id: stepId,
        imported_data: data,
        status: 'completed',
        variables_used: { source: source || 'manual', record_count: data.length },
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,playbook_type,step_id'
      })

    if (upsertError) {
      console.error('[playbook/import-data] Upsert error:', upsertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save imported data'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      recordCount: data.length,
      stepId,
      message: `Successfully imported ${data.length} records`
    })

  } catch (error) {
    console.error('[playbook/import-data] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
