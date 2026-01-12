# Gattaca - Visión del Producto

> Documento vivo que define qué es Gattaca, para quién es, y cómo funciona conceptualmente.

---

## ¿Qué es Gattaca?

Gattaca es un **orquestador de prompts** que permite generar contenido de alta calidad usando IA, manteniendo consistencia de marca a través de un sistema de contexto estructurado.

---

## ¿Para quién es?

### Usuario Principal
- **Agencias de marketing** que generan contenido para múltiples clientes
- **Equipos de contenido** que necesitan escalar producción manteniendo calidad
- **Consultores** que crean estrategias y materiales para clientes

### Problema que resuelve
- La IA genera contenido genérico si no tiene contexto de marca
- Mantener consistencia es difícil cuando hay múltiples personas/herramientas
- Cada nuevo contenido requiere re-explicar el contexto desde cero

---

## Arquitectura Conceptual

```
┌─────────────────────────────────────────────────────────┐
│                        AGENCIA                          │
│  (Growth4U, etc.)                                       │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │    CLIENTE A    │  │    CLIENTE B    │   ...        │
│  │                 │  │                 │              │
│  │  ┌───────────┐  │  │  ┌───────────┐  │              │
│  │  │  CONTEXT  │  │  │  │  CONTEXT  │  │              │
│  │  │   LAKE    │  │  │  │   LAKE    │  │              │
│  │  │           │  │  │  │           │  │              │
│  │  │ T1: Cim.  │  │  │  │ T1: Cim.  │  │              │
│  │  │ T2: Estr. │  │  │  │ T2: Estr. │  │              │
│  │  │ T3: Asset │  │  │  │ T3: Asset │  │              │
│  │  └───────────┘  │  │  └───────────┘  │              │
│  │                 │  │                 │              │
│  │  └─ Proyectos   │  │  └─ Proyectos   │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  PLAYBOOKS                       │   │
│  │  (Compartidos a nivel agencia)                   │   │
│  │                                                  │   │
│  │  • Viral Video Generator                         │   │
│  │  • LinkedIn Post Series                          │   │
│  │  • Competitor Analysis                           │   │
│  │  • Brand DNA Generator                           │   │
│  │  • ...                                           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Sistema de Tiers (Context Lake)

Los documentos se organizan en 3 niveles que representan un **flujo de digestión**:

| Tier | Nombre | Descripción | Ejemplos |
|------|--------|-------------|----------|
| **1** | **Cimientos** | Los fundamentos sobre los que se construye todo | Brand DNA, ICP, Tone of Voice, Producto, Pricing |
| **2** | **Estrategia** | Documentos derivados/procesados de Tier 1 | Briefs de campaña, análisis de competencia, research, estrategias |
| **3** | **Assets** | Contenido final y entregables | Posts, copies, creativos, videos, scripts |

```
Tier 1 (Cimientos)
       ↓ se procesan para crear
Tier 2 (Estrategia)
       ↓ se usan para generar
Tier 3 (Assets)
```

### Flujo de información
- **Tier 1** alimenta a los Playbooks que generan **Tier 2**
- **Tier 1 + Tier 2** alimentan a los Playbooks que generan **Tier 3**
- Los **Assets (Tier 3)** pueden retroalimentar nuevos análisis (Tier 2)

---

## Playbooks

Un Playbook es una **secuencia de prompts** que:
1. Toma contexto del Context Lake
2. Ejecuta pasos en orden (o en paralelo)
3. Genera outputs que pueden guardarse como nuevos documentos

### Anatomía de un Playbook
```
┌─────────────────────────────────────────┐
│  PLAYBOOK: "Viral Video Generator"      │
├─────────────────────────────────────────┤
│                                         │
│  INPUTS:                                │
│  • Tema/Nicho                           │
│  • Plataforma (TikTok, Reels, etc.)     │
│                                         │
│  CONTEXTO REQUERIDO:                    │
│  • Brand DNA (Tier 1)                   │
│  • Tone of Voice (Tier 1)               │
│  • Análisis de competencia (Tier 2)     │
│                                         │
│  BLOQUES:                               │
│  1. Research de tendencias              │
│  2. Generación de hooks                 │
│  3. Estructura del video                │
│  4. Script completo                     │
│  5. [HITL] Revisión humana              │
│  6. Variaciones                         │
│                                         │
│  OUTPUT:                                │
│  • Script de video (Tier 3)             │
│  • Variaciones de hooks                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## Conceptos Clave

