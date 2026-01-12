-- =============================================================================
-- AGENCY-LEVEL OPENROUTER API KEY
-- =============================================================================
-- Permite que todos los miembros de una agencia usen la misma API key de OpenRouter
-- sin necesidad de conectar individualmente sus cuentas.
-- =============================================================================

-- Agregar columna para API key de OpenRouter a nivel de agencia
-- La key se almacena encriptada usando el mismo sistema que user_openrouter_tokens
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;

-- Agregar columna para hint de la key (últimos 4 caracteres para mostrar al usuario)
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS openrouter_key_hint TEXT;

-- Agregar columna para tracking de último uso
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS openrouter_key_last_used_at TIMESTAMPTZ;

-- Comentarios para documentación
COMMENT ON COLUMN agencies.openrouter_api_key IS 'Encrypted OpenRouter API key for agency-wide usage';
COMMENT ON COLUMN agencies.openrouter_key_hint IS 'Last 4 characters of the API key for display purposes';
COMMENT ON COLUMN agencies.openrouter_key_last_used_at IS 'Timestamp of last API call using this key';
