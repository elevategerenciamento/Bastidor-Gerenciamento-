import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Edit, Trash2, Sparkles, PackageSearch } from 'lucide-react';
import { Produto } from '../types';

interface ProdutosModalProps {
  produtos: Produto[];
  onClose: () => void;
  onAdd: (item: Omit<Produto, 'id'>) => void;
  onUpdate: (id: string, updatedItem: Omit<Produto, 'id'>) => void;
  onDelete: (id: string) => void;
}

export default function ProdutosModal({ 
  produtos, 
  onClose,
  onAdd,
  onUpdate,
  onDelete
}: ProdutosModalProps) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Produto | null>(null);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/80 backdrop-blur-xl z-[150] flex flex-col pt-10"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex-1 bg-creme rounded-t-[48px] shadow-2xl border-t-4 border-rosa flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 bg-vinho text-white">
          <div className="max-w-2xl mx-auto flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-rosa/20 p-2 rounded-xl backdrop-blur-sm">
                  <PackageSearch className="w-8 h-8 text-rosa" />
                </div>
                <h2 className="text-3xl font-serif font-black lowercase tracking-tighter">produtos</h2>
              </div>
              <p className="text-rosa/60 text-xs uppercase tracking-widest font-bold">o que você borda?</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all">
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full p-6 md:p-8 space-y-8 custom-scrollbar">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-xl font-serif text-vinho border-l-4 border-dourado pl-3">Meus Produtos & Serviços</h3>
            <button 
              onClick={() => setIsAddingItem(true)}
              className="bg-dourado text-white px-8 py-4 rounded-[20px] font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all w-full sm:w-auto uppercase tracking-widest"
            >
              <Plus className="w-5 h-5" />
              Novo Produto
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 pb-12">
            {produtos.length > 0 ? (
              produtos.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-[32px] border-2 border-rosa/20 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center group hover:border-vinho/20 transition-all gap-4">
                  <div className="flex gap-4 items-center min-w-0">
                    <div className="bg-creme p-4 rounded-2xl group-hover:bg-rosa/10 transition-colors shrink-0">
                      <Sparkles className="w-6 h-6 text-vinho/40" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-vinho text-lg truncate leading-tight mb-1">{item.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t sm:border-none pt-4 sm:pt-0 border-creme">
                    <button 
                      onClick={() => setEditingItem(item)}
                      className="p-3 text-cinza hover:text-vinho hover:bg-creme rounded-2xl transition-all border border-cinza/10 sm:border-none"
                    >
                      <Edit className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => onDelete(item.id)}
                      className="p-3 text-vermelho hover:bg-vermelho/5 rounded-2xl transition-all border border-vermelho/10 sm:border-none"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-rosa/30">
                <PackageSearch className="w-12 h-12 text-rosa mx-auto mb-4 opacity-30" />
                <p className="text-cinza font-medium">Nenhum produto cadastrado. Crie opções como porta maternidade, etc.</p>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isAddingItem && (
            <AddProdutoModal 
              onClose={() => setIsAddingItem(false)}
              onAdd={(newItem) => {
                onAdd(newItem);
                setIsAddingItem(false);
              }}
            />
          )}
          {editingItem && (
            <AddProdutoModal 
              itemToEdit={editingItem}
              onClose={() => setEditingItem(null)}
              onAdd={(updatedItem) => {
                onUpdate(editingItem.id, updatedItem);
                setEditingItem(null);
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function AddProdutoModal({ 
  itemToEdit,
  onClose, 
  onAdd 
}: { 
  itemToEdit?: Produto;
  onClose: () => void; 
  onAdd: (item: Omit<Produto, 'id'>) => void;
}) {
  const [name, setName] = useState(itemToEdit?.name || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ name });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-creme max-w-lg w-full rounded-[40px] shadow-2xl border-2 border-rosa overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-vinho p-8 text-white relative">
          <h3 className="text-3xl font-serif font-black tracking-tight">{itemToEdit ? 'Editar Produto' : 'Novo Produto'}</h3>
          <p className="text-rosa/60 text-[10px] uppercase tracking-widest font-bold mt-1">
            {itemToEdit ? 'Atualize as informações do produto' : 'Cadastre um novo produto (ex: Quadro, Almofada)'}
          </p>
          <button onClick={onClose} className="absolute top-8 right-8 p-1 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6 text-rosa" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-cinza uppercase ml-1">Nome do Produto/Serviço</label>
              <input 
                required
                className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                placeholder="Ex: Porta Maternidade..."
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-vinho text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:opacity-90 transition-all mt-4"
          >
            {itemToEdit ? 'Salvar Alterações' : 'Cadastrar Produto'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
