import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Edit, Trash2, Package } from 'lucide-react';
import { StockItem } from '../types';

interface StockModalProps {
  stockItems: StockItem[];
  onClose: () => void;
  onAdd: (item: Omit<StockItem, 'id'>) => void;
  onUpdate: (id: string, updatedItem: Omit<StockItem, 'id'>) => void;
  onDelete: (id: string) => void;
}

export default function StockModal({ 
  stockItems, 
  onClose,
  onAdd,
  onUpdate,
  onDelete
}: StockModalProps) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  // Agrupar itens por categoria
  const groupedItems = stockItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, StockItem[]>);

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
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="bg-rosa/20 p-2 rounded-xl backdrop-blur-sm">
                  <Package className="w-8 h-8 text-rosa" />
                </div>
                <h2 className="text-3xl font-serif font-black lowercase tracking-tighter">estoque físico</h2>
              </div>
              <p className="text-rosa/60 text-xs uppercase tracking-widest font-bold">controle de materiais</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all">
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full p-6 md:p-8 space-y-8 custom-scrollbar">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-xl font-serif text-vinho border-l-4 border-dourado pl-3">Meus Materiais</h3>
            <button 
              onClick={() => setIsAddingItem(true)}
              className="bg-dourado text-white px-8 py-4 rounded-[20px] font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all w-full sm:w-auto uppercase tracking-widest"
            >
              <Plus className="w-5 h-5" />
              Novo Material
            </button>
          </div>

          <div className="space-y-8 pb-12">
            {Object.keys(groupedItems).length > 0 ? (
              Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="space-y-4">
                  <h4 className="text-lg font-black text-vinho/80 uppercase tracking-widest">{category}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map(item => (
                      <div key={item.id} className="bg-white p-5 rounded-[32px] border-2 border-rosa/20 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center group hover:border-vinho/20 transition-all gap-4">
                        <div className="flex gap-4 items-center min-w-0">
                          <div className="bg-creme p-4 rounded-2xl group-hover:bg-rosa/10 transition-colors shrink-0">
                            <span className="font-black text-xl text-vinho">{item.quantity}</span>
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
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-rosa/30">
                <Package className="w-12 h-12 text-rosa mx-auto mb-4 opacity-30" />
                <p className="text-cinza font-medium">Nenhum material cadastrado no estoque.</p>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isAddingItem && (
            <AddStockItemModal 
              onClose={() => setIsAddingItem(false)}
              onAdd={(newItem) => {
                onAdd(newItem);
                setIsAddingItem(false);
              }}
            />
          )}
          {editingItem && (
            <AddStockItemModal 
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

function AddStockItemModal({ 
  itemToEdit,
  onClose, 
  onAdd 
}: { 
  itemToEdit?: StockItem;
  onClose: () => void; 
  onAdd: (item: Omit<StockItem, 'id'>) => void;
}) {
  const [name, setName] = useState(itemToEdit?.name || '');
  const [category, setCategory] = useState(itemToEdit?.category || 'Bastidor');
  const [quantity, setQuantity] = useState(itemToEdit?.quantity?.toString() || '0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ 
      name, 
      category, 
      quantity: parseInt(quantity) || 0 
    });
  };

  const categoriasPredefinidas = ['Bastidor', 'Caixa', 'Embalagem', 'Tecido', 'Linha', 'Outro'];

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
          <h3 className="text-3xl font-serif font-black tracking-tight">{itemToEdit ? 'Editar Material' : 'Novo Material'}</h3>
          <button onClick={onClose} className="absolute top-8 right-8 p-1 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6 text-rosa" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-cinza uppercase ml-1">Nome do Material</label>
              <input 
                required
                className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                placeholder="Ex: Bastidor 20cm"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-cinza uppercase ml-1">Categoria</label>
              <select 
                className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all appearance-none"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {categoriasPredefinidas.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black text-cinza uppercase ml-1">Quantidade Disponível</label>
              <input 
                required
                type="number"
                min="0"
                className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                placeholder="Ex: 20"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-vinho text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:opacity-90 transition-all mt-4"
          >
            {itemToEdit ? 'Salvar Alterações' : 'Cadastrar Material'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
