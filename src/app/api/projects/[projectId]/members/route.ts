import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 10

/**
 * GET - List project members
 * Returns all members of a project including their roles
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch members (RLS ensures user has access to this project)
    const { data: members, error } = await supabase
      .from('project_members')
      .select(`
        id,
        role,
        added_at,
        user_id,
        added_by
      `)
      .eq('project_id', projectId)
      .order('added_at', { ascending: false })

    if (error) {
      console.error('Error fetching members:', error)
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    // Fetch user emails from auth.users using service role
    // (Regular users can't query auth.users due to RLS)
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get emails for all members
    const userIds = members?.map(m => m.user_id) || []

    // Try auth.users first (Supabase Auth)
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()

    // Create a map of user_id -> email from auth users
    const emailMap = new Map(
      authUsers.users
        .filter(u => userIds.includes(u.id))
        .map(u => [u.id, u.email || 'Unknown'])
    )

    // Enrich members with email
    const enrichedMembers = members?.map(member => ({
      ...member,
      email: emailMap.get(member.user_id) || 'Unknown'
    })) || []

    // Also get project owner to distinguish original owner
    const { data: project } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single()

    return NextResponse.json({
      success: true,
      members: enrichedMembers,
      originalOwnerId: project?.user_id || null
    })
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE - Remove member from project
 * IMPORTANT: Validates that the last owner cannot be removed
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const userId = searchParams.get('userId')

    if (!memberId && !userId) {
      return NextResponse.json({ error: 'Missing memberId or userId parameter' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // If memberId provided, get the userId from project_members
    let targetUserId = userId
    if (memberId && !userId) {
      const { data: member, error: memberError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('id', memberId)
        .eq('project_id', projectId)
        .single()

      if (memberError || !member) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 })
      }

      targetUserId = member.user_id
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Could not determine user to remove' }, { status: 400 })
    }

    // Get the role of the user being removed
    const { data: memberRole, error: roleError } = await supabase
      .rpc('get_user_project_role', {
        p_project_id: projectId,
        p_user_id: targetUserId
      })

    if (roleError) {
      console.error('Error getting member role:', roleError)
    }

    // If removing an owner, verify it's not the last one
    if (memberRole === 'owner') {
      const { data: ownerCount, error: countError } = await supabase
        .rpc('count_project_owners', { p_project_id: projectId })

      if (countError) {
        console.error('Error counting owners:', countError)
        return NextResponse.json({ error: 'Failed to verify owner count' }, { status: 500 })
      }

      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last owner. Add another owner first.' },
          { status: 400 }
        )
      }
    }

    // Verify permission: must be owner to remove others, or removing self
    const { data: userRole } = await supabase
      .rpc('get_user_project_role', {
        p_project_id: projectId,
        p_user_id: session.user.id
      })

    if (userRole !== 'owner' && targetUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only owners can remove other members' },
        { status: 403 }
      )
    }

    // Remove member from project_members table
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', targetUserId)

    if (error) {
      console.error('Error removing member:', error)
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    // Create notification for removed user (if not self-removal)
    if (targetUserId !== session.user.id) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single()

      // Use service role to create notification for another user
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const supabaseAdmin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: targetUserId,
          type: 'member_removed',
          title: 'Removed from project',
          message: `You have been removed from project "${project?.name || 'Unknown'}"`,
          project_id: projectId,
          actor_id: session.user.id
        })
    }

    return NextResponse.json({ success: true, message: 'Member removed successfully' })
  } catch (error) {
    console.error('Delete member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
