# Guía de Testing - ECP Generator

## 🚀 Setup Inicial (Primera Vez)

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Iniciar Supabase Local

```bash
# Si no tienes Supabase CLI instalado:
npm install -g supabase

# Iniciar Supabase (primera vez)
supabase start
```

Esto iniciará:
- **Postgres**: puerto 54322
- **API**: puerto 54321
- **Studio**: puerto 54323 (http://localhost:54323)

### 3. Aplicar Migraciones

```bash
supabase db reset
```

Esto crea todas las tablas con RLS deshabilitado para desarrollo.

### 4. Obtener Claves de Supabase

```bash
supabase status
```

Copia las claves que necesitas:
- `API URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

### 5. Configurar Variables de Entorno

Crea `.env`:

```bash
# Supabase (obtenido de `supabase status`)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>

# Gemini API (obtener de https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=<tu-gemini-api-key>
```

### 6. Iniciar Desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

---

## ✅ Casos de Prueba

### Test 1: Crear Proyecto

1. Ve a http://localhost:3000
2. Click en "Nuevo Proyecto"
3. Completa:
   - Nombre: "Test ECP - Producto XYZ"
   - Descripción: "Proyecto de prueba para validar el sistema"
4. Click "Crear Proyecto"
5. **Resultado esperado**: Redirección al dashboard del proyecto

### Test 2: Subir Documento TXT

1. En el dashboard del proyecto, pestaña "Documentos"
2. Click "Subir Documento"
3. Selecciona categoría: **Producto**
4. Sube un archivo `.txt` (crea uno simple con contenido de prueba)
5. Verifica que muestre el preview de extracción
6. Click "Subir Documento"
7. **Resultado esperado**:
   - Mensaje de éxito
   - Documento aparece en la lista
   - Monitor de tokens muestra el conteo

**Crear archivo de prueba**:
```bash
cat > test-product.txt << 'EOF'
Producto XYZ - Características Principales

Nuestro producto ofrece:
- Solución completa para gestión de inventario
- Integración con sistemas ERP existentes
- Dashboard en tiempo real
- Alertas automáticas de stock bajo
- Soporte 24/7

Beneficios:
- Reduce costos operativos en 30%
- Aumenta eficiencia del equipo
- Elimina errores manuales
EOF
```

### Test 3: Subir Documento PDF (Si tienes pdf-parse instalado)

**Nota**: Para que funcione la extracción de PDF, necesitas:

```bash
npm install pdf-parse
```

Luego sube un PDF simple y verifica la extracción.

### Test 4: Verificar Monitor de Tokens

1. Sube 2-3 documentos
2. Observa el componente **Token Monitor**
3. **Resultado esperado**:
   - Barra de progreso verde (< 75%)
   - Total de tokens calculado correctamente
   - Desglose por documento visible

### Test 5: Ver Contenido de Documento

1. En la lista de documentos, click en el ícono "👁️ (ojo)"
2. **Resultado esperado**: Modal mostrando el contenido completo extraído

### Test 6: Eliminar Documento

1. Click en el ícono de basura en un documento
2. Confirma la eliminación
3. **Resultado esperado**: Documento eliminado, lista actualizada

### Test 7: Navegar entre Pestañas

1. Pestaña "Configuración de Contexto":
   - Verifica que muestre los 4 pasos
   - Verifica que muestre las guías de cada paso
   - Verifica que los checkboxes de documentos aparezcan
2. Pestaña "Prompts":
   - Verifica que muestre los 5 prompts (Deep Research + 4 pasos)
   - Verifica que los textareas contengan los prompts por defecto
3. Pestaña "Campañas":
   - Verifica el placeholder (funcionalidad pendiente)

---

## 🔧 Troubleshooting

### Error: "Cannot connect to Supabase"

**Solución**:
```bash
# Verifica que Supabase esté corriendo
supabase status

# Si no está corriendo
supabase start

# Verifica las variables de entorno en .env
```

### Error: "User not found" al crear proyecto

**Solución**: Verifica que la migración `20250101000001_dev_setup.sql` se haya aplicado correctamente. Ejecuta:

```bash
supabase db reset
```

### Error al extraer PDF: "pdf-parse not found"

**Solución**:
```bash
npm install pdf-parse
```

### Error al extraer DOCX: "mammoth not found"

**Solución**:
```bash
npm install mammoth
```

### Puerto 54321 ya en uso

**Solución**:
```bash
# Detener Supabase
supabase stop

# Reiniciar
supabase start
```

---

## 🗄️ Verificar Base de Datos

### Usando Supabase Studio

1. Abre http://localhost:54323
2. Ve a "Table Editor"
3. Verifica las tablas:
   - `projects`
   - `knowledge_base_docs`
   - `ecp_campaigns`
   - `execution_logs`

### Usando SQL Editor

En Supabase Studio → SQL Editor:

```sql
-- Ver proyectos
SELECT * FROM projects;

-- Ver documentos con conteo de tokens
SELECT
  filename,
  category,
  token_count,
  file_size_bytes,
  created_at
FROM knowledge_base_docs
ORDER BY created_at DESC;

-- Ver total de tokens por proyecto
SELECT
  p.name AS project,
  COUNT(kd.id) AS docs_count,
  SUM(kd.token_count) AS total_tokens
FROM projects p
LEFT JOIN knowledge_base_docs kd ON kd.project_id = p.id
GROUP BY p.id, p.name;
```

---

## 📊 Métricas de Éxito

- [x] Crear proyecto
- [x] Subir documento TXT
- [x] Subir documento PDF (con pdf-parse)
- [x] Subir documento DOCX (con mammoth)
- [x] Ver contenido extraído
- [x] Eliminar documento
- [x] Monitor de tokens funciona
- [x] Navegación entre pestañas
- [ ] Ejecutar prompts con Gemini (pendiente)
- [ ] Guardar outputs como documentos (pendiente)

---

## 🔜 Próximos Tests (Cuando implementemos Edge Functions)

1. **Test Deep Research**
   - Crear campaña
   - Ejecutar Deep Research
   - Verificar output en `ecp_campaigns.deep_research_text`

2. **Test Steps 1-4**
   - Ejecutar cada paso
   - Guardar outputs
   - Usar outputs como contexto en pasos siguientes

3. **Test Token Limits**
   - Subir documentos hasta >1.5M tokens
   - Verificar alerta amarilla
   - Intentar ejecutar con >2M tokens
   - Verificar error

---

## 🧹 Limpiar Todo

```bash
# Detener Supabase
supabase stop

# Limpiar volúmenes (CUIDADO: borra todos los datos)
supabase db reset --dangerous

# O simplemente detener sin borrar
supabase stop
```

---

## 📝 Notas Importantes

1. **RLS está deshabilitado en desarrollo**: Para facilitar testing. Antes de producción, ejecutar migración para re-habilitarlo.

2. **Dummy user_id**: Todos los proyectos usan `00000000-0000-0000-0000-000000000000` como user_id. En producción, usar Supabase Auth real.

3. **Límites de PDF/DOCX**: La extracción funciona solo si instalas las dependencias correspondientes.

4. **Token estimation**: Usa aproximación simple (chars/4). Para precisión mayor, considera usar `tiktoken` library.
