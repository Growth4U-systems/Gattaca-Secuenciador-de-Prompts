# PRD: Playbook UX Redesign

## El Problema

Los playbooks actuales se sienten fríos, mecánicos y parecen más un diagrama de backend que una experiencia de usuario. No comunican:

- **Qué van a hacer** - El usuario no entiende el valor antes de empezar
- **Para qué sirven** - No hay storytelling ni contexto
- **Qué va a obtener** - No hay preview del resultado final
- **Cómo funciona** - Lista de pasos técnicos sin explicación

### Evidencia del problema

La UI actual muestra:
- Una lista vertical de pasos con nombres técnicos
- Etiquetas como "auto", "input", "decisión" que no significan nada
- Barra de progreso genérica "3/5"
- Sin onboarding, sin ejemplos, sin preview

El config tiene información rica (`guidance`, `executionExplanation`, `estimatedTime`, `estimatedCost`) que **no se usa** en la UI.

## La Visión

Transformar los playbooks de "secuencia de pasos" a **experiencia guiada con propósito claro**.

El usuario debe sentir:
1. "Ah, esto me va a ayudar a X" (valor claro)
2. "Veo cómo funciona" (transparencia)
3. "Confío en el proceso" (predictibilidad)
4. "Wow, mira lo que generó" (resultado tangible)

## Quality Gates

Estos comandos deben pasar para cada user story:
- `pnpm typecheck` - Type checking
- `pnpm lint` - Linting

Para stories de UI:
- Verificar en browser

---

## User Stories

### Fase 1: Onboarding del Playbook

---

### US-001: Pantalla de Inicio del Playbook
**Descripción:** Como usuario, quiero ver qué hace el playbook antes de empezar para entender si me sirve.

**Diseño propuesto:**
```
┌─────────────────────────────────────────────────────────────┐
│  💼 LinkedIn Post Generator                                 │
│                                                             │
│  Genera posts profesionales de LinkedIn con imágenes IA     │
│  a partir de cualquier tema usando investigación de         │
│  artículos.                                                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📝 Ejemplo de resultado:                            │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  [Preview de un post de LinkedIn generado]   │    │   │
│  │  │  + imagen a la derecha                       │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ✨ Lo que vas a obtener:                                   │
│  • Post listo para publicar con hook atractivo              │
│  • Imagen profesional generada con IA                       │
│  • Fuentes verificadas de 3 artículos                       │
│                                                             │
│  ⚙️ Servicios necesarios:                                   │
│  [✓] OpenRouter (IA)  [!] Dumpling AI (configura →)         │
│                                                             │
│  ⏱️ Tiempo estimado: 2-3 minutos                            │
│  💰 Costo aproximado: ~$0.05 USD                            │
│                                                             │
│              [ Comenzar Playbook → ]                        │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Crear componente `PlaybookIntroScreen.tsx`
- [ ] Mostrar nombre, icono y descripción del playbook
- [ ] Mostrar "Lo que vas a obtener" extraído del config
- [ ] Mostrar ejemplo/preview del resultado (imagen + texto de ejemplo)
- [ ] Verificar APIs requeridas y mostrar estado (configurada/falta)
- [ ] Link directo a configurar API faltante sin salir del playbook
- [ ] Mostrar tiempo y costo estimado total
- [ ] Botón "Comenzar" que inicia el primer paso
- [ ] El PlaybookShell muestra esta pantalla antes del primer paso

---

### US-002: Ampliar PlaybookConfig con Metadata de Presentación
**Descripción:** Como desarrollador, necesito campos en el config para alimentar la pantalla de inicio.

**Acceptance Criteria:**
- [ ] Agregar a `PlaybookConfig`:
  ```typescript
  presentation: {
    tagline: string;              // "Genera posts de LinkedIn en minutos"
    valueProposition: string[];   // Lo que vas a obtener
    exampleOutput?: {
      type: 'linkedin-post' | 'report' | 'data' | 'custom';
      preview: {
        text?: string;
        imageUrl?: string;
        customComponent?: string;
      };
    };
    estimatedTime: string;        // "2-3 minutos"
    estimatedCost: string;        // "~$0.05 USD"
  }
  ```
- [ ] Actualizar linkedin-post-generator.config.ts con estos campos
- [ ] Actualizar types.ts con las interfaces

---

### Fase 2: Journey Visual

---

### US-003: Rediseñar NavigationPanel como Journey
**Descripción:** Como usuario, quiero ver el progreso como un viaje visual, no como una lista técnica.

**Diseño propuesto:**
```
┌──────────────────────────────┐
│  Tu progreso                 │
│  ━━━━━━━━○━━━━━━━━  2/4      │
│                              │
│  ┌────────────────────────┐  │
│  │ ✓ Tema definido        │  │
│  │   "IA en Marketing"    │  │
│  └────────────────────────┘  │
│           │                  │
│           ▼                  │
│  ┌────────────────────────┐  │
│  │ ● Investigando...      │  │ ← Paso actual (destacado)
│  │   Buscando artículos   │  │
│  │   ⏱️ ~30 segundos       │  │
│  └────────────────────────┘  │
│           │                  │
│           ▼                  │
│  ┌────────────────────────┐  │
│  │ ○ Generar contenido    │  │
│  │   IA crea tu post      │  │
│  └────────────────────────┘  │
│           │                  │
│           ▼                  │
│  ┌────────────────────────┐  │
│  │ ○ Resultado final      │  │
│  │   Post + imagen listos │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Rediseñar NavigationPanel con cards conectadas verticalmente
- [ ] Paso completado: checkmark verde + mini-preview del output
- [ ] Paso actual: destacado con animación sutil, descripción del proceso
- [ ] Pasos futuros: grises con descripción de lo que hará
- [ ] Mostrar tiempo estimado en paso actual
- [ ] Eliminar etiquetas técnicas ("auto", "input")
- [ ] Usar las descripciones del `guidance` en el config

