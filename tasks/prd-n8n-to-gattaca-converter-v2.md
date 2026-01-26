# PRD: n8n to Gattaca Playbook Converter (v2)

## Overview

Build a converter that transforms n8n workflow JSON into native Gattaca playbooks. Based on deep analysis of both systems, this PRD addresses the fundamental architectural differences between n8n's node-based DAG execution model and Gattaca's phase-based sequential playbook model.

### Problem Statement

Users have n8n workflows they want to migrate to Gattaca. However, the two systems have fundamentally different architectures:

| n8n | Gattaca |
|-----|---------|
| Directed Acyclic Graph (DAG) | Sequential phases with steps |
| Nodes connected by wires | Steps with dependencies |
| Data flows through connections | State object passed between steps |
| Parallel fan-out execution | Sequential step execution |
| 400+ node types | ~10 step types |
| Expression syntax `={{ $json.field }}` | State access `state.steps.name.output` |

The converter must bridge these differences intelligently, not naively.

### Key Insight: Transformation, Not Translation

We cannot 1:1 translate n8n nodes to Gattaca steps. Instead, we must:
1. **Analyze** the workflow graph topology
2. **Identify patterns** (linear chains, branches, loops, fan-out)
3. **Transform** patterns into Gattaca-compatible structures
4. **Generate** native code that achieves the same outcome

## Goals

- Convert common n8n workflow patterns to working Gattaca playbooks
- Generate idiomatic Gattaca code (not n8n-in-disguise)
- Clear reporting of what was converted, what needs manual work
- Extensible architecture for adding more node support over time

## Quality Gates

These commands must pass for every user story:
- `pnpm typecheck` - Type checking
- `pnpm lint` - Linting

## User Stories

### Phase 1: Foundation - Understanding n8n

---

### US-001: Define n8n Workflow Type System
**Description:** As a developer, I want complete TypeScript types for n8n workflow JSON so that I can safely parse and analyze workflows.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/types/n8n.types.ts`
- [ ] Define `N8nWorkflow` interface with: id, name, nodes, connections, settings, active
- [ ] Define `N8nNode` interface with: id, name, type, position, parameters, typeVersion, credentials, disabled
- [ ] Define `N8nConnections` type: `Record<string, { main?: N8nConnection[][], ai_languageModel?: N8nConnection[][] }>`
- [ ] Define `N8nConnection` interface: { node: string, type: string, index: number }
- [ ] Define `N8nNodeParameters` as generic Record with common patterns documented
- [ ] Add JSDoc comments explaining each field's purpose
- [ ] Export all types from index file

---

### US-002: Build Workflow Parser with Validation
**Description:** As a developer, I want to parse and validate n8n JSON so that I catch invalid inputs early.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/parser/workflow-parser.ts`
- [ ] Function `parseN8nWorkflow(json: string): ParseResult<N8nWorkflow>`
- [ ] Validate required fields: nodes array exists, connections object exists
- [ ] Validate each node has: id, name, type, position
- [ ] Return structured errors with line numbers where possible
- [ ] Handle both minified and pretty-printed JSON
- [ ] Strip `stickyNote` nodes (documentation only, not executable)
- [ ] Create `ParseResult<T>` type: `{ success: true, data: T } | { success: false, errors: ParseError[] }`

---

### US-003: Build Graph Analyzer for Topology Detection
**Description:** As a developer, I want to analyze the workflow graph topology so that I can identify conversion patterns.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/analyzer/graph-analyzer.ts`
- [ ] Build adjacency list from connections object
- [ ] Detect trigger nodes (entry points with no incoming connections)
- [ ] Detect terminal nodes (no outgoing connections)
- [ ] Detect linear chains (single path, no branches)
- [ ] Detect fan-out points (one node → multiple targets)
- [ ] Detect fan-in points (multiple sources → one node)
- [ ] Detect IF/Switch branches (node type + multiple outputs)
- [ ] Return `GraphAnalysis` object with topology metadata
- [ ] Topological sort to determine execution order

---

### US-004: Create Node Categorization System
**Description:** As a developer, I want to categorize n8n nodes by their role so that I know how to convert each one.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/analyzer/node-categorizer.ts`
- [ ] Define categories: `trigger`, `action`, `transform`, `logic`, `ai`, `utility`, `unknown`
- [ ] Map common node types to categories:
  - Triggers: `*.trigger`, `*.webhook`, `manualTrigger`, `scheduleTrigger`
  - Actions: `httpRequest`, `gmail`, `notion`, `googleSheets`, `slack`
  - Transform: `set`, `code`, `function`, `merge`, `splitOut`, `aggregate`
  - Logic: `if`, `switch`, `filter`, `splitInBatches`
  - AI: `@n8n/n8n-nodes-langchain.*`
  - Utility: `wait`, `noOp`, `stickyNote`
- [ ] Return categorized node list with confidence score
- [ ] Flag `unknown` nodes for manual review

---

### Phase 2: Pattern Recognition

---

### US-005: Detect Linear Chain Patterns
**Description:** As a developer, I want to detect linear chains in the workflow so that I can convert them to sequential steps.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/patterns/linear-chain.detector.ts`
- [ ] Identify sequences of nodes with single input/output
- [ ] Group consecutive transform nodes into single compound step
- [ ] Preserve node order from topological sort
- [ ] Return `LinearChain[]` with start node, end node, and intermediate nodes
- [ ] Handle chains that start from trigger or from branch

---

### US-006: Detect Branch Patterns (IF/Switch)
**Description:** As a developer, I want to detect conditional branches so that I can convert them to Gattaca step conditions.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/patterns/branch.detector.ts`
- [ ] Identify IF nodes and their two output branches
- [ ] Identify Switch nodes and their multiple output branches
- [ ] Track which branch leads where (true path, false path)
- [ ] Detect if branches merge back (reconvergence point)
- [ ] Return `BranchPattern` with: condition node, branches[], mergePoint?
- [ ] Extract condition expression from IF node parameters