### Context Lake
Base de conocimiento por cliente. Todo documento que se sube o genera vive aquí, clasificado por tier.

### Playbook
Receta reutilizable de prompts. Se crea una vez, se ejecuta muchas veces con diferentes inputs/clientes.

### Ejecución
Instancia de un Playbook corriendo. Tiene estado, puede pausarse para revisión humana (HITL), y genera outputs.

### HITL (Human-in-the-Loop)
Puntos de control donde un humano revisa/aprueba antes de continuar. Esencial para calidad.

---

## Filosofía de UX: Dos Modos de Uso

A diferencia de herramientas como n8n donde el creador del workflow y el usuario final ven la misma interfaz compleja, Gattaca separa claramente dos experiencias:

### Modo Editor (Creador de Playbooks)
- **Quién lo usa:** Agencia, consultores, power users
- **Qué ve:** Editor completo de bloques, configuración de prompts, selección de modelos, definición de inputs
- **Complejidad:** Alta - todas las opciones disponibles
- **Objetivo:** Crear playbooks robustos y reutilizables

### Modo Consumidor (Usuario de Playbooks)
- **Quién lo usa:** Usuarios finales, clientes de la agencia
- **Qué ve:** Formulario simple con los inputs definidos por el creador
- **Complejidad:** Mínima - solo llena campos y ejecuta
- **Objetivo:** Obtener resultados sin entender la mecánica interna

```
┌─────────────────────────────────────────────────────────────┐
│                    MODO EDITOR                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Bloque 1│───▶│ Bloque 2│───▶│  HITL   │───▶│ Bloque 3│  │
│  │ Research│    │ Análisis│    │ Revisión│    │  Output │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│  Prompt: "..."  Prompt: "..."  Config...      Prompt: "..."│
│  Model: GPT-4   Model: Claude  Tipo: Edit     Model: GPT-4 │
│  Temp: 0.7      Temp: 0.3                     Temp: 0.5    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    [Guardar Playbook]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  MODO CONSUMIDOR                            │
│                                                             │
│  📋 Generar Contenido Viral                                 │
│  ─────────────────────────────────────────                  │
│                                                             │
│  Tema:      [________________________]                      │
│  Industria: [________________________]                      │
│  Tono:      [Profesional ▼]                                 │
│                                                             │
│              [▶ Ejecutar]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Principios de Diseño

1. **El usuario no necesita saber qué hay detrás**
   - No ve prompts, no ve modelos, no ve configuraciones técnicas
   - Solo ve inputs relevantes para su caso de uso

2. **Configuración superficial, no estructural**
   - El usuario puede ajustar parámetros de entrada
   - NO puede modificar la secuencia de bloques ni los prompts

3. **Resultados, no procesos**
   - El foco está en el output, no en cómo se genera
   - Progreso visible pero simplificado ("Paso 2 de 4...")

4. **Playbooks como productos**
   - Un playbook bien diseñado es un producto listo para usar
   - La agencia "empaqueta" su expertise en playbooks consumibles

---

## Cadenas de Playbooks: Contenido → Transformación

Los playbooks no operan en aislamiento. Después de generar contenido base, el sistema sugiere **playbooks de transformación** que pueden convertir ese output en diferentes formatos o estilos.

### Tipos de Playbooks

| Tipo | Output | Ejemplo |
|------|--------|---------|
| **Ideación** | Tier 2 (Estrategia) | Brief de video, estructura de campaña, análisis |
| **Transformación** | Tier 3 (Assets) | Convierte un brief en script TikTok, post LinkedIn, etc. |
| **Enricher** | Tier 1/2 | Genera o mejora documentos fundacionales |

### Flujo de Cadenas

```
┌─────────────────────────────────────────────────────────────────┐
│  PLAYBOOK: "Ideación de Contenido Viral"                        │
│  Input: Tema, Industria, Objetivo                               │
│  Output: Brief de contenido (Tier 2)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  "Tu brief está listo. ¿Quieres transformarlo?"                 │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 📱 TikTok    │  │ 💼 LinkedIn  │  │ 📧 Newsletter│          │
│  │ Script Viral │  │ Post Pro     │  │ Email Series │          │
│  │              │  │              │  │              │          │
│  │ [Ejecutar]   │  │ [Ejecutar]   │  │ [Ejecutar]   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 📝 Blog SEO  │  │ 🎬 YouTube   │  │ 📸 Carrusel  │          │
│  │ Artículo     │  │ Script Largo │  │ Instagram    │          │
│  │              │  │              │  │              │          │
│  │ [Ejecutar]   │  │ [Ejecutar]   │  │ [Ejecutar]   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Características de los Playbooks de Transformación

