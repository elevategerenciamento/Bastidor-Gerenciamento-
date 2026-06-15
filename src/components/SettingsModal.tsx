import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Settings, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SettingsModalProps {
  onClose: () => void;
  userEmail?: string;
}

export default function SettingsModal({ onClose, userEmail }: SettingsModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err);
      setMessage({ type: 'error', text: err.message || 'Ocorreu um erro ao atualizar a senha.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-[150] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        className="bg-creme max-w-md w-full rounded-[32px] shadow-2xl overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-vinho p-6 text-center relative">
          <button 
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-creme transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Settings className="w-6 h-6 text-creme" />
          </div>
          <h2 className="text-2xl font-serif font-black text-creme">Configurações</h2>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Informações da Conta */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-vinho uppercase tracking-wider">Informações da Conta</h3>
            <div className="bg-white p-4 rounded-2xl border border-rosa/30 flex items-center gap-3">
              <div className="w-10 h-10 bg-rosa/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-vinho" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-cinza font-bold uppercase">E-mail</p>
                <p className="text-sm font-medium text-vinho truncate">{userEmail || 'Não disponível'}</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-rosa/20 w-full" />

          {/* Alterar Senha */}
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <h3 className="text-sm font-black text-vinho uppercase tracking-wider">Alterar Senha</h3>
            
            {message && (
              <div className={`p-4 rounded-2xl text-xs font-bold flex items-start gap-2 ${
                message.type === 'success' ? 'bg-verde/10 text-verde' : 'bg-vermelho/10 text-vermelho'
              }`}>
                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <X className="w-4 h-4 mt-0.5 shrink-0" />}
                <p>{message.text}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cinza/50" />
                <input
                  type="password"
                  placeholder="Nova Senha"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-rosa/30 rounded-2xl text-vinho font-medium focus:border-rosa focus:ring-0 outline-none transition-all placeholder:text-cinza/50"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cinza/50" />
                <input
                  type="password"
                  placeholder="Confirmar Nova Senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-rosa/30 rounded-2xl text-vinho font-medium focus:border-rosa focus:ring-0 outline-none transition-all placeholder:text-cinza/50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full bg-vinho text-creme py-3.5 rounded-2xl font-black text-sm hover:bg-opacity-90 transition-all shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-creme"></div>
              ) : (
                'Atualizar Senha'
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
