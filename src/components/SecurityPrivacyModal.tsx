import React from 'react';
import { motion } from 'motion/react';
import { X, Shield, Lock, EyeOff, Server, CheckCircle2, ShieldCheck } from 'lucide-react';

interface SecurityPrivacyModalProps {
  onClose: () => void;
}

export default function SecurityPrivacyModal({ onClose }: SecurityPrivacyModalProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/70 backdrop-blur-md z-[150] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-[#Fdfbf7] max-w-[800px] w-full rounded-[32px] md:rounded-[48px] shadow-2xl overflow-hidden relative my-8 border border-white/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Premium */}
        <div className="bg-gradient-to-br from-vinho via-[#5c4331] to-[#3a281c] p-10 md:p-14 text-center relative overflow-hidden">
          {/* Fundo Decorativo */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none flex items-center justify-center">
            <ShieldCheck className="w-[120%] h-[120%] text-creme opacity-10 -rotate-12 transform scale-150" />
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-dourado/50 to-transparent" />

          <button 
            onClick={onClose}
            className="absolute right-5 top-5 md:right-6 md:top-6 p-2.5 bg-white/10 hover:bg-white/25 rounded-full text-creme transition-all z-20 backdrop-blur-sm"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          
          <div className="w-20 h-20 bg-gradient-to-tr from-white/5 to-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 relative z-10 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
            <Shield className="w-10 h-10 text-creme" />
          </div>
          <h2 className="text-3xl md:text-5xl font-serif font-black text-creme relative z-10 tracking-tight">Segurança e Privacidade</h2>
          <p className="text-creme/80 mt-4 font-medium text-sm md:text-base relative z-10 max-w-lg mx-auto leading-relaxed">
            O seu ateliê é como um cofre. Tratamos seus dados financeiros e de clientes com o mais alto padrão de segurança do mercado.
          </p>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-10 space-y-8 bg-gradient-to-b from-white/50 to-transparent">
          <div className="grid sm:grid-cols-2 gap-5 md:gap-6">
            
            {/* RLS */}
            <div className="bg-white/80 backdrop-blur-sm p-7 rounded-[28px] border border-rosa/20 shadow-xl shadow-vinho/5 hover:shadow-2xl hover:-translate-y-1.5 hover:border-verde/30 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute -top-16 -right-16 w-40 h-40 bg-verde/10 rounded-full blur-3xl group-hover:bg-verde/20 transition-all duration-500" />
              <div className="flex flex-col gap-5 relative z-10">
                <div className="w-14 h-14 bg-verde/10 text-verde rounded-2xl flex items-center justify-center flex-shrink-0 border border-verde/20 shadow-inner">
                  <EyeOff className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-vinho text-xl mb-2.5">Isolamento Total</h3>
                  <p className="text-[13px] md:text-sm text-cinza/80 font-medium leading-relaxed">
                    Aplicamos regras rígidas de banco de dados (RLS). Ninguém, em hipótese alguma, consegue acessar os valores, clientes ou pedidos do seu ateliê.
                  </p>
                </div>
              </div>
            </div>

            {/* Criptografia */}
            <div className="bg-white/80 backdrop-blur-sm p-7 rounded-[28px] border border-rosa/20 shadow-xl shadow-vinho/5 hover:shadow-2xl hover:-translate-y-1.5 hover:border-azul/30 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute -top-16 -right-16 w-40 h-40 bg-azul/10 rounded-full blur-3xl group-hover:bg-azul/20 transition-all duration-500" />
              <div className="flex flex-col gap-5 relative z-10">
                <div className="w-14 h-14 bg-azul/10 text-azul rounded-2xl flex items-center justify-center flex-shrink-0 border border-azul/20 shadow-inner">
                  <Lock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-vinho text-xl mb-2.5">Criptografia de Ponta</h3>
                  <p className="text-[13px] md:text-sm text-cinza/80 font-medium leading-relaxed">
                    Todas as informações transitam de forma criptografada via HTTPS/SSL. Seus dados estão protegidos contra interceptações durante o uso do app.
                  </p>
                </div>
              </div>
            </div>

            {/* Infraestrutura */}
            <div className="bg-white/80 backdrop-blur-sm p-7 rounded-[28px] border border-rosa/20 shadow-xl shadow-vinho/5 hover:shadow-2xl hover:-translate-y-1.5 hover:border-roxo/30 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute -top-16 -right-16 w-40 h-40 bg-roxo/10 rounded-full blur-3xl group-hover:bg-roxo/20 transition-all duration-500" />
              <div className="flex flex-col gap-5 relative z-10">
                <div className="w-14 h-14 bg-roxo/10 text-roxo rounded-2xl flex items-center justify-center flex-shrink-0 border border-roxo/20 shadow-inner">
                  <Server className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-vinho text-xl mb-2.5">Infraestrutura em Nuvem</h3>
                  <p className="text-[13px] md:text-sm text-cinza/80 font-medium leading-relaxed">
                    Seu ateliê está hospedado em servidores de nível mundial (AWS/Supabase), com proteção ativa 24/7 contra-ataques e backups automáticos.
                  </p>
                </div>
              </div>
            </div>

            {/* Autenticação */}
            <div className="bg-white/80 backdrop-blur-sm p-7 rounded-[28px] border border-rosa/20 shadow-xl shadow-vinho/5 hover:shadow-2xl hover:-translate-y-1.5 hover:border-dourado/30 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute -top-16 -right-16 w-40 h-40 bg-dourado/10 rounded-full blur-3xl group-hover:bg-dourado/20 transition-all duration-500" />
              <div className="flex flex-col gap-5 relative z-10">
                <div className="w-14 h-14 bg-dourado/10 text-dourado rounded-2xl flex items-center justify-center flex-shrink-0 border border-dourado/20 shadow-inner">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-vinho text-xl mb-2.5">Proteção de Credenciais</h3>
                  <p className="text-[13px] md:text-sm text-cinza/80 font-medium leading-relaxed">
                    Sua senha é protegida por algoritmos de hash irreversíveis (Bcrypt). Nem mesmo nossa equipe técnica tem acesso ou pode descobrir a sua senha.
                  </p>
                </div>
              </div>
            </div>

          </div>

          <div className="bg-gradient-to-r from-vinho to-[#5c4331] rounded-[28px] p-6 md:p-8 flex flex-col sm:flex-row items-center gap-5 sm:gap-6 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="bg-creme/10 p-4 rounded-full flex-shrink-0 relative z-10 border border-creme/10">
              <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-creme" />
            </div>
            <p className="text-sm md:text-base font-medium text-creme/90 text-center sm:text-left leading-relaxed relative z-10">
              <strong className="text-creme font-black block text-lg mb-1.5 tracking-wide">Nós prezamos pela sua privacidade.</strong>
              Seus dados financeiros jamais serão compartilhados, vendidos ou acessados indevidamente.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-white text-vinho border-[3px] border-vinho/10 py-4 rounded-[20px] font-black text-[13px] md:text-sm hover:bg-vinho hover:text-creme hover:border-vinho transition-all duration-300 shadow-sm uppercase tracking-widest"
          >
            Entendido, fechar aviso
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
