/**
 * Process GitHub Fork API
 *
 * Converted from n8n nodes:
 * - "On fork" (GitHub Trigger)
 * - "Get Github user information" (HTTP Request)
 *
 * Fetches detailed user information from GitHub API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { input, sessionId, stepId } = body

    const githubUsername = input?.githubUsername
    const repositoryName = input?.repositoryName
    const forkUrl = input?.forkUrl

    if (!githubUsername) {
      return NextResponse.json(
        { error: 'GitHub username is required' },
        { status: 400 }
      )
    }

    // Get GitHub API token
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('key_value')
      .eq('user_id', user.id)
      .eq('provider', 'github')
      .single()

    const githubToken = apiKeys?.key_value || process.env.GITHUB_TOKEN

    // Fetch user info from GitHub API
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Gattaca-CRM-Integration'
    }

    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`
    }

    const response = await fetch(`https://api.github.com/users/${githubUsername}`, {
      headers
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: `GitHub user "${githubUsername}" not found` },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch GitHub user information' },
        { status: 500 }
      )
    }

    const githubUser = await response.json()

    const resultData = {
      githubUsername: githubUser.login,
      name: githubUser.name || githubUser.login,
      email: githubUser.email, // May be null if not public
      avatarUrl: githubUser.avatar_url,
      profileUrl: githubUser.html_url,
      company: githubUser.company,
      location: githubUser.location,
      bio: githubUser.bio,
      publicRepos: githubUser.public_repos,
      followers: githubUser.followers,
      repositoryName,
      forkUrl: forkUrl || `https://github.com/${githubUsername}/${repositoryName?.split('/')[1] || 'repo'}`
    }

    // Store result in session
    if (sessionId) {
      await supabase
        .from('playbook_sessions')
        .update({
          state: supabase.rpc('jsonb_set_nested', {
            target: 'state',
            path: `{steps,${stepId || 'fetch_github_user'}}`,
            value: JSON.stringify({
              status: 'completed',
              output: resultData,
              completedAt: new Date().toISOString()
            })
          }),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
    }

    return NextResponse.json({
      success: true,
      data: resultData,
      metadata: {
        source: 'GitHub API',
        fetchedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('GitHub user fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
