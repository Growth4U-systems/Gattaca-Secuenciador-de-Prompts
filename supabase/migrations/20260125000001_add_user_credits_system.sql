-- ============================================
-- Sistema de Créditos de Gattaca
-- ============================================

-- Tabla principal de balance de créditos por usuario
CREATE TABLE IF NOT EXISTS public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_credits_user_id_unique UNIQUE (user_id),
  CONSTRAINT user_credits_balance_non_negative CHECK (balance >= 0)
);

-- Tabla de transacciones de créditos (historial)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus', 'adjustment')),
  description TEXT,
  reference_id TEXT, -- ID externo (ej: order_id de Polar)
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(type);

-- Habilitar RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_credits
CREATE POLICY "Users can view their own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all credits"
  ON public.user_credits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Políticas RLS para credit_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transactions"
  ON public.credit_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- Función: add_credits
-- Agrega créditos a un usuario (usado por webhooks de pago)
-- ============================================
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id TEXT,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'purchase',
  p_description TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_uuid UUID;
  v_new_balance INTEGER;
  v_credits_record user_credits%ROWTYPE;
BEGIN
  -- Validar parámetros
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Intentar convertir p_user_id a UUID, si falla buscar por email
  BEGIN
    v_user_uuid := p_user_id::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Buscar usuario por email
    SELECT id INTO v_user_uuid FROM auth.users WHERE email = p_user_id;
    IF v_user_uuid IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
  END;

  -- Insertar o actualizar registro de créditos
  INSERT INTO user_credits (user_id, balance, total_purchased)
  VALUES (v_user_uuid, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET
    balance = user_credits.balance + p_amount,
    total_purchased = user_credits.total_purchased + p_amount,
    updated_at = NOW()
  RETURNING * INTO v_credits_record;

  v_new_balance := v_credits_record.balance;

  -- Registrar transacción
  INSERT INTO credit_transactions (user_id, amount, type, description, reference_id, balance_after)
  VALUES (v_user_uuid, p_amount, p_type, p_description, p_reference_id, v_new_balance);

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_uuid,
    'amount_added', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- ============================================
-- Función: use_credits
-- Consume créditos de un usuario
-- ============================================
CREATE OR REPLACE FUNCTION public.use_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Validar parámetros
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Obtener balance actual con lock
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No credits found for user');
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'current_balance', v_current_balance,
      'required', p_amount
    );
  END IF;

  -- Actualizar balance
  v_new_balance := v_current_balance - p_amount;

  UPDATE user_credits
  SET
    balance = v_new_balance,
    total_used = total_used + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Registrar transacción (amount negativo para uso)
  INSERT INTO credit_transactions (user_id, amount, type, description, reference_id, balance_after)
  VALUES (p_user_id, -p_amount, 'usage', p_description, p_reference_id, v_new_balance);

  RETURN json_build_object(
    'success', true,
    'amount_used', p_amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- ============================================
-- Función: get_credits_balance
-- Obtiene el balance actual de créditos
-- ============================================
CREATE OR REPLACE FUNCTION public.get_credits_balance(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits_record user_credits%ROWTYPE;
BEGIN
  SELECT * INTO v_credits_record
  FROM user_credits
  WHERE user_id = p_user_id;

  IF v_credits_record IS NULL THEN
    RETURN json_build_object(
      'balance', 0,
      'total_purchased', 0,
      'total_used', 0
    );
  END IF;

  RETURN json_build_object(
    'balance', v_credits_record.balance,
    'total_purchased', v_credits_record.total_purchased,
    'total_used', v_credits_record.total_used,
    'updated_at', v_credits_record.updated_at
  );
END;
$$;

-- Permisos para las funciones
GRANT EXECUTE ON FUNCTION public.add_credits TO service_role;
GRANT EXECUTE ON FUNCTION public.use_credits TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_credits_balance TO authenticated, service_role;
