import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const playbookType = searchParams.get('playbookType')

    if (!projectId || !playbookType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: projectId, playbookType'
      }, { status: 400 })
    }

    // Verify project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: 'Project not found'
      }, { status: 404 })
    }

    // Fetch all outputs for this project and playbook type
    const { data: outputs, error: outputsError } = await supabase
      .from('playbook_step_outputs')
      .select('step_id, output_content, imported_data, status, variables_used, executed_at')
      .eq('project_id', projectId)
      .eq('playbook_type', playbookType)
      .order('executed_at', { ascending: true })

    if (outputsError) {
      console.error('[playbook/outputs] Error fetching outputs:', outputsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch outputs'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      outputs: outputs || [],
    })

  } catch (error) {
    console.error('[playbook/outputs] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