1. **Reciben como input un documento existente**
   - No piden tema/industria desde cero
   - Heredan el contexto del brief original

2. **Aplican reglas específicas del formato**
   - TikTok: hooks de 3 segundos, duración 15-60s, trends
   - LinkedIn: tono profesional, estructura para engagement
   - Blog: SEO, headers, CTAs

3. **Pueden aplicar estilos adicionales**
   - "Hazlo más viral" → Aplica fórmulas de viralidad
   - "Tono educativo" → Reformatea como tutorial
   - "Formato storytelling" → Convierte en narrativa

### Ejemplo de Cadena Completa

```
Usuario: "Quiero contenido sobre productividad para emprendedores"
                    │
                    ▼
        ┌───────────────────────┐
        │ Playbook: Ideación    │
        │ Output: Brief con     │
        │ - 5 hooks virales     │
        │ - Estructura propuesta│
        │ - Puntos clave        │
        └───────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ → TikTok      │       │ → LinkedIn    │
│ Script 30s    │       │ Post + Imagen │
│ con trending  │       │ con CTA       │
│ audio         │       │               │
└───────────────┘       └───────────────┘
        │                       │
        ▼                       ▼
   Tier 3 Asset            Tier 3 Asset
   (Script listo)          (Post listo)
```

### Implementación Sugerida

1. **Tags de compatibilidad**: Los playbooks declaran qué tipo de input aceptan
   ```typescript
   accepts_input_from: ['content_brief', 'video_script', 'campaign_strategy']
   ```

2. **Sugerencias post-ejecución**: Al terminar un playbook, mostrar playbooks compatibles
   ```typescript
   suggested_next: ['tiktok_transformer', 'linkedin_transformer', 'blog_transformer']
   ```

3. **Ejecución en batch**: Opción de ejecutar múltiples transformadores a la vez
   ```
   [✓] TikTok Script
   [✓] LinkedIn Post
   [ ] Blog Article
   [ ] Newsletter

   [Generar 2 seleccionados]
   ```

---

## Ideas y Conceptos Pendientes

<!-- Agrega aquí ideas con fecha para discutir/implementar -->

### [2025-01-12] Sistema de Tiers
- Renombrado: "La Verdad" → "Cimientos", "Operativo" → "Estrategia", "Efímero" → "Assets"
- Los tiers representan flujo de digestión, no inmutabilidad
- Tier 1 puede generarse con IA (ej: Brand DNA Generator)

---

## Preguntas Abiertas

1. ¿Cómo manejar versiones de documentos en el Context Lake?
2. ¿Los Playbooks pueden llamar a otros Playbooks (composición)?
3. ¿Cómo integrar con herramientas externas (Notion, Google Docs)?
4. ¿Sistema de permisos por rol dentro de una agencia?

---

## Documentos Relacionados

- [`ARCHITECTURE_FLOW_BUILDER.md`](../ARCHITECTURE_FLOW_BUILDER.md) - Proceso de convertir flujos externos → Playbooks
- [`MVP_IMPLEMENTATION_PLAN.md`](../MVP_IMPLEMENTATION_PLAN.md) - Plan técnico de implementación
- [`docs/n8n-gattaca.md`](./n8n-gattaca.md) - Integración con n8n