---

### US-004: Mini-Preview de Output en Pasos Completados
**Descripción:** Como usuario, quiero ver un resumen del resultado de cada paso completado.

**Acceptance Criteria:**
- [ ] Para paso de input: mostrar valor ingresado ("IA en Marketing")
- [ ] Para paso de búsqueda: mostrar "3 artículos encontrados" con títulos truncados
- [ ] Para paso de generación: mostrar preview del post (primeras 50 palabras)
- [ ] Hacer click en paso completado expande el output completo
- [ ] Mantener colapsado por defecto para no saturar

---

### Fase 3: Feedback Durante Ejecución

---

### US-005: Estado de Ejecución Explicativo
**Descripción:** Como usuario, quiero entender qué está haciendo el sistema mientras procesa.

**Diseño propuesto - En WorkArea durante ejecución:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     🔍 Investigando tu tema...                              │
│                                                             │
│     ┌─────────────────────────────────────────────────┐    │
│     │  ⏳ Buscando artículos relevantes...             │    │
│     │     ↳ Consultando fuentes de alta calidad       │    │
│     │                                                  │    │
│     │  [ ════════════░░░░░░░░░░ ] 40%                 │    │
│     │                                                  │    │
│     │  Tiempo estimado restante: ~20 segundos          │    │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
│     💡 Mientras esperas:                                    │
│     Los mejores posts de LinkedIn tienen un hook            │
│     en la primera línea que genera curiosidad.              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Crear componente `ExecutionProgress.tsx`
- [ ] Mostrar título descriptivo de lo que está haciendo
- [ ] Mostrar sub-pasos del `executionExplanation.steps` secuencialmente
- [ ] Barra de progreso con porcentaje
- [ ] Tiempo estimado restante basado en `estimatedTime`
- [ ] Tip educativo o dato curioso mientras espera (opcional, configurable)
- [ ] Reemplazar el simple "Loader2 spinning" actual

---

### US-006: Notificación de Éxito con Preview
**Descripción:** Como usuario, quiero una confirmación clara cuando un paso termina, con preview del resultado.

**Acceptance Criteria:**
- [ ] Animación de éxito cuando termina un paso
- [ ] Toast o inline notification con preview del output
- [ ] Auto-transición al siguiente paso después de 2 segundos
- [ ] Opción de "Ver detalles" antes de continuar

---

### Fase 4: Resultado Final

---

### US-007: Pantalla de Resultado Final Celebratoria
**Descripción:** Como usuario, quiero ver mi resultado final presentado de forma atractiva y lista para usar.

**Diseño propuesto:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     🎉 ¡Tu post de LinkedIn está listo!                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │  [Vista previa estilo LinkedIn]                        │ │
│  │  ┌────────────────────────────────────────────────┐   │ │
│  │  │ 👤 Tu nombre                                    │   │ │
│  │  │ Headline • Ahora                               │   │ │
│  │  │                                                 │   │ │
│  │  │ La inteligencia artificial está transformando   │   │ │
│  │  │ el marketing B2B de formas que pocos anticipan. │   │ │
│  │  │ ...                                             │   │ │
│  │  │                                                 │   │ │
│  │  │ [Imagen generada]                               │   │ │
│  │  │                                                 │   │ │
│  │  │ 👍 Like  💬 Comment  🔄 Repost  📤 Send        │   │ │
│  │  └────────────────────────────────────────────────┘   │ │
│  │                                                        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 📋 Copiar texto │  │ ⬇️ Descargar img │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  📚 Fuentes utilizadas:                                     │
│  • Article 1 title... (link)                                │
│  • Article 2 title... (link)                                │
│  • Article 3 title... (link)                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✏️ ¿Quieres editar algo?                           │   │
│  │  [Textarea editable con el post]                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│           [ 🔄 Generar otra versión ]                       │
│           [ ➕ Nuevo post con otro tema ]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Crear componente `PlaybookResult.tsx` genérico
- [ ] Para LinkedIn: preview estilo LinkedIn real
- [ ] Botones de acción claros: copiar, descargar imagen
- [ ] Mostrar fuentes/referencias usadas
- [ ] Área editable para ajustar el resultado
- [ ] Opción de regenerar o empezar de nuevo
- [ ] Animación celebratoria sutil (confetti opcional, glow)

