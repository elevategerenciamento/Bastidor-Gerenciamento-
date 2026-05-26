import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Sparkles, CreditCard, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

// IDs dos Preços do Stripe - Podem ser editados aqui ou via variáveis de ambiente (.env)
export const STRIPE_PRICES = {
  BASIC_MONTHLY: (import.meta as any).env.VITE_STRIPE_BASIC_MONTHLY || 'price_1PBasicMonthlyXXX',
  BASIC_YEARLY: (import.meta as any).env.VITE_STRIPE_BASIC_YEARLY || 'price_1PBasicYearlyXXX',
  PREMIUM_MONTHLY: (import.meta as any).env.VITE_STRIPE_PREMIUM_MONTHLY || 'price_1PPremiumMonthlyXXX',
  PREMIUM_YEARLY: (import.meta as any).env.VITE_STRIPE_PREMIUM_YEARLY || 'price_1PPremiumYearlyXXX',
};

interface SubscriptionModalProps {
  onClose: () => void;
  currentPlan?: string | null; // 'basic', 'premium' ou null
  subscriptionStatus?: string | null; // 'active', etc.
}

export default function SubscriptionModal({ onClose, currentPlan, subscriptionStatus }: SubscriptionModalProps) {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubscribed = currentPlan && subscriptionStatus === 'active';

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoadingPriceId(priceId);
      setErrorMessage(null);

      // Obtém a sessão do usuário logado
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado para assinar um plano.');
      }

      // Chama a Edge Function no Supabase
      const response = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            priceId: priceId,
            successUrl: window.location.origin + '/?payment=success',
            cancelUrl: window.location.origin + '/?payment=cancel',
          }),
        }
      );

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Erro ao gerar checkout. Verifique se o preço está correto.');
      }

      if (data.url) {
        // Redireciona o usuário para o Stripe Checkout
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Erro de Checkout:', err);
      setErrorMessage(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoadingPriceId('portal');
      setErrorMessage(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado.');
      }

      // Chama a Edge Function para o portal de faturamento
      const response = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            returnUrl: window.location.origin + '/',
          }),
        }
      );

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Erro ao acessar o portal de cobrança.');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Erro de Portal:', err);
      setErrorMessage(err.message || 'Erro ao carregar configurações de assinatura.');
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        className="bg-creme max-w-4xl w-full rounded-[40px] shadow-2xl border-2 border-rosa overflow-hidden relative my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Botão de Fechar */}
        <button 
          onClick={onClose}
          className="absolute right-6 top-6 p-2 bg-white/10 hover:bg-vinho/10 rounded-full text-vinho transition-all z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8 md:p-12 space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rosa/20 rounded-full text-xs font-black text-vinho uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-dourado fill-dourado" /> Planos Bastidor
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-black text-vinho lowercase">
              {isSubscribed ? 'sua assinatura atual' : 'escolha o plano ideal para seu ateliê'}
            </h2>
            <p className="text-cinza text-sm font-medium leading-relaxed">
              {isSubscribed 
                ? 'Gerencie seus pagamentos, altere sua periodicidade ou mude de plano no botão de gerenciamento abaixo.'
                : 'Tenha seu ateliê organizado e leve com acesso a mais recursos de controle e relatórios.'}
            </p>
          </div>

          {errorMessage && (
            <div className="bg-vermelho/5 border border-vermelho/20 text-vermelho text-xs font-bold p-4 rounded-2xl text-center">
              ⚠️ {errorMessage}
            </div>
          )}

          {isSubscribed ? (
            /* Painel de Assinatura Ativa */
            <div className="bg-white rounded-[32px] p-8 border border-rosa/30 shadow-md text-center max-w-md mx-auto space-y-6">
              <div className="bg-verde/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-verde">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-2xl font-serif font-black text-vinho">
                  Plano {currentPlan === 'premium' ? 'Premium ✦' : 'Básico (Basic)'}
                </h4>
                <p className="text-xs text-cinza uppercase tracking-wider font-bold mt-1">
                  Status: Assinatura Ativa
                </p>
              </div>
              <p className="text-sm text-cinza font-medium px-4">
                Você tem acesso aos recursos inclusos no seu plano. Para trocar de cartão, mudar de plano ou cancelar, utilize o portal seguro do Stripe.
              </p>
              <button
                onClick={handleManageSubscription}
                disabled={loadingPriceId === 'portal'}
                className="w-full bg-vinho text-creme py-4 rounded-2xl font-black text-sm hover:bg-opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                {loadingPriceId === 'portal' ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-creme"></div>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Gerenciar Assinatura
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Tela de Escolha de Planos */
            <>
              {/* Toggle Mensal/Anual */}
              <div className="flex justify-center items-center gap-4">
                <span className={`text-xs font-black uppercase tracking-wider transition-colors ${billingPeriod === 'monthly' ? 'text-vinho' : 'text-cinza/60'}`}>
                  Mensal
                </span>
                <button 
                  onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
                  className="w-14 h-8 bg-vinho rounded-full p-1 transition-all relative flex items-center"
                >
                  <motion.div 
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="w-6 h-6 bg-creme rounded-full shadow-md"
                    style={{ marginLeft: billingPeriod === 'monthly' ? '0' : '24px' }}
                  />
                </button>
                <span className={`text-xs font-black uppercase tracking-wider transition-colors ${billingPeriod === 'yearly' ? 'text-vinho' : 'text-cinza/60'} flex items-center gap-1.5`}>
                  Anual 
                  <span className="text-[9px] bg-dourado text-white font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                    -20%
                  </span>
                </span>
              </div>

              {/* Cards dos Planos */}
              <div className="grid md:grid-cols-2 gap-8 mt-4">
                {/* Plano Básico */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-[32px] p-8 border border-rosa/30 shadow-md flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-serif font-black text-vinho">Básico (Basic)</h3>
                      <p className="text-xs text-cinza font-medium mt-1">Para ateliês iniciantes estruturarem suas ordens.</p>
                    </div>

                    <div className="py-2">
                      <span className="text-4xl font-serif font-black text-vinho">
                        {billingPeriod === 'monthly' ? 'R$ 19,90' : 'R$ 199,00'}
                      </span>
                      <span className="text-xs text-cinza font-bold">
                        {billingPeriod === 'monthly' ? ' / mês' : ' / ano'}
                      </span>
                      {billingPeriod === 'yearly' && (
                        <div className="text-[10px] text-dourado font-bold mt-1">Equivalente a R$ 16,58/mês</div>
                      )}
                    </div>

                    {/* Vantagens */}
                    <ul className="space-y-3 pt-2">
                      <li className="flex items-start gap-3 text-xs text-cinza font-medium">
                        <div className="bg-verde/15 text-verde rounded-full p-0.5 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                        <span>Até 15 ordens de serviço (pedidos) ativas</span>
                      </li>
                      <li className="flex items-start gap-3 text-xs text-cinza font-medium">
                        <div className="bg-verde/15 text-verde rounded-full p-0.5 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                        <span>Até 20 itens cadastrados no estoque</span>
                      </li>
                      <li className="flex items-start gap-3 text-xs text-cinza font-medium">
                        <div className="bg-verde/15 text-verde rounded-full p-0.5 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                        <span>Até 2 downloads de relatório PDF por mês</span>
                      </li>
                      <li className="flex items-start gap-3 text-xs text-cinza font-medium text-cinza/40 line-through">
                        <div className="bg-vermelho/10 text-vermelho rounded-full p-0.5 mt-0.5"><X className="w-3.5 h-3.5" /></div>
                        <span>Relatórios personalizados por período</span>
                      </li>
                      <li className="flex items-start gap-3 text-xs text-cinza font-medium text-cinza/40 line-through">
                        <div className="bg-vermelho/10 text-vermelho rounded-full p-0.5 mt-0.5"><X className="w-3.5 h-3.5" /></div>
                        <span>Suporte prioritário a dúvidas</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-8">
                    <button
                      onClick={() => handleSubscribe(billingPeriod === 'monthly' ? STRIPE_PRICES.BASIC_MONTHLY : STRIPE_PRICES.BASIC_YEARLY)}
                      disabled={loadingPriceId !== null}
                      className="w-full bg-white border-2 border-rosa text-vinho py-4 rounded-2xl font-black text-sm hover:bg-rosa/15 transition-all shadow-sm flex items-center justify-center"
                    >
                      {loadingPriceId === (billingPeriod === 'monthly' ? STRIPE_PRICES.BASIC_MONTHLY : STRIPE_PRICES.BASIC_YEARLY) ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-vinho"></div>
                      ) : (
                        'Assinar Básico'
                      )}
                    </button>
                  </div>
                </motion.div>

                {/* Plano Premium */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-vinho rounded-[32px] p-8 border-2 border-dourado/80 shadow-xl flex flex-col justify-between relative overflow-hidden text-creme"
                >
                  {/* Tag Mais Popular */}
                  <div className="absolute top-5 right-[-35px] bg-dourado text-white text-[9px] font-black py-1 px-10 rotate-45 uppercase tracking-widest shadow-md">
                    Premium
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-1 text-[10px] text-dourado uppercase tracking-widest font-black">
                        <Sparkles className="w-3 h-3 text-dourado fill-dourado" /> Recomendado
                      </div>
                      <h3 className="text-2xl font-serif font-black text-creme mt-0.5">Premium ✦</h3>
                      <p className="text-xs text-rosa/80 font-medium mt-1">Acesso completo e ilimitado para impulsionar seu ateliê.</p>
                    </div>

                    <div className="py-2">
                      <span className="text-4xl font-serif font-black text-creme">
                        {billingPeriod === 'monthly' ? 'R$ 34,90' : 'R$ 349,00'}
                      </span>
                      <span className="text-xs text-rosa/60 font-bold">
                        {billingPeriod === 'monthly' ? ' / mês' : ' / ano'}
                      </span>
                      {billingPeriod === 'yearly' && (
                        <div className="text-[10px] text-dourado font-bold mt-1">Equivalente a R$ 29,08/mês</div>
                      )}
                    </div>

                    {/* Vantagens */}
                    <ul className="space-y-3 pt-2">
                      <li className="flex items-start gap-3 text-xs text-rosa/95 font-medium">
                        <div className="bg-dourado/20 text-dourado rounded-full p-0.5 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                        <span>Ordens de serviço (pedidos) ilimitadas</span>
                      </li>
                      <li className="flex items-start gap-3 text-xs text-rosa/95 font-medium">
                        <div className="bg-dourado/20 text-dourado rounded-full p-0.5 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                        <span>Estoque e insumos ilimitados</span>
                      </li>
                      <li className="flex items-start gap-3 text-xs text-rosa/95 font-medium">
                        <div className="bg-dourado/20 text-dourado rounded-full p-0.5 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                        <span>Downloads de relatórios PDF ilimitados</span>
                      </li>
                      <li className="flex items-start gap-3 text-xs text-rosa/95 font-medium">
                        <div className="bg-dourado/20 text-dourado rounded-full p-0.5 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                        <span>Relatórios personalizados por período</span>
                      </li>
                      <li className="flex items-start gap-3 text-xs text-rosa/95 font-medium">
                        <div className="bg-dourado/20 text-dourado rounded-full p-0.5 mt-0.5"><Check className="w-3.5 h-3.5" /></div>
                        <span>Suporte prioritário e novidades exclusivas</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-8">
                    <button
                      onClick={() => handleSubscribe(billingPeriod === 'monthly' ? STRIPE_PRICES.PREMIUM_MONTHLY : STRIPE_PRICES.PREMIUM_YEARLY)}
                      disabled={loadingPriceId !== null}
                      className="w-full bg-dourado text-white py-4 rounded-2xl font-black text-sm hover:bg-opacity-90 transition-all shadow-md flex items-center justify-center border-none"
                    >
                      {loadingPriceId === (billingPeriod === 'monthly' ? STRIPE_PRICES.PREMIUM_MONTHLY : STRIPE_PRICES.PREMIUM_YEARLY) ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      ) : (
                        'Assinar Premium'
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
