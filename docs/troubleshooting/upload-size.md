# Error: "Request Entity Too Large" al Subir Documentos

## Problema
Cuando intentas subir documentos (single o bulk), obtienes el error:
```
❌ Error al procesar archivos: Unexpected token 'R', "Request En"... is not valid JSON
```

Este error ocurre porque el servidor rechaza archivos grandes antes de que lleguen al código de Next.js.

## Causa
- **Next.js App Router** tiene un límite de body size que no se puede configurar fácilmente
- **Vercel** tiene un límite de 4.5MB para function payloads
- **Local dev server** puede tener límites de memoria/buffer

## Soluciones

### Solución 1: Usar Vercel Blob (Recomendado para producción)

Si estás en Vercel, usa Vercel Blob para subir archivos directamente:

1. Instala `@vercel/blob`:
```bash
npm install @vercel/blob
```

2. Configura en dashboard de Vercel: Settings > Storage > Create Blob Store

3. Actualiza el componente de upload para usar Blob:
```typescript
// Upload directo a Vercel Blob, luego procesa en backend
const blob = await upload(file.name, file, {
  access: 'public',
  handleUploadUrl: '/api/documents/upload-blob',
});
```

### Solución 2: Limitar Tamaño de Archivos (Temporal)

Reduce el límite máximo en los componentes de upload:

**Actual**: 50MB
**Temporal**: 10MB (más confiable)

Edita estos archivos:
- `src/app/api/documents/upload/route.ts` → línea 27: `const MAX_SIZE = 10 * 1024 * 1024`
- `src/app/api/documents/extract/route.ts` → línea 56: `const MAX_SIZE = 10 * 1024 * 1024`
- `src/components/documents/DocumentUpload.tsx` → añade validación client-side

### Solución 3: Deploy en Plataforma con Límites Mayores

Si no usas Vercel, considera:
- **Railway**: Límites más flexibles
- **Fly.io**: Configurable
- **Self-hosted con Nginx**: Control total

Configuración Nginx:
```nginx
client_max_body_size 50M;
```

### Solución 4: Chunked Upload (Complejo pero robusto)

Implementa subida en chunks:
1. Divide archivo en chunks de 2MB
2. Sube cada chunk por separado
3. Backend reconstruye el archivo

---

## Workaround Inmediato

**Mientras implementas una solución permanente:**

1. **Reduce tamaño de archivos**:
   - Usa archivos PDF optimizados (comprímelos)
   - Limita a 5-10MB por archivo

2. **Sube de a uno**:
   - Evita bulk upload temporalmente
   - Usa upload individual

3. **Extrae texto antes de subir**:
   - Usa herramientas externas para convertir PDF → TXT
   - Sube archivos .txt directamente (más pequeños)

---

## Para Debugging

Agrega estos logs en el componente de upload:

```typescript
console.log('File size:', file.size / 1024 / 1024, 'MB')
console.log('File type:', file.type)

// Antes de fetch
console.log('Uploading...')

// En catch
console.log('Full error:', error)
console.log('Response status:', response.status)
console.log('Response text:', await response.text())
```

Esto te ayudará a ver exactamente dónde falla el upload.

---

## Recomendación Final

Para un MVP rápido: **Solución 2** (limitar a 10MB)
Para producción: **Solución 1** (Vercel Blob) o **Solución 3** (plataforma diferente)
