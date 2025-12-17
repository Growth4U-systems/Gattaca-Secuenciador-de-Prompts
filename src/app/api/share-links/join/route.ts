import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 10

/**
 * POST - Join project via share link token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: 'Share link token is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 })
    }

    // Find the share link (RLS ensures it's active and not expired)
    const { data: link, error: linkError } = await supabase
      .from('project_share_links')
      .select('*')
      .eq('share_token', token)
      .eq('is_active', true)
      .single()

    if (linkError || !link) {
      console.error('Share link lookup error:', linkError)
      return NextResponse.json(
        { error: 'Invalid or inactive share link' },
        { status: 404 }
      )
    }

    console.log('Found share link:', { id: link.id, role: link.role, project_id: link.project_id })

    // Additional server-side validation for expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      // Deactivate expired link
      await supabase
        .from('project_share_links')
        .update({ is_active: false })
        .eq('id', link.id)

      return NextResponse.json(
        { error: 'This share link has expired' },
        { status: 400 }
      )
    }

    // Check max uses
    if (link.max_uses && link.current_uses >= link.max_uses) {
      // Deactivate link that reached max uses
      await supabase
        .from('project_share_links')
        .update({ is_active: false })
        .eq('id', link.id)

      return NextResponse.json(
        { error: 'This share link has reached its maximum number of uses' },
        { status: 400 }
      )
    }

    // Check if user already has access to this project
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id, role')
      .eq('project_id', link.project_id)
      .eq('user_id', session.user.id)
      .single()

    if (existingMember) {
      return NextResponse.json({
        success: true,
        projectId: link.project_id,
        message: 'You already have access to this project',
        existingRole: existingMember.role
      })
    }

    // Use service role to bypass RLS for adding member and updating stats
    // (RLS policies prevent non-owners from these operations)
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Add user to project using service role
    const { error: memberError } = await supabaseAdmin
      .from('project_members')
      .insert({
        project_id: link.project_id,
        user_id: session.user.id,
        role: link.role,
        added_by: link.created_by
      })

    if (memberError) {
      console.error('Error adding member:', memberError)
      return NextResponse.json(
        { error: 'Failed to add you to the project' },
        { status: 500 }
      )
    }

    // Calculate new uses count
    const newUsesCount = link.current_uses + 1

    // Check if link should be deactivated after this use
    const shouldDeactivate = link.max_uses && newUsesCount >= link.max_uses

    // Update link stats and deactivate if needed
    await supabaseAdmin
      .from('project_share_links')
      .update({
        current_uses: newUsesCount,
        last_used_at: new Date().toISOString(),
        is_active: shouldDeactivate ? false : link.is_active
      })
      .eq('id', link.id)

    // Get project details
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', link.project_id)
      .single()

    const projectName = project?.name || 'a project'

    // Create notification for the new member using service role
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: session.user.id,
        type: 'project_shared',
        title: 'Added to project',
        message: `You've been added to "${projectName}" via share link`,
        project_id: link.project_id,
        actor_id: link.created_by
      })

    // Create notification for the link creator (owner) using service role
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: link.created_by,
        type: 'member_added',
        title: 'New member joined',
        message: `${session.user.email} joined "${projectName}" via share link as ${link.role}`,
        project_id: link.project_id,
        actor_id: session.user.id
      })

    return NextResponse.json({
      success: true,
      projectId: link.project_id,
      role: link.role,
      projectName,
      message: `Successfully joined "${projectName}" as ${link.role}`
    })
  } catch (error) {
    console.error('Join via share link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
