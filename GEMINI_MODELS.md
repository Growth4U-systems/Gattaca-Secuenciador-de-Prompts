# Configuración de Modelos Gemini

## Modelo Actual: Gemini 1.5 Pro

Este proyecto ahora usa **`gemini-1.5-pro-002`** (Gemini 1.5 Pro), el modelo de producción estable con límites de cuota más altos para API paga.

**¿Por qué Gemini 1.5 Pro y no 2.0 Flash?**
- ✅ Límites de cuota más altos con API paga (millones de tokens/minuto vs 250K)
- ✅ Mejor para uso en producción con alto volumen
- ✅ Modelo estable y probado
- ✅ Excelente calidad para análisis estratégicos complejos

## Modelos Disponibles

### Gemini Pro (Recomendado para Producción)
- **`gemini-1.5-pro-002`** ✅ - Versión más reciente (ACTUALMENTE CONFIGURADO)
- **`gemini-1.5-pro`** - Versión estándar
- **`gemini-1.5-pro-latest`** - Siempre apunta a la última versión

**Características:**
- Contexto: Hasta 2M tokens
- Salida: Hasta 8,192 tokens
- Mejor calidad y razonamiento
- Ideal para análisis complejos y estratégicos

### Gemini Flash (Alternativa Rápida)
- **`gemini-2.0-flash-exp`** - Experimental, más rápido
- **`gemini-1.5-flash`** - Versión estable rápida
- **`gemini-1.5-flash-002`** - Flash más reciente

**Características:**
- Más rápido y económico
- Buena calidad para tareas simples
- Menos costo por token

### Gemini Thinking (Razonamiento Profundo)
- **`gemini-2.0-flash-thinking-exp-01-21`** - Con razonamiento interno

## Cómo Cambiar de Modelo

### Opción 1: Cambiar Globalmente

Edita estos archivos:

**`supabase/functions/generate-ecp-step/index.ts`** (línea 165):
```typescript
const modelName = 'gemini-1.5-pro-002' // Cambia aquí
```

**`supabase/functions/execute-flow-step/index.ts`** (línea 185):
```typescript
const modelName = step_config.model || 'gemini-1.5-pro-002' // Cambia aquí
```

### Opción 2: Por Paso Individual

Al configurar un step en el flow, puedes especificar el modelo:

```typescript
{
  id: "step_1",
  name: "Análisis Profundo",
  model: "gemini-1.5-pro-002",  // Modelo específico para este paso
  temperature: 0.7,
  max_tokens: 8192,
  // ... otros campos
}
```

### Opción 3: Usar Gemini Flash para Ahorrar Costos

Si quieres reducir costos en pasos simples:

```typescript
const modelName = 'gemini-1.5-flash-002' // Más barato y rápido
```

## Configuración de API Key

Tu API key de Gemini se configura en las variables de entorno:

### Variables de Entorno Soportadas:
- `GEMINI_API_KEY` (recomendado)
- `GOOGLE_API_KEY` (alternativa)

### Dónde Configurar:

#### En Desarrollo Local (.env.local):
```bash
GEMINI_API_KEY=tu-api-key-aquí
```

#### En Supabase Edge Functions:
```bash
supabase secrets set GEMINI_API_KEY=tu-api-key-aquí
```

#### En Vercel:
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega `GEMINI_API_KEY` con tu clave

## Obtener API Key de Google

1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Crea un nuevo API key
3. Copia la clave y configúrala en tus variables de entorno

## Costos Estimados (Gemini 1.5 Pro)

- **Input**: ~$1.25 por 1M tokens
- **Output**: ~$5.00 por 1M tokens

Con 100 campañas/mes usando ~50K tokens promedio:
- Costo mensual: ~$10-30 USD

## Ventajas de Gemini Pro vs Flash

| Característica | Gemini Pro 1.5 | Gemini Flash 1.5 |
|----------------|----------------|------------------|
| Calidad | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Velocidad | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Costo | $$$ | $ |
| Contexto | 2M tokens | 1M tokens |
| Razonamiento | Excelente | Bueno |

## Después de Cambiar el Modelo

1. **Redeploy Edge Functions**:
   ```bash
   supabase functions deploy execute-flow-step
   supabase functions deploy generate-ecp-step
   ```

2. **Verifica el cambio**: El nuevo modelo se usará en la próxima ejecución de campaña

3. **Monitorea resultados**: Los logs mostrarán qué modelo se usó en cada ejecución
