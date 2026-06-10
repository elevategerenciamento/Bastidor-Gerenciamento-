// Supabase Edge Function: create-stripe-checkout
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Trata requisição OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeApiKey = Deno.env.get("STRIPE_API_KEY") ?? "";
    if (!stripeApiKey) {
      throw new Error("Chave de API da Stripe não configurada.");
    }

    const stripe = new Stripe(stripeApiKey, {
      apiVersion: "2023-10-16",
    });

    // Inicializa cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Obtém usuário autenticado a partir do token de autorização enviado pelo frontend
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização ausente");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Não autorizado");
    }

    // Lê os dados enviados na requisição
    const { planTier, planInterval } = await req.json();
    if (!planTier || !planInterval) {
      throw new Error("planTier e planInterval são obrigatórios.");
    }

    // Determina o valor do plano
    let value = 19.90;
    if (planTier === "basic") {
      value = planInterval === "year" ? 199.00 : 19.90;
    } else if (planTier === "premium") {
      value = planInterval === "year" ? 349.00 : 34.90;
    }

    // Inicializa cliente Supabase de backend com a Service Role Key
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Cria a sessão de Checkout do Stripe
    const appUrl = Deno.env.get("APP_URL") || req.headers.get("origin") || "http://localhost:5173";
    
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Assinatura Bastidor - Plano ${planTier === "premium" ? "Premium" : "Básico"}`,
              description: `Acesso completo aos recursos do plano ${planTier === "premium" ? "Premium" : "Básico"}`,
            },
            unit_amount: Math.round(value * 100),
            recurring: {
              interval: planInterval === "year" ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}?payment=success`,
      cancel_url: `${appUrl}?payment=cancel`,
      metadata: {
        userId: user.id,
        planTier: planTier,
        planInterval: planInterval,
      },
    });

    // Salva ou atualiza a assinatura inicial na tabela com status 'pending'
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + (planInterval === "year" ? 365 : 30));

    await supabaseAdmin.from("subscriptions").upsert({
      user_id: user.id,
      stripe_checkout_url: session.url,
      status: "pending",
      plan_tier: planTier,
      plan_interval: planInterval,
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
