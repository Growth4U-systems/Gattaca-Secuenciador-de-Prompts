# PRD: n8n to Gattaca Playbook Converter

## Overview

Build a converter that transforms any n8n workflow JSON into a native Gattaca playbook that runs independently without n8n. The converter generates playbook configuration, API routes, TypeScript types, and UI components - all living as native Gattaca code.

### Problem Statement

Users have existing n8n workflows they want to run in Gattaca, but currently there's no way to migrate them. Manual conversion is time-consuming and error-prone. We need an automated converter that:
- Parses n8n workflow JSON
- Maps n8n nodes to Gattaca step types
- Generates native TypeScript/React code
- Produces a fully functional, independent playbook

### Solution

Create a converter system with:
1. **Node Mapping Registry** - Maps n8n node types to Gattaca equivalents
2. **Code Generator** - Produces playbook config, API routes, types
3. **CLI Tool** - `npx gattaca convert-n8n workflow.json`
4. **UI Import** - Paste/upload n8n JSON in Gattaca UI
5. **Validation** - Reports unsupported nodes, suggests alternatives

## Goals

- Convert 80%+ of common n8n workflows without manual intervention
- Generated code follows Gattaca patterns and conventions
- Zero runtime dependency on n8n
- Generated playbooks are editable and maintainable
- Clear error messages for unsupported nodes

## Quality Gates

These commands must pass for every user story:
- `pnpm typecheck` - Type checking
- `pnpm lint` - Linting

## User Stories

### US-001: Create n8n Workflow Parser
**Description:** As a developer, I want to parse n8n workflow JSON into a typed structure so that I can analyze and transform it.

**Acceptance Criteria:**
- [ ] Create type definitions for n8n workflow structure in `src/lib/n8n-converter/types/n8n-workflow.types.ts`
- [ ] Types include: Workflow, Node, Connection, Credentials, Parameters
- [ ] Create parser function `parseN8nWorkflow(json: string): N8nWorkflow`
- [ ] Parser validates required fields and throws descriptive errors for invalid JSON
- [ ] Parser extracts: nodes array, connections object, workflow settings
- [ ] Add unit tests for parser with sample n8n workflow JSON

---

