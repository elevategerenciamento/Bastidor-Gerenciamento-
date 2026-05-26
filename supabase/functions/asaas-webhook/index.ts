// Supabase Edge Function: asaas-webhook
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

serve(async (req) => {
  try {
    // Validação de token de segurança (opcional, configurado no Asaas e no Supabase)
    const asaasWebhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (asaasWebhookToken) {
      const headerToken = req.headers.get("asaas-access-token");
      if (headerToken !== asaasWebhookToken) {
        return new Response("Não autorizado", { status: 401 });
      }
    }

    const body = await req.json();
    const eventType = body.event;
    console.log(`Evento recebido do Asaas: ${eventType}`);

    // Inicializa o cliente Supabase admin (ignora RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
      const payment = body.payment;
      const subId = payment.subscription; // ID da assinatura vinculada ao pagamento

      if (subId) {
        // Busca a assinatura correspondente no banco
        const { data: currentSub } = await supabaseAdmin
          .from("subscriptions")
          .select("plan_interval, user_id")
          .eq("asaas_subscription_id", subId)
          .maybeSingle();

        if (currentSub) {
          const interval = currentSub.plan_interval || "month";
          const newPeriodEnd = new Date();
          newPeriodEnd.setDate(newPeriodEnd.getDate() + (interval === "year" ? 365 : 30));

          const { error } = await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "active",
              current_period_end: newPeriodEnd.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("asaas_subscription_id", subId);

          if (error) {
            console.error("Erro ao ativar assinatura no banco:", error);
          } else {
            console.log(`Assinatura ${subId} ativada para o usuário ${currentSub.user_id}`);
          }
        } else {
          console.error(`Assinatura ${subId} não encontrada no banco de dados local.`);
        }
      }
    } else if (eventType === "SUBSCRIPTION_DELETED" || eventType === "SUBSCRIPTION_DISABLED") {
      const subscription = body.subscription;
      const subId = subscription.id;

      if (subId) {
        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("asaas_subscription_id", subId);

        if (error) {
          console.error("Erro ao cancelar assinatura no banco:", error);
        } else {
          console.log(`Assinatura ${subId} marcada como cancelada.`);
        }
      }
    } else if (eventType === "PAYMENT_OVERDUE") {
      const payment = body.payment;
      const subId = payment.subscription;

      if (subId) {
        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "overdue",
            updated_at: new Date().toISOString(),
          })
          .eq("asaas_subscription_id", subId);

        if (error) {
          console.error("Erro ao marcar assinatura como atrasada no banco:", error);
        } else {
          console.log(`Assinatura ${subId} marcada como atrasada (vencida).`);
        }
      }
    }

    return new Response("Webhook processado com sucesso", { status: 200 });
  } catch (err: any) {
    console.error("Erro no processamento do webhook do Asaas:", err);
    return new Response(`Erro interno: ${err.message}`, { status: 500 });
  }
});
