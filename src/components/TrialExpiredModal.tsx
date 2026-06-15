import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Sparkles, CreditCard, LogOut, Lock, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TrialExpiredModalProps {
  onLogout: () => void;
  onSubscriptionSuccess: () => void;
  userName?: string;
}

export default function TrialExpiredModal({ onLogout, onSubscriptionSuccess, userName }: TrialExpiredModalProps) {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubscribe = async (planTier: 'basic' | 'premium', planInterval: 'month' | 'year') => {
    const planKey = `${planTier}_${planInterval}`;
    try {
      setLoadingPlan(planKey);
      setErrorMessage(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Você precisa estar logada para assinar um plano.');

      const response = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/create-stripe-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ planTier, planInterval }),
        }
      );

      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Erro ao gerar checkout.');

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('Erro de Checkout:', err);
      setErrorMessage(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: 'linear-gradient(135deg, #3B1F2B 0%, #5C2D3F 50%, #3B1F2B 100%)' }}
    >
      {/* Elementos decorativos de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 border-[40px] border-white/5 rounded-full" />
        <div className="absolute bottom-[-10%] left-[-15%] w-80 h-80 border-[30px] border-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-[60px] border-white/3 rounded-full" />
      </div>

      {/* Conteúdo com scroll */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start py-8 px-4">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-2xl"
        >
          {/* Header */}
          <div className="text-center mb-8 mt-4">
            {/* Ícone de cadeado animado */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
              style={{ background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)' }}
            >
              <Lock className="w-10 h-10 text-white/80" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <Clock className="w-3.5 h-3.5 text-white/60" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Período de teste encerrado</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tighter mb-3 lowercase">
                olá{userName ? `, ${userName.split(' ')[0].toLowerCase()}` : ''}! 👋
              </h1>
              <p className="text-white/60 text-sm font-medium leading-relaxed max-w-md mx-auto">
                Seu teste grátis de 15 dias acabou, mas <strong className="text-white/90">todos os seus dados estão salvos</strong> e esperando por você.
                Escolha um plano para continuar usando o Bastidor.
              </p>
            </motion.div>
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-2xl text-center text-sm font-bold text-red-200"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              ⚠️ {errorMessage}
            </motion.div>
          )}

          {/* Toggle Mensal/Anual */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex justify-center items-center gap-4 mb-6"
          >
            <span className={`text-xs font-black uppercase tracking-wider transition-colors ${billingPeriod === 'monthly' ? 'text-white' : 'text-white/40'}`}>
              Mensal
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className="w-14 h-8 rounded-full p-1 transition-all relative flex items-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-6 h-6 bg-white rounded-full shadow-md"
                style={{ marginLeft: billingPeriod === 'monthly' ? '0' : '24px' }}
              />
            </button>
            <span className={`text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${billingPeriod === 'yearly' ? 'text-white' : 'text-white/40'}`}>
              Anual
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter"
                style={{ background: '#C9A84C', color: 'white' }}
              >
                Economize
              </span>
            </span>
          </motion.div>

          {/* Cards de planos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid md:grid-cols-2 gap-4 mb-8"
          >
            {/* Plano Básico */}
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              className="rounded-[28px] p-6 flex flex-col justify-between"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1.5px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-serif font-black text-white">Básico</h3>
                  <p className="text-xs text-white/50 font-medium mt-1">Para ateliês que estão começando.</p>
                </div>

                <div>
                  <span className="text-3xl font-serif font-black text-white">
                    {billingPeriod === 'monthly' ? 'R$ 19,90' : 'R$ 199,00'}
                  </span>
                  <span className="text-xs text-white/40 font-bold">
                    {billingPeriod === 'monthly' ? ' / mês' : ' / ano'}
                  </span>
                  {billingPeriod === 'yearly' && (
                    <div className="text-[10px] font-bold mt-1" style={{ color: '#C9A84C' }}>Equivalente a R$ 16,58/mês</div>
                  )}
                </div>

                <ul className="space-y-2.5 pt-1">
                  {[
                    'Até 15 ordens de serviço ativas',
                    'Até 20 itens no estoque',
                    'Até 2 relatórios PDF por mês',
                    'Até 1 planilha XLS por mês',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-xs text-white/70 font-medium">
                      <div className="rounded-full p-0.5 mt-0.5 flex-shrink-0"
                        style={{ background: 'rgba(134,239,172,0.2)', color: '#86efac' }}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                  {['Relatórios personalizados por período', 'Suporte prioritário'].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-xs text-white/25 font-medium line-through">
                      <div className="rounded-full p-0.5 mt-0.5 flex-shrink-0"
                        style={{ background: 'rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.6)' }}>
                        <X className="w-3 h-3" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSubscribe('basic', billingPeriod === 'monthly' ? 'month' : 'year')}
                disabled={loadingPlan !== null}
                className="mt-6 w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  color: 'white'
                }}
              >
                {loadingPlan === `basic_${billingPeriod === 'monthly' ? 'month' : 'year'}` ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Assinar Básico
                  </>
                )}
              </button>
            </motion.div>

            {/* Plano Premium */}
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              className="rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #C9A84C 0%, #E8C76B 50%, #C9A84C 100%)',
                border: '2px solid #E8C76B',
              }}
            >
              {/* Tag Premium */}
              <div className="absolute top-5 right-[-32px] text-white text-[9px] font-black py-1 px-10 rotate-45 uppercase tracking-widest shadow-md"
                style={{ background: '#3B1F2B' }}>
                Popular
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black mb-1"
                    style={{ color: '#3B1F2B' }}>
                    <Sparkles className="w-3 h-3" /> Recomendado
                  </div>
                  <h3 className="text-2xl font-serif font-black" style={{ color: '#3B1F2B' }}>Premium ✦</h3>
                  <p className="text-xs font-medium mt-1" style={{ color: 'rgba(59,31,43,0.7)' }}>
                    Acesso completo para impulsionar seu ateliê.
                  </p>
                </div>

                <div>
                  <span className="text-3xl font-serif font-black" style={{ color: '#3B1F2B' }}>
                    {billingPeriod === 'monthly' ? 'R$ 34,90' : 'R$ 349,00'}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'rgba(59,31,43,0.6)' }}>
                    {billingPeriod === 'monthly' ? ' / mês' : ' / ano'}
                  </span>
                  {billingPeriod === 'yearly' && (
                    <div className="text-[10px] font-bold mt-1" style={{ color: '#3B1F2B' }}>Equivalente a R$ 29,08/mês</div>
                  )}
                </div>

                <ul className="space-y-2.5 pt-1">
                  {[
                    'Ordens de serviço ilimitadas',
                    'Estoque e insumos ilimitados',
                    'Relatórios PDF ilimitados',
                    'Planilhas XLS ilimitadas',
                    'Relatórios personalizados por período',
                    'Suporte prioritário e novidades',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-xs font-medium" style={{ color: 'rgba(59,31,43,0.9)' }}>
                      <div className="rounded-full p-0.5 mt-0.5 flex-shrink-0"
                        style={{ background: 'rgba(59,31,43,0.15)', color: '#3B1F2B' }}>
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSubscribe('premium', billingPeriod === 'monthly' ? 'month' : 'year')}
                disabled={loadingPlan !== null}
                className="mt-6 w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:opacity-90 disabled:opacity-50"
                style={{ background: '#3B1F2B', color: 'white', border: 'none' }}
              >
                {loadingPlan === `premium_${billingPeriod === 'monthly' ? 'month' : 'year'}` ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Assinar Premium
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>

          {/* Rodapé — dados salvos + botão sair */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center pb-8 space-y-4"
          >
            <div className="flex items-center justify-center gap-2 text-white/40 text-xs font-medium">
              <div className="h-px flex-1 max-w-[80px]" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span>✦ seus dados estão seguros e salvos ✦</span>
              <div className="h-px flex-1 max-w-[80px]" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 text-xs font-bold text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair da conta
            </button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
