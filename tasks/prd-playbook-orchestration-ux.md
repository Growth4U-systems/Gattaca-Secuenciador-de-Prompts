# PRD: Playbook Orchestration UX Overhaul

## Overview

Redesign the playbook execution experience to be simple, guided, and persistent. Users should always know where they are, what's happening, and never lose their work. This establishes a reusable pattern for all playbooks in the system.

### Problem Statement

The current Niche Finder playbook (and playbook architecture in general) suffers from:
- **Disorientation**: Users don't know which step they're on or what's being executed
- **Data loss**: Navigating back/forth causes results to disappear without warning
- **No persistence**: Sessions aren't saved; users can't resume or access historical data
- **No guidance**: Users aren't told what to do at each step or what's happening
- **Valuable data wasted**: SERP results, scraped content not reusable across sessions

### Solution

Implement a "Guided Persistent Sessions" architecture that:
1. Saves all playbook data to persistent sessions in Supabase
2. Provides a simple step-by-step wizard UX with clear progress
3. Warns before any destructive action and allows saving intermediate outputs
4. Enables access to historical session data for reuse
5. Establishes patterns reusable across all playbooks

## Goals

- Users always know which step they're on and what percentage complete
- Zero data loss: all intermediate results persisted automatically
- Users can resume any session from where they left off
- Users can save any intermediate output to Context Lake with one click
- Historical session data is browsable and reusable
- Pattern is generic enough for any playbook (not just Niche Finder)

## Quality Gates

These commands must pass for every user story:
- `pnpm typecheck` - Type checking
- `pnpm lint` - Linting

For UI stories, also verify manually in browser that the component renders correctly and interactions work as expected.

## User Stories

### US-001: Create Playbook Session Management Schema
**Description:** As a developer, I want a database schema for playbook sessions so that all playbook data is persisted and queryable.

**Acceptance Criteria:**
- [ ] Create/update `playbook_sessions` table with fields: id, user_id, project_id, playbook_id, name, tags (array), status (draft|running|paused|completed|failed), current_step_id, created_at, updated_at, completed_at
- [ ] Create/update `playbook_session_steps` table with fields: id, session_id, step_id, step_order, status (pending|running|completed|failed|skipped), started_at, completed_at, input_data (jsonb), output_data (jsonb), error_message
- [ ] Create `playbook_session_artifacts` table with fields: id, session_id, step_id, artifact_type (serp_results|scraped_content|extracted_data|analysis_output), data (jsonb), metadata (jsonb), created_at
- [ ] Add RLS policies: users can only access their own sessions
- [ ] Add indexes on: user_id, project_id, playbook_id, status, created_at
- [ ] Create migration file in `supabase/migrations/`

---

### US-002: Build Session Initialization Flow
**Description:** As a user, I want to start a new playbook session with a name so that I can identify it later.

**Acceptance Criteria:**
- [ ] When user opens a playbook, show "Start New Session" dialog
- [ ] Dialog has: auto-generated name field (format: "Niche Finder - Jan 25, 2026"), editable by user
- [ ] Optional tags input (comma-separated or pill-style)
- [ ] "Start Session" button creates session record and navigates to Step 1
- [ ] Session ID stored in URL query param for bookmarkability: `/playbook/niche-finder?session=abc123`
- [ ] If URL has session param, load that session instead of showing dialog

---

### US-003: Build Session Resume and History Panel
**Description:** As a user, I want to see my previous sessions and resume any of them so that I never lose my work.

**Acceptance Criteria:**
- [ ] "Start New Session" dialog includes "Or resume a previous session" section
- [ ] Shows list of recent sessions (last 10) with: name, date, status badge, current step
- [ ] Each session row has "Resume" button that loads that session
- [ ] "View All Sessions" link opens full session history panel
- [ ] Session history panel has: search by name, filter by status, filter by date range
- [ ] Sessions sorted by updated_at descending (most recent first)

---

### US-004: Create Step-by-Step Wizard Navigation Component
**Description:** As a user, I want a clear wizard-style navigation so that I always know which step I'm on and how far I have to go.

**Acceptance Criteria:**
- [ ] Create `PlaybookWizardNav` component showing all steps as horizontal stepper
- [ ] Current step highlighted with distinct color and "Current" indicator
- [ ] Completed steps show checkmark, clickable to review (read-only)
- [ ] Future steps shown but disabled/grayed out
- [ ] Step labels are short and descriptive (e.g., "1. Configure", "2. Search", "3. Extract")
- [ ] Mobile responsive: collapses to "Step 2 of 5" with dropdown on small screens
- [ ] Progress bar below stepper showing overall percentage

---

### US-005: Create Step Container Component with Guidance
**Description:** As a user, I want each step to clearly tell me what's happening and what I need to do so that I'm never confused.

