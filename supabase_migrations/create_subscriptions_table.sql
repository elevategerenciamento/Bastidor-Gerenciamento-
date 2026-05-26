-- ====================================================================
-- SCRIPT DE BANCO DE DADOS - PLANOS DE ASSINATURA BASTIDOR (ASAAS)
-- Execute estas queries no SQL Editor do seu painel do Supabase.
-- ====================================================================

-- Remover a tabela antiga de assinaturas se ela existir
DROP TABLE IF EXISTS public.subscriptions;

-- 1. Nova Tabela de Assinaturas (subscriptions) para o Asaas
CREATE TABLE public.subscriptions (
  user_id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  asaas_invoice_url TEXT, -- URL de pagamento da fatura no Asaas
  status TEXT, -- ex: 'active', 'canceled', 'overdue', 'pending'
  plan_tier TEXT, -- 'basic' ou 'premium'
  plan_interval TEXT, -- 'month' ou 'year'
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem visualizar apenas sua própria assinatura
CREATE POLICY "Usuários podem visualizar sua própria assinatura" 
  ON public.subscriptions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Política: Usuários podem deletar sua própria assinatura
CREATE POLICY "Usuários podem deletar sua própria assinatura" 
  ON public.subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Política: Usuários podem atualizar sua própria assinatura
CREATE POLICY "Usuários podem atualizar sua própria assinatura" 
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Tabela de Downloads de PDF (pdf_downloads)
CREATE TABLE IF NOT EXISTS public.pdf_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS) para pdf_downloads
ALTER TABLE public.pdf_downloads ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem visualizar apenas seus próprios downloads de PDF
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
