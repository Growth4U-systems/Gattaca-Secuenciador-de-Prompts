import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface HistoricalArtifactQuery {
  project_id: string
  playbook_type?: string
  step_id?: string
  compatible_types?: string[]
  session_name?: string
  date_from?: string
  date_to?: string
  tags?: string[]
  exclude_session_id?: string
  limit?: number
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const searchParams = request.nextUrl.searchParams
  const projectId = searchParams.get('project_id')
  const playbookType = searchParams.get('playbook_type')
  const stepId = searchParams.get('step_id')
  const compatibleTypes = searchParams.get('compatible_types')?.split(',').filter(Boolean)
  const sessionName = searchParams.get('session_name')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const tags = searchParams.get('tags')?.split(',').filter(Boolean)
  const excludeSessionId = searchParams.get('exclude_session_id')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 50

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  try {
    // First, get sessions for the project with optional filtering
    let sessionsQuery = supabase
      .from('playbook_sessions')
      .select('id, name, playbook_type, status, tags, variables, created_at, updated_at, completed_at')
      .eq('project_id', projectId)
      .in('status', ['completed', 'active', 'paused'])
      .order('updated_at', { ascending: false })

    if (playbookType) {
      sessionsQuery = sessionsQuery.eq('playbook_type', playbookType)
    }

    if (excludeSessionId) {
      sessionsQuery = sessionsQuery.neq('id', excludeSessionId)
    }

    if (sessionName) {
      sessionsQuery = sessionsQuery.ilike('name', `%${sessionName}%`)
    }

    if (dateFrom) {
      sessionsQuery = sessionsQuery.gte('created_at', dateFrom)
    }

    if (dateTo) {
      const endDate = new Date(dateTo)
      endDate.setDate(endDate.getDate() + 1)
      sessionsQuery = sessionsQuery.lt('created_at', endDate.toISOString())
    }

    if (tags && tags.length > 0) {
      sessionsQuery = sessionsQuery.overlaps('tags', tags)
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery.limit(20)

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ artifacts: [], sessions: [] })
    }

    const sessionIds = sessions.map(s => s.id)

    // Get step outputs from these sessions
    let outputsQuery = supabase
      .from('playbook_step_outputs')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('executed_at', { ascending: false })

    if (playbookType) {
      outputsQuery = outputsQuery.eq('playbook_type', playbookType)
    }

    if (stepId) {
      outputsQuery = outputsQuery.eq('step_id', stepId)
    }

    const { data: outputs, error: outputsError } = await outputsQuery.limit(limit)

    if (outputsError) {
      console.error('Error fetching outputs:', outputsError)
      return NextResponse.json({ error: 'Failed to fetch outputs' }, { status: 500 })
    }

    // Also get session step data
    const { data: sessionSteps, error: stepsError } = await supabase
      .from('playbook_session_steps')
      .select('*')
      .in('session_id', sessionIds)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (stepsError) {
      console.error('Error fetching session steps:', stepsError)
    }

    // Build artifacts from outputs and session steps
    const artifacts = buildHistoricalArtifacts(
      outputs || [],
      sessionSteps || [],
      sessions,
      compatibleTypes
    )

    // Get unique sessions that have artifacts
    const sessionsWithArtifacts = sessions.filter(s =>
      artifacts.some(a => a.sessionId === s.id)
    )

    // Get unique tags from all sessions
    const allTags = new Set<string>()
    sessions.forEach(s => {
      if (s.tags && Array.isArray(s.tags)) {
        s.tags.forEach(tag => allTags.add(tag))
      }
    })

    // Get unique step IDs
    const allStepIds = new Set<string>()
    artifacts.forEach(a => allStepIds.add(a.stepId))

    return NextResponse.json({
      artifacts: artifacts.slice(0, limit),
      sessions: sessionsWithArtifacts.map(s => ({
        id: s.id,
        name: s.name,
        playbookType: s.playbook_type,
        status: s.status,
        tags: s.tags,
        variables: s.variables,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        completedAt: s.completed_at,
      })),
      filters: {
        availableTags: Array.from(allTags),
        availableStepIds: Array.from(allStepIds),
      },
    })
  } catch (error) {
    console.error('Error in historical-artifacts endpoint:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

interface SessionRow {
  id: string
  name: string | null
  playbook_type: string
  status: string
  tags: string[] | null
  variables: Record<string, unknown>
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface OutputRow {
  id?: string
  project_id: string
  playbook_type: string
  step_id: string
  output_content: string | null
  imported_data: unknown
  variables_used: Record<string, unknown> | null
  status: string
  executed_at: string | null
  created_at: string
}

interface SessionStepRow {
  id: string
  session_id: string
  step_id: string
  status: string
  input_data: unknown
  output_data: unknown
  started_at: string | null
  completed_at: string | null
}

interface HistoricalArtifact {
  id: string
  sessionId: string
  sessionName: string | null
  sessionCreatedAt: string
  stepId: string
  stepName: string
  type: string
  name: string
  content: unknown
  contentType: string
  createdAt: string
  itemCount?: number
  wordCount?: number
  playbookType: string
  variables?: Record<string, unknown>
  tags?: string[] | null
}

function buildHistoricalArtifacts(
  outputs: OutputRow[],
  sessionSteps: SessionStepRow[],
  sessions: SessionRow[],
  compatibleTypes?: string[]
): HistoricalArtifact[] {
  const artifacts: HistoricalArtifact[] = []
  const sessionsMap = new Map(sessions.map(s => [s.id, s]))

  // Process playbook_step_outputs
  outputs.forEach((output, index) => {
    const content = output.imported_data || output.output_content
    if (!content) return

    const artifact = createArtifactFromContent(
      `output-${output.step_id}-${index}`,
      output.step_id,
      content,
      output.executed_at || output.created_at
    )

    if (!artifact) return

    // Filter by compatible types if specified
    if (compatibleTypes && compatibleTypes.length > 0) {
      if (!compatibleTypes.includes(artifact.type)) return
    }

    // Find the session for this output (based on playbook_type and variables)
    // Since outputs don't have session_id, we match by playbook_type
    const matchingSession = sessions.find(s => s.playbook_type === output.playbook_type)

    artifacts.push({
      ...artifact,
      sessionId: matchingSession?.id || '',
      sessionName: matchingSession?.name || null,
      sessionCreatedAt: matchingSession?.created_at || output.created_at,
      playbookType: output.playbook_type,
      variables: output.variables_used || matchingSession?.variables,
      tags: matchingSession?.tags,
    })
  })

  // Process session steps
  sessionSteps.forEach((step, index) => {
    const content = step.output_data
    if (!content) return

    const session = sessionsMap.get(step.session_id)
    if (!session) return

    const artifact = createArtifactFromContent(
      `step-${step.session_id}-${step.step_id}-${index}`,
      step.step_id,
      content,
      step.completed_at || step.started_at || new Date().toISOString()
    )

    if (!artifact) return

    // Filter by compatible types if specified
    if (compatibleTypes && compatibleTypes.length > 0) {
      if (!compatibleTypes.includes(artifact.type)) return
    }

    // Check if we already have this artifact from outputs
    const exists = artifacts.some(a =>
      a.stepId === step.step_id && a.sessionId === step.session_id
    )
    if (exists) return

    artifacts.push({
      ...artifact,
      sessionId: step.session_id,
      sessionName: session.name,
      sessionCreatedAt: session.created_at,
      playbookType: session.playbook_type,
      variables: session.variables,
      tags: session.tags,
    })
  })

  return artifacts
}

function createArtifactFromContent(
  id: string,
  stepId: string,
  content: unknown,
  createdAt: string
): Omit<HistoricalArtifact, 'sessionId' | 'sessionName' | 'sessionCreatedAt' | 'playbookType' | 'variables' | 'tags'> | null {
  if (!content) return null

  const stepName = getStepDisplayName(stepId)
  let type = 'step_output'
  let contentType = 'text'
  let itemCount: number | undefined
  let wordCount: number | undefined
  let name = `${stepName} Output`

  if (typeof content === 'string') {
    contentType = content.includes('#') || content.includes('**') ? 'markdown' : 'text'
    wordCount = content.split(/\s+/).length
  } else if (Array.isArray(content)) {
    contentType = 'list'
    itemCount = content.length

    if (content.length > 0) {
      const first = content[0]
      if (typeof first === 'object' && first !== null) {
        if ('url' in first) {
          type = 'serp_results'
          name = `${stepName} - URLs`
        } else if ('content' in first || 'text' in first) {
          type = 'scraped_content'
          name = `${stepName} - Content`
        } else if ('niche' in first || 'problem' in first || 'pain_point' in first) {
          type = 'extracted_data'
          name = `${stepName} - Extracted`
        }
        contentType = 'table'
      }
    }
  } else if (typeof content === 'object' && content !== null) {
    contentType = 'json'
    const obj = content as Record<string, unknown>

    if ('analysis' in obj || 'summary' in obj) {
      type = 'analysis'
      name = `${stepName} - Analysis`
    } else if ('suggestions' in obj || 'recommendations' in obj) {
      type = 'suggestions'
      name = `${stepName} - Suggestions`
    } else if ('generated' in obj || 'content' in obj) {
      type = 'generated_content'
      name = `${stepName} - Generated`
    }
  }

  return {
    id,
    stepId,
    stepName,
    type,
    name,
    content,
    contentType,
    createdAt,
    itemCount,
    wordCount,
  }
}

function getStepDisplayName(stepId: string): string {
  const STEP_NAMES: Record<string, string> = {
    'serp_search': 'SERP Search',
    'find_creators': 'Find Creators',
    'scrape': 'Scrape Pages',
    'scrape_posts': 'Scrape Posts',
    'scrape_engagers': 'Scrape Engagers',
    'extract_problems': 'Extract Problems',
    'evaluate_creators': 'Evaluate Creators',
    'evaluate_posts': 'Evaluate Posts',
    'filter_icp': 'Filter ICP',
    'clean_filter': 'Clean & Filter',
    'deep_research_manual': 'Deep Research',
    'consolidate': 'Consolidate',
    'map_topics': 'Map Topics',
    'lead_magnet_messages': 'Lead Magnet Messages',
    'generate_idea': 'Generate Idea',
    'generate_scenes': 'Generate Scenes',
    'life_contexts': 'Life Contexts',
    'need_words': 'Need Words',
    'sources': 'Sources',
    'indicators': 'Indicators',
    'review_urls': 'Review URLs',
    'review_extraction': 'Review Extraction',
    'select_niches': 'Select Niches',
  }

  return STEP_NAMES[stepId] || stepId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