**Acceptance Criteria:**
- [ ] Create `PlaybookStepContainer` component wrapping each step's content
- [ ] Header section shows: Step number/title, brief description of what this step does
- [ ] "What you need to do" section with bullet points (from step config)
- [ ] Main content area for step-specific UI
- [ ] Footer with: "Back" button (with warning if data exists), "Next"/"Continue" button
- [ ] "Next" button disabled until step completion criteria met
- [ ] Step config schema extended with: `guidance.description`, `guidance.userActions[]`, `guidance.completionCriteria`

---

### US-006: Implement Step Data Auto-Persistence
**Description:** As a user, I want my step data saved automatically so that I never lose progress even if I close the browser.

**Acceptance Criteria:**
- [ ] When step starts, create/update `playbook_session_steps` record with status "running"
- [ ] Auto-save step output_data to database every 30 seconds during execution
- [ ] Auto-save immediately when significant data changes (e.g., batch of URLs scraped)
- [ ] When step completes, update status to "completed" and save final output_data
- [ ] On session resume, load step data from database and restore UI state
- [ ] Show subtle "Saved" indicator when auto-save occurs (toast or icon)

---

### US-007: Implement Navigation Warning System
**Description:** As a user, I want to be warned before any action that could lose my data so that I can save first.

**Acceptance Criteria:**
- [ ] When user clicks "Back" on a step with unsaved/in-progress data, show confirmation dialog
- [ ] Dialog explains what will happen: "Going back will reset Step 3. Your current progress (45 URLs scraped) will be saved to the session but this step will need to be re-run."
- [ ] Dialog has options: "Go Back Anyway", "Save to Context Lake First", "Cancel"
- [ ] Browser beforeunload handler warns if session has unsaved changes
- [ ] "Save to Context Lake First" opens the save dialog then proceeds with navigation

---

### US-008: Create Universal "Save to Context Lake" Button
**Description:** As a user, I want to save any step's output to Context Lake with one click so that I can preserve valuable intermediate results.

**Acceptance Criteria:**
- [ ] Add "Save to Context Lake" button in `PlaybookStepContainer` footer (visible when step has output)
- [ ] Button opens dialog showing: what will be saved, suggested document name, folder, tags
- [ ] User can edit name, folder, tags before saving
- [ ] Save includes metadata: session_id, step_id, playbook_id, created_at
- [ ] After save, button shows "Saved ✓" state with link to view document
- [ ] Multiple saves from same step create separate documents (not overwrite)

---

### US-009: Build Live Execution Progress Component
**Description:** As a user, I want to see live progress during step execution so that I know what's happening.

**Acceptance Criteria:**
- [ ] Create `StepExecutionProgress` component for long-running steps
- [ ] Shows: current action text, progress bar (if countable), elapsed time
- [ ] Action text updates in real-time: "Searching Google... 12/50 queries"
- [ ] For scraping: shows last URL processed and snippet preview
- [ ] For extraction: shows count of niches found so far
- [ ] Expandable "Details" section showing recent log entries
- [ ] "Pause" button to pause execution (where technically feasible)
- [ ] If step fails, shows error message with "Retry" button

---

### US-010: Implement Step Retry Functionality
**Description:** As a user, I want to retry a failed step without losing previous steps' data so that I can recover from errors.

**Acceptance Criteria:**
- [ ] Failed steps show clear error state with error message
- [ ] "Retry" button available on failed steps
- [ ] Retry preserves: session context, previous steps' outputs, step configuration
- [ ] User can optionally modify step config before retry (e.g., change model, adjust settings)
- [ ] Retry creates new attempt record linked to same step (for audit trail)
- [ ] After 3 failed attempts, suggest "Contact support" or "Skip this step"

---

### US-011: Create Artifact Browser for Session Data
**Description:** As a user, I want to browse all data generated in my session so that I can access any intermediate result.

**Acceptance Criteria:**
- [ ] Add "Session Data" tab/panel accessible from any step
- [ ] Shows all artifacts grouped by step: SERP Results (150 URLs), Scraped Content (120 pages), etc.
- [ ] Each artifact group expandable to show individual items
- [ ] Search/filter within artifacts
- [ ] "View" button opens artifact in modal (table view for structured data, markdown for content)
- [ ] "Save to Context Lake" button on any artifact
- [ ] "Export as CSV/JSON" option for structured data

---

### US-012: Implement Historical Data Reuse
**Description:** As a user, I want to reuse data from previous sessions so that I don't repeat expensive operations.

**Acceptance Criteria:**
- [ ] At relevant steps (e.g., SERP search), show "Use previous data" option
- [ ] Opens panel showing compatible artifacts from other sessions
- [ ] Filter by: session name, date range, tags
- [ ] Preview artifact before selecting
- [ ] "Use This Data" imports artifact into current session's step
- [ ] Imported data marked with source session reference (traceability)
- [ ] Skip execution for steps where historical data is imported

---

### US-013: Refactor Niche Finder to Use New Playbook Architecture
**Description:** As a developer, I want to migrate the Niche Finder playbook to use the new session-based architecture so that it benefits from all improvements.

