# Plan de Integración: OpenRouter OAuth

## Resumen

Integrar OpenRouter como único proveedor de modelos AI, reemplazando las llamadas directas a Gemini, OpenAI y Anthropic. Cada usuario autorizará su propia cuenta de OpenRouter mediante OAuth PKCE.

---

## Arquitectura Actual

- **Auth**: Supabase Auth con Context API (`src/lib/auth-context.tsx`)
- **AI Providers**: Edge Function llama directamente a Gemini/OpenAI/Anthropic con API keys del servidor
- **Edge Function**: `supabase/functions/execute-flow-step/index.ts`
- **Tipos de modelos**: `src/types/flow.types.ts`

---

## Fase 1: Base de Datos

### 1.1 Crear migración para tokens OAuth

**Archivo**: `supabase/migrations/20251224000001_add_openrouter_tokens.sql`

```sql
CREATE TABLE user_openrouter_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  encrypted_api_key TEXT NOT NULL,
  key_label TEXT,
  key_prefix TEXT,  -- "sk-or-v1-xxx..."
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  -- PKCE temporal
  pending_code_verifier TEXT,
  pending_state TEXT,
  pending_expires_at TIMESTAMPTZ
);

-- RLS: Solo el usuario accede a su token
ALTER TABLE user_openrouter_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tokens" ON user_openrouter_tokens
  FOR ALL USING (auth.uid() = user_id);
```

---

## Fase 2: OAuth Flow (Backend)

### 2.1 API Routes nuevas

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/openrouter/initiate` | POST | Genera PKCE y redirige a OpenRouter |
| `/api/openrouter/callback` | GET | Recibe code, intercambia por API key |
| `/api/openrouter/status` | GET | Verifica si usuario tiene token |
| `/api/openrouter/disconnect` | POST | Elimina token del usuario |
| `/api/openrouter/models` | GET | Obtiene modelos disponibles |

### 2.2 Flujo OAuth PKCE

```
1. Usuario click "Conectar OpenRouter"
2. POST /api/openrouter/initiate
   - Genera code_verifier (random 32 bytes)
   - Genera code_challenge = SHA256(code_verifier)
   - Guarda en DB con expires_at (+10 min)
   - Redirige a https://openrouter.ai/auth?callback_url=...&code_challenge=...

3. Usuario autoriza en OpenRouter
4. OpenRouter redirige a /api/openrouter/callback?code=...

5. GET /api/openrouter/callback
   - Valida state
   - POST https://openrouter.ai/api/v1/auth/keys con code + code_verifier
   - Recibe API key del usuario
   - Encripta y guarda en DB
   - Redirige a app con success
```

### 2.3 Encriptación de tokens

**Archivo**: `src/lib/encryption.ts`

- Usar AES-256-GCM con `ENCRYPTION_KEY` de env
- Funciones: `encryptToken()`, `decryptToken()`

---

## Fase 3: Context y Estado (Frontend)

### 3.1 OpenRouterContext

**Archivo**: `src/lib/openrouter-context.tsx`

```typescript
interface OpenRouterContextType {
  isConnected: boolean
  isLoading: boolean
  tokenInfo: { keyPrefix: string; lastUsedAt: string } | null
  initiateOAuth: () => Promise<void>
  disconnect: () => Promise<void>
  refreshStatus: () => Promise<void>
}
```

### 3.2 Integrar en providers

**Modificar**: `src/app/layout.tsx`

```tsx
<AuthProvider>
  <OpenRouterProvider>
    <UIProviders>
      {children}
    </UIProviders>
  </OpenRouterProvider>
</AuthProvider>
```

---

## Fase 4: Componentes UI

### 4.1 Indicador de estado en Header

**Archivo**: `src/components/openrouter/OpenRouterStatusBadge.tsx`

Badge compacto que muestra estado:
- Si no conectado: Icono de link con punto rojo + tooltip "OpenRouter no conectado"
- Si conectado: Icono de link con punto verde + tooltip con prefijo del key

**Modificar**: `src/components/Header.tsx`
- Agregar `<OpenRouterStatusBadge />` antes de NotificationBell
- En el dropdown del usuario, agregar sección "OpenRouter" con:
  - Si no conectado: Botón "Conectar OpenRouter"
  - Si conectado: Info del key + Botón "Desconectar"

### 4.2 Modal de autorización

**Archivo**: `src/components/openrouter/OpenRouterAuthModal.tsx`

Mostrar cuando:
1. Usuario inicia sesión y no tiene token → trigger: `login`
2. Usuario intenta ejecutar AI sin token → trigger: `action`

Contenido:
- Explicación de beneficios (100+ modelos, control de costos)
- Botón "Conectar con OpenRouter"
- Link para crear cuenta
- Opción "Configurar más tarde" (solo en login)

### 4.3 Lógica de mostrar modal

**Modificar**: `src/app/page.tsx` o layout principal
- Detectar query param `?openrouter_success=true` o `?openrouter_error=...`
- Si usuario autenticado y sin token, mostrar modal después de 2 segundos

---

## Fase 5: Interceptar Acciones AI

### 5.1 Verificar antes de ejecutar

**Modificar**: `src/components/campaign/CampaignRunner.tsx`

```typescript
const { isConnected: hasOpenRouter } = useOpenRouter()
const [showOpenRouterModal, setShowOpenRouterModal] = useState(false)

