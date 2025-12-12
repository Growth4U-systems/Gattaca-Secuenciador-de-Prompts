# Troubleshooting Guide

## Error: "Internal server error" cuando se crea una campaña

### Causa
Este error ocurre cuando las columnas necesarias no existen en la tabla `ecp_campaigns`. Esto sucede si la migración SQL no se aplicó correctamente en Supabase.

### Diagnóstico

1. **Ve a Supabase Dashboard** → Tu proyecto → **SQL Editor**

2. **Ejecuta el script de verificación:**
```sql
SELECT
    column_name,
    data_type
FROM
    information_schema.columns
WHERE
    table_name = 'ecp_campaigns'
ORDER BY
    ordinal_position;
```

3. **Verifica que existan estas columnas:**
   - ✅ `step_outputs` (jsonb)
   - ✅ `current_step_id` (text)
   - ✅ `started_at` (timestamptz)
   - ✅ `completed_at` (timestamptz)

### Solución

Si esas columnas **NO EXISTEN**, aplica la migración:

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Click en **"New query"**
3. Copia y pega este SQL:

```sql
-- Add flow configuration to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS flow_config JSONB DEFAULT NULL;

-- Add campaign execution tracking columns
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS step_outputs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS current_step_id TEXT;
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE ecp_campaigns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

4. Click en **"Run"** (Ctrl/Cmd + Enter)
5. Verifica que veas: **"Success. No rows returned"**

### Verificación Post-Migración

Intenta crear una campaña nuevamente. Si el error persiste:

1. **Revisa los logs del servidor:**
   - Si usas Vercel: Ve a tu deployment → Logs
   - Si local: Revisa la consola donde corre `npm run dev`

2. **Verifica las variables de entorno:**
   - `NEXT_PUBLIC_SUPABASE_URL` debe estar configurado
   - `SUPABASE_SERVICE_ROLE_KEY` debe estar configurado
   - Ambas deben coincidir con tu proyecto en Supabase

3. **Consulta la consola del navegador:**
   - Abre DevTools (F12)
   - Ve a la pestaña "Console"
   - Busca errores adicionales

---

## Error: "Failed to execute step" al correr campaña

### Causa
La edge function no está desplegada o GEMINI_API_KEY no está configurado.

### Solución

1. **Verifica que la edge function esté desplegada:**
   - Ve a Supabase Dashboard → Edge Functions
   - Busca `execute-flow-step`
   - Si no existe, despliégala desde el dashboard

2. **Configura GEMINI_API_KEY:**
   - Ve a Supabase Dashboard → Edge Functions → Manage secrets
   - Agrega secret: `GEMINI_API_KEY` = tu_api_key
   - Obtén API key en: https://aistudio.google.com/apikey

---

## Error: "Context exceeds token limit"

### Causa
Los documentos seleccionados + outputs de pasos anteriores exceden 2M tokens.

### Solución

1. Ve al tab "Flow Setup"
2. Para cada paso, reduce documentos asignados
3. O divide el análisis en más pasos pequeños
4. Considera usar documentos más cortos

---

## Error: "Campaign not found" al ejecutar

### Causa
La campaña fue eliminada o el ID es incorrecto.

### Solución

1. Recarga la página
2. Verifica que la campaña existe en la lista
3. Si persiste, verifica RLS policies en Supabase

---

## Ayuda Adicional

Si ninguna de estas soluciones funciona:

1. Revisa los logs en Supabase Dashboard → Logs
2. Revisa errores en la consola del navegador (F12)
3. Abre un issue en GitHub con:
   - Mensaje de error completo
   - Logs del servidor
   - Pasos para reproducir el error