**Acceptance Criteria:**
- [ ] Update `niche-finder.config.ts` to include new guidance fields for each step
- [ ] Replace current state management with session-based persistence
- [ ] Integrate `PlaybookWizardNav` and `PlaybookStepContainer` components
- [ ] Update all API routes to read/write from session artifacts
- [ ] Migrate `UnifiedSearchExtractPanel` to use `StepExecutionProgress`
- [ ] Add "Save to Context Lake" integration at each step
- [ ] Test full flow: new session → all steps → completion → resume
- [ ] Verify historical data from old `niche_finder_jobs` is still accessible

---

### US-014: Create Playbook Session API Routes
**Description:** As a developer, I want API routes for session management so that the frontend can create, read, update sessions.

**Acceptance Criteria:**
- [ ] `POST /api/playbook/sessions` - Create new session (body: playbook_id, project_id, name, tags)
- [ ] `GET /api/playbook/sessions` - List sessions (query: playbook_id, status, limit, offset)
- [ ] `GET /api/playbook/sessions/[id]` - Get session with all steps and artifacts
- [ ] `PATCH /api/playbook/sessions/[id]` - Update session (name, tags, status, current_step)
- [ ] `POST /api/playbook/sessions/[id]/steps/[stepId]/artifacts` - Save step artifact
- [ ] `GET /api/playbook/sessions/[id]/artifacts` - Get all session artifacts
- [ ] All routes require authentication and enforce RLS

---

### US-015: Create Reusable Playbook Shell Component
**Description:** As a developer, I want a reusable PlaybookShell component so that new playbooks automatically get session management and wizard UX.

**Acceptance Criteria:**
- [ ] Create `PlaybookShellV2` component that wraps any playbook
- [ ] Props: playbook config, project_id
- [ ] Handles: session initialization, step navigation, auto-save, progress tracking
- [ ] Renders: `PlaybookWizardNav`, `PlaybookStepContainer` for current step, session data panel
- [ ] Provides context to child components: session data, step state, save functions
- [ ] Document usage pattern for creating new playbooks
- [ ] Add example playbook skeleton in documentation

## Functional Requirements

- FR-1: Every playbook execution must create a session record before any step runs
- FR-2: All step outputs must be persisted to `playbook_session_artifacts` within 30 seconds of generation
- FR-3: Session state must be fully recoverable from database (no localStorage dependencies for critical data)
- FR-4: Navigation between steps must preserve all previously completed step data
- FR-5: Users must be warned before any action that resets or loses step data
- FR-6: The wizard navigation must accurately reflect completion status of all steps
- FR-7: Failed steps must be retryable without affecting other steps
- FR-8: Any artifact can be saved to Context Lake with full traceability metadata
- FR-9: Historical artifacts must be queryable by session, step, date, and tags
- FR-10: The architecture must support any playbook, not just Niche Finder

## Non-Goals (Out of Scope)

- Real-time collaboration (multiple users on same session)
- Branching sessions (create variant from existing session)
- Automated session cleanup/archival
- Session templates (pre-configured sessions)
- Playbook versioning (handling config changes between sessions)
- Offline support
- Mobile-native experience (responsive web only)

## Technical Considerations

### Database
- Use existing Supabase instance
- Leverage JSONB for flexible artifact storage
- Consider partitioning `playbook_session_artifacts` if volume grows large
- Add database indexes for common query patterns

### State Management
- Session state lives in database, not React state
- Use React Query or SWR for data fetching with optimistic updates
- Local state only for UI interactions (form inputs, modals)

### Backward Compatibility
- Existing `niche_finder_jobs` data should remain accessible
- Migration path: old jobs viewable but not resumable in new system
- New sessions create new records; don't modify old tables

### Performance
- Lazy load artifacts (don't fetch all data upfront)
- Paginate large artifact lists
- Use streaming for live progress updates where possible

### Reusability
- Step types should be pluggable (new step types can be added)
- Guidance content should come from config, not hardcoded
- Context Lake integration should be a generic utility

## Success Metrics

- Users can identify their current step within 2 seconds of viewing the playbook
- Zero data loss incidents reported (navigation, browser close, errors)
- 90% of started sessions reach completion (vs. current baseline)
- Average time to complete Niche Finder playbook reduced by 20% (less confusion)
- 50%+ of users save at least one intermediate artifact to Context Lake
- New playbooks can be created using the pattern in < 1 day of development

## Open Questions

1. Should we migrate existing `niche_finder_jobs` data to new session format, or keep them separate?
2. How long should session data be retained? (30 days? Forever? User choice?)
3. Should there be a limit on sessions per user/project?
4. Do we need session sharing (view-only link for stakeholders)?

## Implementation Phases

**Phase 1 (Foundation):** US-001, US-002, US-014, US-006
- Database schema, session creation, API routes, auto-persistence

**Phase 2 (UX Core):** US-004, US-005, US-007, US-009
- Wizard navigation, step container, warnings, progress display

**Phase 3 (Data Access):** US-008, US-011, US-012
- Context Lake integration, artifact browser, historical reuse

**Phase 4 (Migration):** US-013, US-015, US-010
- Niche Finder migration, reusable shell, retry functionality
