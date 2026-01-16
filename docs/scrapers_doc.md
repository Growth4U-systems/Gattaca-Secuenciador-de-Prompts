# Documentación de Scrapers - Gattaca

Esta documentación contiene los schemas de input exactos para cada actor de Apify y otros servicios de scraping utilizados en Gattaca.

---

## Guía de Desarrollo de Scrapers

### ⚠️ REGLA OBLIGATORIA: Siempre Testear Antes de Habilitar

**NUNCA habilitar un scraper sin testearlo primero.** Todo scraper debe ser probado con datos reales antes de cambiar su status de `'pending'` a `'enabled'` en `ScraperLauncher.tsx`.

### Proceso para Crear/Habilitar un Scraper

#### 1. Verificar el Schema
- Consultar esta documentación para los valores exactos de cada campo
- Verificar el schema en `src/lib/scraperFieldSchemas.ts`
- Verificar el template en `src/lib/scraperTemplates.ts`

#### 2. Testear el Scraper
Ejecutar un test real usando el script de testing:

```bash
# Usar el script de test (requiere APIFY_TOKEN en env)
export APIFY_TOKEN=your_token_here

# Testear App Store Reviews
node scripts/test-scraper.mjs appstore_reviews 5

# Testear Play Store Reviews
node scripts/test-scraper.mjs playstore_reviews 5

# Testear cualquier otro scraper
node scripts/test-scraper.mjs <scraper_type> [max_items]
```

El script automáticamente:
- Usa inputs de prueba predefinidos (Revolut como target)
- Ejecuta el actor de Apify
- Espera a que termine
- Muestra los primeros resultados
- Reporta si el test pasó o falló

**URLs de prueba recomendadas (Revolut):**
| Plataforma | URL de Test |
|------------|-------------|
| App Store | `https://apps.apple.com/es/app/revolut/id932493382` |
| Play Store | `https://play.google.com/store/apps/details?id=com.revolut.revolut` |
| Trustpilot | Dominio: `revolut.com` |
| Instagram | Username: `revolut` |
| TikTok | Profile: `@revolut` |
| LinkedIn | Company: `revolut` |
| YouTube | `https://www.youtube.com/@Revolut` |
| Facebook | `https://www.facebook.com/Revolut` |
| G2 | Product: `revolut-business` |
| Capterra | Company: `revolut` |

#### 3. Verificar el Output
- Confirmar que el job se ejecuta sin errores
- Verificar que los datos retornados tienen el formato esperado
- Guardar un ejemplo del output para referencia

#### 4. Habilitar en la UI
Solo después de un test exitoso:

```typescript
// En src/components/scraper/ScraperLauncher.tsx
// Cambiar de:
{ type: 'appstore_reviews', status: 'pending', category: 'reviews' },
// A:
{ type: 'appstore_reviews', status: 'enabled', category: 'reviews' },
```

#### 5. Documentar el Test
Agregar al Changelog de este documento:
- Fecha del test
- Actor testeado
- URL/input usado
- Resultado (éxito/fallo)

### Archivos Clave del Sistema de Scrapers

| Archivo | Propósito |
|---------|-----------|
| `src/components/scraper/ScraperLauncher.tsx` | UI principal, lista de scrapers habilitados |
| `src/lib/scraperFieldSchemas.ts` | Definición de campos, validación, opciones |
| `src/lib/scraperTemplates.ts` | Templates con actorId, campos requeridos/opcionales |
| `src/app/api/scraper/start/route.ts` | API para iniciar jobs |
| `src/app/api/scraper/status/route.ts` | API para consultar estado |
| `docs/scrapers_doc.md` | Esta documentación |

---

## Tabla de Contenidos

