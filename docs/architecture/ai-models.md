# Configuración de Modelos Gemini

## Modelo Actual: Gemini 2.5 Pro

Este proyecto ahora usa **`gemini-2.5-pro-002`** (Gemini 2.5 Pro), el modelo de máxima calidad de Google (2025).

**¿Por qué Gemini 2.5 Pro?**
- ✅ Modelo de MÁXIMA CALIDAD de la familia Gemini (2025)
- ✅ #1 en benchmarks: GPQA, AIME 2025, USAMO
- ✅ Mejor para análisis estratégicos complejos
- ✅ Capacidades de thinking avanzadas
- ✅ Contexto de 1 millón de tokens
- ✅ Límites de cuota altos para API paga

## Modelos Disponibles (2025)

### Gemini 2.5 (Más Recientes - Recomendados)
- **`gemini-2.5-pro-002`** ✅ - Pro más reciente - MÁXIMA CALIDAD (ACTUALMENTE CONFIGURADO)
- **`gemini-2.5-flash-002`** - Flash más reciente (más rápido y económico)
- **`gemini-2.5-flash-lite`** - Versión ligera (menor latencia, más económico)

### Gemini 2.0
- **`gemini-2.0-flash-exp`** - Experimental (límites de cuota bajos)
- **`gemini-2.0-flash-thinking-exp`** - Con razonamiento profundo

### Gemini 1.5 (Anteriores)
- **`gemini-1.5-pro-002`** - Pro estable anterior
- **`gemini-1.5-pro`** - Versión estándar
- **`gemini-1.5-flash-002`** - Flash anterior

**Características de Gemini 2.5:**
- **Contexto**: 1 millón de tokens
- **Salida**: Hasta 8,192 tokens
- **Thinking**: Capacidades de razonamiento avanzado
- **Agentic**: Mejor uso de herramientas y agentes
- **Formateo**: Mejoras en headers, listas y tablas
- **Benchmarks**: Top en GPQA, AIME 2025, SWE-Bench

**Comparación de Modelos Gemini 2.5:**

| Característica | 2.5 Flash | 2.5 Pro | 2.5 Flash-Lite |
|----------------|-----------|---------|----------------|
| Calidad | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Velocidad | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Costo | $$ | $$$$ | $ |
| Uso recomendado | General | Análisis complejos | Alto volumen |

## Cómo Cambiar de Modelo

### Opción 1: Cambiar Globalmente

Edita estos archivos:

**`supabase/functions/generate-ecp-step/index.ts`** (línea 165):
```typescript
const modelName = 'gemini-2.5-pro-002' // Cambia aquí
// Opciones: 'gemini-2.5-flash-002' (más rápido), 'gemini-2.5-flash-lite' (más barato)
```

**`supabase/functions/execute-flow-step/index.ts`** (línea 185):
```typescript
const modelName = step_config.model || 'gemini-2.5-pro-002' // Cambia aquí
// Opciones: 'gemini-2.5-flash-002' (más rápido), 'gemini-2.5-flash-lite' (más barato)
```

### Opción 2: Por Paso Individual

Al configurar un step en el flow, puedes especificar el modelo:

```typescript
{
  id: "step_1",
  name: "Análisis Profundo",
  model: "gemini-2.5-pro-002",  // Usa Pro para análisis complejos
  temperature: 0.7,
  max_tokens: 8192,
  // ... otros campos
}

{
  id: "step_2",
  name: "Resumen Rápido",
  model: "gemini-2.5-flash-lite",  // Usa Lite para tareas simples
  temperature: 0.7,
  max_tokens: 4096,
  // ... otros campos
}
```

### Opción 3: Usar Gemini 2.5 Pro para Máxima Calidad

Para análisis estratégicos complejos que requieren el mejor razonamiento:

```typescript
const modelName = 'gemini-2.5-pro-002' // Mejor calidad, más caro
```

## Configuración de API Key

Tu API key de Gemini se configura en las variables de entorno:

### Variables de Entorno Soportadas:
- `GEMINI_API_KEY` (recomendado)
- `GOOGLE_API_KEY` (alternativa)

### Dónde Configurar:

#### En Desarrollo Local (.env):
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

## Costos Estimados (Gemini 2.5)

### Gemini 2.5 Flash (Recomendado)
- **Input**: ~$0.075 por 1M tokens (hasta 128K contexto)
- **Output**: ~$0.30 por 1M tokens
- Muy económico para alto volumen

### Gemini 2.5 Pro (Máxima Calidad)
- **Input**: ~$1.25 por 1M tokens (hasta 128K contexto)
- **Output**: ~$5.00 por 1M tokens
- Para análisis que requieren la mejor calidad

### Gemini 2.5 Flash-Lite (Más Económico)
- **Menor costo** que Flash regular
- Optimizado para **alto volumen** y **baja latencia**

**Estimación con 100 campañas/mes:**
- Con 2.5 Flash: ~$5-15 USD/mes
- Con 2.5 Pro: ~$20-40 USD/mes
- Con 2.5 Flash-Lite: ~$2-8 USD/mes

## Ventajas de Gemini 2.5 vs Versiones Anteriores

| Característica | Gemini 2.5 Flash | Gemini 2.5 Pro | Gemini 1.5 Pro |
|----------------|------------------|----------------|----------------|
| Calidad | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Velocidad | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Costo | $ | $$$ | $$$ |
| Contexto | 1M tokens | 1M tokens | 2M tokens |
| Razonamiento | Excelente (2025) | Superior (2025) | Excelente |
| Thinking | ✅ Sí | ✅ Sí (Deep Think) | Limitado |
| Agentic | ✅ Mejorado | ✅ Avanzado | Básico |

## Después de Cambiar el Modelo

1. **Redeploy Edge Functions**:
   ```bash
   supabase functions deploy execute-flow-step
   supabase functions deploy generate-ecp-step
   ```

2. **Verifica el cambio**: El nuevo modelo se usará en la próxima ejecución de campaña

3. **Monitorea resultados**: Los logs mostrarán qué modelo se usó en cada ejecución
