# Cómo Aplicar las Migraciones de Colaboración

Tienes 3 opciones para aplicar las migraciones. Elige la que prefieras:

---

## OPCIÓN 1: Supabase Dashboard (Más Fácil) ⭐ RECOMENDADO

### Pasos:

1. **Ve a tu proyecto en Supabase Dashboard:**
   - https://supabase.com/dashboard/project/TU_PROJECT_ID

2. **Abre SQL Editor:**
   - En el menú lateral: **SQL Editor**
   - Click en **New query**

3. **Ejecuta la primera migración:**
   - Copia todo el contenido de: `supabase/migrations/20251218000001_add_project_collaboration.sql`
   - Pégalo en el editor SQL
   - Click **Run** o presiona `Ctrl+Enter`
   - Verifica que no haya errores

4. **Ejecuta la segunda migración:**
   - Copia todo el contenido de: `supabase/migrations/20251218000002_update_rls_policies.sql`
   - Pégalo en el editor SQL
   - Click **Run**
   - Verifica que no haya errores

5. **Verifica que funcionó:**
   ```sql
   -- Ejecuta este query para verificar
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('project_members', 'project_invitations', 'project_share_links', 'notifications');
   ```

   Deberías ver las 4 nuevas tablas.

---

## OPCIÓN 2: Supabase CLI (Desarrollo Local)

Si tienes Docker instalado, puedes usar Supabase local:

### Instalación del CLI:

```bash
# En Linux/macOS
brew install supabase/tap/supabase

# O descarga el binario:
# https://github.com/supabase/cli/releases
```

### Aplicar migraciones:

```bash
# 1. Iniciar Supabase local (si no está corriendo)
supabase start

# 2. Aplicar todas las migraciones pendientes
supabase db push

# 3. Ver el estado
supabase migration list

# 4. Acceder a Studio local
# http://localhost:54323
```

### Verificación:

```bash
# Ver las tablas creadas
supabase db dump --schema public --tables

# O conectarte con psql
psql postgresql://postgres:postgres@localhost:54322/postgres
```

---

## OPCIÓN 3: Script SQL Directo (psql)

Si tienes acceso directo a PostgreSQL:

### 1. Conectar a la base de datos:

```bash
# Supabase local
psql postgresql://postgres:postgres@localhost:54322/postgres

# O Supabase remoto (desde dashboard obtén la connection string)
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

### 2. Ejecutar migraciones:

```bash
# Desde el terminal
psql "TU_CONNECTION_STRING" < supabase/migrations/20251218000001_add_project_collaboration.sql
psql "TU_CONNECTION_STRING" < supabase/migrations/20251218000002_update_rls_policies.sql
```

### 3. O desde dentro de psql:

```sql
\i supabase/migrations/20251218000001_add_project_collaboration.sql
\i supabase/migrations/20251218000002_update_rls_policies.sql
```

---

## ⚠️ ANTES DE MIGRAR - PRE-VERIFICACIÓN

**IMPORTANTE:** Primero verifica si tienes proyectos con placeholder:

```sql
-- Ejecuta esto en SQL Editor
SELECT
  COUNT(*) FILTER (WHERE user_id = '00000000-0000-0000-0000-000000000000') as placeholder_count,
  COUNT(*) FILTER (WHERE user_id IS NULL) as null_count,
  COUNT(*) as total_projects
FROM projects;
```

**Si `placeholder_count > 0`:**
1. Primero ejecuta: `supabase/migrations/20251217000001_migrate_placeholder_to_real_users.sql`
2. **IMPORTANTE:** Edita línea 16 y reemplaza `'YOUR_ADMIN_USER_UUID_HERE'` con tu UUID real
3. Obtén tu UUID desde: Dashboard > Authentication > Users
4. Luego sí ejecuta las migraciones de colaboración

---

## ✅ POST-MIGRACIÓN - VERIFICACIÓN

Después de aplicar las migraciones, verifica que todo funcionó:

```sql
-- 1. Verificar que las tablas existen
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'project_%' OR table_name = 'notifications';

-- 2. Verificar que los owners fueron migrados
SELECT COUNT(*) as total_owners FROM project_members WHERE role = 'owner';
-- Debe coincidir con el número de proyectos

-- 3. Verificar que las funciones existen
SELECT proname
FROM pg_proc
WHERE proname LIKE '%project%'
AND pronamespace = 'public'::regnamespace;

-- 4. Verificar policies RLS
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('projects', 'project_members', 'notifications');

-- 5. Test rápido de permisos (reemplaza con tu user_id y project_id)
SELECT get_user_project_role('TU_PROJECT_ID', 'TU_USER_ID');
-- Debería retornar 'owner'
```

---

## 🐛 TROUBLESHOOTING

### Error: "function update_updated_at() does not exist"
- Ya existe en la migración inicial, este error es normal si ejecutas 2 veces

### Error: "relation project_members already exists"
- La migración ya fue ejecutada. Puedes ignorar o hacer DROP TABLE primero

### Error: "type project_role already exists"
- El tipo ya fue creado. Puedes ignorar.

### No veo mis proyectos después de migrar
- Verifica que fueron insertados en project_members:
  ```sql
  SELECT * FROM project_members WHERE user_id = 'TU_USER_ID';
  ```
- Si no aparecen, ejecuta manualmente:
  ```sql
  INSERT INTO project_members (project_id, user_id, role, added_at)
  SELECT id, user_id, 'owner', created_at
  FROM projects
  WHERE user_id = 'TU_USER_ID'
  ON CONFLICT DO NOTHING;
  ```

---

## 📝 NOTAS

- **Backup:** Siempre haz backup antes de migrar en producción
- **Staging first:** Prueba en un entorno de staging primero
- **Rollback:** Si algo falla, restaura el backup
- **Support:** Si tienes problemas, revisa los logs en Dashboard > Logs

---

## 🚀 DESPUÉS DE MIGRAR

Una vez aplicadas las migraciones exitosamente:

1. ✅ Las rutas API nuevas funcionarán
2. ✅ Los usuarios pueden compartir proyectos
3. ⚠️ Necesitas deployar el frontend (FASE 4 y 5)
4. ⚠️ Necesitas corregir las rutas existentes (FASE 3)

**Continúa con:** FASE 3 - Corregir seguridad en rutas existentes