const handleRunStep = async (...) => {
  if (!hasOpenRouter) {
    setShowOpenRouterModal(true)
    return  // No ejecutar
  }
  // ... continuar con ejecución
}
```

---

## Fase 6: Modificar Edge Function

### 6.1 Agregar función callOpenRouter

**Modificar**: `supabase/functions/execute-flow-step/index.ts`

```typescript
async function callOpenRouter(
  userApiKey: string,
  model: string,
  systemPrompt: string,
  context: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number
): Promise<LLMResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userApiKey}`,
      'HTTP-Referer': process.env.APP_URL,
      'X-Title': 'Gatacca',
    },
    body: JSON.stringify({
      model,  // Ej: "openai/gpt-4o", "anthropic/claude-3.5-sonnet"
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${context}\n\n--- TASK ---\n\n${userPrompt}` },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })
  // ... parsear respuesta
}
```

### 6.2 Obtener token del usuario

**Modificar**: `src/app/api/campaign/run-step/route.ts`
- Pasar `user_id: session.user.id` en el body a la Edge Function

**Modificar**: `supabase/functions/execute-flow-step/index.ts`
- Recibir `user_id` en request
- Consultar `user_openrouter_tokens` para obtener `encrypted_api_key`
- Desencriptar con función compartida
- Usar para llamar a OpenRouter

### 6.3 Reemplazar llamadas directas

Eliminar funciones:
- `callGemini()`
- `callOpenAI()`
- `callAnthropic()`

Reemplazar por `callOpenRouter()` unificado.

**Nota sobre Deep Research**: Este modelo usa la Interactions API de Google directamente, no está disponible en OpenRouter. Mantener lógica separada o deshabilitar temporalmente.

---

## Fase 7: Selector de Modelos Dinámico

### 7.1 API para obtener modelos

**Archivo**: `src/app/api/openrouter/models/route.ts`

```typescript
// Obtener token del usuario
// Llamar a https://openrouter.ai/api/v1/models
// Filtrar modelos text->text
// Retornar lista formateada
```

### 7.2 Nuevo selector de modelos

**Archivo**: `src/components/openrouter/OpenRouterModelSelector.tsx`

- Cargar modelos desde `/api/openrouter/models`
- Agrupar por proveedor (openai, anthropic, google, meta, etc.)
- Mostrar contexto y pricing
- Si no conectado: mensaje "Conecta OpenRouter para ver modelos"

### 7.3 Actualizar StepEditor

**Modificar**: `src/components/campaign/flow/StepEditor.tsx`

Reemplazar select estático de modelos por `<OpenRouterModelSelector />`

### 7.4 Actualizar tipos

**Modificar**: `src/types/flow.types.ts`

```typescript
// Cambiar de tipos estáticos a string genérico
export type LLMModel = string  // ID de OpenRouter: "openai/gpt-4o"

// Mantener LLMProvider para compatibilidad, pero será derivado del ID
```

---

## Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `supabase/migrations/20251224000001_add_openrouter_tokens.sql` | Tabla de tokens |
| `src/lib/openrouter-context.tsx` | Context de estado |
| `src/lib/encryption.ts` | Funciones de encriptación |
| `src/app/api/openrouter/initiate/route.ts` | Iniciar OAuth |
| `src/app/api/openrouter/callback/route.ts` | Callback OAuth |
| `src/app/api/openrouter/status/route.ts` | Estado de conexión |
| `src/app/api/openrouter/disconnect/route.ts` | Desconectar |
| `src/app/api/openrouter/models/route.ts` | Listar modelos |
| `src/components/openrouter/OpenRouterStatusBadge.tsx` | Badge en header |
| `src/components/openrouter/OpenRouterAuthModal.tsx` | Modal autorización |
| `src/components/openrouter/OpenRouterModelSelector.tsx` | Selector modelos |

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/app/layout.tsx` | Agregar OpenRouterProvider |
| `src/components/Header.tsx` | Agregar OpenRouterConnectButton |
| `src/components/campaign/CampaignRunner.tsx` | Verificar token antes de ejecutar |
| `src/app/api/campaign/run-step/route.ts` | Pasar user_id a Edge Function |
| `supabase/functions/execute-flow-step/index.ts` | Usar OpenRouter API |
| `src/components/campaign/flow/StepEditor.tsx` | Usar nuevo selector |
| `src/types/flow.types.ts` | Actualizar tipos de modelos |

---

## Variables de Entorno Nuevas

```env
# Encriptación de tokens (generar con: openssl rand -hex 32)
ENCRYPTION_KEY=<64-char-hex-string>

# URL de la app para callbacks
NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app
```

## Variables de Entorno a Eliminar (después de migrar)

