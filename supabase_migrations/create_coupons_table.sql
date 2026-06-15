-- ====================================================================
-- SCRIPT DE BANCO DE DADOS - SISTEMA DE CUPONS DE DESCONTO (TRIAL)
-- Execute estas queries no SQL Editor do seu painel do Supabase.
-- ====================================================================

-- 1. Adicionar coluna coupon_used na tabela user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS coupon_used TEXT DEFAULT NULL;

-- 2. Tabela de Cupons
CREATE TABLE IF NOT EXISTS public.coupons (
  code        TEXT PRIMARY KEY,                  -- Código do cupom (ex: 'BASTIDOR20')
  extra_days  INTEGER NOT NULL DEFAULT 0,        -- Dias extras além dos 15 padrão
  description TEXT,                              -- Descrição interna do cupom
  max_uses    INTEGER DEFAULT NULL,              -- NULL = usos ilimitados
  used_count  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  expires_at  TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- NULL = sem validade
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar RLS na tabela coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer usuário autenticado pode verificar se um cupom existe/é válido
CREATE POLICY "Usuários autenticados podem visualizar cupons ativos"
  ON public.coupons
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Somente service_role pode gerenciar cupons (inserir, atualizar, deletar)
-- Nenhuma policy de INSERT/UPDATE/DELETE para authenticated = bloqueado por padrão

-- 4. Função segura para aplicar cupom (SECURITY DEFINER = roda como superuser)
CREATE OR REPLACE FUNCTION public.apply_coupon(p_user_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_total_days INTEGER;
BEGIN
  -- Busca e valida o cupom (case-insensitive, sem espaços)
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cupom inválido, expirado ou já esgotado.'
    );
  END IF;

  -- Verifica se este usuário já usou algum cupom
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = p_user_id AND coupon_used IS NOT NULL) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você já utilizou um cupom nesta conta.'
    );
  END IF;

  v_total_days := 15 + v_coupon.extra_days;

  -- Atualiza o trial do usuário com os dias extras
  UPDATE public.user_profiles
  SET
    trial_ends_at = trial_started_at + (v_total_days || ' days')::INTERVAL,
    coupon_used   = v_coupon.code
  WHERE user_id = p_user_id;

  -- Incrementa o contador de uso do cupom
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE code = v_coupon.code;

  RETURN jsonb_build_object(
    'success',    true,
    'extra_days', v_coupon.extra_days,
    'total_days', v_total_days,
    'code',       v_coupon.code
  );
END;
$$;

-- 5. Cupons de exemplo (edite conforme sua necessidade)
INSERT INTO public.coupons (code, extra_days, description, max_uses) VALUES
  ('BASTIDOR20', 5,  'Trial de 20 dias — campanha de lançamento', NULL),
  ('BASTIDOR30', 15, 'Trial de 30 dias — parceiros especiais', 50),
  ('VIPMETA',    45, 'Trial de 60 dias — influenciadoras parceiras', 20)
ON CONFLICT (code) DO NOTHING;

-- ====================================================================
-- COMO GERENCIAR CUPONS (execute no SQL Editor):
-- 
-- Criar novo cupom:
--   INSERT INTO public.coupons (code, extra_days, description, max_uses)
--   VALUES ('MEU_CUPOM', 10, 'Descrição', 100);
--
-- Desativar cupom:
--   UPDATE public.coupons SET is_active = false WHERE code = 'MEU_CUPOM';
--
-- Ver uso dos cupons:
--   SELECT code, description, used_count, max_uses, is_active FROM public.coupons;
-- ====================================================================
