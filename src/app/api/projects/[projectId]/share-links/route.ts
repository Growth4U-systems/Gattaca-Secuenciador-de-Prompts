import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 10

/**
 * GET - List active share links for project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS ensures only owners can view share links
    const { data: links, error } = await supabase
      .from('project_share_links')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching share links:', error)
      return NextResponse.json({ error: 'Failed to fetch share links' }, { status: 500 })
    }

    return NextResponse.json({ success: true, links: links || [] })
  } catch (error) {
    console.error('Get share links error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST - Create new shareable link
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await request.json()
    const { role = 'editor', expiresIn = 1, maxUses = 1 } = body  // Defaults: editor, 1 uso, 1 día

    // Validate role
    if (!['viewer', 'editor', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Validate maxUses if provided
    if (maxUses !== null && (typeof maxUses !== 'number' || maxUses < 1)) {
      return NextResponse.json({ error: 'maxUses must be a positive number' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate expiration if provided (expiresIn is in days)
    let expiresAt = null
    if (expiresIn && typeof expiresIn === 'number' && expiresIn > 0) {
      const now = new Date()
      expiresAt = new Date(now.getTime() + expiresIn * 24 * 60 * 60 * 1000).toISOString()
    }

    // Create share link (RLS ensures only owners can do this)
    const { data: link, error } = await supabase
      .from('project_share_links')
      .insert({
        project_id: projectId,
        role,
        expires_at: expiresAt,
        max_uses: maxUses,
        created_by: session.user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating share link:', error)
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
    }

    // Generate full URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const shareUrl = `${appUrl}/projects/join/${link.share_token}`

    return NextResponse.json({
      success: true,
      link,
      url: shareUrl,
      message: 'Share link created successfully'
    })
  } catch (error) {
    console.error('Create share link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE - Deactivate share link
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get('linkId')

    if (!linkId) {
      return NextResponse.json({ error: 'Missing linkId parameter' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Deactivate the link (soft delete) - RLS ensures only owners can do this
    const { error } = await supabase
      .from('project_share_links')
      .update({ is_active: false })
      .eq('id', linkId)
      .eq('project_id', projectId)

    if (error) {
      console.error('Error deactivating share link:', error)
      return NextResponse.json({ error: 'Failed to deactivate share link' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Share link deactivated' })
  } catch (error) {
    console.error('Delete share link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
