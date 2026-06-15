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
      className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        className="bg-creme max-w-2xl w-full rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden relative my-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-vinho p-8 md:p-10 text-center relative overflow-hidden">
          {/* Fundo Decorativo */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none flex items-center justify-center">
            <ShieldCheck className="w-64 h-64 text-rosa" />
          </div>

          <button 
            onClick={onClose}
            className="absolute right-4 top-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-creme transition-all z-10"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          
          <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10 border border-white/20 shadow-lg">
            <Shield className="w-8 h-8 text-creme" />
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-black text-creme relative z-10">Segurança e Privacidade</h2>
          <p className="text-rosa/90 mt-2 font-medium text-sm md:text-base relative z-10 max-w-md mx-auto">
            O seu ateliê é como um cofre. Tratamos seus dados financeiros e de clientes com o mais alto padrão de segurança do mercado.
          </p>
        </div>

        <div className="p-6 md:p-10 space-y-6">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            
            {/* RLS */}
            <div className="bg-white p-5 rounded-2xl border border-rosa/30 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rosa/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              <div className="flex items-start gap-4 relative z-10">
                <div className="bg-verde/15 text-verde p-3 rounded-xl flex-shrink-0">
                  <EyeOff className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-vinho text-base mb-1">Isolamento Total</h3>
                  <p className="text-sm text-cinza font-medium leading-relaxed">
                    Aplicamos regras rígidas de banco de dados (RLS). Ninguém, em hipótese alguma, consegue acessar os valores, clientes ou pedidos do seu ateliê.
                  </p>
                </div>
              </div>
            </div>

            {/* Criptografia */}
            <div className="bg-white p-5 rounded-2xl border border-rosa/30 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rosa/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              <div className="flex items-start gap-4 relative z-10">
                <div className="bg-azul/15 text-azul p-3 rounded-xl flex-shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-vinho text-base mb-1">Criptografia de Ponta</h3>
                  <p className="text-sm text-cinza font-medium leading-relaxed">
                    Todas as informações transitam de forma criptografada via HTTPS/SSL. Seus dados estão protegidos contra interceptações durante o uso do app.
                  </p>
                </div>
              </div>
            </div>

            {/* Infraestrutura */}
            <div className="bg-white p-5 rounded-2xl border border-rosa/30 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rosa/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              <div className="flex items-start gap-4 relative z-10">
                <div className="bg-roxo/15 text-roxo p-3 rounded-xl flex-shrink-0">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-vinho text-base mb-1">Infraestrutura em Nuvem</h3>
                  <p className="text-sm text-cinza font-medium leading-relaxed">
                    Seu ateliê está hospedado em servidores de nível mundial (AWS/Supabase), com proteção ativa 24/7 contra-ataques e backups automáticos.
                  </p>
                </div>
              </div>
            </div>

            {/* Autenticação */}
            <div className="bg-white p-5 rounded-2xl border border-rosa/30 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rosa/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              <div className="flex items-start gap-4 relative z-10">
                <div className="bg-dourado/15 text-dourado p-3 rounded-xl flex-shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-vinho text-base mb-1">Proteção de Credenciais</h3>
                  <p className="text-sm text-cinza font-medium leading-relaxed">
                    Sua senha é protegida por algoritmos de hash irreversíveis (Bcrypt). Nem mesmo nossa equipe técnica tem acesso ou pode descobrir a sua senha.
                  </p>
                </div>
              </div>
            </div>

          </div>

          <div className="bg-verde/10 border border-verde/20 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-verde flex-shrink-0" />
            <p className="text-sm font-bold text-vinho">
              Nós prezamos pela privacidade. Seus dados financeiros jamais serão compartilhados, vendidos ou acessados indevidamente.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-vinho text-creme py-4 rounded-2xl font-black text-sm hover:bg-opacity-90 transition-all shadow-md uppercase tracking-wider"
          >
            Entendido, fechar aviso
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