---

### US-007: Detect Parallel Execution Patterns
**Description:** As a developer, I want to detect fan-out patterns so that I can handle them appropriately.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/patterns/parallel.detector.ts`
- [ ] Identify fan-out: one node connects to multiple independent nodes
- [ ] Distinguish from IF branches (parallel vs conditional)
- [ ] Identify fan-in: multiple nodes connect to one (merge/aggregate)
- [ ] Return `ParallelPattern` with: source, parallel branches[], sink?
- [ ] Flag for manual review: Gattaca doesn't support true parallel execution

---

### US-008: Detect Loop Patterns
**Description:** As a developer, I want to detect loop patterns so that I can convert them to Gattaca batch processing.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/patterns/loop.detector.ts`
- [ ] Identify `splitInBatches` nodes (n8n's loop construct)
- [ ] Identify `splitOut` → process → `aggregate` patterns
- [ ] Track loop body (nodes between split and aggregate)
- [ ] Return `LoopPattern` with: splitter, body nodes[], aggregator
- [ ] Note: Gattaca handles this via batch processing in API routes

---

### Phase 3: Node Converters

---

### US-009: Create Base Converter Interface
**Description:** As a developer, I want a consistent interface for node converters so that they're easy to implement and test.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/base.converter.ts`
- [ ] Define `NodeConverter` interface:
  ```typescript
  interface NodeConverter {
    nodeTypes: string[];  // n8n types this converter handles
    canConvert(node: N8nNode, context: ConversionContext): boolean;
    analyze(node: N8nNode, context: ConversionContext): NodeAnalysis;
    generateStep(node: N8nNode, context: ConversionContext): GattacaStepConfig;
    generateCode(node: N8nNode, context: ConversionContext): GeneratedCode;
  }
  ```
- [ ] Define `ConversionContext` with: workflow, graph analysis, converted nodes, variable mappings
- [ ] Define `NodeAnalysis` with: convertible, limitations[], manualSteps[]
- [ ] Define `GeneratedCode` with: files[], imports[], dependencies[]

---

### US-010: Implement HTTP Request Converter
**Description:** As a developer, I want to convert n8n HTTP Request nodes so that API calls work in Gattaca.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/http-request.converter.ts`
- [ ] Handle methods: GET, POST, PUT, DELETE, PATCH
- [ ] Map URL with expression conversion
- [ ] Map headers, query params, body
- [ ] Handle auth types: None, Basic Auth, Bearer Token, API Key
- [ ] Generate API route file: `/api/playbook/[name]/steps/[stepId]/route.ts`
- [ ] Route uses `fetch()` with proper error handling
- [ ] Convert n8n expressions to Gattaca state access
- [ ] Handle response parsing (JSON, text, binary)

---

### US-011: Implement AI/LLM Node Converters
**Description:** As a developer, I want to convert n8n LangChain nodes so that AI functionality works in Gattaca.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/ai-llm.converter.ts`
- [ ] Handle node types:
  - `@n8n/n8n-nodes-langchain.lmChatOpenAi`
  - `@n8n/n8n-nodes-langchain.lmChatGoogleGemini`
  - `@n8n/n8n-nodes-langchain.lmChatAnthropic`
  - `@n8n/n8n-nodes-langchain.chainLlm`
  - `@n8n/n8n-nodes-langchain.agent`
- [ ] Map model names to Gattaca's OpenRouter format
- [ ] Extract prompt templates and convert expressions
- [ ] Map temperature, maxTokens, systemMessage
- [ ] Generate step that calls `/api/llm/generate`
- [ ] Handle structured output parsers

---

### US-012: Implement Data Transform Converters
**Description:** As a developer, I want to convert n8n Set/Code nodes so that data transformations work.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/transform.converter.ts`
- [ ] Handle `n8n-nodes-base.set`: Map field assignments to state updates
- [ ] Handle `n8n-nodes-base.code`: Extract JS code, wrap in async function
- [ ] Handle `n8n-nodes-base.function`: Similar to code node
- [ ] Convert n8n helpers to Gattaca equivalents:
  - `$json` → `input`
  - `$input.all()` → `inputs`
  - `$node["name"].json` → `state.steps.name.output`
- [ ] Generate utility functions for complex transformations
- [ ] Flag uses of n8n-specific APIs that need manual conversion

---

### US-013: Implement Trigger Converters
**Description:** As a developer, I want to convert n8n triggers to Gattaca playbook entry points.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/trigger.converter.ts`
- [ ] Handle `manualTrigger`: Standard playbook start (user-initiated)
- [ ] Handle `webhook`: Generate webhook route + initial step
- [ ] Handle `scheduleTrigger`: Note cron config, flag for external scheduler
- [ ] Handle `googleSheetsTrigger`: Generate polling step or note for webhook
- [ ] Extract input schema from trigger configuration
- [ ] First trigger becomes first step in first phase
- [ ] Multiple triggers → flag for manual decision

---

### US-014: Implement Logic Converters (IF/Switch)
**Description:** As a developer, I want to convert n8n IF/Switch nodes to Gattaca conditional logic.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/logic.converter.ts`
- [ ] Handle `n8n-nodes-base.if`:
  - Extract condition parameters (value1, operation, value2)
  - Convert to JS boolean expression
  - Generate step with `condition` field
  - Map true/false branches to different next steps
- [ ] Handle `n8n-nodes-base.switch`:
  - Extract routing rules
  - Generate multiple condition checks
  - Flag complex routing for manual review
- [ ] Handle `n8n-nodes-base.filter`:
  - Convert to transform step with filter logic

---

### Phase 4: Code Generation

---

### US-015: Implement Expression Converter
**Description:** As a developer, I want to convert n8n expressions to Gattaca state access so that dynamic values work.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/expression.converter.ts`
- [ ] Parse n8n expression syntax: `={{ expression }}`
- [ ] Convert variable references:
  - `$json.field` → `input.field`
  - `$json["field"]` → `input["field"]`
  - `$node["NodeName"].json.field` → `state.steps.nodeName.output.field`
  - `$input.first().json` → `inputs[0]`
  - `$input.all()` → `inputs`
- [ ] Convert built-in functions:
  - `$now` → `new Date().toISOString()`
  - `$today` → `new Date().toISOString().split('T')[0]`
  - `$if(cond, a, b)` → `(cond) ? a : b`
  - `$isEmpty(val)` → `!val || val.length === 0`
- [ ] Handle nested expressions and string interpolation
- [ ] Return `{ converted: string, warnings: string[] }` for unconvertible parts

---

### US-016: Generate Playbook Config File (with UX Metadata)
**Description:** As a developer, I want to generate a complete playbook config that includes all UX presentation data so that playbooks feel engaging and communicate value clearly.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/generators/playbook-config.generator.ts`
- [ ] Input: analyzed workflow + converted steps
- [ ] Generate phases based on workflow topology:
  - Trigger → Phase 1 "Inicio"
  - Linear chains → sequential steps in same phase
  - Branches → steps with conditions, possibly separate phases
- [ ] Generate step dependencies from connections
- [ ] Generate step configs with: id, name, description, type, executor, dependsOn
- [ ] Infer step descriptions from node names
- [ ] Output valid TypeScript matching `PlaybookConfig` interface
- [ ] Include imports and exports
- [ ] **Generate `presentation` block** (see US-016b)
- [ ] **Generate `guidance` for each step** (see US-016c)
- [ ] **Generate `executionExplanation` for auto steps** (see US-016d)

---

### US-016b: Generate Presentation Metadata for Onboarding
**Description:** As a user, I want the generated playbook to have an engaging intro screen that explains what it does and what I'll get.

**Acceptance Criteria:**
- [ ] Generate `presentation` block in PlaybookConfig:
  ```typescript
  presentation: {
    tagline: string;              // Auto-inferred from workflow name/description
    valueProposition: string[];   // What the user will get (inferred from output nodes)
    exampleOutput?: {             // Preview of expected result
      type: 'linkedin-post' | 'report' | 'data' | 'keywords' | 'custom';
      preview: { text?: string; imageUrl?: string; };
    };
    estimatedTime: string;        // Sum of all step estimated times
    estimatedCost: string;        // Based on API services used
    requiredServices?: Array<{    // Services shown in intro screen with config status
      key: string;                // Must match ServiceName in getUserApiKey (e.g., 'dumpling')
      name: string;               // Display name (e.g., 'Dumpling AI')
      description: string;        // What this service does
    }>;
  }
  ```

**Note:** The `requiredServices` array enables the intro screen to check if services are configured. The `key` must match the service names used in `getUserApiKey.ts`.
- [ ] Infer `tagline` from workflow name: "Auto-Generate LinkedIn Posts" → "Genera posts de LinkedIn automáticamente"
- [ ] Infer `valueProposition` from output node types:
  - If has image generation → "Imagen profesional generada con IA"
  - If has text generation → "Contenido listo para publicar"
  - If has data scraping → "Datos de fuentes verificadas"
- [ ] Calculate `estimatedTime` summing step estimates (default 30s per API call)
- [ ] Calculate `estimatedCost` based on services:
  - OpenRouter/GPT-4: ~$0.03 per call
  - Dumpling AI: ~$0.02 per search
  - Image generation: ~$0.05 per image

---

### US-016c: Generate Step Guidance
**Description:** As a user, I want each step to have clear guidance that explains what to do and what's happening.

**Acceptance Criteria:**
- [ ] Generate `guidance` for each step:
  ```typescript
  guidance: {
    description: string;           // What this step does (human-friendly)
    userActions: string[];         // What the user needs to do
    completionCriteria: {
      description: string;
      type: 'input_required' | 'auto_complete' | 'manual';
    };
  }
  ```
- [ ] For input steps: guidance explains what to enter and why
- [ ] For auto steps: guidance explains what's happening behind the scenes
- [ ] For review steps: guidance explains what to check
- [ ] Infer from n8n node descriptions and parameters

---

### US-016d: Generate Execution Explanations
**Description:** As a user, I want to see progress details while steps execute so I understand what's happening.

**Acceptance Criteria:**
- [ ] Generate `executionExplanation` for auto/API steps:
  ```typescript
  executionExplanation: {
    title: string;                 // "Buscando artículos relevantes..."
    steps: string[];               // Sub-steps shown during execution
    estimatedTime: string;         // "30-45 segundos"
    estimatedCost: string;         // "~$0.02"
    costService: string;           // "Dumpling AI"
  }
  ```
- [ ] Infer `steps` from n8n node type:
  - HTTP Request → ["Conectando con API...", "Procesando respuesta..."]
  - AI/LLM → ["Analizando contenido...", "Generando respuesta...", "Formateando salida..."]
  - Search → ["Buscando resultados...", "Filtrando relevantes...", "Descargando contenido..."]
- [ ] Map n8n credential types to `costService` names

---

### US-017: Generate API Route Files
**Description:** As a developer, I want to generate API routes for each step that needs server execution.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/generators/api-routes.generator.ts`
- [ ] Create directory structure: `/api/playbook/[playbookName]/`
- [ ] Generate route.ts for each step that needs server execution
- [ ] Routes follow existing Gattaca patterns:
  - Auth check with `createClient`
  - Error handling with try/catch
  - Response format: `{ success, data?, error? }`
- [ ] Generate shared types in `_types.ts`
- [ ] Generate shared utilities in `_utils.ts`
- [ ] Include file header: `// Generated by n8n-converter from workflow: [name]`

---

### US-018: Generate Step UI Components (Optional)
**Description:** As a developer, I want to optionally generate basic UI components for custom steps.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/generators/ui-components.generator.ts`
- [ ] Generate React component for steps that need user input
- [ ] Use existing Gattaca UI patterns (forms, buttons, tables)
- [ ] Generate form fields from node parameters
- [ ] Connect to API routes via fetch
- [ ] Output to `/components/playbook/[playbookName]/`
- [ ] Mark as optional in conversion report
- [ ] Many steps can use existing generic components

---

### Phase 5: Integration & UX

---

### US-019: Create CLI Converter Tool
**Description:** As a user, I want a CLI to convert n8n workflows so I can automate migration.

**Acceptance Criteria:**
- [ ] Create `scripts/convert-n8n.ts`
- [ ] Usage: `pnpm run convert-n8n <input.json> [--output <dir>] [--name <name>]`
- [ ] Process: parse → analyze → convert → generate → write files
- [ ] Show progress: "Analyzing workflow... Found 12 nodes, 15 connections"
- [ ] Show conversion status per node: ✅ converted, ⚠️ partial, ❌ manual
- [ ] Generate conversion report: `conversion-report.md`
- [ ] `--dry-run` flag: show what would be generated without writing
- [ ] `--verbose` flag: show detailed conversion decisions

---

### US-020: Create Web Import UI
**Description:** As a user, I want to import n8n workflows through the Gattaca UI.

**Acceptance Criteria:**
- [ ] Create `/app/playbook/import/page.tsx`
- [ ] Textarea for pasting n8n JSON
- [ ] File upload alternative for .json files
- [ ] "Analyze" button shows preview:
  - Workflow name, node count
  - Conversion status per node (table)
  - Warnings and manual steps needed
- [ ] "Convert" button triggers server-side conversion
- [ ] Progress indicator during conversion
- [ ] Success: download generated files as ZIP or create in project
- [ ] Link to conversion report

---

### US-021: Generate Conversion Report
**Description:** As a user, I want a detailed report of what was converted and what needs manual work.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/reporters/conversion-report.ts`
- [ ] Report sections:
  - **Summary**: nodes converted/partial/manual, files generated
  - **Converted Nodes**: list with green checkmarks
  - **Partial Conversions**: what works, what needs attention
  - **Manual Steps Required**: detailed instructions for each
  - **Generated Files**: list with descriptions
  - **Environment Variables**: required API keys
  - **Next Steps**: checklist to complete setup
- [ ] Output formats: Markdown (default), JSON (for programmatic use)
- [ ] Include in generated playbook directory as `CONVERSION_NOTES.md`

---

### US-022: Generate Integration Artifacts (Multi-File)
**Description:** As a developer, I want the converter to generate ALL required integration artifacts across multiple files so that playbooks work end-to-end without manual fixes.

**Acceptance Criteria:**
- [ ] Detect all external API services used in the workflow
- [ ] For each NEW service not in Gattaca, generate updates for ALL 5 files:
  - `/api/user/api-keys/route.ts` - add to `SUPPORTED_SERVICES`
  - `/api/user/api-keys/check/route.ts` - add to `ServiceName` type
  - `/lib/getUserApiKey.ts` - add to `ServiceName` type AND both `envVarMap` objects
  - `/components/settings/ApiKeySetupModal.tsx` - add to `SERVICE_INFO`
  - `/components/settings/ApiKeysConfig.tsx` - add to `SERVICE_INFO`
- [ ] Generated API routes MUST use `getUserApiKey()` pattern, NOT direct DB queries
- [ ] Generated AI/LLM routes MUST use OpenRouter OAuth pattern (`user_openrouter_tokens` + `decryptToken`)
- [ ] Generated API routes read from `previousOutputs.<stepId>` correctly
- [ ] Generate SQL migration to insert playbook in database
- [ ] Update `configs/index.ts` to register the new playbook
- [ ] Generate variables array in config matching input step fields
- [ ] Step configs include correct `requiredApiKeys` array
- [ ] Include comprehensive checklist in conversion report:
  - Files modified/created
  - Environment variables needed
  - Services to configure in settings
  - Manual steps if any

---

### US-023: Handle Unsupported Nodes Gracefully
**Description:** As a user, I want unsupported nodes handled gracefully so partial conversion is useful.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/converters/fallback.converter.ts`
- [ ] Unsupported nodes generate placeholder step:
  ```typescript
  {
    id: 'manual_node_name',
    name: 'Manual: [Node Name]',
    description: 'This step requires manual implementation',
    type: 'manual',
    executor: 'none',
    // Original n8n config preserved in comments
  }
  ```
- [ ] Generate TODO comment in API route with original node config
- [ ] Conversion continues past unsupported nodes
- [ ] Report clearly lists what's missing
- [ ] Suggest similar Gattaca patterns if available

---

### Phase 6: Testing & Documentation

---

### US-024: Create Test Suite with Real Workflows
**Description:** As a developer, I want integration tests with real n8n workflows to verify conversion quality.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/__tests__/`
- [ ] Add 5 test workflow JSONs:
  1. `simple-http-chain.json`: Trigger → HTTP → Set → HTTP (linear)
  2. `ai-content-generator.json`: Trigger → OpenAI → GoogleSheets (AI)
  3. `conditional-routing.json`: Trigger → IF → Branch A / Branch B (branching)
  4. `batch-processing.json`: Trigger → Split → Process → Aggregate (loops)
  5. `complex-marketing.json`: Real marketing workflow from templates (complex)
- [ ] Test: parser produces valid N8nWorkflow
- [ ] Test: analyzer detects correct patterns
- [ ] Test: generated config matches PlaybookConfig interface
- [ ] Test: generated code compiles without TypeScript errors
- [ ] Test: expressions convert correctly

---

### US-025: Write Converter Documentation
**Description:** As a developer, I want documentation so others can extend the converter.

**Acceptance Criteria:**
- [ ] Create `src/lib/n8n-converter/README.md`
- [ ] Document architecture and design decisions
- [ ] Document how to add a new node converter
- [ ] Document expression syntax mapping table
- [ ] Document known limitations and workarounds
- [ ] Add inline JSDoc comments to all public functions
- [ ] Include architecture diagram (ASCII or Mermaid)

## Functional Requirements

- FR-1: Converter must accept n8n workflow JSON exported from n8n UI
- FR-2: Generated playbook config must match Gattaca's `PlaybookConfig` interface
- FR-3: Generated API routes must follow existing Gattaca patterns
- FR-4: Generated code must pass `pnpm typecheck` without errors
- FR-5: Conversion must complete in < 30 seconds for workflows under 30 nodes
- FR-6: All generated files must include source attribution header
- FR-7: Converter must not fail on unknown nodes (graceful degradation)
- FR-8: Expression conversion must handle nested expressions up to 3 levels deep

## Non-Goals (Out of Scope)

- **Bidirectional sync**: Not converting Gattaca → n8n
- **Runtime translation**: Not running n8n directly in Gattaca
- **All 400+ n8n nodes**: Starting with most common 20-30
- **n8n community nodes**: Official nodes only
- **Credentials migration**: Only placeholders, no secrets
- **Sub-workflows**: Not handling "Execute Workflow" nodes
- **Binary data**: Not handling file/image processing nodes

## Technical Considerations

### Architecture
```
src/lib/n8n-converter/
├── types/
│   ├── n8n.types.ts          # n8n JSON types
│   └── output.types.ts       # Conversion output types
├── parser/
│   └── workflow-parser.ts    # JSON → typed workflow
├── analyzer/
│   ├── graph-analyzer.ts     # Topology analysis
│   └── node-categorizer.ts   # Node classification
├── patterns/
│   ├── linear-chain.detector.ts
│   ├── branch.detector.ts
│   ├── parallel.detector.ts
│   └── loop.detector.ts
├── converters/
│   ├── base.converter.ts     # Interface + registry
│   ├── http-request.converter.ts
│   ├── ai-llm.converter.ts
│   ├── transform.converter.ts
│   ├── trigger.converter.ts
│   ├── logic.converter.ts
│   ├── expression.converter.ts
│   └── fallback.converter.ts
├── generators/
│   ├── playbook-config.generator.ts
│   ├── api-routes.generator.ts
│   └── ui-components.generator.ts
├── reporters/
│   └── conversion-report.ts
├── __tests__/
│   ├── workflows/            # Test JSON files
│   └── *.test.ts
└── index.ts                  # Main entry point
```

### Node Priority Matrix

| Priority | Node Type | Rationale |
|----------|-----------|-----------|
| P0 | httpRequest | Core integration capability |
| P0 | set | Data transformation |
| P0 | if | Control flow |
| P0 | manualTrigger | Basic start |
| P1 | lmChatOpenAi | AI functionality |
| P1 | code | Custom logic |
| P1 | googleSheets | Common integration |
| P1 | webhook | Event-driven start |
| P2 | gmail, slack, notion | Popular integrations |
| P2 | splitInBatches, aggregate | Loop patterns |

## Success Metrics

- 80% of test workflows convert without manual intervention
- Generated code compiles on first run
- Conversion time < 10 seconds for typical workflows
- Clear, actionable conversion report
- New node converter can be added in < 2 hours

## Integration Requirements (Critical)

Based on actual conversion testing, these requirements are **MANDATORY** for generated playbooks to work end-to-end without manual fixes.

### 1. API Service Registration (MULTI-FILE)

Any API service used by the playbook MUST be registered in **ALL 5 LOCATIONS**:

| File | Location | What to Add |
|------|----------|-------------|
| `/src/app/api/user/api-keys/route.ts` | `SUPPORTED_SERVICES` array | `'servicename'` |
| `/src/app/api/user/api-keys/check/route.ts` | `ServiceName` type | `'servicename'` |
| `/src/lib/getUserApiKey.ts` | `ServiceName` type | `'servicename'` |
| `/src/lib/getUserApiKey.ts` | BOTH `envVarMap` objects (lines ~80 and ~124) | `servicename: 'SERVICE_ENV_VAR'` |
| `/src/components/settings/ApiKeySetupModal.tsx` | `SERVICE_INFO` object | Full service config (see below) |
| `/src/components/settings/ApiKeysConfig.tsx` | `SERVICE_INFO` object | Full service config (see below) |

**SERVICE_INFO entry format:**
```typescript
servicename: {
  name: 'servicename',           // Internal key (must match SUPPORTED_SERVICES)
  label: 'Service Display Name', // UI display name
  description: 'What this service does',
  docsUrl: 'https://service.com/api-keys',
  placeholder: 'sk_xxxxxxxxxxxx', // API key format hint
},
```

**The converter must**:
- Detect ALL external services the n8n workflow uses
- Generate code/instructions to update ALL 5 files
- Include environment variable names in conversion report

**Checking API key configuration (for intro screens):**
```typescript
// ✅ CORRECT - use `services` (PLURAL) parameter
const response = await fetch(`/api/user/api-keys/check?services=${serviceKey}`)
const data = await response.json()
// Response: { results: { [serviceKey]: { configured: boolean } }, allConfigured, missing }
const isConfigured = data.results?.[serviceKey]?.configured ?? false

// ❌ WRONG - `service` (singular) doesn't exist
const response = await fetch(`/api/user/api-keys/check?service=${serviceKey}`)
```

### 2. API Key Retrieval Pattern (Use getUserApiKey)

Generated API routes MUST use `getUserApiKey()` from `@/lib/getUserApiKey`:

```typescript
// ❌ WRONG - old pattern with wrong column names
const { data: apiKeys } = await supabase
  .from('user_api_keys')
  .select('key_value')           // WRONG column!
  .eq('provider', 'servicename') // WRONG column!
  .single()

// ✅ CORRECT - use getUserApiKey utility
import { getUserApiKey } from '@/lib/getUserApiKey'

const apiKey = await getUserApiKey({
  userId: user.id,
  serviceName: 'servicename',  // Must match ServiceName type
  supabase,
})

if (!apiKey) {
  return NextResponse.json(
    { error: 'Service API key not configured. Please add it in settings.' },
    { status: 400 }
  )
}
```

**Important:** `getUserApiKey` handles:
- Fetching user's encrypted key from `user_api_keys.api_key_encrypted`
- Decrypting with the correct salt format (`'salt'`, hex encoding)
- Fallback to environment variable if user has no key

### 3. OpenRouter (AI/LLM) Special Pattern

OpenRouter uses OAuth, NOT the standard `user_api_keys` table. Generated AI routes MUST use:

```typescript
import { decryptToken } from '@/lib/encryption'

async function getOpenRouterKey(userId: string, supabase: any): Promise<string | null> {
  // 1. Try user's OAuth token (user_openrouter_tokens table)
  const { data: tokenRecord } = await supabase
    .from('user_openrouter_tokens')
    .select('encrypted_api_key')
    .eq('user_id', userId)
    .single()

  if (tokenRecord?.encrypted_api_key && tokenRecord.encrypted_api_key !== 'PENDING') {
    try {
      const oauthKey = decryptToken(tokenRecord.encrypted_api_key)
      // Validate it looks like an OpenRouter key
      if (oauthKey && (oauthKey.startsWith('sk-or-') || oauthKey.length > 20)) {
        return oauthKey
      }
    } catch {
      // Ignore decryption errors, fall through
    }
  }

  // 2. Fallback to environment
  return process.env.OPENROUTER_API_KEY || null
}
```

**Key difference:** `decryptToken` uses salt `'gattaca-api-keys'` with base64 encoding (different from `getUserApiKey`).

### 4. API Route Data Access Pattern (CRITICAL)

Generated API routes MUST read input from `previousOutputs` (PLURAL), NOT from `previousStepOutput` (singular) or `input`:

```typescript
// ❌ WRONG - uses singular (doesn't match what PlaybookShell sends!)
const { input, previousStepOutput, sessionId, stepId } = body
const articles = previousStepOutput?.articles  // Will be undefined!

// ❌ WRONG - reads directly from input (only works for current step)
const topic = input?.topic

// ✅ CORRECT - how PlaybookShell passes data (uses PLURAL previousOutputs)
const body = await request.json()
const { input, previousOutputs, sessionId, stepId } = body

// Get data from previous step output BY STEP ID
const inputStepOutput = previousOutputs?.define_topic as Record<string, string> | undefined
const searchStepOutput = previousOutputs?.search_articles as Record<string, unknown> | undefined

const topic = inputStepOutput?.topic || input?.topic
const articles = searchStepOutput?.articles || input?.articles
```

**Common Bug:** Using `previousStepOutput` (singular) instead of `previousOutputs` (plural). This will cause "No data provided" errors because the variable is always undefined.

PlaybookShell sends this payload:
```json
{
  "projectId": "...",
  "stepId": "current_step",
  "input": null,
  "previousOutputs": {
    "define_topic": { "topic": "AI in Marketing", "tone": "professional" },
    "search_articles": { "articles": [...], "topic": "..." }
  },
  "sessionId": "..."
}
```

**Key points:**
- Access data by step ID: `previousOutputs.step_id_here`
- Input step data is in `previousOutputs.define_topic` (or whatever the input step ID is)
- Always use fallback: `previousOutputs?.step_id?.field || input?.field`

### 5. Input Step Type Handling

The `'input'` step type requires:
- Step config with `type: 'input'` and `executor: 'form'`
- WorkArea.tsx already handles this via InputStep component
- Form fields with explicit dark text styling: `text-gray-900 bg-white placeholder:text-gray-400`

### 6. PlaybookConfig Variables

Input steps derive their form fields from `playbookConfig.variables`:

```typescript
variables: [
  {
    key: 'topic',           // Used as form field name and state key
    label: 'Topic',         // Display label
    type: 'text',           // text | textarea | select | number
    required: true,         // Validation
    placeholder: '...',     // Placeholder text
    options?: [...]         // For select type
  }
]
```

### 7. requiredApiKeys in Step Config

If a step needs an API key, include it in the step config:

```typescript
{
  id: 'search_articles',
  name: 'Search Articles',
  type: 'auto',
  executor: '/api/playbook/linkedin-post-generator/search-articles',
  requiredApiKeys: ['dumpling'],  // Will show setup modal if not configured
  dependsOn: ['define_topic'],
}
```

WorkArea.tsx checks these before executing and shows ApiKeySetupModal for missing keys.

### 8. API Response Format for Display

Generated API routes should return data in formats that WorkArea can display nicely:

```typescript
// ✅ GOOD - articles with structured data (WorkArea renders as nice list)
return NextResponse.json({
  success: true,
  data: {
    topic: "AI in Marketing",
    articleCount: 3,
    articles: [
      { title: "Article Title", url: "https://...", snippet: "Preview text..." },
      // ...
    ]
  }
})

// ✅ GOOD - text content (WorkArea renders as preformatted text)
return NextResponse.json({
  success: true,
  data: {
    postText: "Your generated LinkedIn post...",
    imagePrompt: "A professional image showing..."
  }
})

// ❌ AVOID - deeply nested data that's hard to display
return NextResponse.json({
  result: { nested: { deeply: { data: "..." } } }
})
```

**WorkArea auto-detects and renders:**
- Objects with `articles` array → Formatted article list with title/URL/snippet
- String content → Preformatted text with character count
- Other objects → JSON formatted display

**Important:** The step's `output` in state should contain the `data` field content, not the entire response wrapper.

### 9. Step Types and User Experience

**Critical Rule:** Steps with `type: 'auto'` do NOT auto-advance to the next step after completion. The user must see the results and click "Siguiente" in the navigation panel when ready.

**Step Type Behaviors:**

| Type | Execution | After Completion | User Action Required |
|------|-----------|------------------|---------------------|
| `input` | User fills form | User clicks "Continuar" | Yes |
| `auto` | Executes when user clicks "Ejecutar" | Shows results, waits for user | User clicks "Siguiente" in nav |
| `auto_with_review` | Executes when user clicks "Ejecutar" | Shows results with edit options | User clicks "Aprobar y continuar" |
| `suggestion` | Shows AI suggestions | User selects option | User clicks "Continuar" |
| `decision` | Shows options | User selects | User clicks "Continuar" |
| `manual` | No execution | User manually completes | User clicks "Marcar completado" |

**Why No Auto-Advance:**

1. **User visibility:** Users need to see and verify step results (e.g., "3 articles found") before proceeding
2. **Error awareness:** If something unexpected happens, user can review and decide to re-execute
3. **Flow control:** User maintains control over when to proceed
4. **Preview expectations:** Users expect to review what was generated/found

**Generated Config Example:**
```typescript
// ✅ CORRECT - auto step that waits for user review
{
  id: 'search_articles',
  name: 'Search Articles',
  type: 'auto',  // Will show results and wait for "Siguiente"
  executor: 'api',
  apiEndpoint: '/api/playbook/linkedin-post-generator/search-articles',
}

// ✅ CORRECT - if user must approve output before continuing
{
  id: 'review_post',
  name: 'Review Post',
  type: 'auto_with_review',  // Has "Aprobar y continuar" button
  executor: 'none',
}
```

### 10. Generated Files Checklist

For a complete conversion, the converter must generate/update:

| File | Purpose | Required? |
|------|---------|-----------|
| `src/components/playbook/configs/[name].config.ts` | Playbook configuration | ✅ Always |
| `src/components/playbook/configs/index.ts` | Add to playbookConfigs registry | ✅ Always |
| `src/app/api/playbook/[name]/[step]/route.ts` | API routes for auto steps | ✅ Per step |
| `/src/app/api/user/api-keys/route.ts` | Add to SUPPORTED_SERVICES | If new service |
| `/src/app/api/user/api-keys/check/route.ts` | Add to ServiceName type | If new service |
| `/src/lib/getUserApiKey.ts` | Add to ServiceName + both envVarMaps | If new service |
| `/src/components/settings/ApiKeySetupModal.tsx` | Add to SERVICE_INFO | If new service |
| `/src/components/settings/ApiKeysConfig.tsx` | Add to SERVICE_INFO | If new service |
| Database INSERT | Add playbook to `playbooks` table | ✅ Always |

### 11. Database Registration

Playbooks must be registered in both:
1. **TypeScript config** (`configs/index.ts`)
2. **Database table** (`playbooks`)

Generate SQL migration:
```sql
INSERT INTO playbooks (agency_id, name, slug, description, playbook_type, type, is_public, version, config)
VALUES (
  (SELECT id FROM agencies LIMIT 1),
  'LinkedIn Post Generator',
  'linkedin-post-generator',
  'Generate LinkedIn posts from any topic',
  'linkedin-post-generator',
  'linkedin-post-generator',
  true,
  '1.0.0',
  '{"source": "n8n", "n8n_workflow_name": "Auto-Generate LinkedIn Posts"}'
);
```

### 10. Known Services Mapping

The converter should recognize these n8n credential types and map to Gattaca services:

| n8n Credential Type | Gattaca Service Name | Env Variable |
|---------------------|---------------------|--------------|
| `dumplingAiApi` | `dumpling` | `DUMPLING_API_KEY` |
| `openAiApi`, `openRouterApi` | `openrouter` (OAuth) | `OPENROUTER_API_KEY` |
| `apifyApi` | `apify` | `APIFY_TOKEN` |
| `firecrawlApi` | `firecrawl` | `FIRECRAWL_API_KEY` |
| `serperApi` | `serper` | `SERPER_API_KEY` |
| `perplexityApi` | `perplexity` | `PERPLEXITY_API_KEY` |
| `phantombusterApi` | `phantombuster` | `PHANTOMBUSTER_API_KEY` |

If a new service is detected that's not in this list, the converter should:
1. Flag it in the conversion report
2. Generate placeholder code with TODO comments
3. List the required file updates

## Open Questions

1. Should parallel fan-out be converted to sequential (simpler) or flagged for manual parallel implementation?
2. How do we handle n8n's "sticky note" documentation - preserve as comments?
3. Should we generate one mega API route or per-step routes?
4. How do we handle n8n's binary data in expressions?

## UX Requirements (Critical)

> **Documento relacionado:** [PRD: Playbook UX Redesign](./prd-playbook-ux-redesign.md)

Los playbooks generados deben sentirse **cálidos, claros y orientados al valor**, no fríos ni técnicos. El convertidor debe generar toda la metadata necesaria para una buena UX.

### Principios de UX para Playbooks Generados

1. **Valor antes que proceso**: El usuario debe entender QUÉ va a obtener antes de ver los pasos
2. **Contexto en cada paso**: Explicar qué está pasando y por qué, no solo el nombre técnico
3. **Feedback constante**: Mostrar progreso, tiempo estimado, qué se está haciendo
4. **Resultado celebrado**: El output final debe presentarse de forma atractiva

### Metadata UX Requerida en Config

Cada playbook generado DEBE incluir:

```typescript
// 1. Bloque de presentación para pantalla de inicio
presentation: {
  tagline: "Genera posts de LinkedIn en minutos",
  valueProposition: [
    "Post listo para publicar con hook atractivo",
    "Imagen profesional generada con IA",
    "Fuentes verificadas de artículos reales"
  ],
  exampleOutput: {
    type: 'linkedin-post',
    preview: { text: "Ejemplo de post...", imageUrl: "/examples/..." }
  },
  estimatedTime: "2-3 minutos",
  estimatedCost: "~$0.05 USD",
  // IMPORTANT: requiredServices enables intro screen to check configuration status
  requiredServices: [
    { key: 'openrouter', name: 'OpenRouter (IA)', description: 'Genera el contenido usando GPT-4o' },
    { key: 'dumpling', name: 'Dumpling AI', description: 'Busca y extrae artículos' }
  ]
}

// 2. Guidance en cada step
steps: [{
  id: 'search_articles',
  guidance: {
    description: "Buscando los mejores artículos sobre tu tema...",
    userActions: ["Espera mientras buscamos fuentes de calidad"],
    completionCriteria: { type: 'auto_complete', description: "Artículos encontrados" }
  },
  executionExplanation: {
    title: "Investigando tu tema",
    steps: [
      "Buscando artículos relevantes en Google",
      "Filtrando por calidad y relevancia",
      "Extrayendo contenido de los mejores 3"
    ],
    estimatedTime: "30-45 segundos",
    estimatedCost: "~$0.02",
    costService: "Dumpling AI"
  }
}]
```

### Inferencia de UX desde n8n

El convertidor debe inferir la metadata UX:

| Elemento n8n | Metadata UX generada |
|--------------|---------------------|
| Nombre del workflow | `presentation.tagline` |
| Output nodes (tipo) | `presentation.valueProposition` |
| Total de API calls | `presentation.estimatedTime` |
| Credenciales usadas | `presentation.estimatedCost` |
| Nombre del nodo | `step.guidance.description` |
| Tipo de nodo | `step.executionExplanation.steps` |

### Validación de UX

El convertidor debe validar que:
- [ ] Todos los steps tienen `guidance` con `description` no vacía
- [ ] Todos los steps `auto` tienen `executionExplanation`
- [ ] El playbook tiene `presentation` completa
- [ ] Los tiempos y costos estimados son realistas (no placeholder)

## Implementation Order

1. **Week 1**: US-001 → US-004 (Foundation: types, parser, analyzer)
2. **Week 2**: US-005 → US-008 (Patterns: detection algorithms)
3. **Week 3**: US-009 → US-014 (Converters: node-specific logic)
4. **Week 4**: US-015 → US-018 (Generation: code output + UX metadata)
5. **Week 5**: US-019 → US-022 (UX: CLI, UI, reporting)
6. **Week 6**: US-023 → US-024 (Quality: tests, docs)

## Related Documents

- [PRD: Playbook UX Redesign](./prd-playbook-ux-redesign.md) - Especificación completa de la nueva UX de playbooks
