import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ExecuteActionRequest {
  projectId: string
  action: {
    type: 'execute_step' | 'start_playbook'
    stepId?: string
    stepName?: string
    playbookType?: string
    playbookName?: string
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

  // Get session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: ExecuteActionRequest = await request.json()
  const { projectId, action } = body

  if (!projectId || !action) {
    return NextResponse.json({ error: 'Missing projectId or action' }, { status: 400 })
  }

  try {
    if (action.type === 'execute_step') {
      // Call the existing execute-step endpoint
      const executeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/playbook/execute-step`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            projectId,
            stepId: action.stepId,
            playbookType: action.playbookType,
          }),
        }
      )

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json()
        return NextResponse.json({
          success: false,
          message: `Error al ejecutar el paso: ${errorData.error || 'Unknown error'}`,
        }, { status: 500 })
      }

      const result = await executeResponse.json()

      return NextResponse.json({
        success: true,
        message: `El paso "${action.stepName}" se ejecutó correctamente.`,
        result,
      })

    } else if (action.type === 'start_playbook') {
      // Create a new playbook session
      const { data: newSession, error: sessionError } = await supabase
        .from('playbook_sessions')
        .insert({
          project_id: projectId,
          playbook_type: action.playbookType,
          status: 'active',
          current_phase: 'setup',
          config: {},
          variables: {},
        })
        .select()
        .single()

      if (sessionError) {
        return NextResponse.json({
          success: false,
          message: `Error al iniciar el playbook: ${sessionError.message}`,
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `El playbook "${action.playbookName}" se inició correctamente. Puedes ir a la página del playbook para continuar.`,
        session: newSession,
      })
    }

    return NextResponse.json({
      error: 'Unknown action type',
    }, { status: 400 })

  } catch (error) {
    console.error('[Assistant Execute Action] Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Error interno al ejecutar la acción.',
    }, { status: 500 })
  }
}
