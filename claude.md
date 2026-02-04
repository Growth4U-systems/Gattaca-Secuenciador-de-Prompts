# CLAUDE.md - Contexto del Proyecto Gattaca

Este archivo mantiene contexto persistente para Claude Code entre sesiones.

---

## Descripción del Proyecto

**Gattaca - Secuenciador de Prompts** es una plataforma para gestionar campañas de análisis de competidores y flujos de trabajo con LLMs.

### Stack Técnico
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **LLMs**: OpenRouter (múltiples modelos), Gemini Deep Research
- **Scraping**: Apify Actors

### Estructura Principal
- `/src/components/scraper-dashboard/` - Dashboard de análisis de competidores
- `/src/components/flow/` - Editor de flujos y pasos (StepEditor, FlowCanvas)
- `/src/lib/playbooks/competitor-analysis/` - Configuración del playbook de competidores
- `/src/app/api/campaign/` - APIs de campañas

---

## Registro Histórico de Conversaciones

### 2026-02-04 (Sesión 2) - Sistema de Playbooks por Cliente

**Objetivo**: Implementar un sistema donde cada cliente tiene su propio catálogo de playbooks personalizable, con cascada de configuración: Base Template → Cliente → Proyecto.

**Arquitectura Implementada**:
```
Base Templates (código) → client_playbooks (DB) → project_playbooks (DB)
```

**Archivos Creados**:
1. `supabase/migrations/20260203100000_client_playbooks_table.sql` - Nueva tabla con RLS
2. `src/app/api/v2/clients/[clientId]/playbooks/route.ts` - API CRUD
3. `src/app/api/v2/clients/[clientId]/playbooks/[playbookId]/route.ts` - API individual
4. `src/hooks/useClientPlaybooks.ts` - Hook con forkFromTemplate, updatePlaybook, deletePlaybook
5. `src/app/clients/[clientId]/playbooks/page.tsx` - Página biblioteca
6. `src/app/clients/[clientId]/playbooks/[playbookId]/edit/page.tsx` - Editor de playbook
7. `src/components/playbook/PlaybookLibraryCard.tsx` - Componente card

**Archivos Modificados**:
- `src/app/clients/[clientId]/page.tsx` - PlaybooksTab con modal de personalización
- `src/app/api/projects/[projectId]/playbooks/route.ts` - Cascada de configuración

**Fix adicional**: El botón "Personalizar" llevaba a la biblioteca en lugar de iniciar personalización. Se agregó modal y navegación directa al editor.

**PR**: #356 - feat: Add client playbooks system and fix infinite loading

---

### 2026-02-04 - Integración StepEditor en CompetitorDetailView

**Problema inicial**: El StepEditor no guardaba los prompts editados. Al editar un paso de análisis de competidor, los cambios no se persistían.

**Diagnóstico**:
1. El inline preview leía de `ALL_PROMPTS[step.promptKey]` (siempre el default)
2. No leía de `campaign.custom_variables` donde se guardaban los configs

**Solución implementada**:

1. **CompetitorDetailView.tsx** - Fix del inline preview:
```typescript
// Antes (roto):
const promptText = ALL_PROMPTS[step.promptKey]

// Después (corregido):
const savedStepConfig = campaign.custom_variables?.[`${step.id}_config`]
const promptText = savedStepConfig?.prompt || ALL_PROMPTS[step.promptKey]
```

2. **run-step/route.ts** - Agregado mapeo para cargar configs guardados:
```typescript
const FLOW_TO_ANALYSIS_ID: Record<string, string> = {
  'comp-step-1-autopercepcion': 'autopercepcion',
  'comp-step-2-percepcion-terceros': 'percepcion-terceros',
  'comp-step-3-percepcion-rrss': 'percepcion-rrss',
  'comp-step-4-percepcion-reviews': 'percepcion-reviews',
  'comp-step-5-sintesis': 'resumen',
}
```

3. **StepEditor.tsx** - Fix del título para mostrar nombre del paso:
```typescript
<h2>Editar Paso: {editedStep.name}</h2>
```

4. **HighlightedPromptEditor.tsx** - Fondo blanco para mejor visibilidad:
```typescript
className="... bg-white"
```

**PR mergeado**: #363 - fix: StepEditor integration and prompt save/preview

**Archivos modificados**:
- `src/components/scraper-dashboard/CompetitorDetailView.tsx`
- `src/app/api/campaign/run-step/route.ts`
- `src/components/flow/StepEditor.tsx`
- `src/components/flow/HighlightedPromptEditor.tsx`
- `src/hooks/useClients.ts` (cleanup de timeouts)
- `src/hooks/useProjects.ts` (cleanup de timeouts)

---

### Mapeo de IDs de Pasos (Referencia)

Los pasos de análisis tienen dos IDs diferentes:

| UI ID (ANALYSIS_STEPS) | Flow ID (COMPETITOR_FLOW_STEPS) |
|------------------------|----------------------------------|
| `autopercepcion` | `comp-step-1-autopercepcion` |
| `percepcion-terceros` | `comp-step-2-percepcion-terceros` |
| `percepcion-rrss` | `comp-step-3-percepcion-rrss` |
| `percepcion-reviews` | `comp-step-4-percepcion-reviews` |
| `resumen` | `comp-step-5-sintesis` |

Los configs se guardan en `campaign.custom_variables` con key `{ui_id}_config` (ej: `autopercepcion_config`).

---

## Temas Pendientes

### Integración Apify para Competitor Analysis
- **Estado**: Pendiente de definición
- **Skills disponibles**: `apify-competitor-intelligence`, `apify-lead-generation`, `apify-ultimate-scraper`
- **Objetivo**: Usar scrapers de Apify para recopilar datos de competidores automáticamente
- **Contexto**: Se discutió en sesión anterior pero no hay detalles específicos

---

## Convenciones del Proyecto

1. **Commits**: Usar formato `type: description` (feat, fix, refactor, etc.)
2. **PRs**: Crear con `gh pr create`, mergear con `--squash --delete-branch`
3. **Configs de pasos**: Se guardan en `campaign.custom_variables['{stepId}_config']`
4. **Tipos**: Hay incompatibilidad entre `FlowStep` de `flow.types.ts` y `competitor-analysis/types.ts`, se usa cast con `as unknown as FlowStep`
