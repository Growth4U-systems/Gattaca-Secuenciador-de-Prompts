import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 10

/**
 * POST - Accept invitation by token
 * NOTE: This operation has potential race conditions but they are acceptable for MVP
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 })
    }

    // Find the invitation
    const { data: invitation, error: invError } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .single()

    if (invError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    // Verify the email matches the logged-in user
    if (invitation.email.toLowerCase() !== session.user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      )
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('project_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id, role')
      .eq('project_id', invitation.project_id)
      .eq('user_id', session.user.id)
      .single()

    if (existingMember) {
      // Update invitation status anyway
      await supabase
        .from('project_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return NextResponse.json({
        success: true,
        projectId: invitation.project_id,
        message: 'You are already a member of this project',
        existingRole: existingMember.role
      })
    }

    // Use service role to bypass RLS for adding member and creating notifications
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Add user to project_members using service role
    const { error: memberError } = await supabaseAdmin
      .from('project_members')
      .insert({
        project_id: invitation.project_id,
        user_id: session.user.id,
        role: invitation.role,
        added_by: invitation.invited_by
      })

    if (memberError) {
      console.error('Error adding member:', memberError)
      return NextResponse.json(
        { error: 'Failed to add you to the project' },
        { status: 500 }
      )
    }

    // Mark invitation as accepted using service role
    await supabaseAdmin
      .from('project_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    // Get project details for notifications
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', invitation.project_id)
      .single()

    const projectName = project?.name || 'a project'

    // Create notification for the inviter using service role
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: invitation.invited_by,
        type: 'member_added',
        title: 'Invitation accepted',
        message: `${session.user.email} accepted your invitation to "${projectName}"`,
        project_id: invitation.project_id,
        actor_id: session.user.id
      })

    // Create notification for the new member using service role
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: session.user.id,
        type: 'project_shared',
        title: 'Added to project',
        message: `You've been added to "${projectName}" as ${invitation.role}`,
        project_id: invitation.project_id,
        actor_id: invitation.invited_by
      })

    return NextResponse.json({
      success: true,
      projectId: invitation.project_id,
      role: invitation.role,
      projectName,
      message: `Successfully joined "${projectName}"`
    })
  } catch (error) {
    console.error('Accept invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
