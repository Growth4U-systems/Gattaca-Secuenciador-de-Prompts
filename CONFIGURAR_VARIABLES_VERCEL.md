# Configurar Variables de Entorno en Vercel

## Error: "Server configuration error"

Este error indica que faltan las variables de entorno de Supabase en tu deployment de Vercel.

## 🔧 Solución: Configurar Variables en Vercel

### **Paso 1: Obtener las Credenciales de Supabase**

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **API**
4. Copia estos valores:
   - **Project URL** (ej: `https://xxxxx.supabase.co`)
   - **anon/public key** (empieza con `eyJhbGc...`)
   - **service_role key** (⚠️ secreto, empieza con `eyJhbGc...`)

### **Paso 2: Agregar Variables en Vercel**

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega estas 3 variables:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` (anon key) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` (service_role) | Production, Preview, Development |

**IMPORTANTE**:
- ✅ Marca las 3 checkboxes (Production, Preview, Development)
- ⚠️ El `SUPABASE_SERVICE_ROLE_KEY` es secreto, NUNCA lo expongas en el cliente

### **Paso 3: Redeploy**

Después de agregar las variables:

1. Ve a **Deployments**
2. Click en los 3 puntos ⋮ del último deployment
3. Click en **"Redeploy"**

O simplemente:
```bash
git commit --allow-empty -m "Trigger redeploy"
git push
```

---

## ✅ Verificación

Después del redeploy, intenta subir un archivo. Si las variables están bien configuradas, debería funcionar.

### **Si sigue fallando:**

Revisa los logs:
1. Vercel Dashboard → Deployments → Tu deployment → **Functions**
2. Busca logs de `/api/documents/process-blob`
3. Deberías ver:
   ```
   Environment check: { hasUrl: true, hasKey: true, ... }
   ```

Si ves `hasUrl: false` o `hasKey: false`, las variables no se configuraron correctamente.

---

## 📋 Checklist Completo de Variables

Para que el sistema funcione completo, necesitas:

| Variable | Dónde se usa | Requerido |
|----------|--------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente y servidor | ✅ Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente | ✅ Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | ✅ Sí |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | ✅ Sí (auto-generado) |
| `GEMINI_API_KEY` | Edge functions | ✅ Sí (en Supabase) |

---

## 🎯 Configuración Rápida (Copiar y Pegar)

Si tienes `vercel` CLI instalado:

```bash
# Set variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Pega: https://xxxxx.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Pega: eyJhbGc...

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Pega: eyJhbGc...

# Redeploy
vercel --prod
```

---

## 🔍 Troubleshooting

### Error persiste después de configurar variables
- Espera 1-2 minutos después del redeploy
- Verifica que seleccionaste "Production" al agregar las variables
- Limpia cache del navegador (Ctrl+Shift+R)

### No sé cuál es mi Project URL
- Ve a Supabase Dashboard → Settings → API
- Busca "Project URL" en la sección "Config"

### No encuentro el service_role key
- Ve a Supabase Dashboard → Settings → API
- Busca "service_role" en la sección "Project API keys"
- Click en "Reveal" para ver la clave
- ⚠️ Guárdala de forma segura

---

## ✨ Después de Configurar

Una vez configuradas las variables, el flujo completo funcionará:

```
Archivo > 4MB
  ↓
Upload a Vercel Blob ✅
  ↓
Process blob ✅ (ahora tiene las credenciales)
  ↓
Guarda en Supabase ✅
  ↓
¡Listo!
```
