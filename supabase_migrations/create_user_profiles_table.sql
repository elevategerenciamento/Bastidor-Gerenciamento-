-- ====================================================================
-- SCRIPT DE BANCO DE DADOS - PERFIS DE USUÁRIO E CONTROLE DE TRIAL
-- Execute estas queries no SQL Editor do seu painel do Supabase.
-- ====================================================================

-- 1. Tabela de Perfis de Usuário (user_profiles)
-- Armazena telefone (barreira anti-duplicata) e datas do período de trial.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,           -- UNIQUE garante 1 conta por telefone
  trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '15 days') NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem visualizar apenas seu próprio perfil
CREATE POLICY "Usuários podem visualizar seu próprio perfil"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários podem inserir apenas seu próprio perfil
CREATE POLICY "Usuários podem inserir seu próprio perfil"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Permissão de service_role para a trigger poder inserir sem RLS
-- (A função da trigger roda com SECURITY DEFINER, então não precisa de policy extra)

-- 4. Índices para otimização
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone
  ON public.user_profiles (phone_number);

CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_ends
  ON public.user_profiles (trial_ends_at);

-- ====================================================================
-- VERIFICAÇÃO: Para testar se um número já está cadastrado, execute:
-- SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE phone_number = '11999999999');
-- ====================================================================
