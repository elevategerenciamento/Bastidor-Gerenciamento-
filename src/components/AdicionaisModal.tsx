import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Edit, Trash2, Tag, Sparkles } from 'lucide-react';
import { Adicional } from '../types';
import { formatCurrency } from '../lib/utils';

interface AdicionaisModalProps {
  adicionais: Adicional[];
  onClose: () => void;
  onAdd: (item: Omit<Adicional, 'id'>) => void;
  onUpdate: (id: string, updatedItem: Omit<Adicional, 'id'>) => void;
  onDelete: (id: string) => void;
}

export default function AdicionaisModal({ 
  adicionais, 
  onClose,
  onAdd,
  onUpdate,
  onDelete
}: AdicionaisModalProps) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Adicional | null>(null);

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
                  <Tag className="w-8 h-8 text-rosa" />
                </div>
                <h2 className="text-3xl font-serif font-black lowercase tracking-tighter">adicionais</h2>
              </div>
              <p className="text-rosa/60 text-xs uppercase tracking-widest font-bold">gerencie extras para seus pedidos</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all">
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full p-6 md:p-8 space-y-8 custom-scrollbar">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-xl font-serif text-vinho border-l-4 border-dourado pl-3">Meus Adicionais</h3>
            <button 
              onClick={() => setIsAddingItem(true)}
              className="bg-dourado text-white px-8 py-4 rounded-[20px] font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all w-full sm:w-auto uppercase tracking-widest"
            >
              <Plus className="w-5 h-5" />
              Novo Adicional
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 pb-12">
            {adicionais.length > 0 ? (
              adicionais.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-[32px] border-2 border-rosa/20 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center group hover:border-vinho/20 transition-all gap-4">
                  <div className="flex gap-4 items-center min-w-0">
                    <div className="bg-creme p-4 rounded-2xl group-hover:bg-rosa/10 transition-colors shrink-0">
                      <Sparkles className="w-6 h-6 text-vinho/40" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-vinho text-lg truncate leading-tight mb-1">{item.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-none pt-4 sm:pt-0 border-creme">
                    <div className="sm:text-right">
                      <div className="text-2xl font-serif font-black text-vinho leading-none mb-1">{formatCurrency(parseFloat(item.price.replace(',', '.')))}</div>
                    </div>
                    <div className="flex items-center gap-2">
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
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-rosa/30">
                <Tag className="w-12 h-12 text-rosa mx-auto mb-4 opacity-30" />
                <p className="text-cinza font-medium">Nenhum adicional cadastrado. Crie opções como cavaletes, caixas, etc.</p>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isAddingItem && (
            <AddAdicionalModal 
              onClose={() => setIsAddingItem(false)}
              onAdd={(newItem) => {
                onAdd(newItem);
                setIsAddingItem(false);
              }}
            />
          )}
          {editingItem && (
            <AddAdicionalModal 
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

function AddAdicionalModal({ 
  itemToEdit,
  onClose, 
  onAdd 
}: { 
  itemToEdit?: Adicional;
  onClose: () => void; 
  onAdd: (item: Omit<Adicional, 'id'>) => void;
}) {
  const [name, setName] = useState(itemToEdit?.name || '');
  const [price, setPrice] = useState(itemToEdit?.price || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      name,
      price
    });
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
          <h3 className="text-3xl font-serif font-black tracking-tight">{itemToEdit ? 'Editar Adicional' : 'Novo Adicional'}</h3>
          <p className="text-rosa/60 text-[10px] uppercase tracking-widest font-bold mt-1">
            {itemToEdit ? 'Atualize as informações do adicional' : 'Cadastre um novo adicional (ex: cavalete, embalagem)'}
          </p>
          <button onClick={onClose} className="absolute top-8 right-8 p-1 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6 text-rosa" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-cinza uppercase ml-1">Nome do Adicional</label>
              <input 
                required
                className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                placeholder="Ex: Cavalete de Madeira..."
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black text-cinza uppercase ml-1">Valor</label>
              <div className="relative">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-rosa">BRL</div>
                <input 
                  required
                  type="text"
                  className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-5 pr-12 py-4 text-sm outline-none focus:border-vinho transition-all"
                  value={price}
                  onChange={e => setPrice(e.target.value.replace(/[^0-9,.]/g, ''))}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-vinho text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:opacity-90 transition-all mt-4"
          >
            {itemToEdit ? 'Salvar Alterações' : 'Cadastrar Adicional'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
