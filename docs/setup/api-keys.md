# ⚠️ Configuración Segura de API Key de Google Gemini

## IMPORTANTE: Seguridad de tu API Key

**NUNCA** incluyas tu API key directamente en el código o archivos que se suben a Git.

Si compartiste tu API key accidentalmente:
1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Elimina la clave comprometida
3. Genera una nueva API key
4. Configúrala de manera segura siguiendo esta guía

---

## Paso 1: Obtener tu API Key

1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Click en **"Create API Key"** o **"Get API Key"**
4. Copia la clave generada (empieza con `AIza...`)
5. **NO la compartas públicamente**

---

## Paso 2: Configurar en Supabase (Para Edge Functions)

### Opción A: Usando Supabase CLI

```bash
# Configura la API key como secret en Supabase
supabase secrets set GEMINI_API_KEY=AIzaSy...tu-api-key-aqui...

# Verifica que se configuró
supabase secrets list
```

### Opción B: Usando Supabase Dashboard

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Click en **"Edge Functions"** en el menú lateral
3. Click en **"Manage secrets"**
4. Agrega:
   - Name: `GEMINI_API_KEY`
   - Value: `AIzaSy...tu-api-key-aqui...`
5. Click en **"Add secret"**

---

## Paso 3: Configurar en Vercel (Para Deployment)

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en **"Settings"**
3. Click en **"Environment Variables"**
4. Agrega una nueva variable:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `AIzaSy...tu-api-key-aqui...`
   - **Environments**: Marca Production, Preview, y Development
5. Click en **"Save"**
6. **Redeploy** tu proyecto para que tome efecto

---

## Paso 4: Configurar en Local (.env)

Para desarrollo local:

1. Crea el archivo `.env` en la raíz del proyecto (si no existe)
2. Agrega la siguiente línea:

```bash
GEMINI_API_KEY=AIzaSy...tu-api-key-aqui...
```

3. **IMPORTANTE**: Verifica que `.env` está en `.gitignore`

```bash
# Verifica que .env NO se subirá a Git
cat .gitignore | grep .env
```

---

## Paso 5: Verificar la Configuración

### En Supabase Edge Functions:

```bash
# Despliega las funciones
supabase functions deploy execute-flow-step
supabase functions deploy generate-ecp-step

# Prueba que funcionan
supabase functions invoke execute-flow-step --body '{"test": true}'
```

### En Vercel:

1. Después de configurar la variable de entorno
2. Redeploy tu proyecto
3. Verifica que las campañas funcionan correctamente

---

## Variables de Entorno Soportadas

El sistema busca la API key en este orden:

1. `GEMINI_API_KEY` (recomendado)
2. `GOOGLE_API_KEY` (alternativa)

Puedes usar cualquiera de las dos.

---

## ✅ Checklist de Seguridad

- [ ] API key configurada en Supabase Secrets
- [ ] API key configurada en Vercel Environment Variables
- [ ] API key en `.env` para desarrollo local
- [ ] `.env` está en `.gitignore`
- [ ] NO hay API keys en archivos de código
- [ ] Edge functions redesplegadas
- [ ] Proyecto redesplegado en Vercel

---

## 🔒 Mejores Prácticas

1. **Nunca** hagas commit de API keys en Git
2. **Rota** tus API keys periódicamente
3. **Revoca** inmediatamente cualquier key expuesta
4. Usa **diferentes keys** para desarrollo y producción
5. **Monitorea** el uso de tu API key en Google Cloud Console

---

## 🆘 Si Expusiste tu API Key Accidentalmente

1. **Inmediatamente** ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Elimina** la API key comprometida
3. **Genera** una nueva API key
4. **Configúrala** siguiendo los pasos de esta guía
5. **Verifica** que la nueva key funciona
6. Si hiciste commit de la key en Git, considera reescribir el historial o hacer el repo privado

---

## 📞 Soporte

Si tienes problemas configurando la API key:
- Revisa los logs de Supabase Edge Functions
- Verifica los logs de deployment en Vercel
- Asegúrate de que la API key sea válida en Google AI Studio