### US-002: Create Node Type Registry
**Description:** As a developer, I want a registry that maps n8n node types to Gattaca step generators so that I can extend support for new nodes.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/registry/node-registry.ts`
- [ ] Registry interface: `{ [n8nNodeType: string]: NodeConverter }`
- [ ] NodeConverter interface: `{ canConvert(node): boolean, convert(node): GattacaStep, generateCode(node): GeneratedCode }`
- [ ] Create `registerNode(type, converter)` function for adding converters
- [ ] Create `getConverter(nodeType)` function that returns converter or null
- [ ] Create `listSupportedNodes()` function for documentation
- [ ] Registry is extensible - new converters can be added without modifying core

---

### US-003: Implement HTTP Request Node Converter
**Description:** As a user, I want n8n HTTP Request nodes converted to Gattaca API calls so that my API integrations work.

**Acceptance Criteria:**
- [ ] Create converter in `src/lib/n8n-converter/converters/http-request.converter.ts`
- [ ] Maps HTTP method, URL, headers, body, authentication
- [ ] Generates API route in `/api/playbook/[playbookName]/steps/[stepId]/route.ts`
- [ ] Supports dynamic parameters from previous steps using `{{$node["name"].json["field"]}}`
- [ ] Converts n8n expression syntax to Gattaca state references
- [ ] Handles authentication types: None, Basic, Bearer, API Key, OAuth2
- [ ] Generated route includes error handling and response parsing

---

### US-004: Implement AI/LLM Node Converters
**Description:** As a user, I want n8n OpenAI/Anthropic nodes converted to Gattaca LLM calls so that my AI workflows work.

**Acceptance Criteria:**
- [ ] Create converters for: `@n8n/n8n-nodes-langchain.openAi`, `@n8n/n8n-nodes-langchain.anthropic`
- [ ] Map model selection, temperature, max tokens, system prompt, user prompt
- [ ] Generate step that calls `/api/llm/generate` with correct parameters
- [ ] Convert n8n prompt templates to Gattaca prompt format
- [ ] Handle chat vs completion modes
- [ ] Support structured output / JSON mode if configured
- [ ] Map n8n's message history handling to Gattaca state

---

### US-005: Implement Code/Function Node Converter
**Description:** As a user, I want n8n Code nodes converted to Gattaca executable code so that custom logic works.

**Acceptance Criteria:**
- [ ] Create converter for `n8n-nodes-base.code` and `n8n-nodes-base.function`
- [ ] Extract JavaScript code from node parameters
- [ ] Generate Supabase Edge Function or inline execution
- [ ] Map n8n's `$input`, `$json`, `$node` helpers to Gattaca equivalents
- [ ] Create utility functions that replicate n8n helpers: `getInputData()`, `getNodeParameter()`
- [ ] Handle async code and external imports
- [ ] Generated code includes TypeScript types for inputs/outputs

---

### US-006: Implement Control Flow Node Converters
**Description:** As a user, I want n8n IF/Switch/Loop nodes converted so that branching logic works.

**Acceptance Criteria:**
- [ ] Create converters for: `n8n-nodes-base.if`, `n8n-nodes-base.switch`, `n8n-nodes-base.splitInBatches`
- [ ] IF node: generates step with `condition` field that determines next step
- [ ] Switch node: generates step with multiple condition branches
- [ ] SplitInBatches: generates loop configuration in playbook
- [ ] Map n8n condition expressions to JavaScript boolean expressions
- [ ] Handle nested conditions
- [ ] Generate proper step connections based on true/false branches

---

### US-007: Implement Trigger Node Converters
**Description:** As a user, I want n8n trigger nodes converted to Gattaca playbook entry points.

**Acceptance Criteria:**
- [ ] Create converters for: `n8n-nodes-base.webhook`, `n8n-nodes-base.manualTrigger`, `n8n-nodes-base.scheduleTrigger`
- [ ] Webhook: generates initial step config with expected input schema
- [ ] Manual: generates standard playbook start (user-initiated)
- [ ] Schedule: generates cron configuration (or marks as "requires external scheduler")
- [ ] Extract input schema from trigger configuration
- [ ] Generate TypeScript interface for trigger payload

---

### US-008: Implement Data Transformation Node Converters
**Description:** As a user, I want n8n Set/Merge/Split nodes converted so that data manipulation works.

**Acceptance Criteria:**
- [ ] Create converters for: `n8n-nodes-base.set`, `n8n-nodes-base.merge`, `n8n-nodes-base.itemLists`
- [ ] Set node: generates state update logic
- [ ] Merge node: generates data combination logic (append, merge by key, etc.)
- [ ] ItemLists: generates array operations (split, aggregate, limit, etc.)
- [ ] All transformations work with Gattaca's step state model
- [ ] Generate helper functions for complex transformations

---

### US-009: Create Playbook Config Generator
**Description:** As a developer, I want to generate a complete playbook config from converted nodes so that the playbook is functional.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/generators/playbook-config.generator.ts`
- [ ] Input: array of converted GattacaSteps + workflow metadata
- [ ] Output: complete playbook config matching `src/components/playbook/configs/*.config.ts` pattern
- [ ] Generate phases based on n8n workflow structure (group sequential nodes)
- [ ] Generate step dependencies from n8n connections
- [ ] Include step guidance (description, user actions) derived from node names/notes
- [ ] Generate variables from n8n workflow variables/settings
- [ ] Output is valid TypeScript that can be imported

---

### US-010: Create API Routes Generator
**Description:** As a developer, I want to generate API routes for each step so that the playbook can execute.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/generators/api-routes.generator.ts`
- [ ] Generate route files in `/api/playbook/[playbookName]/[stepId]/route.ts`
- [ ] Each route handles the step's execution logic
- [ ] Routes follow existing Gattaca patterns (auth, error handling, response format)
- [ ] Generate shared utilities in `/api/playbook/[playbookName]/_utils/`
- [ ] Include proper TypeScript types for request/response
- [ ] Routes integrate with Gattaca's state management

---

### US-011: Create Connection/Flow Analyzer
**Description:** As a developer, I want to analyze n8n connections to determine step execution order and dependencies.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/analyzers/flow-analyzer.ts`
- [ ] Parse n8n connections object into directed graph
- [ ] Detect: linear flows, branches (IF/Switch), merges, loops
- [ ] Topological sort to determine execution order
- [ ] Identify parallel branches that could execute concurrently
- [ ] Detect cycles and report as errors (or convert to loops)
- [ ] Output: ordered list of steps with dependencies