```env
GEMINI_API_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
```

---

## Orden de Implementación

1. **DB**: Crear migración y aplicar
2. **Encryption**: Crear utilidades de encriptación
3. **API Routes**: initiate, callback, status, disconnect
4. **Context**: OpenRouterContext + Provider
5. **UI**: ConnectButton, AuthModal
6. **Header**: Integrar botón
7. **Modal en login**: Detectar usuario sin token
8. **Edge Function**: Agregar callOpenRouter, obtener token
9. **Interceptar**: Verificar en CampaignRunner
10. **Models API**: Endpoint para listar modelos
11. **Selector**: Componente dinámico
12. **StepEditor**: Usar nuevo selector
13. **Limpieza**: Eliminar funciones y keys antiguas

---

## Decisiones del Usuario

### Deep Research
**Decisión**: Deshabilitar temporalmente
- Ocultar el modelo `deep-research-pro-preview-12-2025` del selector
- Eliminar lógica de Deep Research de la Edge Function
- Puede reactivarse en el futuro si OpenRouter lo soporta

### Ubicación del Botón OpenRouter
**Decisión**: Ambos lugares
- Badge de estado en el header (antes de notificaciones)
- Opción de gestión completa en el dropdown del usuario (conectar/desconectar)

### Modal de Autorización al Login
**Decisión**: Opcional (puede saltar)
- Mostrar modal después del login si no tiene token
- Incluir botón "Configurar más tarde"
- El modal será obligatorio solo al intentar ejecutar una acción AI

---

## Consideraciones de Seguridad
- Tokens encriptados en reposo (AES-256-GCM)
- PKCE para OAuth (previene CSRF)
- RLS en tabla de tokens
- Tokens nunca expuestos al frontend

### UX
- Modal no-bloqueante en login (puede saltarse)
- Modal bloqueante al intentar acción AI
- Feedback claro de estado conectado/desconectado
- Manejo de errores de OAuth

---

## TODOs Pendientes

### 1. Testear funcionamiento de todos los lugares donde se usa algún modelo de AI
**Prioridad**: Alta
**Estado**: Pendiente (requiere testing manual)
**Descripción**: Validación exhaustiva de que la integración con OpenRouter funciona correctamente en todos los puntos de la aplicación que usan modelos de AI.

**Puntos de integración identificados**:

| Componente | Función | API | Test |
|-----------|---------|-----|------|
| `execute-flow-step` | `executeModel()` | OpenRouter | Token decrypt, modelo selection |
| `execute-flow-step` | `callOpenRouter()` | OpenRouter | Mapeo de modelos, errores API |
| `execute-flow-step` | `callDeepResearch()` | Google Interactions | Creación async, polling |
| `poll-deep-research` | Estado extraction | Google API | Estados, thinking summaries |
| `run-step` | Orquestación | Edge Function | Timeout, retry, feedback |
| `openrouter/models` | Lista dinámica | OpenRouter | Filtrado, pricing, autenticación |
| `openrouter/callback` | OAuth | OpenRouter API | Token exchange, encriptación |
| `StepEditor` | Selector UI | OpenRouter | Carga, búsqueda, rendering |
| `campaign/suggest-edit` | Edición AI | Gemini (directo) | Edición parcial, estructura |

**Checklist de testing manual**:
- [ ] Ejecutar un paso con modelo de OpenAI vía OpenRouter
- [ ] Ejecutar un paso con modelo de Anthropic vía OpenRouter
- [ ] Ejecutar un paso con modelo de Google vía OpenRouter
- [ ] Probar Deep Research (usa Google API directa, no OpenRouter)
- [ ] Verificar manejo de errores cuando OpenRouter falla
- [ ] Verificar comportamiento cuando el token expira
- [ ] Probar retry con modelo alternativo (fallback)
- [ ] Probar la edición AI asistida (`suggest-edit` usa Gemini directo)
- [ ] Verificar el selector de modelos dinámico carga correctamente

### 2. Guardar modelo seleccionado en configuración del flujo
**Prioridad**: Alta
**Estado**: Pendiente
**Descripción**: Cuando el usuario selecciona un modelo en el `StepEditor` usando `OpenRouterModelSelector`, el cambio no se persiste en la base de datos. El modelo debería guardarse en `flow_config.steps[].model`.

**Archivos afectados**:
- `src/components/campaign/flow/StepEditor.tsx` - El selector de modelo debe llamar a la función de guardado
- `src/components/campaign/flow/FlowEditor.tsx` - Debe tener la lógica para actualizar el paso y guardar en DB

**Implementación sugerida**:
1. Asegurar que `StepEditor` propague el cambio de modelo al padre (`FlowEditor`)
2. `FlowEditor` debe llamar a `updateStep()` o similar cuando cambia el modelo
3. El cambio debe persistirse en `ecp_campaigns.flow_config` o `projects.flow_config` según corresponda

**Nota**: Verificar que el selector de modelo en el modal de ejecución (que permite override temporal) siga funcionando independientemente del modelo guardado en la configuración.

