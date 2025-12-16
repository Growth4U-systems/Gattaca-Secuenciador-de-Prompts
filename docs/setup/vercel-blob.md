# Configuración de Vercel Blob

Vercel Blob permite subir archivos de cualquier tamaño sin límites, evitando los problemas de "Request Entity Too Large".

## Paso 1: Crear Blob Store en Vercel

### Opción A: Via Dashboard (Recomendado)

1. Ve a tu proyecto en Vercel Dashboard: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Storage** en el menú lateral
4. Click en **Create Database**
5. Selecciona **Blob**
6. Click en **Create**
7. Dale un nombre (ej: `ecp-documents`)
8. Click en **Create Store**

Vercel automáticamente agregará las siguientes variables de entorno:
- `BLOB_READ_WRITE_TOKEN`

### Opción B: Via CLI

```bash
# Instala Vercel CLI si no lo tienes
npm i -g vercel

# Login
vercel login

# Link proyecto (si no está linkeado)
vercel link

# Crear Blob store
vercel blob create ecp-documents
```

## Paso 2: Configurar Variables de Entorno

Las variables se configuran automáticamente en producción, pero para desarrollo local:

### Local Development

1. Instala las dependencias:
```bash
npm install @vercel/blob
```

2. Pull las variables de entorno:
```bash
vercel env pull .env
```

Esto creará `.env` con:
```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

3. Agrega también tus otras variables si no las tienes:
```env
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Paso 3: Usar el Nuevo Endpoint

El código ya está listo en `/api/documents/upload-blob`.

### En el componente DocumentUpload:

Opción 1 - Cambiar URL (más simple):
```typescript
// En src/components/documents/DocumentUpload.tsx
const response = await fetch('/api/documents/upload-blob', {  // <- cambiar aquí
  method: 'POST',
  body: formData,
})
```

Opción 2 - Feature flag (más flexible):
```typescript
const USE_BLOB = true // o process.env.NEXT_PUBLIC_USE_BLOB === 'true'
const endpoint = USE_BLOB ? '/api/documents/upload-blob' : '/api/documents/upload'

const response = await fetch(endpoint, {
  method: 'POST',
  body: formData,
})
```

## Paso 4: Deploy

```bash
# Commit cambios
git add .
git commit -m "feat: Add Vercel Blob support for large files"
git push

# Deploy (si no tienes auto-deploy)
vercel --prod
```

## Flujo Técnico

```
┌─────────────┐
│   Usuario   │
│ sube archivo│
└─────┬───────┘
      │
      ▼
┌─────────────────┐
│  Next.js API    │ /api/documents/upload-blob
│  (sin límite)   │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│  Vercel Blob    │ Almacena archivo temporalmente
│   Storage       │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│ Extrae contenido│ pdf-parse / mammoth
│  (PDF, DOCX)    │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│   Supabase DB   │ Guarda contenido extraído
│                 │
└─────────────────┘
```

## Ventajas

✅ **Sin límites de tamaño**: Sube archivos de 100MB+
✅ **Más rápido**: Upload directo al storage
✅ **Más confiable**: No depende de límites de funciones serverless
✅ **Automático en Vercel**: Configuración mínima

## Desventajas

⚠️ **Solo funciona en Vercel**: No funciona en self-hosting sin configurar storage alternativo
⚠️ **Costos**: Vercel Blob tiene límites en plan gratuito
  - Free: 500MB storage, 500MB bandwidth/mes
  - Pro: 100GB storage, 1TB bandwidth
⚠️ **Requiere configuración**: Necesitas crear Blob store en dashboard

## Alternativas (si no usas Vercel)

### Para otros proveedores:

**Cloudflare R2**:
```bash
npm install @cloudflare/r2
```

**AWS S3**:
```bash
npm install @aws-sdk/client-s3
```

**Supabase Storage**:
```typescript
const supabase = createClient(...)
const { data, error } = await supabase.storage
  .from('documents')
  .upload('file.pdf', file)
```

## Troubleshooting

### Error: "BLOB_READ_WRITE_TOKEN is not defined"
- Asegúrate de haber creado el Blob store
- Ejecuta `vercel env pull .env`
- Reinicia el servidor de desarrollo

### Error: "Blob upload failed"
- Verifica que el proyecto esté linkeado a Vercel
- Verifica límites de tu plan de Vercel
- Revisa logs en Vercel Dashboard

### Archivos muy grandes (>100MB)
- Considera comprimir PDFs antes de subir
- O divide documentos en partes más pequeñas
- Blob soporta hasta 5GB pero puede ser lento

## Límites de Vercel Blob

### Plan Hobby (Free):
- Storage: 500MB
- Bandwidth: 500MB/mes
- Max file size: 5GB

### Plan Pro:
- Storage: 100GB
- Bandwidth: 1TB/mes
- Max file size: 5GB

Ver precios: https://vercel.com/docs/storage/vercel-blob/usage-and-pricing