---

### US-012: Create Expression Converter
**Description:** As a developer, I want to convert n8n expressions to Gattaca state references so that dynamic values work.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/expression.converter.ts`
- [ ] Parse n8n expression syntax: `{{ $json.field }}`, `{{ $node["name"].json.field }}`
- [ ] Convert to Gattaca state access: `state.steps.stepName.output.field`
- [ ] Handle n8n functions: `$now`, `$today`, `$if()`, `$isEmpty()`
- [ ] Create equivalent helper functions in generated code
- [ ] Support nested expressions and string interpolation
- [ ] Report unconvertible expressions with clear error messages

---

### US-013: Create CLI Converter Tool
**Description:** As a user, I want a CLI command to convert n8n workflows so that I can easily migrate.

**Acceptance Criteria:**
- [ ] Create CLI script `scripts/convert-n8n.ts`
- [ ] Usage: `npx tsx scripts/convert-n8n.ts ./workflow.json --output ./src/playbooks/my-playbook`
- [ ] Parses n8n JSON, runs conversion, generates all files
- [ ] Shows progress: "Converting node 1/15: HTTP Request..."
- [ ] Reports warnings for unsupported features
- [ ] Generates summary: files created, nodes converted, manual steps needed
- [ ] `--dry-run` flag to preview without writing files
- [ ] `--validate-only` flag to check if workflow is convertible

---

### US-014: Create UI Import Component
**Description:** As a user, I want to import n8n workflows through the Gattaca UI so that I don't need CLI.

**Acceptance Criteria:**
- [ ] Create `src/components/playbook/ImportN8nWorkflow.tsx`
- [ ] Two input modes: paste JSON or upload .json file
- [ ] Preview panel shows: workflow name, node count, detected issues
- [ ] "Analyze" button shows conversion report before committing
- [ ] "Convert" button triggers server-side conversion
- [ ] Progress indicator during conversion
- [ ] Success: redirects to new playbook editor
- [ ] Failure: shows detailed error with suggestions

---

### US-015: Create Conversion Report Generator
**Description:** As a user, I want a detailed report of the conversion so that I know what needs manual attention.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/reporters/conversion-report.ts`
- [ ] Report includes: converted nodes (green), partially converted (yellow), unsupported (red)
- [ ] For each unsupported node: reason + suggested manual implementation
- [ ] List of generated files with descriptions
- [ ] List of required environment variables / API keys
- [ ] List of manual steps needed post-conversion
- [ ] Export as JSON, Markdown, or display in UI

---

### US-016: Implement Credentials Mapping
**Description:** As a developer, I want to map n8n credentials to Gattaca's credential system so that authentication works.

**Acceptance Criteria:**
- [ ] Analyze n8n credential types used in workflow
- [ ] Map to Gattaca's existing auth patterns (API keys, OAuth, etc.)
- [ ] Generate placeholder environment variables for credentials
- [ ] Create setup documentation for each credential type
- [ ] Do NOT extract actual credential values (security)
- [ ] Generate `.env.example` entries for required credentials

---

