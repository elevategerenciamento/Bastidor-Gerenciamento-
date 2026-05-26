// Supabase Edge Function: create-asaas-subscription
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

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
    const asaasUrl = Deno.env.get("ASAAS_API_URL") || "https://sandbox.asaas.com/api/v3";
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY") ?? "";

    if (!asaasApiKey) {
      throw new Error("Chave de API do Asaas não configurada.");
    }

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

    // Determina o valor do plano e o ciclo
    let value = 19.90;
    let cycle = "MONTHLY";

    if (planTier === "basic") {
      value = planInterval === "year" ? 199.00 : 19.90;
      cycle = planInterval === "year" ? "YEARLY" : "MONTHLY";
    } else if (planTier === "premium") {
      value = planInterval === "year" ? 349.00 : 34.90;
      cycle = planInterval === "year" ? "YEARLY" : "MONTHLY";
    }

    // Inicializa cliente Supabase de backend com a Service Role Key
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verifica se o usuário já tem um asaas_customer_id registrado
    const { data: subscriptionData } = await supabaseAdmin
      .from("subscriptions")
      .select("asaas_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = subscriptionData?.asaas_customer_id;

    if (!customerId) {
      // Cria um novo cliente no Asaas
      const customerName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Cliente Bastidor";
      const customerResponse = await fetch(`${asaasUrl}/customers`, {
        method: "POST",
        headers: {
          "access_token": asaasApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: customerName,
          email: user.email,
        }),
      });

      const customer = await customerResponse.json();
      if (!customerResponse.ok) {
        throw new Error(customer.errors?.[0]?.description || "Erro ao criar cliente no Asaas.");
      }
      customerId = customer.id;
    }

    // Define o vencimento da primeira parcela (nextDueDate) para amanhã
    // (O Asaas exige que o vencimento de uma assinatura seja no futuro)
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const nextDueDateStr = nextDueDate.toISOString().split("T")[0];

    // Cria a assinatura no Asaas
    const subResponse = await fetch(`${asaasUrl}/subscriptions`, {
      method: "POST",
      headers: {
        "access_token": asaasApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED", // Permite o cliente escolher PIX, Cartão ou Boleto
        value: value,
        nextDueDate: nextDueDateStr,
        cycle: cycle,
        description: `Assinatura Bastidor - Plano ${planTier === "premium" ? "Premium" : "Básico"}`,
        externalReference: user.id,
      }),
    });

    const subscription = await subResponse.json();
    if (!subResponse.ok) {
      throw new Error(subscription.errors?.[0]?.description || "Erro ao criar assinatura no Asaas.");
    }

    // Busca as cobranças da assinatura para pegar a invoiceUrl da primeira fatura
    const paymentsResponse = await fetch(`${asaasUrl}/payments?subscription=${subscription.id}`, {
      method: "GET",
      headers: {
        "access_token": asaasApiKey,
      },
    });

    const paymentsData = await paymentsResponse.json();
    const firstPayment = paymentsData.data?.[0];
    const invoiceUrl = firstPayment?.invoiceUrl || subscription.invoiceUrl || "https://asaas.com";

    // Salva ou atualiza a assinatura inicial na tabela com status 'pending'
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + (planInterval === "year" ? 365 : 30));

    await supabaseAdmin.from("subscriptions").upsert({
      user_id: user.id,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscription.id,
      asaas_invoice_url: invoiceUrl,
      status: "pending",
      plan_tier: planTier,
      plan_interval: planInterval,
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ url: invoiceUrl }), {
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
