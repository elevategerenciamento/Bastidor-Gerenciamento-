import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Sparkles, CreditCard, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

const formatCpfCnpj = (value: string) => {
  const clean = value.replace(/[^\d]/g, '');
  
  if (clean.length <= 11) {
    // CPF: 000.000.000-00
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
    if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  } else {
    // CNPJ: 00.000.000/0000-00
    const limited = clean.slice(0, 14);
    if (limited.length <= 12) {
      return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;
    }
    return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12, 14)}`;
  }
};

interface SubscriptionModalProps {
  onClose: () => void;
  currentPlan?: string | null; // 'basic', 'premium' ou null
  subscriptionStatus?: string | null; // 'active', 'pending', etc.
  invoiceUrl?: string | null; // URL da fatura no Asaas
  onSubscriptionUpdated?: () => Promise<void>;
}

export default function SubscriptionModal({ onClose, currentPlan, subscriptionStatus, invoiceUrl, onSubscriptionUpdated }: SubscriptionModalProps) {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cpfCnpj, setCpfCnpj] = useState('');

  const isSubscribed = currentPlan && subscriptionStatus === 'active';
  const isPending = currentPlan && subscriptionStatus === 'pending';

  const handleSubscribe = async (planTier: 'basic' | 'premium', planInterval: 'month' | 'year') => {
    const planKey = `${planTier}_${planInterval}`;
    try {
      setLoadingPlan(planKey);
      setErrorMessage(null);

      // Validação do CPF/CNPJ
      const cleanCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');
      if (!cleanCpfCnpj) {
        throw new Error('Por favor, insira o seu CPF ou CNPJ de faturamento antes de prosseguir.');
      }
      if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
        throw new Error('Por favor, insira um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      }

      // Obtém a sessão do usuário logado
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado para assinar um plano.');
      }

      // Chama a Edge Function no Supabase para criar a assinatura no Asaas
      const response = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/create-asaas-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            planTier: planTier,
            planInterval: planInterval,
            cpfCnpj: cleanCpfCnpj,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Erro ao gerar checkout com o Asaas.');
      }

      if (data.url) {
        // Redireciona o usuário para a fatura do Asaas
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Erro de Checkout Asaas:', err);
      setErrorMessage(err.message || 'Ocorreu um erro inesperado ao conectar ao Asaas.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleOpenInvoice = () => {
    if (invoiceUrl) {
      window.location.href = invoiceUrl;
    } else {
      setErrorMessage('Link de faturamento não encontrado. Verifique seu e-mail ou SMS cadastrado no Asaas.');
    }
  };

  const handleCancelPending = async () => {
    try {
      setLoadingPlan('cancel_pending');
      setErrorMessage(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado para realizar esta ação.');
      }

      // Deleta a assinatura pendente do banco de dados
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', session.user.id);

      if (error) {
        throw error;
      }

      if (onSubscriptionUpdated) {
        await onSubscriptionUpdated();
      }
    } catch (err: any) {
      console.error('Erro ao cancelar assinatura pendente:', err);
      setErrorMessage(err.message || 'Ocorreu um erro ao cancelar a assinatura pendente.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-[150] flex items-start md:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        className="bg-creme max-w-4xl w-full rounded-[24px] md:rounded-[40px] shadow-2xl border-2 border-rosa overflow-hidden relative my-2 md:my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Botão de Fechar */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 md:right-6 md:top-6 p-2 bg-white/10 hover:bg-vinho/10 rounded-full text-vinho transition-all z-10"
        >
          <X className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        <div className="p-4 sm:p-8 md:p-12 space-y-6 md:space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rosa/20 rounded-full text-xs font-black text-vinho uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-dourado fill-dourado" /> Assinaturas
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-black text-vinho lowercase">
              {isSubscribed ? 'sua assinatura ativa' : isPending ? 'pagamento pendente' : 'escolha o plano ideal para seu ateliê'}
            </h2>
            <p className="text-cinza text-sm font-medium leading-relaxed">
              {isSubscribed 
                ? 'Gerencie seus pagamentos, altere sua periodicidade ou mude de plano através das suas faturas.'
                : isPending
                ? 'Identificamos que você gerou uma fatura de faturamento. Efetue o pagamento por PIX, Cartão ou Boleto para liberar o acesso.'
                : 'Tenha seu ateliê organizado e leve com acesso a mais recursos de controle e relatórios.'}
            </p>
          </div>

          {errorMessage && (
            <div className="bg-vermelho/5 border border-vermelho/20 text-vermelho text-xs font-bold p-4 rounded-2xl text-center">
              ⚠️ {errorMessage}
            </div>
          )}

          {isSubscribed || isPending ? (
            /* Painel de Assinatura Ativa ou Pendente */
            <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 border border-rosa/30 shadow-md text-center max-w-md mx-auto space-y-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${isSubscribed ? 'bg-verde/10 text-verde' : 'bg-amarelo/10 text-amarelo'}`}>
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-2xl font-serif font-black text-vinho">
                  Plano {currentPlan === 'premium' ? 'Premium ✦' : 'Básico (Basic)'}
                </h4>
                <p className="text-xs text-cinza uppercase tracking-wider font-bold mt-1">
                  Status: {isSubscribed ? 'Assinatura Ativa' : 'Aguardando Pagamento'}
                </p>
              </div>
              <p className="text-sm text-cinza font-medium px-4">
                {isSubscribed 
                  ? 'Você tem acesso completo aos recursos. Clique no botão abaixo para acessar o histórico de faturas e pagamentos no seu painel.'
                  : 'Sua assinatura foi registrada. Clique no botão abaixo para abrir a fatura e escolher a forma de pagamento (PIX, Cartão ou Boleto).'}
              </p>
              
              <div className="space-y-3 w-full">
                <button
                  onClick={handleOpenInvoice}
                  disabled={loadingPlan !== null}
                  className="w-full bg-vinho text-creme py-3.5 md:py-4 rounded-2xl font-black text-sm hover:bg-opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <CreditCard className="w-5 h-5" />
                  {isSubscribed ? 'Visualizar Faturas' : 'Ir para o Pagamento'}
                </button>

                {!isSubscribed && isPending && (
                  <button
                    onClick={handleCancelPending}
                    disabled={loadingPlan !== null}
                    className="w-full bg-white border-2 border-rosa text-vinho py-3.5 md:py-4 rounded-2xl font-black text-sm hover:bg-rosa/15 transition-all shadow-sm flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    {loadingPlan === 'cancel_pending' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-vinho"></div>
                    ) : (
                      'Cancelar Assinatura Pendente'
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Tela de Escolha de Planos */
            <>
              {/* Campo CPF/CNPJ de faturamento */}
              <div className="max-w-md mx-auto bg-white rounded-[20px] md:rounded-[24px] p-4 md:p-6 border border-rosa/30 shadow-md space-y-3 mb-6 md:mb-8 text-left">
                <label className="block text-xs font-black text-vinho uppercase tracking-wider">
                  CPF ou CNPJ do Titular (Faturamento)
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={cpfCnpj}
                  maxLength={18}
                  onChange={(e) => {
                    setCpfCnpj(formatCpfCnpj(e.target.value));
                  }}
                  className="w-full bg-creme border-2 border-rosa/30 rounded-2xl px-4 py-3 text-sm text-vinho font-semibold placeholder:text-cinza/40 focus:outline-none focus:border-vinho transition-all"
                />
                <p className="text-[10px] text-cinza/70 font-medium leading-normal">
                  * Necessário para a geração de fatura e Pix de forma segura.
                </p>
              </div>

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
                    Economize
                  </span>
                </span>
              </div>

              {/* Cards dos Planos */}
              <div className="grid md:grid-cols-2 gap-4 md:gap-8 mt-4">
                {/* Plano Básico */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-[24px] md:rounded-[32px] p-5 md:p-8 border border-rosa/30 shadow-md flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="space-y-4 md:space-y-6">
                    <div>
                      <h3 className="text-2xl font-serif font-black text-vinho">Básico (Basic)</h3>
                      <p className="text-xs text-cinza font-medium mt-1">Para ateliês iniciantes estruturarem suas ordens.</p>
                    </div>

                    <div className="py-1 md:py-2">
                      <span className="text-3xl md:text-4xl font-serif font-black text-vinho">
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
                    <ul className="space-y-2 md:space-y-3 pt-1 md:pt-2">
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

                  <div className="pt-6 md:pt-8">
                    <button
                      onClick={() => handleSubscribe('basic', billingPeriod === 'monthly' ? 'month' : 'year')}
                      disabled={loadingPlan !== null}
                      className="w-full bg-white border-2 border-rosa text-vinho py-3 md:py-4 rounded-2xl font-black text-sm hover:bg-rosa/15 transition-all shadow-sm flex items-center justify-center"
                    >
                      {loadingPlan === `basic_${billingPeriod === 'monthly' ? 'month' : 'year'}` ? (
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
                  className="bg-vinho rounded-[24px] md:rounded-[32px] p-5 md:p-8 border-2 border-dourado/80 shadow-xl flex flex-col justify-between relative overflow-hidden text-creme"
                >
                  {/* Tag Premium */}
                  <div className="absolute top-5 right-[-35px] bg-dourado text-white text-[9px] font-black py-1 px-10 rotate-45 uppercase tracking-widest shadow-md">
                    Premium
                  </div>

                  <div className="space-y-4 md:space-y-6">
                    <div>
                      <div className="flex items-center gap-1 text-[10px] text-dourado uppercase tracking-widest font-black">
                        <Sparkles className="w-3 h-3 text-dourado fill-dourado" /> Recomendado
                      </div>
                      <h3 className="text-2xl font-serif font-black text-creme mt-0.5">Premium ✦</h3>
                      <p className="text-xs text-rosa/80 font-medium mt-1">Acesso completo e ilimitado para impulsionar seu ateliê.</p>
                    </div>

                    <div className="py-1 md:py-2">
                      <span className="text-3xl md:text-4xl font-serif font-black text-creme">
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
                    <ul className="space-y-2 md:space-y-3 pt-1 md:pt-2">
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

                  <div className="pt-6 md:pt-8">
                    <button
                      onClick={() => handleSubscribe('premium', billingPeriod === 'monthly' ? 'month' : 'year')}
                      disabled={loadingPlan !== null}
                      className="w-full bg-dourado text-white py-3 md:py-4 rounded-2xl font-black text-sm hover:bg-opacity-90 transition-all shadow-md flex items-center justify-center border-none"
                    >
                      {loadingPlan === `premium_${billingPeriod === 'monthly' ? 'month' : 'year'}` ? (
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
