/**
 * Check Contact in Pipedrive API
 *
 * Converted from n8n node: "Search person with Pipedrive"
 * Searches for an existing person in Pipedrive by email
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
    const { input, previousStepOutput, sessionId, stepId } = body

    // Get data from previous step (GitHub user info)
    const email = previousStepOutput?.email || input?.email
    const githubUsername = previousStepOutput?.githubUsername || input?.githubUsername
    const name = previousStepOutput?.name || input?.name

    // Get Pipedrive API key
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('key_value')
      .eq('user_id', user.id)
      .eq('provider', 'pipedrive')
      .single()

    const pipedriveApiKey = apiKeys?.key_value || process.env.PIPEDRIVE_API_KEY

    if (!pipedriveApiKey) {
      return NextResponse.json(
        { error: 'Pipedrive API key not configured. Please add it in settings.' },
        { status: 400 }
      )
    }

    let existingPerson = null
    let searchMethod = 'none'

    // Search by email if available
    if (email) {
      const searchUrl = new URL('https://api.pipedrive.com/v1/persons/search')
      searchUrl.searchParams.set('term', email)
      searchUrl.searchParams.set('fields', 'email')
      searchUrl.searchParams.set('api_token', pipedriveApiKey)

      const response = await fetch(searchUrl.toString())

      if (response.ok) {
        const data = await response.json()
        if (data.data?.items?.length > 0) {
          existingPerson = data.data.items[0].item
          searchMethod = 'email'
        }
      }
    }

    // If no email or not found, try searching by GitHub username in name
    if (!existingPerson && githubUsername) {
      const searchUrl = new URL('https://api.pipedrive.com/v1/persons/search')
      searchUrl.searchParams.set('term', githubUsername)
      searchUrl.searchParams.set('fields', 'name')
      searchUrl.searchParams.set('api_token', pipedriveApiKey)

      const response = await fetch(searchUrl.toString())

      if (response.ok) {
        const data = await response.json()
        if (data.data?.items?.length > 0) {
          existingPerson = data.data.items[0].item
          searchMethod = 'github_username'
        }
      }
    }

    const resultData = {
      contactExists: !!existingPerson,
      existingPerson: existingPerson ? {
        id: existingPerson.id,
        name: existingPerson.name,
        email: existingPerson.primary_email || existingPerson.email?.[0]?.value,
        orgId: existingPerson.org_id
      } : null,
      searchMethod,
      // Pass through data for next step
      githubData: {
        githubUsername,
        name,
        email,
        avatarUrl: previousStepOutput?.avatarUrl,
        profileUrl: previousStepOutput?.profileUrl,
        company: previousStepOutput?.company,
        location: previousStepOutput?.location,
        bio: previousStepOutput?.bio,
        publicRepos: previousStepOutput?.publicRepos,
        followers: previousStepOutput?.followers,
        repositoryName: previousStepOutput?.repositoryName,
        forkUrl: previousStepOutput?.forkUrl
      }
    }

    // Store result in session
    if (sessionId) {
      await supabase
        .from('playbook_sessions')
        .update({
          state: supabase.rpc('jsonb_set_nested', {
            target: 'state',
            path: `{steps,${stepId || 'check_contact'}}`,
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
        source: 'Pipedrive API',
        searchedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Pipedrive search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
