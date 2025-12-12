# Diagnóstico de Problemas de Upload

## Error: "Unexpected token 'R', Request En... is not valid JSON"

Este error indica que el servidor está retornando HTML/texto plano en lugar de JSON, típicamente un error 413 (Request Entity Too Large) o 502 (Bad Gateway).

## 🔍 Paso 1: Información Necesaria

**Por favor responde estas preguntas:**

1. **¿Dónde estás testeando?**
   - [ ] Local (`npm run dev`)
   - [ ] Vercel producción (deployed)
   - [ ] Otro (Railway, Fly.io, etc)

2. **¿Qué tamaño tiene el archivo que intentas subir?**
   - Ejemplo: 500KB, 2MB, 10MB

3. **¿Qué tipo de archivo es?**
   - [ ] PDF
   - [ ] DOCX
   - [ ] TXT

4. **¿El error ocurre...?**
   - [ ] Inmediatamente (< 1 segundo)
   - [ ] Después de unos segundos
   - [ ] Después de que la barra de progreso avanza

## 🧪 Paso 2: Test con Endpoint Simple

Prueba con este endpoint de diagnóstico que acabo de crear:

### Test desde terminal:

```bash
# Crear un archivo de test pequeño (1KB)
echo "Test content for upload diagnosis" > test.txt

# Test el endpoint (reemplaza con tu URL de Vercel)
curl -X POST https://tu-app.vercel.app/api/test-upload \
  -F "file=@test.txt" \
  -v
```

### Test desde el navegador:

1. Abre tu app en producción
2. Abre DevTools (F12) → Console
3. Ejecuta:

```javascript
// Crear archivo pequeño de test
const testFile = new File(['Test content'], 'test.txt', { type: 'text/plain' })
const formData = new FormData()
formData.append('file', testFile)

// Test con archivo de 1KB
fetch('/api/test-upload', {
  method: 'POST',
  body: formData
})
  .then(r => r.json())
  .then(data => console.log('✅ Result:', data))
  .catch(err => console.error('❌ Error:', err))
```

**¿Qué resultado obtuviste?**
- ✅ Success → El endpoint funciona, el problema es el tamaño
- ❌ Error → Hay un problema de configuración más profundo

## 🔧 Paso 3: Diagnóstico por Ambiente

### Si estás en LOCAL (`npm run dev`):

**Problema común:** Next.js dev server puede tener límites diferentes.

**Solución:**
```bash
# Detener servidor
# Ctrl+C

# Reiniciar con variables
NODE_OPTIONS="--max-http-header-size=16384" npm run dev
```

### Si estás en VERCEL PRODUCCIÓN:

**Problema común:** Límite de 4.5MB en funciones serverless.

**Verificar:**
1. Ve a Vercel Dashboard → Tu proyecto → **Deployments**
2. Click en el último deployment → **Functions**
3. Busca errores en los logs

**Soluciones según tamaño:**

| Tamaño | Solución |
|--------|----------|
| < 1MB  | Debería funcionar - revisar configuración |
| 1-4MB  | Puede funcionar - depende de overhead |
| > 4MB  | **REQUIERE Vercel Blob** (obligatorio) |

## 🚨 Paso 4: Soluciones Alternativas

### Opción A: Vercel Blob (Recomendado para > 4MB)

Ya está implementado. Solo necesitas:

1. Vercel Dashboard → Storage → Create Blob Store
2. Nombre: `ecp-documents`
3. Redeploy tu app

**Automático:** Archivos > 4MB usarán Blob automáticamente.

### Opción B: Comprimir PDFs antes de subir

```bash
# Usar herramientas online:
# - https://www.ilovepdf.com/compress_pdf
# - https://smallpdf.com/compress-pdf

# O desde terminal con ghostscript:
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 \
   -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile=output.pdf input.pdf
```

### Opción C: Convertir a TXT primero

```bash
# Extraer texto del PDF localmente
# Luego subir solo el .txt (mucho más pequeño)

# Con pdftotext:
pdftotext documento.pdf documento.txt

# Resultado: PDF 10MB → TXT 200KB
```

### Opción D: Supabase Storage (No requiere Vercel Blob)

Si no quieres usar Vercel Blob, puedo implementar upload directo a Supabase Storage:

**Ventajas:**
- Sin límites de Vercel
- Funciona en cualquier hosting
- Gratis hasta 100GB

**Requiere:**
- Modificar código (30 minutos)

## 📊 Paso 5: Verificar Logs

### Vercel Logs:
```bash
vercel logs --follow
```

O en Dashboard:
1. Deployments → Latest → View Function Logs
2. Busca errores con "upload" o "413"

### Browser DevTools:
1. F12 → Network tab
2. Intenta subir archivo
3. Click en la request que falla
4. Ve a "Response" → ¿Qué dice?

## 💡 Paso 6: Reportar Resultados

**Comparte esta información:**

1. Ambiente: Local / Vercel / Otro
2. Tamaño archivo: X MB
3. Resultado test-upload: ✅ / ❌
4. Logs de error (si los hay)
5. Response del navegador (Network tab)

Con esto puedo darte una solución exacta para tu caso específico.

---

## ⚡ Quick Fix Temporal

**Mientras diagnosticamos, usa archivos < 1MB:**

1. Comprime tus PDFs
2. O convierte a TXT
3. O divide en documentos más pequeños

Esto te permite seguir trabajando mientras solucionamos el problema raíz.