1. [Apify - Información General](#apify---información-general)
2. [Trustpilot Reviews](#1-trustpilot-reviews)
3. [Instagram Posts & Comments](#2-instagram-posts--comments)
4. [TikTok Posts](#3-tiktok-posts)
5. [TikTok Comments](#4-tiktok-comments)
6. [LinkedIn Company Posts](#5-linkedin-company-posts)
7. [LinkedIn Comments](#6-linkedin-comments)
8. [LinkedIn Company Insights](#7-linkedin-company-insights)
9. [YouTube Channel Videos](#8-youtube-channel-videos)
10. [YouTube Comments](#9-youtube-comments)
11. [YouTube Transcripts](#10-youtube-transcripts)
12. [G2 Reviews](#11-g2-reviews)
13. [Capterra Reviews](#12-capterra-reviews)
14. [App Store Reviews](#13-app-store-reviews)
15. [Play Store Reviews](#14-play-store-reviews)
16. [Google Maps Reviews](#15-google-maps-reviews)
17. [Facebook Posts](#16-facebook-posts)
18. [Facebook Comments](#17-facebook-comments)
19. [Firecrawl (Website)](#firecrawl-website)
20. [Mangools (SEO Keywords)](#mangools-seo-keywords)

---

## Apify - Información General

### API Base URL
```
https://api.apify.com/v2
```

### Autenticación
```
Authorization: Bearer {APIFY_TOKEN}
```

### Endpoints Principales

#### Ejecutar Actor
```
POST /acts/{actorId}/runs
Content-Type: application/json

{
  "input": { ... }
}
```

#### Obtener Estado de Run
```
GET /actor-runs/{runId}
```

#### Obtener Dataset de Run
```
GET /actor-runs/{runId}/dataset/items
```

### Estados de Ejecución
- `READY` - Listo para ejecutar
- `RUNNING` - En ejecución
- `SUCCEEDED` - Completado exitosamente
- `FAILED` - Falló
- `ABORTED` - Abortado
- `TIMED-OUT` - Tiempo excedido

---

## 1. TRUSTPILOT REVIEWS

**Actor ID:** `fLXimoyuhE1UQgDbM`

**URL del Actor:** https://apify.com/compass/trustpilot-reviews-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `companyDomain` | string | ✅ SÍ | Dominio de la empresa | Ej: `"revolut.com"` |
| `count` | number | No | Cantidad máxima de reviews | Default: `100` |
| `date` | enum | No | Filtro de fecha | `"last30days"`, `"last3months"`, `"last6months"`, `"last12months"` |
| `stars` | string[] | No | Filtro por estrellas | `["1", "2", "3", "4", "5"]` |
| `languages` | string[] | No | Idiomas de reviews | ISO codes: `["en", "es", "sv", "de", "fr", "it", "pt", "nl", "pl", "da", "no", "fi"]` |
| `sort` | enum | No | Ordenamiento | `"recency"` |

### Ejemplo de Input
```json
{
  "companyDomain": "revolut.com",
  "count": 100,
  "date": "last3months",
  "stars": ["4", "5"],
  "languages": ["en", "es"]
}
```

### Output Fields
- `title` - Título de la review
- `text` - Contenido de la review
- `rating` - Puntuación (1-5)
- `author` - Nombre del autor
- `date` - Fecha de la review
- `verified` - Si es compra verificada
- `consumerCountryCode` - País del consumidor

---

## 2. INSTAGRAM POSTS & COMMENTS

**Actor ID:** `dIKFJ95TN8YclK2no`

**URL del Actor:** https://apify.com/apify/instagram-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `username` | string[] | ✅ SÍ | Array de usernames | Ej: `["revolut", "n26"]` |
| `resultsType` | enum | No | Tipo de resultados | `"posts"`, `"comments"`, `"details"`, `"mentions"`, `"reels"`, `"stories"` |
| `resultsLimit` | number | No | Límite de resultados | Default: `200` |

⚠️ **IMPORTANTE:** El campo requerido es `username`, NO `directUrls`

### Ejemplo de Input
```json
{
  "username": ["revolut"],
  "resultsType": "posts",
  "resultsLimit": 50
}
```

### Output Fields
- `shortCode` - Código único del post
- `caption` - Texto del post
- `likesCount` - Cantidad de likes
- `commentsCount` - Cantidad de comentarios
- `timestamp` - Fecha/hora
- `comments` - Array de comentarios (si aplica)

---

## 3. TIKTOK POSTS

**Actor ID:** `GdWCkxBtKWOsKjdch`

**URL del Actor:** https://apify.com/clockworks/tiktok-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `profiles` | string[] | ✅ SÍ | Array de perfiles | Ej: `["@revolut", "@n26bank"]` |
| `resultsPerPage` | number | No | Resultados por página | `1` - `1,000,000`. Default: `50` |
| `profileSorting` | enum | No | Ordenamiento | `"latest"`, `"popular"`, `"oldest"` |
| `proxyCountryCode` | enum | No | País del proxy | Ver lista completa abajo |

### Valores de `proxyCountryCode` (UPPERCASE)
```
"None", "ES", "US", "GB", "DE", "FR", "IT", "PT", "BR", "MX", "AR", "CL", "CO", "PE",
"JP", "KR", "CN", "IN", "AU", "NZ", "CA", "NL", "BE", "SE", "NO", "DK", "FI", "PL",
"CZ", "AT", "CH", "IE", "RU", "UA", "TR", "ZA", "EG", "SA", "AE", "IL", "SG", "MY",
"TH", "VN", "ID", "PH"
```

### Ejemplo de Input
```json
{
  "profiles": ["@revolut"],
  "resultsPerPage": 50,
  "proxyCountryCode": "ES",
  "profileSorting": "latest"
}
```

### Output Fields
- `id` - ID único del video
- `text` - Descripción del video
- `createTime` - Timestamp de creación
- `stats` - Objeto con estadísticas (views, likes, comments, shares)
- `author` - Información del autor

---

## 4. TIKTOK COMMENTS

**Actor ID:** `BDec00yAmCm1QbMEI`

**URL del Actor:** https://apify.com/clockworks/tiktok-comments-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `postURLs` | string[] | ✅ SÍ | URLs de posts | Ej: `["https://www.tiktok.com/@user/video/123"]` |
| `commentsPerPost` | number | No | Comentarios por post | Default: `100` |

### Ejemplo de Input
```json
{
  "postURLs": ["https://www.tiktok.com/@revolut/video/7123456789"],
  "commentsPerPost": 100
}
```

### Output Fields
- `text` - Texto del comentario
- `createTime` - Timestamp
- `likesCount` - Likes del comentario
- `user` - Información del usuario

---

## 5. LINKEDIN COMPANY POSTS

**Actor ID:** `mrThmKLmkxJPehxCg`

**URL del Actor:** https://apify.com/anchor/linkedin-company-posts-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `company_name` | string | ✅ SÍ | Nombre de la empresa | Ej: `"revolut"` |
| `limit` | number | No | Límite de posts | Default: `50` |
| `sort` | enum | No | Ordenamiento | `"recent"`, `"top"` (SOLO ESTOS DOS) |

⚠️ **IMPORTANTE:** `sort` solo acepta `"recent"` o `"top"`, NO otros valores.

### Ejemplo de Input
```json
{
  "company_name": "revolut",
  "limit": 50,
  "sort": "recent"
}
```

### Output Fields
- `text` - Contenido del post
- `likesCount` - Cantidad de likes
- `commentsCount` - Cantidad de comentarios
- `postedAt` - Fecha de publicación
- `urn` - ID único de LinkedIn

---

## 6. LINKEDIN COMMENTS

**Actor ID:** `2XnpwxfhSW1fAWElp`

**URL del Actor:** https://apify.com/anchor/linkedin-comments-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `postIds` | string[] | ✅ SÍ | IDs de posts (URNs) | Ej: `["urn:li:activity:123"]` |
| `limit` | number | No | Límite de comentarios | Default: `100` |
| `sortOrder` | enum | No | Ordenamiento | `"most recent"`, `"most relevant"` |

⚠️ **IMPORTANTE:** `sortOrder` tiene ESPACIO: `"most recent"`, `"most relevant"`

### Ejemplo de Input
```json
{
  "postIds": ["urn:li:activity:7148123456789012480"],
  "limit": 100,
  "sortOrder": "most recent"
}
```

### Output Fields
- `text` - Texto del comentario
- `likesCount` - Likes
- `author` - Información del autor
- `createdAt` - Fecha de creación

---

## 7. LINKEDIN COMPANY INSIGHTS

**Actor ID:** `6mSoKnECRInl7QUb8`

**URL del Actor:** https://apify.com/anchor/linkedin-company-insights

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `companyUrls` | string[] | ✅ SÍ | URLs de empresas | Ej: `["https://www.linkedin.com/company/revolut"]` |

### Ejemplo de Input
```json
{
  "companyUrls": ["https://www.linkedin.com/company/revolut"]
}
```

### Output Fields
- `name` - Nombre de la empresa
- `description` - Descripción
- `industry` - Industria
- `employeeCount` - Cantidad de empleados
- `headquarters` - Sede
- `website` - Sitio web

---

## 8. YOUTUBE CHANNEL VIDEOS

**Actor ID:** `6MHGJwYGoF8Cvtkg0`

**URL del Actor:** https://apify.com/streamers/youtube-channel-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `youtube_channels` | string[] | ✅ SÍ | URLs de canales | Ej: `["https://www.youtube.com/@Revolut"]` |
| `End_date` | string | No | Fecha límite | Formato: `"YYYY-MM-DD"` |

### Ejemplo de Input
```json
{
  "youtube_channels": ["https://www.youtube.com/@Revolut"],
  "End_date": "2024-01-01"
}
```

### Output Fields
- `title` - Título del video
- `description` - Descripción
- `viewCount` - Vistas
- `likeCount` - Likes
- `publishedAt` - Fecha de publicación
- `url` - URL del video

---

## 9. YOUTUBE COMMENTS

**Actor ID:** `mExYO4A2k9976zMfA`

**URL del Actor:** https://apify.com/streamers/youtube-comment-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `startUrls` | object[] | ✅ SÍ | Array de objetos con URLs | `[{url: "https://..."}]` |
| `maxComments` | number | No | Máximo de comentarios | Default: `100` |
| `sort` | enum | No | Ordenamiento | `"top"`, `"latest"` |

⚠️ **IMPORTANTE:** `startUrls` es un array de OBJETOS, no strings: `[{url: "..."}]`

### Ejemplo de Input
```json
{
  "startUrls": [{"url": "https://www.youtube.com/watch?v=abc123"}],
  "maxComments": 100,
  "sort": "latest"
}
```

### Output Fields
- `text` - Texto del comentario
- `author` - Nombre del autor
- `likesCount` - Likes
- `publishedAt` - Fecha de publicación

---

## 10. YOUTUBE TRANSCRIPTS

**Actor ID:** `L57jETyu9qT6J7bs5`

**URL del Actor:** https://apify.com/streamers/youtube-transcript-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `videoUrls` | string[] | ✅ SÍ | URLs de videos | Ej: `["https://www.youtube.com/watch?v=abc"]` |
| `language` | string | No | Idioma preferido | ISO code. Default: `"es"` |

### Ejemplo de Input
```json
{
  "videoUrls": ["https://www.youtube.com/watch?v=abc123"],
  "language": "es"
}
```

### Output Fields
- `transcript` - Texto completo del transcript
- `language` - Idioma del transcript
- `isGenerated` - Si fue generado automáticamente

---

## 11. G2 REVIEWS

**Actor ID:** `kT2dx4xoOebKw6uQB`

**URL del Actor:** https://apify.com/compass/g2-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `product` | string | ✅ SÍ | Nombre del producto | Ej: `"revolut-business"` |
| `max_reviews` | number | No | Máximo de reviews | **Mínimo: 200**. Default: `200` |

⚠️ **IMPORTANTE:** `max_reviews` tiene un mínimo de 200.

### Ejemplo de Input
```json
{
  "product": "revolut-business",
  "max_reviews": 200
}
```

### Output Fields
- `title` - Título de la review
- `text` - Contenido
- `rating` - Puntuación
- `author` - Autor
- `date` - Fecha
- `pros` - Aspectos positivos
- `cons` - Aspectos negativos

---

## 12. CAPTERRA REVIEWS

**Actor ID:** `50GSYJYYfRB0xCNRc`

**URL del Actor:** https://apify.com/compass/capterra-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `company_name` | string | ✅ SÍ | Nombre de la empresa | Ej: `"revolut"` |
| `maxReviews` | number | No | Máximo de reviews | Default: `100` |

⚠️ **IMPORTANTE:** El campo es `company_name` (STRING), NO `productUrls` (array).

### Ejemplo de Input
```json
{
  "company_name": "revolut",
  "maxReviews": 100
}
```

### Output Fields
- `title` - Título
- `text` - Contenido
- `rating` - Puntuación
- `author` - Autor
- `date` - Fecha
- `pros` - Aspectos positivos
- `cons` - Aspectos negativos

---

## 13. APP STORE REVIEWS

**Actor ID:** `4qRgh5vXXsv0bKa1l`

**URL del Actor:** https://apify.com/compass/app-store-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `startUrls` | string[] | ✅ SÍ | URLs de apps | Ej: `["https://apps.apple.com/app/id123"]` |
| `maxItems` | number | No | Máximo de items | Default: `100` |
| `country` | enum | No | País | **LOWERCASE**: `"us"`, `"es"`, `"gb"`, `"de"`, `"fr"`, `"it"`, `"pt"`, `"br"`, `"mx"`, `"ar"`, `"cl"`, `"co"`, `"pe"`, `"jp"`, `"kr"`, `"cn"`, `"in"`, `"au"`, `"nz"`, `"ca"` |

⚠️ **IMPORTANTE:** `country` en MINÚSCULAS: `"us"`, `"es"`, etc.

### Ejemplo de Input
```json
{
  "startUrls": ["https://apps.apple.com/app/revolut/id932493382"],
  "maxItems": 100,
  "country": "es"
}
```

### Output Fields
- `title` - Título
- `text` - Contenido
- `rating` - Puntuación
- `author` - Autor
- `date` - Fecha
- `version` - Versión de la app

---

## 14. PLAY STORE REVIEWS

**Actor ID:** `Bs72sDKr8fGe3d5Ti`

**URL del Actor:** https://apify.com/compass/google-play-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `startUrls` | string[] | ✅ SÍ | URLs de apps **con hl y gl** | Ej: `["https://play.google.com/store/apps/details?id=com.app&hl=es&gl=ES"]` |
| `maxItems` | number | No | Máximo de items | Default: `100` |

⚠️ **IMPORTANTE - Formato de URL:**
El actor requiere que el idioma (`hl`) y país (`gl`) estén **DENTRO de la URL**, no como campos separados:
- `hl` (idioma): minúsculas: `es`, `en`, `de`, `fr`, `it`, `pt`
- `gl` (país): MAYÚSCULAS: `ES`, `US`, `GB`, `DE`, `FR`, `IT`

**URL incorrecta:** `https://play.google.com/store/apps/details?id=com.revolut.revolut`
**URL correcta:** `https://play.google.com/store/apps/details?id=com.revolut.revolut&hl=es&gl=ES`

### Ejemplo de Input
```json
{
  "startUrls": ["https://play.google.com/store/apps/details?id=com.revolut.revolut&hl=es&gl=ES"],
  "maxItems": 100
}
```

> **Nota técnica:** El backend (`scraperTemplates.ts`) automáticamente añade `&hl=` y `&gl=` a las URLs si el usuario no los incluye, usando los valores seleccionados en la UI.

### Output Fields
- `text` - Contenido de la review
- `rating` - Puntuación (1-5)
- `author` - Nombre del autor
- `date` - Fecha
- `thumbsUp` - Cantidad de "útil"

---

## 15. GOOGLE MAPS REVIEWS

**Actor ID:** `thEbk6nzmhRsChwBS`

**URL del Actor:** https://apify.com/compass/google-maps-reviews-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `placeUrls` | string[] | ✅ SÍ | URLs de lugares | Ej: `["https://www.google.com/maps/place/..."]` |
| `maxReviews` | number | No | Máximo de reviews | Default: `100` |
| `reviewsSort` | enum | No | Ordenamiento | `"newest"`, `"mostRelevant"`, `"highestRanking"`, `"lowestRanking"` |
| `language` | string | No | Idioma de resultados | ISO code. Default: `"es"` |

### Lista de Idiomas Soportados (56)
```
"en", "es", "de", "fr", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh-CN", "zh-TW",
"ar", "bg", "ca", "cs", "da", "el", "et", "fi", "he", "hi", "hr", "hu", "id", "lt",
"lv", "ms", "no", "ro", "sk", "sl", "sr", "sv", "th", "tr", "uk", "vi", "bn", "fil",
"gu", "kn", "ml", "mr", "pa", "ta", "te", "ur"
```

### Ejemplo de Input
```json
{
  "placeUrls": ["https://www.google.com/maps/place/Revolut"],
  "maxReviews": 100,
  "reviewsSort": "newest",
  "language": "es"
}
```

### Output Fields
- `text` - Texto de la review
- `rating` - Puntuación (1-5)
- `author` - Nombre del autor
- `date` - Fecha relativa
- `reviewerPhotoUrl` - URL de la foto del reviewer

---

## 16. FACEBOOK POSTS

**Actor ID:** `KoJrdxJCTtpon81KY`

**URL del Actor:** https://apify.com/apify/facebook-posts-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `startUrls` | string[] | ✅ SÍ | URLs de páginas | Ej: `["https://www.facebook.com/Revolut"]` |
| `resultsLimit` | number | No | Límite de resultados | Default: `50` |

### Ejemplo de Input
```json
{
  "startUrls": ["https://www.facebook.com/Revolut"],
  "resultsLimit": 50
}
```

### Output Fields
- `text` - Texto del post
- `likesCount` - Cantidad de likes
- `commentsCount` - Cantidad de comentarios
- `sharesCount` - Cantidad de compartidos
- `time` - Fecha/hora de publicación

---

## 17. FACEBOOK COMMENTS

**Actor ID:** `us5srxAYnsrkgUv2v`

**URL del Actor:** https://apify.com/apify/facebook-comments-scraper

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `startUrls` | string[] | ✅ SÍ | URLs de posts | Ej: `["https://www.facebook.com/Revolut/posts/123"]` |
| `resultsLimit` | number | No | Límite de resultados | Default: `100` |

### Ejemplo de Input
```json
{
  "startUrls": ["https://www.facebook.com/Revolut/posts/123456789"],
  "resultsLimit": 100
}
```

### Output Fields
- `text` - Texto del comentario
- `likesCount` - Cantidad de likes
- `author` - Nombre del autor
- `date` - Fecha

---

## FIRECRAWL (Website)

**Provider:** Firecrawl (no es Apify)

**API Base URL:** `https://api.firecrawl.dev/v1`

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `url` | string | ✅ SÍ | URL a scrapear | Cualquier URL válida |
| `formats` | string[] | No | Formatos de output | `["markdown"]`, `["html"]`, `["markdown", "html"]` |
| `onlyMainContent` | boolean | No | Solo contenido principal | Default: `true` |
| `waitFor` | number | No | Esperar X ms antes de scrapear | Default: `0` |

### Ejemplo de Input
```json
{
  "url": "https://www.revolut.com/es-ES/",
  "formats": ["markdown"],
  "onlyMainContent": true,
  "waitFor": 0
}
```

### Output Fields
- `markdown` - Contenido en formato Markdown
- `metadata` - Metadatos de la página (título, descripción, etc.)

---

## MANGOOLS (SEO Keywords)

**Provider:** Mangools KWFinder (no es Apify)

### Input Schema

| Campo | Tipo | Requerido | Descripción | Valores Permitidos |
|-------|------|-----------|-------------|-------------------|
| `keyword` | string | ✅ SÍ | Keyword a investigar | Cualquier palabra clave |
| `location` | string | No | Ubicación | Ej: `"Spain"`, `"Mexico"`, `"United States"` |
| `language` | string | No | Idioma | ISO code: `"es"`, `"en"`, etc. |

### Ejemplo de Input
```json
{
  "keyword": "mejor banco digital",
  "location": "Spain",
  "language": "es"
}
```

### Output Fields
- `keyword` - Keyword buscada
- `searchVolume` - Volumen de búsqueda mensual
- `cpc` - Costo por clic
- `competition` - Nivel de competencia
- `trend` - Tendencia de búsqueda

---

## Resumen de Diferencias Críticas

### Campos que Causan Errores Comunes

| Actor | Campo | ❌ Incorrecto | ✅ Correcto |
|-------|-------|--------------|-------------|
| Trustpilot | `date` | `"today"`, `"week"`, `"month"`, `"year"` | `"last30days"`, `"last3months"`, `"last6months"`, `"last12months"` |
| Instagram | Campo requerido | `directUrls` | `username` |
| LinkedIn Posts | `sort` | `"latest"`, `"popular"` | `"recent"`, `"top"` |
| LinkedIn Comments | `sortOrder` | `"mostRecent"`, `"mostRelevant"` | `"most recent"`, `"most relevant"` (con espacio) |
| Play Store | `country` | `"es"`, `"us"` | `"ES"`, `"US"` (UPPERCASE) |
| Play Store | `sort` | `"newest"`, `"rating"` | `"NEWEST"`, `"RATING"` (UPPERCASE) |
| App Store | `country` | `"ES"`, `"US"` | `"es"`, `"us"` (lowercase) |
| Capterra | Campo requerido | `productUrls` (array) | `company_name` (string) |
| YouTube Comments | `startUrls` | `["url1", "url2"]` | `[{url: "url1"}, {url: "url2"}]` |
| Google Maps | `sort` | `"newest"` | `reviewsSort: "newest"` |
| TikTok | `proxyCountryCode` | `"es"` | `"ES"` (UPPERCASE) |

---

## Changelog

- **2025-01-16:** Agregada guía de desarrollo con regla obligatoria de testing antes de habilitar scrapers.
- **2025-01-16:** Documentación inicial creada con schemas verificados de todos los actores.

---

## Registro de Tests de Scrapers

| Fecha | Scraper | Input de Test | Resultado | Notas |
|-------|---------|---------------|-----------|-------|
| 2025-01-15 | TikTok Posts | `@revolut` | ✅ Éxito | 50 posts obtenidos |
| 2025-01-15 | Trustpilot Reviews | `revolut.com` | ✅ Éxito | 100 reviews obtenidas |
| 2025-01-16 | App Store Reviews | `id932493382` | ✅ Éxito | 5 reviews, incluye título, texto, score, fecha, versión |
| 2025-01-16 | Play Store Reviews | `com.revolut.revolut&hl=es&gl=ES` | ✅ Éxito | 5 reviews, incluye texto, score, respuesta de empresa |
