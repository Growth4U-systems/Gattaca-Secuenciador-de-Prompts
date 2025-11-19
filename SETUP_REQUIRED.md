# ⚠️ IMPORTANTE: Setup Manual Requerido

## Las tablas NO están creadas todavía

He generado todos los archivos de migración SQL, pero **necesitas ejecutar los siguientes comandos manualmente** en tu máquina local para crear las tablas en Supabase.

## 📋 Pasos para Aplicar las Migraciones

### Opción 1: Supabase Local (Recomendado para desarrollo)

```bash
# 1. Instalar Supabase CLI (si no lo tienes)
# macOS
brew install supabase/tap/supabase

# Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
brew install supabase/tap/supabase
# O descarga el binario: https://github.com/supabase/cli/releases

# 2. Iniciar Supabase local
supabase start

# 3. Aplicar migraciones (esto crea todas las tablas)
supabase db reset

# 4. Obtener las claves
supabase status

# 5. Copiar las claves a .env.local
# API URL: http://localhost:54321
# anon key: (copiar)
# service_role key: (copiar)
```

### Opción 2: Supabase Cloud (Producción)

Si prefieres usar Supabase Cloud:

```bash
# 1. Crear proyecto en https://app.supabase.com

# 2. Inicializar en el proyecto local
supabase init

# 3. Link al proyecto cloud
supabase link --project-ref <tu-project-ref>

# 4. Push de migraciones
supabase db push

# 5. Obtener las claves desde el dashboard de Supabase
# Settings → API → Project URL y anon key
```

### Opción 3: Ejecutar SQL Manualmente

Si no puedes usar Supabase CLI, puedes ejecutar el SQL directamente:

1. Ve a tu proyecto Supabase → **SQL Editor**
2. Copia y pega el contenido de:
   - `supabase/migrations/20250101000000_initial_schema.sql`
   - `supabase/migrations/20250101000001_dev_setup.sql`
3. Ejecuta ambos scripts en orden

## 🔍 Verificar que las Tablas Existen

Después de ejecutar las migraciones, verifica:

```sql
-- En SQL Editor de Supabase
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Deberías ver:
-- - projects
-- - knowledge_base_docs
-- - ecp_campaigns
-- - execution_logs
```

## 📝 Configurar .env.local

Una vez que Supabase esté corriendo, crea `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321  # o tu URL de cloud
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
GEMINI_API_KEY=<opcional-por-ahora>
```

## 🚀 Luego Iniciar el Proyecto

```bash
npm install
npm run dev
```

---

**¿Por qué no lo hice automáticamente?**

El entorno de ejecución actual no permite instalar Supabase CLI. Necesitas ejecutar estos comandos en tu máquina local donde tengas acceso a Docker (Supabase local usa Docker para correr Postgres).