---

### US-008: Preview Específico por Tipo de Playbook
**Descripción:** Como desarrollador, quiero componentes de preview específicos para cada tipo de output.

**Acceptance Criteria:**
- [ ] Crear `LinkedInPostPreview.tsx` - simula post de LinkedIn
- [ ] Crear `ReportPreview.tsx` - para reportes/análisis
- [ ] Crear `DataTablePreview.tsx` - para datos estructurados
- [ ] El PlaybookConfig define qué preview usar
- [ ] Fallback genérico para playbooks sin preview específico

---

### Fase 5: Micro-interacciones y Polish

---

### US-009: Transiciones Suaves entre Pasos
**Descripción:** Como usuario, quiero transiciones fluidas que me guíen de un paso al siguiente.

**Acceptance Criteria:**
- [ ] Fade out del paso actual, fade in del siguiente
- [ ] Scroll suave si es necesario
- [ ] Animación del NavigationPanel actualizando
- [ ] Sin saltos bruscos ni reloads

---

### US-010: Estados de Error Amigables
**Descripción:** Como usuario, quiero errores explicados de forma clara con opciones de solución.

**Acceptance Criteria:**
- [ ] Mensaje de error sin jerga técnica
- [ ] Explicación de por qué falló
- [ ] Botón "Reintentar" siempre visible
- [ ] Si es error de API key: link directo a configurar
- [ ] Si es error de servicio externo: explicar y sugerir esperar

---

### Fase 6: Responsive y Accesibilidad

---

### US-011: Diseño Responsive para Mobile
**Descripción:** Como usuario mobile, quiero usar playbooks desde mi teléfono.

**Acceptance Criteria:**
- [ ] NavigationPanel se convierte en stepper horizontal compacto en mobile
- [ ] WorkArea ocupa 100% del ancho
- [ ] Botones de acción siempre visibles (sticky bottom)
- [ ] Texto legible sin zoom

---

### US-012: Accesibilidad Básica
**Descripción:** Como usuario, quiero que los playbooks sean accesibles.

**Acceptance Criteria:**
- [ ] Focus visible en todos los elementos interactivos
- [ ] Labels en todos los inputs
- [ ] Anuncios de estado para screen readers
- [ ] Contraste de colores WCAG AA

---

## Arquitectura de Componentes

```
PlaybookShell.tsx
├── PlaybookIntroScreen.tsx      (nuevo - US-001)
├── NavigationPanel.tsx          (rediseño - US-003)
│   └── StepCard.tsx             (nuevo - cards de pasos)
├── WorkArea.tsx
│   ├── InputStep.tsx            (existente)
│   ├── ExecutionProgress.tsx    (nuevo - US-005)
│   └── PlaybookResult.tsx       (nuevo - US-007)
│       ├── LinkedInPostPreview.tsx
│       ├── ReportPreview.tsx
│       └── DataTablePreview.tsx
└── StepTransition.tsx           (nuevo - US-009)
```

## Datos del Config que se usarán

Del `PlaybookConfig`:
- `name`, `description`, `icon` → Intro screen
- `presentation.*` → Todo el onboarding (nuevo)
- `phases[].steps[].guidance` → Descripciones en journey
- `phases[].steps[].executionExplanation` → Progress durante ejecución
- `variables` → Formulario de input

## Prioridad de Implementación

1. **Crítico (Fase 1-2)**: US-001, US-002, US-003 - Cambia la percepción inicial
2. **Alto (Fase 3)**: US-005, US-006 - Mejora la experiencia durante ejecución
3. **Alto (Fase 4)**: US-007, US-008 - El momento de "wow" final
4. **Medio (Fase 5)**: US-009, US-010 - Polish y robustez
5. **Bajo (Fase 6)**: US-011, US-012 - Alcance extendido

## Métricas de Éxito

- Reducción en abandono de playbooks (usuarios que empiezan y no terminan)
- Aumento en playbooks completados por usuario
- Feedback cualitativo positivo sobre la experiencia
- Tiempo promedio para completar playbook (menor confusión = menor tiempo)

## Referencias de Inspiración

- Notion's onboarding y templates
- Linear's smooth transitions
- Figma's collaborative feedback
- Stripe's documentation UX
- Vercel's deployment experience (progreso claro, éxito celebrado)
