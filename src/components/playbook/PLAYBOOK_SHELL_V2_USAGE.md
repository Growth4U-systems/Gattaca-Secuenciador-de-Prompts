# PlaybookShellV2 Usage Guide

`PlaybookShellV2` is a reusable wrapper component that provides session management, wizard navigation, auto-save, and progress tracking for any playbook implementation.

## Features

- **Session Management**: Automatic session initialization and persistence
- **Step Navigation**: Horizontal wizard or vertical panel navigation styles
- **Auto-Save**: Automatic saving of step data to the database
- **Progress Tracking**: Visual progress indicators and completion tracking
- **Context Provider**: React Context for child component access to session data
- **Session Data Panel**: Collapsible panel showing session info and step outputs

## Quick Start

### 1. Create a Playbook Configuration

Define your playbook phases and steps in a configuration file:

```typescript
// src/components/playbook/configs/my-playbook.config.ts
import { PlaybookConfig } from '../types'

export const myPlaybookConfig: PlaybookConfig = {
  id: 'my_playbook',
  type: 'my_playbook',
  name: 'My Playbook',
  description: 'Description of what this playbook does',
  phases: [
    {
      id: 'phase_1',
      name: 'Configuration',
      steps: [
        {
          id: 'step_1_config',
          name: 'Configure Settings',
          type: 'input',
          executor: 'none',
          guidance: {
            description: 'Set up your initial configuration',
            userActions: [
              'Enter your preferences',
              'Review the settings',
            ],
            completionCriteria: {
              description: 'All required fields must be filled',
              type: 'input_required',
              minCount: 1,
            },
          },
        },
      ],
    },
    {
      id: 'phase_2',
      name: 'Execution',
      steps: [
        {
          id: 'step_2_execute',
          name: 'Run Analysis',
          type: 'auto_with_preview',
          executor: 'api',
          apiEndpoint: '/api/my-playbook/analyze',
          dependsOn: ['step_1_config'],
          guidance: {
            description: 'The system will analyze your data',
            userActions: [
              'Review the preview',
              'Click Execute to proceed',
            ],
            completionCriteria: {
              description: 'Analysis must complete successfully',
              type: 'auto_complete',
            },
          },
        },
      ],
    },
    {
      id: 'phase_3',
      name: 'Results',
      steps: [
        {
          id: 'step_3_results',
          name: 'View Results',
          type: 'display',
          executor: 'none',
          dependsOn: ['step_2_execute'],
          guidance: {
            description: 'Review the analysis results',
            userActions: [
              'Examine the findings',
              'Export if needed',
            ],
            completionCriteria: {
              description: 'Review completed',
              type: 'manual',
            },
          },
        },
      ],
    },
  ],
  variables: [
    {
      key: 'analysis_depth',
      label: 'Analysis Depth',
      type: 'select',
      options: [
        { value: 'basic', label: 'Basic' },
        { value: 'detailed', label: 'Detailed' },
      ],
      defaultValue: 'basic',
    },
  ],
}
```

### 2. Register the Configuration

Add your config to the playbook registry:

```typescript
// src/components/playbook/configs/index.ts
import { myPlaybookConfig } from './my-playbook.config'

export const playbookConfigs: Record<string, PlaybookConfig> = {
  // ... existing configs
  my_playbook: myPlaybookConfig,
}
```

### 3. Create the Playbook Component

Create a wrapper component that uses `PlaybookShellV2`:

```typescript
// src/components/my-playbook/MyPlaybook.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PlaybookShellV2, StartSessionDialog, AllSessionsPanel } from '../playbook'
import { myPlaybookConfig } from '../playbook/configs/my-playbook.config'

interface MyPlaybookProps {
  projectId: string
}

export default function MyPlaybook({ projectId }: MyPlaybookProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionParam = searchParams.get('session')

  const [sessionId, setSessionId] = useState<string | null>(sessionParam)
  const [showDialog, setShowDialog] = useState(!sessionParam)
  const [showAllSessions, setShowAllSessions] = useState(false)

  const handleSessionStart = (newSessionId: string) => {
    setSessionId(newSessionId)
    setShowDialog(false)

    // Update URL for bookmarkability
    const url = new URL(window.location.href)
    url.searchParams.set('session', newSessionId)
    router.replace(url.pathname + url.search)
  }

  if (showAllSessions) {
    return (
      <AllSessionsPanel
        projectId={projectId}
        playbookType="my_playbook"
        onSessionSelect={handleSessionStart}
        onClose={() => setShowAllSessions(false)}
        onStartNew={() => {
          setShowAllSessions(false)
          setShowDialog(true)
        }}
      />
    )
  }

  if (showDialog) {
    return (
      <StartSessionDialog
        projectId={projectId}
        playbookType="my_playbook"
        onSessionStart={handleSessionStart}
        onCancel={() => setShowDialog(false)}
        onViewAllSessions={() => setShowAllSessions(true)}
      />
    )
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500 mb-4">Session required to continue</p>
        <button
          onClick={() => setShowDialog(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Start Session
        </button>
      </div>
    )
  }

  return (
    <PlaybookShellV2
      projectId={projectId}
      playbookConfig={myPlaybookConfig}
      sessionId={sessionId}
      navigationStyle="wizard"
      showSessionPanel={true}
      onStepComplete={(stepId, output) => {
        console.log(`Step ${stepId} completed with output:`, output)
      }}
      onPlaybookComplete={() => {
        console.log('Playbook completed!')
      }}
    />
  )
}
```

