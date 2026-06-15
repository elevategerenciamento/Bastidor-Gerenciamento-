-- ====================================================================
-- SCRIPT DE BANCO DE DADOS - PLANOS DE ASSINATURA BASTIDOR (XLS DOWNLOADS)
-- Execute estas queries no SQL Editor do seu painel do Supabase.
-- ====================================================================

-- 1. Tabela de Downloads de XLS (xls_downloads)
CREATE TABLE IF NOT EXISTS public.xls_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS) para xls_downloads
ALTER TABLE public.xls_downloads ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem visualizar apenas seus próprios downloads de XLS
CREATE POLICY "Usuários podem visualizar seus próprios downloads de XLS" 
  ON public.xls_downloads
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Política: Usuários podem registrar seus próprios downloads de XLS
CREATE POLICY "Usuários podem registrar seus próprios downloads de XLS" 
  ON public.xls_downloads
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Índices para Otimização de Consultas de Downloads
CREATE INDEX IF NOT EXISTS idx_xls_downloads_user_date 
  ON public.xls_downloads (user_id, downloaded_at);
