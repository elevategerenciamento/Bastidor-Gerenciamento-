// Supabase Edge Function: stripe-webhook
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response("Assinatura ausente", { status: 400 });
  }

  const stripeApiKey = Deno.env.get("STRIPE_API_KEY") ?? "";
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const stripe = new Stripe(stripeApiKey, { apiVersion: "2023-10-16" });

  let event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
  } catch (err: any) {
    console.error(`Falha ao verificar assinatura do webhook da Stripe: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`Evento da Stripe recebido: ${event.type}`);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id || session.metadata?.userId;
    const subscriptionId = session.subscription;
    const customerId = session.customer;
    const planTier = session.metadata?.planTier;
    const planInterval = session.metadata?.planInterval;

    if (userId) {
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + (planInterval === "year" ? 365 : 30));

      const { error } = await supabaseAdmin
        .from("subscriptions")
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: "active",
          plan_tier: planTier,
          plan_interval: planInterval,
          current_period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) {
        console.error("Erro ao ativar assinatura no Supabase:", error);
      } else {
        console.log(`Assinatura do Stripe criada/ativada para o usuário ${userId}`);
      }
    }
  } else if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    const subId = subscription.id;
    const status = subscription.status === "active" ? "active" : subscription.status === "unpaid" ? "overdue" : "pending";
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: status,
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subId);

    if (error) {
      console.error(`Erro ao atualizar assinatura ${subId}:`, error);
    } else {
      console.log(`Assinatura ${subId} atualizada.`);
    }
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const subId = subscription.id;

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subId);

    if (error) {
      console.error(`Erro ao cancelar assinatura ${subId}:`, error);
    } else {
      console.log(`Assinatura ${subId} marcada como cancelada.`);
    }
  }

  return new Response("Webhook processado com sucesso", { status: 200 });
});