### 4. Create the Page Route

```typescript
// src/app/playbooks/my-playbook/page.tsx
import MyPlaybook from '@/components/my-playbook/MyPlaybook'

export default function MyPlaybookPage({
  searchParams,
}: {
  searchParams: { project?: string }
}) {
  const projectId = searchParams.project

  if (!projectId) {
    return <div>Project ID required</div>
  }

  return <MyPlaybook projectId={projectId} />
}
```

## Using Context in Child Components

Child components can access playbook data and actions via hooks:

```typescript
import { usePlaybook, useCurrentStep, useSaveState } from '../playbook'

function MyStepContent() {
  const { data, actions } = usePlaybook()
  const { step, stepState, isFirst, isLast } = useCurrentStep()
  const saveState = useSaveState()

  const handleComplete = async () => {
    // Mark step as complete with output
    actions.markStepComplete(step.id, { result: 'success' })
    // Navigate to next step
    actions.goToNextStep()
  }

  return (
    <div>
      <h2>{step.name}</h2>
      <p>Progress: {data.progressPercentage}%</p>

      {saveState.isSaving && <span>Saving...</span>}

      <button onClick={handleComplete}>
        {isLast ? 'Finish' : 'Continue'}
      </button>
    </div>
  )
}
```

## Available Hooks

| Hook | Description |
|------|-------------|
| `usePlaybook()` | Full context with data and actions |
| `usePlaybookData()` | Read-only access to playbook data |
| `usePlaybookActions()` | Access to playbook actions only |
| `useCurrentStep()` | Current step info (step, state, position) |
| `useStepProgress()` | Progress info (completed, total, percentage) |
| `useSaveState()` | Auto-save state (isSaving, lastSaved, error) |

## Custom Step Renderer

For custom step UI, use the `renderStep` prop:

```typescript
<PlaybookShellV2
  projectId={projectId}
  playbookConfig={config}
  sessionId={sessionId}
  renderStep={({ step, stepState, onContinue, onUpdateState }) => {
    switch (step.type) {
      case 'custom_type':
        return (
          <MyCustomStepUI
            step={step}
            state={stepState}
            onComplete={(output) => {
              onUpdateState({ status: 'completed', output })
              onContinue()
            }}
          />
        )
      default:
        // Fall back to default rendering
        return null
    }
  }}
/>
```

## Props Reference

### PlaybookShellV2Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | required | Project ID for the session |
| `playbookConfig` | `PlaybookConfig` | required | Playbook configuration |
| `initialState` | `Partial<PlaybookState>` | - | Initial state for resuming |
| `sessionId` | `string` | - | Session ID (enables persistence) |
| `navigationStyle` | `'wizard' \| 'panel'` | `'wizard'` | Navigation style |
| `showSessionPanel` | `boolean` | `true` | Show session data panel |
| `renderStep` | `(props: StepRenderProps) => ReactNode` | - | Custom step renderer |
| `onStepComplete` | `(stepId, output) => void` | - | Step completion callback |
| `onPlaybookComplete` | `() => void` | - | Playbook completion callback |
| `onStepStateChange` | `(stepId, state) => void` | - | Step state change callback |

## Step Types

| Type | Description |
|------|-------------|
| `input` | User must enter data |
| `suggestion` | System suggests, user selects |
| `auto` | Executes without stopping |
| `auto_with_preview` | Shows preview before continuing |
| `auto_with_review` | Executes and shows result for review |
| `decision` | User must make a decision |
| `display` | Only shows information |
| `action` | User performs an action |
| `manual_research` | User performs research externally |
| `manual_review` | User must approve before continuing |

## Database Schema

The playbook system uses these tables:

- `playbook_sessions` - Session records
- `playbook_session_steps` - Step data per session
- `playbook_step_attempts` - Retry attempt tracking

Ensure these tables exist and the API routes are configured:

- `POST /api/playbook/sessions` - Create session
- `GET /api/playbook/sessions/[id]` - Get session
- `POST /api/playbook/sessions/[id]/steps` - Save step data
- `GET /api/playbook/sessions/[id]/steps` - Load step data
