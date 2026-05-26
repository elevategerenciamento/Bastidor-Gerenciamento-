-- ====================================================================
-- SCRIPT DE BANCO DE DADOS - PLANOS DE ASSINATURA BASTIDOR
-- Execute estas queries no SQL Editor do seu painel do Supabase.
-- ====================================================================

-- 1. Tabela de Assinaturas (subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID REFERENCES auth.users NOT null PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT, -- ex: 'active', 'trialing', 'canceled', 'incomplete', 'past_due'
  plan_tier TEXT, -- 'basic' ou 'premium'
  plan_interval TEXT, -- 'month' ou 'year'
  price_id TEXT, -- ID do preço cadastrado no Stripe
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT null,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT null
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem visualizar apenas sua própria assinatura
CREATE POLICY "Usuários podem visualizar sua própria assinatura" 
  ON public.subscriptions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 2. Tabela de Downloads de PDF (pdf_downloads)
-- Utilizada para controlar o limite de downloads do plano gratuito (1 download de teste)
-- e do plano Básico (2 downloads por mês).
CREATE TABLE IF NOT EXISTS public.pdf_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT null,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT null
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.pdf_downloads ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem visualizar apenas seus próprios registros de download
CREATE POLICY "Usuários podem visualizar seus próprios downloads de PDF" 
  ON public.pdf_downloads
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Política: Usuários podem registrar seus próprios downloads
CREATE POLICY "Usuários podem registrar seus próprios downloads de PDF" 
  ON public.pdf_downloads
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 3. Índices para Otimização de Consultas de Downloads
CREATE INDEX IF NOT EXISTS idx_pdf_downloads_user_date 
  ON public.pdf_downloads (user_id, downloaded_at);
