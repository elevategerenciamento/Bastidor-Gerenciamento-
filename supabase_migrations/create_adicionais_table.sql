-- Criar a tabela adicionais
CREATE TABLE IF NOT EXISTS public.adicionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar RLS
ALTER TABLE public.adicionais ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view their own adicionais" 
    ON public.adicionais FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own adicionais" 
    ON public.adicionais FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own adicionais" 
    ON public.adicionais FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own adicionais" 
    ON public.adicionais FOR DELETE 
    USING (auth.uid() = user_id);

-- Atualizar a tabela orders para incluir adicionais selecionados
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS selected_adicionais JSONB DEFAULT '[]'::jsonb;
