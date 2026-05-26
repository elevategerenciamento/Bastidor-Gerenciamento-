// Supabase Edge Function: stripe-webhook
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import Stripe from "https://esm.sh/stripe@14.22.0?target=deno";

serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Assinatura ausente", { status: 400 });
    }

    // Lê o body raw para verificação
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Erro ao validar assinatura do webhook: ${err.message}`);
      return new Response(`Erro de webhook: ${err.message}`, { status: 400 });
    }

    // Inicializa o cliente Supabase admin (ignora RLS para atualização)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Evento recebido: ${event.type}`);

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const subscriptionId = subscription.id;
      const status = subscription.status; // 'active', 'canceled', etc.

      // Se a assinatura foi deletada (cancelamento completo e expiração do período)
      if (event.type === "customer.subscription.deleted") {
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        console.log(`Assinatura ${subscriptionId} marcada como cancelada.`);
        return new Response("Webhook processado", { status: 200 });
      }

      // Obtém o preço e as informações de intervalo
      const price = subscription.items.data[0].price;
      const priceId = price.id;
      const planInterval = price.recurring?.interval || "month";

      // Busca os metadados do produto no Stripe para determinar se é basic ou premium
      let planTier = "basic"; // fallback
      try {
        const product = await stripe.products.retrieve(price.product as string);
        if (product.metadata && product.metadata.plan_tier) {
          planTier = product.metadata.plan_tier; // 'basic' ou 'premium'
        }
      } catch (err) {
        console.error("Erro ao obter metadados do produto do Stripe:", err);
      }

      const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

      // Identifica o ID do usuário do Supabase
      // Primeiramente tenta pegar dos metadados da assinatura
      let userId = subscription.metadata?.supabase_user_id;

      // Se não estiver lá, tenta buscar pelo Stripe Customer ID existente em nossa tabela
      if (!userId) {
        const { data: userSub } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        userId = userSub?.user_id;
      }

      // Se ainda assim não encontrar, tenta buscar o cliente no Stripe para ver se há o ID no metadado
      if (!userId) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (!customer.deleted && customer.metadata && customer.metadata.supabase_user_id) {
            userId = customer.metadata.supabase_user_id;
          }
        } catch (err) {
          console.error("Erro ao buscar cliente no Stripe:", err);
        }
      }

      if (!userId) {
        console.error(`Não foi possível associar o Stripe Customer ID ${customerId} a um usuário do Supabase.`);
        return new Response("Usuário não encontrado", { status: 400 });
      }

      // Faz o upsert dos dados da assinatura na tabela
      const { error: upsertError } = await supabaseAdmin
        .from("subscriptions")
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: status,
          plan_tier: planTier,
          plan_interval: planInterval,
          price_id: priceId,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Erro ao fazer upsert da assinatura no banco de dados:", upsertError);
        return new Response("Erro no banco de dados", { status: 500 });
      }

      console.log(`Assinatura do usuário ${userId} atualizada: ${planTier} (${planInterval}) - Status: ${status}`);
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (userId && subscriptionId) {
        // Vincula o customer_id ao usuário caso não tenha sido vinculado
        // O webhook de subscription.created/updated normalmente já roda,
        // mas isso garante que os IDs básicos sejam gravados.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const price = subscription.items.data[0].price;
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const planInterval = price.recurring?.interval || "month";

        let planTier = "basic";
        try {
          const product = await stripe.products.retrieve(price.product as string);
          if (product.metadata && product.metadata.plan_tier) {
            planTier = product.metadata.plan_tier;
          }
        } catch (err) {
          console.error("Erro ao obter metadados do produto do Stripe:", err);
        }

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: subscription.status,
            plan_tier: planTier,
            plan_interval: planInterval,
            price_id: price.id,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (error) {
          console.error("Erro ao processar checkout.session.completed no banco de dados:", error);
        }
      }
    }

    return new Response("Webhook processado com sucesso", { status: 200 });
  } catch (err: any) {
    console.error("Erro geral no processamento do webhook:", err);
    return new Response(`Erro interno: ${err.message}`, { status: 500 });
  }
});
