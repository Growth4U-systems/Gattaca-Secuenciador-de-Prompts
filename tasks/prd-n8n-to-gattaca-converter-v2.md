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

### US-016: Generate Playbook Config File
**Description:** As a developer, I want to generate a complete playbook config from analyzed workflow.

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

### US-022: Handle Unsupported Nodes Gracefully
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

### US-023: Create Test Suite with Real Workflows
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

### US-024: Write Converter Documentation
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

## Open Questions

1. Should parallel fan-out be converted to sequential (simpler) or flagged for manual parallel implementation?
2. How do we handle n8n's "sticky note" documentation - preserve as comments?
3. Should we generate one mega API route or per-step routes?
4. How do we handle n8n's binary data in expressions?

## Implementation Order

1. **Week 1**: US-001 → US-004 (Foundation: types, parser, analyzer)
2. **Week 2**: US-005 → US-008 (Patterns: detection algorithms)
3. **Week 3**: US-009 → US-014 (Converters: node-specific logic)
4. **Week 4**: US-015 → US-018 (Generation: code output)
5. **Week 5**: US-019 → US-022 (UX: CLI, UI, reporting)
6. **Week 6**: US-023 → US-024 (Quality: tests, docs)
