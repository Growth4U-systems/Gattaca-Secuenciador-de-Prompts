-- Ejecuta esto en Supabase SQL Editor para ver tus documentos

-- Ver todos los documentos con información básica
SELECT
  id,
  filename,
  category,
  LENGTH(extracted_content) as content_length_chars,
  token_count,
  file_size_bytes,
  created_at
FROM knowledge_base_docs
ORDER BY created_at DESC
LIMIT 10;

-- Ver un documento completo (reemplaza 'tu-uuid-aqui' con un ID real)
-- SELECT
--   filename,
--   extracted_content
-- FROM knowledge_base_docs
-- WHERE id = 'tu-uuid-aqui';

-- Contar total de documentos por categoría
SELECT
  category,
  COUNT(*) as total_docs,
  SUM(token_count) as total_tokens,
  SUM(LENGTH(extracted_content)) as total_chars
FROM knowledge_base_docs
GROUP BY category;
