import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Exemplo de estrutura de tabela 'orders' sugerida para o Supabase:
 * 
 * id: uuid (primary key)
 * customer_name: text
 * piece_description: text
 * notes: text
 * deadline: timestamp with time zone
 * is_partnership: boolean
 * completed: boolean
 * payment: jsonb (para armazenar o objeto PaymentInfo)
 * created_at: timestamp with time zone
 * user_id: uuid (foreign key para auth.users)
 */