### US-017: Create Integration Tests with Real n8n Workflows
**Description:** As a developer, I want integration tests with real n8n workflows so that I can verify the converter works.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/__tests__/` directory
- [ ] Add 5+ sample n8n workflow JSON files covering different patterns
- [ ] Test 1: Simple HTTP request chain
- [ ] Test 2: AI workflow (prompt → LLM → output)
- [ ] Test 3: Branching workflow (IF node)
- [ ] Test 4: Loop workflow (SplitInBatches)
- [ ] Test 5: Complex multi-node workflow
- [ ] Each test verifies: parsing, conversion, code generation, type validity
- [ ] Generated code compiles without TypeScript errors

---

### US-018: Create Unsupported Node Fallback System
**Description:** As a user, I want unsupported nodes handled gracefully so that partial conversion is still useful.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/fallback.converter.ts`
- [ ] Unsupported nodes generate a "manual step" placeholder
- [ ] Manual step includes: original node config as comment, TODO instructions
- [ ] Manual step has clear UI indication "Requires manual implementation"
- [ ] Conversion continues past unsupported nodes (doesn't fail entirely)
- [ ] Final report clearly lists all manual steps needed
- [ ] Option to skip unsupported nodes entirely with `--skip-unsupported` flag

## Functional Requirements

- FR-1: Converter must parse valid n8n workflow JSON exported from n8n UI
- FR-2: Generated playbook config must be valid TypeScript importable by Gattaca
- FR-3: Generated API routes must follow Gattaca's existing route patterns
- FR-4: Conversion must not require n8n to be installed or running
- FR-5: Generated code must pass `pnpm typecheck` without errors
- FR-6: Converter must handle workflows up to 50 nodes
- FR-7: Conversion must complete in under 30 seconds for typical workflows
- FR-8: All generated files must include header comment indicating auto-generation

## Non-Goals (Out of Scope)

- Real-time sync with n8n (one-time conversion only)
- Converting Gattaca playbooks back to n8n
- Supporting n8n community nodes (only official nodes)
- Executing n8n workflows directly (must convert first)
- Credential migration (only generates placeholders)
- Supporting n8n's sub-workflow feature
- Visual workflow editor in Gattaca

## Technical Considerations

### Architecture
```
src/lib/n8n-converter/
├── types/
│   ├── n8n-workflow.types.ts    # n8n JSON structure
│   └── gattaca-step.types.ts    # Output structure
├── registry/
│   └── node-registry.ts         # Node converter registry
├── converters/
│   ├── http-request.converter.ts
│   ├── openai.converter.ts
│   ├── code.converter.ts
│   ├── if.converter.ts
│   ├── expression.converter.ts
│   └── fallback.converter.ts
├── analyzers/
│   └── flow-analyzer.ts         # Connection/flow analysis
├── generators/
│   ├── playbook-config.generator.ts
│   ├── api-routes.generator.ts
│   └── types.generator.ts
├── reporters/
│   └── conversion-report.ts
└── index.ts                     # Main entry point
```

### n8n Node Type Priorities
1. **P0 (Must have):** HTTP Request, OpenAI, Code, IF, Set, Webhook
2. **P1 (Should have):** Anthropic, Switch, Merge, Function, Schedule
3. **P2 (Nice to have):** Google Sheets, Slack, Email, Database nodes

### Expression Syntax Mapping
| n8n | Gattaca |
|-----|---------|
| `{{ $json.field }}` | `state.currentStep.input.field` |
| `{{ $node["name"].json.field }}` | `state.steps.name.output.field` |
| `{{ $now }}` | `new Date().toISOString()` |
| `{{ $if(cond, a, b) }}` | `cond ? a : b` |

## Success Metrics

- 80% of test n8n workflows convert without manual intervention
- Generated playbooks pass typecheck on first run
- Conversion time < 10 seconds for workflows under 20 nodes
- Clear, actionable error messages for conversion failures
- Users can run converted playbook within 5 minutes of import

## Open Questions

1. Should we support n8n's "Execute Workflow" node (sub-workflows)?
2. How do we handle n8n's binary data (files, images)?
3. Should generated code use existing Gattaca utilities or be self-contained?
4. Do we need a "preview/simulate" mode before full conversion?

## Implementation Phases

**Phase 1 (Foundation):** US-001, US-002, US-011, US-012
- Parser, registry, flow analyzer, expression converter

**Phase 2 (Core Converters):** US-003, US-004, US-005, US-006, US-007, US-008
- All node type converters

**Phase 3 (Generators):** US-009, US-010, US-016
- Playbook config, API routes, credentials

**Phase 4 (UX):** US-013, US-014, US-015, US-018
- CLI, UI import, reporting, fallbacks

**Phase 5 (Quality):** US-017
- Integration tests with real workflows
