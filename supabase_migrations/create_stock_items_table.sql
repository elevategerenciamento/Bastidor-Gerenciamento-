

-- Tabela para gerenciar o estoque físico (bastidores, embalagens, etc)
CREATE TABLE IF NOT EXISTS stock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'bastidor', 'embalagem', 'caixa', etc.
    quantity INTEGER NOT NULL DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS e criar políticas para stock_items
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stock_items" 
ON stock_items FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stock_items" 
ON stock_items FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stock_items" 
ON stock_items FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stock_items" 
ON stock_items FOR DELETE 
USING (auth.uid() = user_id);


-- Adicionar controle de quantidade aos adicionais existentes
ALTER TABLE adicionais ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- Adicionar campo em orders para salvar quais itens do estoque foram usados e suas quantidades
-- Isso será útil para devolução ao estoque se o pedido for deletado ou modificado.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS used_stock_items JSONB DEFAULT '[]'::jsonb;
