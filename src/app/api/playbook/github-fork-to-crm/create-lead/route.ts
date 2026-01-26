/**
 * Create Lead in Pipedrive API
 *
 * Converted from n8n nodes:
 * - "Create person in Pipedrive" (conditional)
 * - "Create lead in Pipedrive"
 *
 * Creates a new person (if needed) and lead in Pipedrive
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
    const { input, previousStepOutput, sessionId, stepId, decision } = body

    // Check if user decided to create the lead
    if (decision === 'skip') {
      return NextResponse.json({
        success: true,
        data: {
          skipped: true,
          reason: 'User chose to skip lead creation'
        }
      })
    }

    // Get data from previous steps
    const contactExists = previousStepOutput?.contactExists
    const existingPerson = previousStepOutput?.existingPerson
    const githubData = previousStepOutput?.githubData || input

    const {
      githubUsername,
      name,
      email,
      company,
      location,
      bio,
      profileUrl,
      publicRepos,
      followers,
      repositoryName,
      forkUrl
    } = githubData

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

    let personId = existingPerson?.id

    // Create person if doesn't exist
    if (!contactExists) {
      const personResponse = await fetch(
        `https://api.pipedrive.com/v1/persons?api_token=${pipedriveApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: name || githubUsername,
            email: email ? [{ value: email, primary: true }] : undefined,
            // Store GitHub profile in a custom field or visible notes
            visible_to: 3, // Entire company
            // Add notes with GitHub info
          })
        }
      )

      if (!personResponse.ok) {
        const errorData = await personResponse.json().catch(() => ({}))
        console.error('Pipedrive create person error:', errorData)
        return NextResponse.json(
          { error: 'Failed to create person in Pipedrive' },
          { status: 500 }
        )
      }

      const personData = await personResponse.json()
      personId = personData.data.id

      // Add note to person with GitHub details
      await fetch(
        `https://api.pipedrive.com/v1/notes?api_token=${pipedriveApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: `**GitHub Profile**
- Username: ${githubUsername}
- Profile: ${profileUrl}
- Company: ${company || 'N/A'}
- Location: ${location || 'N/A'}
- Bio: ${bio || 'N/A'}
- Public Repos: ${publicRepos}
- Followers: ${followers}`,
            person_id: personId
          })
        }
      )
    }

    // Create the lead
    const leadTitle = `GitHub Fork: ${repositoryName || 'Repository'} - ${name || githubUsername}`

    const leadResponse = await fetch(
      `https://api.pipedrive.com/v1/leads?api_token=${pipedriveApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: leadTitle,
          person_id: personId,
          // Lead value could be customized
          value: {
            amount: 0,
            currency: 'USD'
          },
          expected_close_date: null,
          visible_to: 3, // Entire company
          was_seen: false
        })
      }
    )

    if (!leadResponse.ok) {
      const errorData = await leadResponse.json().catch(() => ({}))
      console.error('Pipedrive create lead error:', errorData)
      return NextResponse.json(
        { error: 'Failed to create lead in Pipedrive' },
        { status: 500 }
      )
    }

    const leadData = await leadResponse.json()

    // Add note to lead with fork details
    await fetch(
      `https://api.pipedrive.com/v1/notes?api_token=${pipedriveApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: `**Fork Details**
- Repository: ${repositoryName}
- Fork URL: ${forkUrl}
- Forked at: ${new Date().toISOString()}

**Lead Source**: GitHub Repository Fork
**Interest Level**: High (actively engaged with code)`,
          lead_id: leadData.data.id
        })
      }
    )

    const resultData = {
      personCreated: !contactExists,
      personId,
      leadId: leadData.data.id,
      leadTitle,
      pipedriveUrl: `https://app.pipedrive.com/leads/inbox/${leadData.data.id}`
    }

    // Store result in session
    if (sessionId) {
      await supabase
        .from('playbook_sessions')
        .update({
          state: supabase.rpc('jsonb_set_nested', {
            target: 'state',
            path: `{steps,${stepId || 'create_lead'}}`,
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
        createdAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Pipedrive lead creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
