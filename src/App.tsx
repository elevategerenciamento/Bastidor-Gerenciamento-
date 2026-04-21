/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  TrendingUp, 
  AlertCircle, 
  Check,
  Sparkles,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Download,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  Edit,
  Trash2,
  Menu,
  Settings,
  CreditCard,
  LogOut
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { INITIAL_ORDERS, TODAY } from './constants';
import { Order, PaymentInfo } from './types';
import { formatCurrency, getDaysRemaining, getStatusColor } from './lib/utils';
import { supabase } from './lib/supabase';


export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);


  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchOrders();
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchOrders();
        fetchInventory();
      } else {

        setOrders([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('deadline', { ascending: true });

      if (error) throw error;

      if (data) {
        setOrders(data.map(o => ({
          id: o.id,
          customerName: o.customer_name,
          pieceDescription: o.piece_description,
          notes: o.notes,
          deadline: o.deadline ? new Date(o.deadline) : null,
          isPartnership: o.is_partnership,
          completed: o.completed,
          payment: o.payment
        })));
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      if (data) {
        setInventory(data.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          price: item.price.toString(),
          purchaseDate: new Date(item.purchase_date),
          paymentMethod: item.payment_method,
          installments: item.installments
        })));
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };


  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'received' | 'pending' | 'urgent' | 'completed'>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0); // 0: April, 1: May, 2: June
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);
  const [isFinanceDetailsOpen, setIsFinanceDetailsOpen] = useState(false);
  const [financeDetailType, setFinanceDetailType] = useState<'received' | 'pending'>('received');
  const [reportMonth, setReportMonth] = useState<number>(TODAY.getMonth());
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);


  const months = useMemo(() => {
    const currentMonth = TODAY.getMonth();
    const currentYear = TODAY.getFullYear();
    return [
      { month: currentMonth, year: currentYear },
      { month: (currentMonth + 1) % 12, year: currentMonth + 1 > 11 ? currentYear + 1 : currentYear },
      { month: (currentMonth + 2) % 12, year: currentMonth + 2 > 11 ? currentYear + 1 : currentYear },
    ];
  }, []);

  // Derived Stats
  const stats = useMemo(() => {
    const activeOrders = orders.filter(o => !o.completed && !o.isPartnership);
    const urgentCount = activeOrders.filter(o => {
      const days = getDaysRemaining(o.deadline);
      return days !== null && days <= 3;
    }).length;

    let totalReceived = 0;
    let totalPending = 0;
    let receivedCount = 0;
    let pendingCount = 0;

    const monthlyTotals: Record<number, { total: number; received: number }> = {
      3: { total: 0, received: 0 },
      4: { total: 0, received: 0 },
      5: { total: 0, received: 0 },
    };

    const receivedPayments: any[] = [];
    const pendingPayments: any[] = [];

    let totalInventoryExpenses = 0;
    inventory.forEach(item => {
      totalInventoryExpenses += parseFloat(item.price.replace(',', '.')) || 0;
    });


    orders.forEach(o => {
      if (o.isPartnership) return;
      const value = parseFloat(o.payment.totalValue.replace(',', '.')) || 0;
      const month = o.deadline ? o.deadline.getMonth() : null;

      if (month !== null && monthlyTotals[month]) {
        monthlyTotals[month].total += value;
      }

      if (o.payment.type === 'pix') {
        const totalValueNum = value;
        const entryAmnt = parseFloat(o.payment.pixEntryAmount?.replace(',', '.') || '0') || (totalValueNum * 0.5);
        const remainingAmnt = totalValueNum - entryAmnt;
        const entryPct = totalValueNum > 0 ? Math.round((entryAmnt / totalValueNum) * 100) : 0;

        if (o.payment.pixEntryPaid) {
          totalReceived += entryAmnt;
          receivedCount++;
          receivedPayments.push({ customerName: o.customerName, piece: o.pieceDescription, amount: entryAmnt, label: `Entrada ${entryPct}%`, type: 'pix' });
          if (month !== null && monthlyTotals[month]) monthlyTotals[month].received += entryAmnt;
        } else if (totalValueNum > 0) {
          totalPending += entryAmnt;
          pendingCount++;
          pendingPayments.push({ customerName: o.customerName, piece: o.pieceDescription, amount: entryAmnt, label: `Entrada ${entryPct}%`, type: 'pix' });
        }
        
        if (o.payment.pixRemainingPaid) {
          totalReceived += remainingAmnt;
          receivedCount++;
          receivedPayments.push({ customerName: o.customerName, piece: o.pieceDescription, amount: remainingAmnt, label: `Restante ${100-entryPct}%`, type: 'pix' });
          if (month !== null && monthlyTotals[month]) monthlyTotals[month].received += remainingAmnt;
        } else if (totalValueNum > 0) {
          totalPending += remainingAmnt;
          pendingCount++;
          pendingPayments.push({ customerName: o.customerName, piece: o.pieceDescription, amount: remainingAmnt, label: `Restante ${100-entryPct}%`, type: 'pix' });
        }
      } else if (o.payment.type === 'card') {
        if (o.payment.cardPaid) {
          totalReceived += value;
          receivedCount++;
          receivedPayments.push({ customerName: o.customerName, piece: o.pieceDescription, amount: value, label: 'Total Cartão', type: 'card' });
          if (month !== null && monthlyTotals[month]) monthlyTotals[month].received += value;
        } else if (value > 0) {
          totalPending += value;
          pendingCount++;
          pendingPayments.push({ customerName: o.customerName, piece: o.pieceDescription, amount: value, label: 'Total Cartão', type: 'card' });
        }
      } else if (value > 0) {
        totalPending += value;
        pendingCount++;
        pendingPayments.push({ customerName: o.customerName, piece: o.pieceDescription, amount: value, label: 'A definir', type: 'none' });
      }
    });

    return {
      urgentCount,
      totalOrders: orders.filter(o => !o.isPartnership).length,
      completedCount: orders.filter(o => o.completed).length,
      totalReceived,
      totalPending,
      receivedCount,
      pendingCount,
      monthlyTotals,
      receivedPayments,
      pendingPayments,
      totalInventoryExpenses
    };

  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (selectedDate) {
      result = result.filter(o => o.deadline && o.deadline.toDateString() === selectedDate.toDateString());
    } else {
      if (activeFilter === 'received') {
        result = result.filter(o => 
          (o.payment.type === 'pix' && (o.payment.pixEntryPaid || o.payment.pixRemainingPaid)) ||
          (o.payment.type === 'card' && o.payment.cardPaid)
        );
      } else if (activeFilter === 'pending') {
        result = result.filter(o => {
          const value = parseFloat(o.payment.totalValue.replace(',', '.')) || 0;
          if (value === 0) return false;
          if (o.payment.type === 'pix') return !o.payment.pixEntryPaid || !o.payment.pixRemainingPaid;
          if (o.payment.type === 'card') return !o.payment.cardPaid;
          return true; // No type set but has value
        });
      } else if (activeFilter === 'urgent') {
        result = result.filter(o => {
          if (o.completed || o.isPartnership) return false;
          const days = getDaysRemaining(o.deadline);
          return days !== null && days <= 3;
        });
      } else if (activeFilter === 'completed') {
        result = result.filter(o => o.completed);
      }
    }

    return result.sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      if (a.isPartnership && !b.isPartnership) return 1;
      if (!a.isPartnership && b.isPartnership) return -1;
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.getTime() - b.deadline.getTime();
    });
  }, [orders, activeFilter]);

  const updateOrderPayment = async (id: string, updates: Partial<PaymentInfo>) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    
    const newPayment = { ...order.payment, ...updates };
    const { error } = await supabase
      .from('orders')
      .update({ payment: newPayment })
      .eq('id', id);
      
    if (!error) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, payment: newPayment } : o));
    }
  };

  const toggleOrderCompletion = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    
    const newCompleted = !order.completed;
    const { error } = await supabase
      .from('orders')
      .update({ completed: newCompleted })
      .eq('id', id);
      
    if (!error) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, completed: newCompleted } : o));
    }
  };

  const addNewOrder = async (newOrder: Omit<Order, 'id' | 'completed'>) => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        customer_name: newOrder.customerName,
        piece_description: newOrder.pieceDescription,
        notes: newOrder.notes,
        deadline: newOrder.deadline?.toISOString(),
        is_partnership: newOrder.isPartnership,
        payment: newOrder.payment,
        user_id: user.id,
        completed: false
      }])
      .select()
      .single();
      
    if (!error && data) {
      const mapped: Order = {
        id: data.id,
        customerName: data.customer_name,
        pieceDescription: data.piece_description,
        notes: data.notes,
        deadline: data.deadline ? new Date(data.deadline) : null,
        isPartnership: data.is_partnership,
        completed: data.completed,
        payment: data.payment
      };
      setOrders(prev => [...prev, mapped]);
      setIsAddingOrder(false);
    } else if (error) {
      console.error('Error adding order:', error);
    }
  };

  const updateOrder = async (id: string, updatedOrder: Omit<Order, 'id' | 'completed'>) => {
    const { error } = await supabase
      .from('orders')
      .update({
        customer_name: updatedOrder.customerName,
        piece_description: updatedOrder.pieceDescription,
        notes: updatedOrder.notes,
        deadline: updatedOrder.deadline?.toISOString(),
        is_partnership: updatedOrder.isPartnership,
        payment: updatedOrder.payment
      })
      .eq('id', id);
      
    if (!error) {
      setOrders(prev => prev.map(o => o.id === id ? { ...updatedOrder, id, completed: o.completed } : o));
      setEditingOrder(null);
    } else {
      console.error('Error updating order:', error);
    }
  };

  const deleteOrder = (id: string) => {
    setDeletingOrderId(id);
  };

  const confirmDelete = async () => {
    // ... logic for orders ...
  };

  const addInventoryItem = async (newItem: Omit<InventoryItem, 'id'>) => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('inventory')
      .insert([{
        name: newItem.name,
        category: newItem.category,
        quantity: newItem.quantity,
        price: parseFloat(newItem.price.replace(',', '.')) || 0,
        purchase_date: newItem.purchaseDate.toISOString(),
        payment_method: newItem.paymentMethod,
        installments: newItem.installments || 1,
        user_id: user.id
      }])
      .select()
      .single();
      
    if (!error && data) {
      setInventory(prev => [{
        id: data.id,
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        price: data.price.toString(),
        purchaseDate: new Date(data.purchase_date),
        paymentMethod: data.payment_method,
        installments: data.installments
      }, ...prev]);
    } else if (error) {
      console.error('Error adding inventory item:', error);
    }
  };

  const deleteInventoryItem = async (id: string) => {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);
      
    if (!error) {
      setInventory(prev => prev.filter(item => item.id !== id));
    } else {
      console.error('Error deleting inventory item:', error);
    }
  };

    if (deletingOrderId) {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', deletingOrderId);
        
      if (!error) {
        setOrders(prev => prev.filter(o => o.id !== deletingOrderId));
        setDeletingOrderId(null);
      } else {
        console.error('Error deleting order:', error);
      }
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(TODAY.getFullYear(), reportMonth));
    
    // Header
    doc.setFillColor(74, 55, 40); // Marrom Profundo
    doc.rect(0, 0, 210, 50, 'F');
    
    // Draw Logo in PDF (Centered)
    const logoSize = 22;
    const s = logoSize / 100;
    const logoY = 6;
    
    doc.setDrawColor(217, 197, 178); // Rosa/Bege color for logo lines
    doc.setLineWidth(0.4);
    doc.circle(105, logoY + 50 * s, 45 * s, 'S');
    doc.setLineWidth(0.15);
    doc.circle(105, logoY + 50 * s, 41 * s, 'S');
    doc.setLineWidth(0.4);
    doc.line(105 - 15 * s, logoY + 65 * s, 105 + 15 * s, logoY + 35 * s);
    doc.setFillColor(217, 197, 178);
    doc.circle(105 + 13 * s, logoY + 37 * s, 1 * s, 'F');
    doc.roundedRect(105 - 8 * s, logoY + 2 * s, 16 * s, 6 * s, 1 * s, 1 * s, 'S');

    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(30);
    doc.text('bastidor', 105, 34, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(217, 197, 178);
    doc.text('seu ateliê organizado e leve', 105, 40, { align: 'center' });
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text(`Relatório Financeiro • ${monthName} ${TODAY.getFullYear()}`, 105, 46, { align: 'center' });
    
    // Summary Section
    const monthStats = stats.monthlyTotals[reportMonth] || { total: 0, received: 0 };
    const pending = monthStats.total - monthStats.received;
    
    doc.setTextColor(74, 55, 40);
    doc.setFontSize(14);
    doc.text('Resumo do Mês', 14, 60);
    
    autoTable(doc, {
      startY: 65,
      head: [['Descrição', 'Valor']],
      body: [
        ['Total em Encomendas', formatCurrency(monthStats.total)],
        ['Total Recebido', formatCurrency(monthStats.received)],
        ['Total a Receber', formatCurrency(pending)],
      ],
      headStyles: { fillColor: [74, 55, 40] },
      margin: { left: 14, right: 14 },
    });
    
    // Detailed Transactions
    doc.setFontSize(16);
    doc.text('Detalhamento de Recebidos', 14, (doc as any).lastAutoTable.finalY + 15);
    
    const monthOrders = orders.filter(o => o.deadline && o.deadline.getMonth() === reportMonth && !o.isPartnership);
    const tableData: any[] = [];
    
    monthOrders.forEach(o => {
      const totalValue = parseFloat(o.payment.totalValue.replace(',', '.')) || 0;
      if (o.payment.type === 'pix') {
        const entry = parseFloat(o.payment.pixEntryAmount?.replace(',', '.') || '0') || (totalValue * 0.5);
        const remaining = totalValue - entry;
        if (o.payment.pixEntryPaid) tableData.push([o.customerName, o.pieceDescription, 'PIX (Entrada)', formatCurrency(entry)]);
        if (o.payment.pixRemainingPaid) tableData.push([o.customerName, o.pieceDescription, 'PIX (Restante)', formatCurrency(remaining)]);
      } else if (o.payment.type === 'card' && o.payment.cardPaid) {
        tableData.push([o.customerName, o.pieceDescription, 'Cartão', formatCurrency(totalValue)]);
      }
    });
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Cliente', 'Peça', 'Tipo', 'Valor']],
      body: tableData,
      headStyles: { fillColor: [74, 55, 40] },
      margin: { left: 14, right: 14 },
    });
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} - Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
    }
    
    doc.save(`Relatorio_Bastidor_${monthName}_2026.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vinho"></div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onEnter={async (name, email, password, isRegistering) => {
      try {
        if (isRegistering) {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: name }
            }
          });
          if (error) throw error;
          alert('Cadastro realizado! Por favor, entre com suas credenciais.');
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (error) throw error;
        }
      } catch (err: any) {
        alert(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : err.message);
      }
    }} />;
  }

  return (
    <div className="min-h-screen pb-20">
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-vinho/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-creme z-[101] shadow-2xl border-r-2 border-rosa flex flex-col"
            >
              <div className="p-8 bg-vinho text-creme">
                <div className="flex items-center gap-3">
                  <div className="bg-rosa p-2 rounded-xl">
                    <HoopLogo className="w-8 h-8 text-vinho" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-black lowercase tracking-tighter">bastidor</h3>
                    <p className="text-[10px] text-rosa uppercase font-bold tracking-widest">menu ateliê</p>
                  </div>
                </div>
              </div>

                <button 
                  onClick={() => {
                    setIsInventoryOpen(true);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <Package className="w-5 h-5" />
                  <span>Estoque & Compras</span>
                </button>
                <button 
                  onClick={() => setIsSidebarOpen(false)}

                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Minha Assinatura</span>
                </button>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <Settings className="w-5 h-5" />
                  <span>Configurações</span>
                </button>
              </nav>

              <div className="p-4 border-t border-rosa/30">
                <button 
                  onClick={() => {
                    setIsSidebarOpen(false);
                    supabase.auth.signOut();
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vermelho hover:bg-vermelho/5 transition-all font-black"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className="bg-vinho text-creme px-6 py-6 md:py-10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] border-[40px] border-rosa rounded-full rotate-45" />
        </div>
        
        {/* Menu Toggle */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-1/2 -translate-y-1/2 md:top-6 md:translate-y-0 p-3 bg-white/10 rounded-2xl text-rosa hover:bg-white/20 transition-all z-20"
        >
          <Menu className="w-6 h-6" />
        </button>

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="text-rosa mb-2 md:mb-4">
            <HoopLogo className="w-12 h-12 md:w-16 md:h-16" />
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-black mb-1 lowercase tracking-tighter">bastidor</h1>
          <p className="text-[10px] text-rosa tracking-[3px] uppercase font-bold">seu ateliê organizado • olá, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}</p>
        </motion.div>
      </header>

      <div className="bg-dourado text-white text-center py-2 text-xs font-medium tracking-wider">
        hoje: {TODAY.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
      </div>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-8">
        {/* Finance Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-rosa pb-2">
            <TrendingUp className="w-5 h-5 text-vinho" />
            <h2 className="text-xl font-serif text-vinho">Resumo Financeiro</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setFinanceDetailType('received');
                setIsFinanceDetailsOpen(true);
              }}
              className={`p-4 rounded-2xl shadow-lg text-left transition-all ${activeFilter === 'received' ? 'ring-4 ring-dourado bg-vinho text-white' : 'bg-vinho text-white'}`}
            >
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70 mb-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Já recebi</span>
              </div>
              <div className="text-2xl font-serif font-black">{formatCurrency(stats.totalReceived)}</div>
              <div className="text-[10px] opacity-60 mt-1">{stats.receivedCount} pagamentos</div>
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setFinanceDetailType('pending');
                setIsFinanceDetailsOpen(true);
              }}
              className={`p-4 rounded-2xl shadow-sm text-left border-2 transition-all ${activeFilter === 'pending' ? 'ring-4 ring-vinho bg-white border-rosa' : 'bg-white border-rosa'}`}
            >
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-cinza mb-1">
                <Clock className="w-3 h-3" />
                <span>A receber</span>
              </div>
              <div className="text-2xl font-serif font-black text-vinho">{formatCurrency(stats.totalPending)}</div>
              <div className="text-[10px] text-cinza opacity-60 mt-1">{stats.pendingCount} pendentes</div>
            </motion.button>
          </div>

          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="p-4 rounded-2xl bg-white border-2 border-rosa shadow-sm flex justify-between items-center"
          >
            <div className="flex items-center gap-3">
              <div className="bg-vermelho/10 p-2 rounded-xl">
                <Package className="w-5 h-5 text-vermelho" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-cinza">Gastos com Estoque</div>
                <div className="text-xl font-serif font-black text-vermelho">{formatCurrency(stats.totalInventoryExpenses)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-cinza font-bold">{inventory.length} compras</div>
              <div className="text-[9px] text-cinza opacity-60">reposição de insumos</div>
            </div>
          </motion.div>


          <div className="grid grid-cols-3 gap-2">
            {[
              { name: 'Abril', month: 3 },
              { name: 'Maio', month: 4 },
              { name: 'Junho', month: 5 }
            ].map(m => (
              <div key={m.month} className="bg-white p-3 rounded-xl text-center shadow-sm border border-creme">
                <div className="text-[10px] text-cinza uppercase tracking-wider">{m.name}</div>
                <div className="text-sm font-bold text-vinho mt-1">{formatCurrency(stats.monthlyTotals[m.month].total)}</div>
                {stats.monthlyTotals[m.month].received > 0 && (
                  <div className="text-[9px] text-verde mt-1 font-medium">
                    ✓ {formatCurrency(stats.monthlyTotals[m.month].received)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="grid grid-cols-3 gap-3">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setActiveFilter(activeFilter === 'urgent' ? 'all' : 'urgent');
              setTimeout(() => document.getElementById('orders-list')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
            className={`p-4 rounded-xl text-center shadow-sm border transition-all ${activeFilter === 'urgent' ? 'ring-4 ring-vermelho bg-white border-creme' : 'bg-white border-creme'}`}
          >
            <div className="text-2xl font-serif font-black text-vermelho">{stats.urgentCount}</div>
            <div className="flex items-center justify-center gap-1 text-[10px] text-cinza mt-1">
              <AlertTriangle className="w-3 h-3 text-vermelho" />
              <span>Urgente</span>
            </div>
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setActiveFilter('all');
              setTimeout(() => document.getElementById('orders-list')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
            className={`p-4 rounded-xl text-center shadow-sm border transition-all ${activeFilter === 'all' ? 'ring-4 ring-vinho bg-white border-creme' : 'bg-white border-creme'}`}
          >
            <div className="text-2xl font-serif font-black text-vinho">{stats.totalOrders}</div>
            <div className="flex items-center justify-center gap-1 text-[10px] text-cinza mt-1">
              <Package className="w-3 h-3 text-vinho" />
              <span>Total pedidos</span>
            </div>
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setActiveFilter(activeFilter === 'completed' ? 'all' : 'completed');
              setTimeout(() => document.getElementById('orders-list')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
            className={`p-4 rounded-xl text-center shadow-sm border transition-all ${activeFilter === 'completed' ? 'ring-4 ring-verde bg-white border-creme' : 'bg-white border-creme'}`}
          >
            <div className="text-2xl font-serif font-black text-verde">{stats.completedCount}</div>
            <div className="flex items-center justify-center gap-1 text-[10px] text-cinza mt-1">
              <CheckCircle2 className="w-3 h-3 text-verde" />
              <span>Concluídos</span>
            </div>
          </motion.button>
        </section>

        {/* Report Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-rosa pb-2">
            <FileText className="w-5 h-5 text-vinho" />
            <h2 className="text-xl font-serif text-vinho">Relatórios Mensais</h2>
          </div>
          
          <div className="bg-white p-6 rounded-[32px] border-2 border-rosa shadow-sm flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-bold text-cinza uppercase mb-2">Selecione o Mês</label>
              <div className="flex gap-2">
                {[
                  { name: 'Abril', val: 3 },
                  { name: 'Maio', val: 4 },
                  { name: 'Junho', val: 5 }
                ].map(m => (
                  <button
                    key={m.val}
                    onClick={() => setReportMonth(m.val)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border-2 ${
                      reportMonth === m.val 
                      ? 'bg-vinho border-vinho text-creme' 
                      : 'bg-white border-rosa text-vinho hover:bg-rosa/10'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={generatePDF}
              className="w-full sm:w-auto bg-dourado text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg hover:bg-opacity-90 transition-all"
            >
              <Download className="w-5 h-5" />
              GERAR PDF
            </motion.button>
          </div>
        </section>

        {/* Calendar Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-rosa pb-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-vinho" />
              <h2 className="text-xl font-serif text-vinho">Calendário de Prazos</h2>
            </div>
            <div className="flex gap-2">
              <button 
                disabled={currentMonthIndex === 0}
                onClick={() => setCurrentMonthIndex(prev => prev - 1)}
                className="p-1 rounded-full hover:bg-creme disabled:opacity-30 text-vinho"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                disabled={currentMonthIndex === months.length - 1}
                onClick={() => setCurrentMonthIndex(prev => prev + 1)}
                className="p-1 rounded-full hover:bg-creme disabled:opacity-30 text-vinho"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMonthIndex}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Calendar 
                  month={months[currentMonthIndex].month} 
                  year={months[currentMonthIndex].year} 
                  orders={orders} 
                  selectedDate={selectedDate}
                  onDateClick={(date) => {
                    const dayOrders = orders.filter(o => o.deadline && o.deadline.toDateString() === date.toDateString());
                    if (dayOrders.length > 0) {
                      setSelectedDate(date);
                      setIsDayDetailsOpen(true);
                    }
                  }}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap gap-4 px-2">
            <div className="flex items-center gap-2 text-[10px] text-cinza">
              <div className="w-2 h-2 rounded-full bg-vermelho" /> Urgente
            </div>
            <div className="flex items-center gap-2 text-[10px] text-cinza">
              <div className="w-2 h-2 rounded-full bg-amarelo" /> Próximo
            </div>
            <div className="flex items-center gap-2 text-[10px] text-cinza">
              <div className="w-2 h-2 rounded-full bg-verde" /> Folgado
            </div>
            <div className="flex items-center gap-2 text-[10px] text-cinza">
              <div className="w-2 h-2 rounded-full bg-cinza" /> Parceria
            </div>
          </div>
        </section>

        {/* Urgent Alerts */}
        <AnimatePresence>
          {stats.urgentCount > 0 && (
            <motion.section 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#fff5f5] border-2 border-vermelho rounded-2xl overflow-hidden"
            >
              <div className="bg-vermelho text-white px-4 py-2 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Atenção Imediata
              </div>
              <div className="divide-y divide-[#fce4e4]">
                {orders.filter(o => !o.completed && !o.isPartnership && getDaysRemaining(o.deadline) !== null && (getDaysRemaining(o.deadline) || 0) <= 3).map(o => {
                  const days = getDaysRemaining(o.deadline);
                  return (
                    <div key={o.id} className="p-4 flex justify-between items-center group">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{o.customerName}</div>
                        <div className="text-xs text-cinza">{o.pieceDescription}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingOrder(o)}
                            className="p-1.5 text-cinza hover:text-vinho hover:bg-creme rounded-lg transition-all"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => deleteOrder(o.id)}
                            className="p-1.5 text-cinza hover:text-vermelho hover:bg-vermelho/10 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="bg-vermelho text-white text-[10px] px-2 py-1 rounded-full font-bold">
                          {days === 0 ? 'HOJE!' : days! < 0 ? `${Math.abs(days!)}d atrasado` : `${days}d`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Orders List */}
        <section id="orders-list" className="space-y-4">
          <div className="flex items-center justify-between border-b border-rosa pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-vinho" />
              <h2 className="text-xl font-serif text-vinho">Ordem de Bordado</h2>
            </div>
            <button 
              onClick={() => setIsAddingOrder(true)}
              className="bg-vinho text-creme px-4 py-2 rounded-xl hover:bg-opacity-90 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Pedido</span>
            </button>
          </div>

          <div className="space-y-4">
            {(activeFilter !== 'all' || selectedDate) && (
              <div className="flex items-center justify-between bg-creme/30 p-2 rounded-lg border border-rosa/30">
                <span className="text-xs font-medium text-vinho">
                  {selectedDate ? (
                    <>Pedidos para: <span className="font-bold uppercase">{selectedDate.toLocaleDateString('pt-BR')}</span></>
                  ) : (
                    <>Filtrando por: <span className="font-bold uppercase">{
                      activeFilter === 'received' ? 'Já recebi' :
                      activeFilter === 'pending' ? 'A receber' :
                      activeFilter === 'urgent' ? 'Urgente' :
                      activeFilter === 'completed' ? 'Concluídos' : ''
                    }</span></>
                  )}
                </span>
                <button 
                  onClick={() => {
                    setActiveFilter('all');
                    setSelectedDate(null);
                  }}
                  className="text-[10px] font-bold text-vinho hover:underline"
                >
                  Limpar filtro
                </button>
              </div>
            )}
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order, index) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  index={order.isPartnership ? '✦' : index + 1}
                  onUpdatePayment={(updates) => updateOrderPayment(order.id, updates)}
                  onToggleComplete={() => toggleOrderCompletion(order.id)}
                  onEdit={() => setEditingOrder(order)}
                  onDelete={() => deleteOrder(order.id)}
                />
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-rosa/30">
                <p className="text-cinza text-sm italic">Nenhum pedido encontrado para este filtro.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {isAddingOrder && (
          <AddOrderModal 
            onClose={() => setIsAddingOrder(false)} 
            onAdd={addNewOrder} 
          />
        )}
        {editingOrder && (
          <AddOrderModal 
            orderToEdit={editingOrder}
            onClose={() => setEditingOrder(null)} 
            onAdd={(updated) => updateOrder(editingOrder.id, updated)} 
          />
        )}
        {isDayDetailsOpen && selectedDate && (
          <DayDetailsModal 
            date={selectedDate}
            orders={orders.filter(o => o.deadline && o.deadline.toDateString() === selectedDate.toDateString())}
            onClose={() => {
              setIsDayDetailsOpen(false);
              setSelectedDate(null);
            }}
            onEdit={(order) => {
              setEditingOrder(order);
              setIsDayDetailsOpen(false);
            }}
            onDelete={(id) => {
              deleteOrder(id);
              setIsDayDetailsOpen(false);
            }}
          />
        )}
        {isFinanceDetailsOpen && (
          <FinanceDetailsModal 
            type={financeDetailType}
            payments={financeDetailType === 'received' ? stats.receivedPayments : stats.pendingPayments}
            total={financeDetailType === 'received' ? stats.totalReceived : stats.totalPending}
            onClose={() => setIsFinanceDetailsOpen(false)}
            onFilter={(type) => {
              setActiveFilter(type);
              setIsFinanceDetailsOpen(false);
            }}
          />
        )}
        {deletingOrderId && (
          <DeleteConfirmationModal 
            onClose={() => setDeletingOrderId(null)}
            onConfirm={confirmDelete}
          />
        )}
        {isInventoryOpen && (
          <InventoryModal 
            items={inventory}
            onClose={() => setIsInventoryOpen(false)}
            onAdd={addInventoryItem}
            onDelete={deleteInventoryItem}
          />
        )}
      </AnimatePresence>

      </AnimatePresence>
    </div>
  );
}

function FinanceDetailsModal({ 
  type, 
  payments, 
  total, 
  onClose,
  onFilter 
}: { 
  type: 'received' | 'pending'; 
  payments: any[]; 
  total: number; 
  onClose: () => void;
  onFilter: (type: 'received' | 'pending') => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-creme max-w-lg w-full rounded-[32px] overflow-hidden shadow-2xl border-2 border-rosa"
        onClick={e => e.stopPropagation()}
      >
        <div className={`p-6 text-white flex justify-between items-center ${type === 'received' ? 'bg-verde' : 'bg-vinho'}`}>
          <div>
            <h3 className="text-2xl font-serif font-black">
              {type === 'received' ? 'Pagamentos Recebidos' : 'Valores Pendentes'}
            </h3>
            <p className="text-white/80 text-xs uppercase tracking-widest mt-1">
              Total: {formatCurrency(total)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
          {payments.length > 0 ? (
            payments.map((p, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-rosa/20 shadow-sm flex justify-between items-center">
                <div className="min-w-0">
                  <div className="font-bold text-vinho truncate">{p.customerName}</div>
                  <div className="text-[10px] text-cinza uppercase font-bold truncate">{p.piece}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black text-vinho/40 bg-creme px-1.5 py-0.5 rounded uppercase">
                      {p.label}
                    </span>
                    <span className="text-[9px] font-black text-vinho/40 bg-creme px-1.5 py-0.5 rounded uppercase">
                      {p.type === 'pix' ? 'PIX' : p.type === 'card' ? 'Cartão' : '---'}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-lg font-black text-vinho">{formatCurrency(p.amount)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-cinza italic">
              Nenhum pagamento registrado.
            </div>
          )}
        </div>

        <div className="p-6 bg-creme border-t border-rosa/20 flex gap-3">
          <button 
            onClick={() => onFilter(type)}
            className="flex-1 bg-vinho text-creme py-4 rounded-2xl font-black text-sm hover:bg-opacity-90 transition-all shadow-lg"
          >
            Ver na Lista
          </button>
          <button 
            onClick={onClose}
            className="flex-1 bg-white border-2 border-rosa text-vinho py-4 rounded-2xl font-black text-sm hover:bg-rosa/10 transition-all"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DayDetailsModal({ 
  date, 
  orders, 
  onClose,
  onEdit,
  onDelete
}: { 
  date: Date; 
  orders: Order[]; 
  onClose: () => void;
  onEdit: (order: Order) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-creme max-w-lg w-full rounded-[32px] overflow-hidden shadow-2xl border-2 border-rosa"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-vinho p-6 text-creme flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-serif font-black">Pedidos do Dia</h3>
            <p className="text-rosa text-xs uppercase tracking-widest mt-1">
              {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 custom-scrollbar">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl p-5 border border-rosa/30 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-xl font-serif font-black text-vinho">{order.customerName}</h4>
                  <p className="text-sm font-bold text-dourado uppercase tracking-tight">{order.pieceDescription}</p>
                </div>
                <div className="text-right">
                  <div className="flex gap-2 mb-1 justify-end">
                    <button 
                      onClick={() => onEdit(order)}
                      className="p-1.5 text-cinza hover:text-vinho hover:bg-creme rounded-lg transition-all"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => onDelete(order.id)}
                      className="p-1.5 text-cinza hover:text-vermelho hover:bg-vermelho/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-lg font-black text-vinho">{formatCurrency(parseFloat(order.payment.totalValue.replace(',', '.')) || 0)}</div>
                  <div className="text-[10px] font-bold text-cinza uppercase">
                    {order.payment.type ? (order.payment.type === 'pix' ? 'PIX' : 'Cartão') : 'A definir'}
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="bg-fundo/50 p-3 rounded-xl border-l-4 border-rosa italic text-sm text-vinho/80 mb-3">
                  "{order.notes}"
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${order.completed ? 'bg-verde' : 'bg-amarelo'}`} />
                <span className="text-[10px] font-bold text-cinza uppercase">
                  {order.completed ? 'Concluído' : 'Em produção'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-creme border-t border-rosa/20">
          <button 
            onClick={onClose}
            className="w-full bg-vinho text-creme py-4 rounded-2xl font-black text-lg hover:bg-opacity-90 transition-all shadow-lg"
          >
            Entendido
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function HoopLogo({ className = "w-24 h-24" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="41" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1="35" y1="65" x2="65" y2="35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="63" cy="37" r="1" fill="currentColor" />
      <path 
        d="M63 37 C 75 25, 85 45, 65 55 C 45 65, 35 45, 50 35" 
        stroke="currentColor" 
        strokeWidth="0.8" 
        strokeLinecap="round" 
        fill="none"
        className="opacity-40"
      />
      <rect x="42" y="2" width="16" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LandingPage({ onEnter }: { onEnter: (name: string, email: string, password?: string, isRegistering?: boolean) => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((isRegistering ? name : true) && email && password) {
      onEnter(name, email, password, isRegistering);
    }
  };

  return (
    <div className="min-h-screen bg-creme flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 border-[20px] border-rosa/20 rounded-full" />
      <div className="absolute bottom-[-5%] left-[-5%] w-48 h-48 border-[15px] border-vinho/5 rounded-full" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-vinho mb-4"
          >
            <HoopLogo className="w-32 h-32" />
          </motion.div>
          <h1 className="text-5xl font-serif font-black text-vinho tracking-tighter mb-2">bastidor</h1>
          <p className="text-cinza text-sm font-medium tracking-wide max-w-[250px] mx-auto leading-relaxed">
            seu ateliê de bordados organizado e leve
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[40px] shadow-2xl border border-rosa/30 space-y-5">
          <AnimatePresence mode="wait">
            {isRegistering && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-left overflow-hidden"
              >
                <label className="block text-[10px] font-bold text-cinza uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                <input 
                  required={isRegistering}
                  type="text" 
                  className="w-full bg-fundo/30 border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Como quer ser chamada?"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-left">
            <label className="block text-[10px] font-bold text-cinza uppercase tracking-widest mb-2 ml-1">E-mail</label>
            <input 
              required
              type="email" 
              className="w-full bg-fundo/30 border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>

          <div className="text-left">
            <label className="block text-[10px] font-bold text-cinza uppercase tracking-widest mb-2 ml-1">Senha</label>
            <div className="relative">
              <input 
                required
                type={showPassword ? "text" : "password"} 
                className="w-full bg-fundo/30 border-2 border-rosa/30 rounded-2xl px-5 py-4 pr-12 text-sm outline-none focus:border-vinho transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-cinza hover:text-vinho transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-vinho text-creme py-5 rounded-2xl font-black text-lg hover:bg-opacity-90 transition-all shadow-xl mt-4 active:scale-95"
          >
            {isRegistering ? 'criar minha conta' : 'entrar no ateliê'}
          </button>

          <div className="pt-2">
            <button 
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-xs font-bold text-cinza hover:text-vinho transition-colors uppercase tracking-widest"
            >
              {isRegistering ? 'já tenho uma conta' : 'ainda não tenho conta? cadastrar'}
            </button>
          </div>
        </form>

        <div className="mt-12 text-[10px] text-cinza font-bold uppercase tracking-[4px] opacity-40">
          ✦ feito com amor para bordadeiras ✦
        </div>
      </motion.div>
    </div>
  );
}

function AddOrderModal({ 
  onClose, 
  onAdd, 
  orderToEdit 
}: { 
  onClose: () => void; 
  onAdd: (order: Omit<Order, 'id' | 'completed'>) => void;
  orderToEdit?: Order | null;
}) {
  const [name, setName] = useState(orderToEdit?.customerName || '');
  const [piece, setPiece] = useState(orderToEdit?.pieceDescription || '');
  const [notes, setNotes] = useState(orderToEdit?.notes || '');
  const [date, setDate] = useState(orderToEdit?.deadline ? orderToEdit.deadline.toISOString().split('T')[0] : '');
  const [isPartnership, setIsPartnership] = useState(orderToEdit?.isPartnership || false);
  const [value, setValue] = useState(orderToEdit?.payment.totalValue || '');
  const [entryAmount, setEntryAmount] = useState(orderToEdit?.payment.pixEntryAmount || '');

  const entryPercentage = useMemo(() => {
    const total = parseFloat(value.replace(',', '.')) || 0;
    const entry = parseFloat(entryAmount.replace(',', '.')) || 0;
    if (total > 0 && entry > 0) {
      return Math.round((entry / total) * 100);
    }
    return 0;
  }, [value, entryAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !piece) return;

    onAdd({
      customerName: name,
      pieceDescription: piece,
      notes,
      deadline: date ? new Date(date + 'T12:00:00') : null,
      isPartnership,
      payment: orderToEdit ? { ...orderToEdit.payment, totalValue: value, pixEntryAmount: entryAmount } : {
        totalValue: value,
        type: null,
        pixEntryAmount: entryAmount,
        pixEntryPaid: false,
        pixRemainingPaid: false,
        cardInstallments: 1,
        cardPaid: false
      }
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-creme max-w-lg w-full rounded-[40px] shadow-2xl border-2 border-rosa overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header decorativo */}
        <div className="bg-vinho p-8 text-creme relative overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-32 h-32 border-[10px] border-rosa/10 rounded-full" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-rosa/20 p-3 rounded-2xl backdrop-blur-sm">
              {orderToEdit ? <Edit className="w-8 h-8 text-rosa" /> : <Plus className="w-8 h-8 text-rosa" />}
            </div>
            <div>
              <h3 className="text-3xl font-serif font-black tracking-tight">
                {orderToEdit ? 'Editar Encomenda' : 'Nova Encomenda'}
              </h3>
              <p className="text-rosa/60 text-[10px] uppercase tracking-widest font-bold mt-1">Preencha os detalhes do seu bordado</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">Quem é a cliente?</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa transition-colors group-focus-within:text-vinho">
                  <Menu className="w-4 h-4" />
                </div>
                <input 
                  required
                  type="text" 
                  className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-4 py-4 text-sm outline-none focus:border-vinho focus:ring-4 focus:ring-vinho/5 transition-all text-vinho font-medium placeholder:text-cinza/30 shadow-sm"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nome completo da cliente..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">O que vamos bordar?</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa transition-colors group-focus-within:text-vinho">
                  <Sparkles className="w-4 h-4" />
                </div>
                <input 
                  required
                  type="text" 
                  className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-4 py-4 text-sm outline-none focus:border-vinho focus:ring-4 focus:ring-vinho/5 transition-all text-vinho font-medium placeholder:text-cinza/30 shadow-sm"
                  value={piece}
                  onChange={e => setPiece(e.target.value)}
                  placeholder="Ex: Quadro Maternidade Ramos..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">Alguma observação importante?</label>
              <textarea 
                className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho focus:ring-4 focus:ring-vinho/5 transition-all h-28 resize-none text-vinho font-medium placeholder:text-cinza/30 shadow-sm"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Detalhes de cores, tecidos ou pedidos especiais da cliente..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 flex-1">
                <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">Para quando?</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa pointer-events-none transition-colors group-focus-within:text-vinho">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <input 
                    type="date" 
                    className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-4 py-4 text-sm outline-none focus:border-vinho focus:ring-4 focus:ring-vinho/5 transition-all text-vinho font-medium shadow-sm appearance-none"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">Valor do Bordado</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa transition-colors group-focus-within:text-vinho">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-rosa">BRL</div>
                  <input 
                    type="text" 
                    className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-12 py-4 text-sm outline-none focus:border-vinho focus:ring-4 focus:ring-vinho/5 transition-all text-vinho font-medium shadow-sm"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="block text-[10px] font-black text-cinza uppercase tracking-wider">Valor de Entrada (PIX)</label>
                {entryPercentage > 0 && (
                  <span className="text-[10px] font-black text-vinho bg-rosa/20 px-2 py-0.5 rounded-full">
                    {entryPercentage}% do total
                  </span>
                )}
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa transition-colors group-focus-within:text-vinho">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-rosa">OPCIONAL</div>
                <input 
                  type="text" 
                  className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-20 py-4 text-sm outline-none focus:border-vinho focus:ring-4 focus:ring-vinho/5 transition-all text-vinho font-medium shadow-sm"
                  value={entryAmount}
                  onChange={e => setEntryAmount(e.target.value)}
                  placeholder="Quanto você já recebeu?"
                />
              </div>
            </div>
          </div>

          <div 
            onClick={() => setIsPartnership(!isPartnership)}
            className="flex items-center gap-3 p-4 bg-white/50 border-2 border-rosa/20 rounded-2xl cursor-pointer hover:bg-white transition-all group shadow-sm"
          >
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isPartnership ? 'bg-vinho border-vinho text-white' : 'border-rosa text-transparent group-hover:border-vinho'}`}>
              <Check className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-vinho/70 group-hover:text-vinho transition-colors">Este pedido é uma parceria / collab?</span>
          </div>

          <div className="flex gap-4 pt-4 pb-2">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 bg-white border-2 border-rosa/40 text-vinho/60 py-5 rounded-[24px] font-black text-sm hover:bg-rosa/10 hover:text-vinho transition-all uppercase tracking-widest shadow-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-[1.5] bg-vinho text-creme py-5 rounded-[24px] font-black text-sm hover:bg-opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl uppercase tracking-widest"
            >
              {orderToEdit ? 'Salvar Alterações' : 'Cadastrar Bordado'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function Calendar({ 
  month, 
  year, 
  orders, 
  selectedDate, 
  onDateClick 
}: { 
  month: number; 
  year: number; 
  orders: Order[];
  selectedDate: Date | null;
  onDateClick: (date: Date) => void;
}) {
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  const days = useMemo(() => {
    const arr = [];
    // Padding for first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      arr.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      arr.push(i);
    }
    return arr;
  }, [month, year]);

  const getDayStatus = (day: number) => {
    const date = new Date(year, month, day);
    const dayOrders = orders.filter(o => o.deadline && o.deadline.toDateString() === date.toDateString());
    if (dayOrders.length === 0) return null;

    if (dayOrders.some(o => !o.completed && !o.isPartnership && (getDaysRemaining(o.deadline) || 0) <= 3)) return 'bg-vermelho';
    if (dayOrders.some(o => !o.completed && !o.isPartnership && (getDaysRemaining(o.deadline) || 0) <= 5)) return 'bg-amarelo';
    if (dayOrders.some(o => o.isPartnership)) return 'bg-cinza';
    return 'bg-verde';
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-creme">
      <h3 className="text-lg font-serif font-black text-vinho capitalize mb-4 text-center">{monthName} {year}</h3>
      <div className="grid grid-cols-7 gap-1">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={`${d}-${i}`} className="text-[10px] font-bold text-cinza text-center pb-2">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={i} className="aspect-square" />;
          
          const date = new Date(year, month, day);
          const status = getDayStatus(day);
          const isToday = date.toDateString() === TODAY.toDateString();
          const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
          const hasOrders = orders.some(o => o.deadline && o.deadline.toDateString() === date.toDateString());
          
          return (
            <button 
              key={i} 
              onClick={() => onDateClick(date)}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs relative transition-all ${
                isSelected ? 'bg-vinho text-white scale-110 z-10 shadow-md' : 
                hasOrders ? 'bg-creme/50 hover:bg-rosa/20 cursor-pointer' : 'bg-fundo/30'
              } ${isToday && !isSelected ? 'ring-2 ring-vinho font-bold' : ''}`}
            >
              {day}
              {status && !isSelected && (
                <div className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${status}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  index: number | string;
  onUpdatePayment: (updates: Partial<PaymentInfo>) => void;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  key?: React.Key;
}

function DeleteConfirmationModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-creme max-w-sm w-full rounded-[32px] p-8 shadow-2xl border-2 border-rosa text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-vermelho/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trash2 className="w-8 h-8 text-vermelho" />
        </div>
        <h3 className="text-2xl font-serif font-black text-vinho mb-2">Excluir Pedido?</h3>
        <p className="text-cinza text-sm mb-8">
          Esta ação não pode ser desfeita. Tem certeza que deseja remover este pedido permanentemente?
        </p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className="w-full bg-vermelho text-white py-4 rounded-2xl font-black text-sm hover:bg-opacity-90 transition-all shadow-lg"
          >
            Sim, Excluir
          </button>
          <button 
            onClick={onClose}
            className="w-full bg-white border-2 border-rosa text-vinho py-4 rounded-2xl font-black text-sm hover:bg-rosa/10 transition-all"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function OrderCard({ 
  order, 
  index, 
  onUpdatePayment, 
  onToggleComplete,
  onEdit,
  onDelete
}: OrderCardProps) {
  const days = getDaysRemaining(order.deadline);
  const statusColor = getStatusColor(days, order.isPartnership);
  
  const getBadge = () => {
    if (order.completed) return { text: 'concluído', class: 'bg-creme text-cinza' };
    if (order.isPartnership) return { text: 'parceria', class: 'bg-creme text-cinza' };
    if (days === null) return { text: 'sem prazo', class: 'bg-verde/10 text-verde' };
    if (days < 0) return { text: `${Math.abs(days)}d atrasado`, class: 'bg-vermelho text-white' };
    if (days === 0) return { text: 'hoje!', class: 'bg-vermelho/10 text-vermelho' };
    if (days <= 3) return { text: `${days}d restantes`, class: 'bg-vermelho/10 text-vermelho' };
    if (days <= 5) return { text: `${days}d restantes`, class: 'bg-amarelo/10 text-amarelo' };
    return { text: `${days}d restantes`, class: 'bg-verde/10 text-verde' };
  };

  const badge = getBadge();

  return (
    <motion.div 
      layout
      className={`bg-white rounded-2xl shadow-sm border-l-4 ${statusColor} overflow-hidden ${order.completed ? 'opacity-60' : ''}`}
    >
      <div className="p-4 flex items-start gap-4">
        <div className="text-2xl font-serif font-black text-vinho/30 w-8 text-center pt-1">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate">{order.customerName}</div>
          <div className="text-xs text-cinza truncate">{order.pieceDescription}</div>
          {order.notes && (
            <div className="text-[10px] text-vinho/70 italic mt-1 bg-rosa/5 px-2 py-1 rounded border border-rosa/10">
              "{order.notes}"
            </div>
          )}
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <div className="flex gap-1 mb-1">
            <button 
              onClick={onEdit}
              className="p-1.5 text-cinza hover:text-vinho hover:bg-creme rounded-lg transition-all"
              title="Editar pedido"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onDelete}
              className="p-1.5 text-cinza hover:text-vermelho hover:bg-vermelho/10 rounded-lg transition-all"
              title="Excluir pedido"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xs font-bold text-vinho">
            {order.deadline ? order.deadline.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '---'}
          </div>
          <div className="flex flex-col gap-1 items-end">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badge.class}`}>
              {badge.text}
            </span>
            {order.payment.type && (
              <span className="text-[8px] font-black text-vinho/40 uppercase tracking-widest bg-creme px-1.5 rounded">
                {order.payment.type === 'pix' ? 'PIX' : 'Cartão'}
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={onToggleComplete}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${order.completed ? 'bg-verde border-verde text-white' : 'border-rosa text-transparent'}`}
        >
          <Check className="w-4 h-4" />
        </button>
      </div>

      {!order.isPartnership && (
        <div className="bg-creme/50 border-t border-creme p-4 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-cinza uppercase">Valor:</span>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-cinza">R$</span>
                <input 
                  type="text" 
                  className="bg-white border border-rosa rounded-lg pl-7 pr-2 py-1 text-sm font-bold text-vinho w-24 outline-none focus:border-vinho"
                  value={order.payment.totalValue}
                  onChange={(e) => onUpdatePayment({ totalValue: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-cinza uppercase">Tipo:</span>
              <div className="flex bg-white border border-rosa rounded-lg overflow-hidden">
                <button 
                  onClick={() => onUpdatePayment({ type: 'pix' })}
                  className={`px-3 py-1 text-[10px] font-bold transition-all ${order.payment.type === 'pix' ? 'bg-verde text-white' : 'text-cinza hover:bg-creme'}`}
                >
                  PIX
                </button>
                <button 
                  onClick={() => onUpdatePayment({ type: 'card' })}
                  className={`px-3 py-1 text-[10px] font-bold transition-all ${order.payment.type === 'card' ? 'bg-azul text-white' : 'text-cinza hover:bg-creme'}`}
                >
                  CARTÃO
                </button>
              </div>
            </div>
          </div>

          {order.payment.type === 'pix' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              {(() => {
                const total = parseFloat(order.payment.totalValue.replace(',', '.')) || 0;
                const entry = parseFloat(order.payment.pixEntryAmount?.replace(',', '.') || '0') || (total * 0.5);
                const remaining = total - entry;
                const entryPct = total > 0 ? Math.round((entry / total) * 100) : 0;
                
                return (
                  <>
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-creme">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${order.payment.pixEntryPaid ? 'bg-verde/10 text-verde' : 'bg-amarelo/10 text-amarelo'}`}>
                          {order.payment.pixEntryPaid ? '✓ Entrada' : `Entrada ${entryPct}%`}
                        </span>
                        <span className="text-xs font-bold text-vinho">
                          {formatCurrency(entry)}
                        </span>
                      </div>
                      <button 
                        onClick={() => onUpdatePayment({ pixEntryPaid: !order.payment.pixEntryPaid })}
                        className={`text-[9px] font-bold px-3 py-1 rounded-full border transition-all ${order.payment.pixEntryPaid ? 'bg-verde border-verde text-white' : 'border-verde text-verde hover:bg-verde/5'}`}
                      >
                        {order.payment.pixEntryPaid ? '✓ Recebido' : 'Marcar recebido'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-creme">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${order.payment.pixRemainingPaid ? 'bg-verde/10 text-verde' : 'bg-vermelho/10 text-vermelho'}`}>
                          {order.payment.pixRemainingPaid ? '✓ Restante' : `Restante ${100 - entryPct}%`}
                        </span>
                        <span className="text-xs font-bold text-vinho">
                          {formatCurrency(remaining)}
                        </span>
                      </div>
                      <button 
                        onClick={() => onUpdatePayment({ pixRemainingPaid: !order.payment.pixRemainingPaid })}
                        className={`text-[9px] font-bold px-3 py-1 rounded-full border transition-all ${order.payment.pixRemainingPaid ? 'bg-verde border-verde text-white' : 'border-verde text-verde hover:bg-verde/5'}`}
                      >
                        {order.payment.pixRemainingPaid ? '✓ Recebido' : 'Marcar recebido'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {order.payment.type === 'card' && (
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-creme animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-cinza uppercase">Parc:</span>
                <input 
                  type="number" 
                  className="w-12 border border-rosa rounded-lg px-2 py-1 text-xs font-bold text-vinho outline-none focus:border-azul"
                  value={order.payment.cardInstallments}
                  onChange={(e) => onUpdatePayment({ cardInstallments: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="flex-1 text-[10px] text-cinza">
                {order.payment.cardInstallments}x de {formatCurrency((parseFloat(order.payment.totalValue.replace(',', '.')) || 0) / order.payment.cardInstallments)}
              </div>
              <button 
                onClick={() => onUpdatePayment({ cardPaid: !order.payment.cardPaid })}
                className={`text-[9px] font-bold px-3 py-1 rounded-full border transition-all ${order.payment.cardPaid ? 'bg-verde border-verde text-white' : 'border-verde text-verde hover:bg-verde/5'}`}
              >
                {order.payment.cardPaid ? '✓ Recebido' : 'Marcar recebido'}
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function InventoryModal({ 
  items, 
  onClose,
  onAdd,
  onDelete
}: { 
  items: InventoryItem[]; 
  onClose: () => void;
  onAdd: (item: Omit<InventoryItem, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [isAddingItem, setIsAddingItem] = useState(false);

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
                  <Package className="w-8 h-8 text-rosa" />
                </div>
                <h2 className="text-3xl font-serif font-black lowercase tracking-tighter">estoque</h2>
              </div>
              <p className="text-rosa/60 text-xs uppercase tracking-widest font-bold">controle de insumos e materiais</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all">
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full p-6 md:p-8 space-y-8 custom-scrollbar">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-serif text-vinho">Últimas Compras</h3>
            <button 
              onClick={() => setIsAddingItem(true)}
              className="bg-dourado text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
              REGISTRAR COMPRA
            </button>
          </div>

          <div className="space-y-4">
            {items.length > 0 ? (
              items.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-3xl border border-rosa/30 shadow-sm flex justify-between items-center group hover:border-vinho/30 transition-all">
                  <div className="flex gap-4 items-center min-w-0">
                    <div className="bg-creme p-3 rounded-2xl group-hover:bg-rosa/10 transition-colors">
                      <Sparkles className="w-6 h-6 text-vinho/40" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-vinho text-lg truncate">{item.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-rosa/20 text-vinho px-2 py-0.5 rounded uppercase">{item.category}</span>
                        <span className="text-[10px] text-cinza font-bold">{item.quantity}</span>
                        <span className="text-[10px] text-cinza opacity-40">•</span>
                        <span className="text-[10px] text-cinza uppercase">{item.purchaseDate.toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <div className="text-xl font-black text-vinho">{formatCurrency(parseFloat(item.price.replace(',', '.')))}</div>
                      <div className="text-[9px] text-cinza font-black uppercase tracking-tighter opacity-60">
                        {item.paymentMethod === 'cash' ? 'À Vista' : item.paymentMethod === 'pix' ? 'PIX' : `Cartão ${item.installments}x`}
                      </div>
                    </div>
                    <button 
                      onClick={() => onDelete(item.id)}
                      className="p-2 text-cinza hover:text-vermelho hover:bg-vermelho/5 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-rosa/30">
                <Package className="w-12 h-12 text-rosa mx-auto mb-4 opacity-30" />
                <p className="text-cinza font-medium">Nenhum item em estoque. Comece registrando suas compras!</p>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isAddingItem && (
            <AddInventoryModal 
              onClose={() => setIsAddingItem(false)}
              onAdd={(newItem) => {
                onAdd(newItem);
                setIsAddingItem(false);
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function AddInventoryModal({ 
  onClose, 
  onAdd 
}: { 
  onClose: () => void; 
  onAdd: (item: Omit<InventoryItem, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'cash' | 'pix' | 'card'>('pix');
  const [installments, setInstallments] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      name,
      category,
      quantity,
      price,
      purchaseDate: new Date(date + 'T12:00:00'),
      paymentMethod: method,
      installments
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
          <h3 className="text-3xl font-serif font-black tracking-tight">Novo Insumo</h3>
          <p className="text-rosa/60 text-[10px] uppercase tracking-widest font-bold mt-1">O que você comprou para o ateliê?</p>
          <button onClick={onClose} className="absolute top-8 right-8 p-1 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6 text-rosa" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-cinza uppercase ml-1">Descrição</label>
              <input 
                required
                className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                placeholder="Ex: Linhas Anchor meada, Tecido Linho..."
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-cinza uppercase ml-1">Categoria</label>
                <select 
                  className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  <option value="Linha">Linha / Meada</option>
                  <option value="Tecido">Tecido / Pano</option>
                  <option value="Bastidor">Bastidor</option>
                  <option value="Agulha">Agulha</option>
                  <option value="Embalagem">Embalagem</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-cinza uppercase ml-1">Quantidade</label>
                <input 
                  required
                  className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                  placeholder="Ex: 5 unid"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-cinza uppercase ml-1">Valor Total</label>
                <input 
                  required
                  className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                  placeholder="0,00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-cinza uppercase ml-1">Data da Compra</label>
                <input 
                  type="date"
                  className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black text-cinza uppercase ml-1">Forma de Pagamento</label>
              <div className="flex bg-white border-2 border-rosa/30 rounded-2xl overflow-hidden p-1">
                {(['cash', 'pix', 'card'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`flex-1 py-3 text-[10px] font-bold rounded-xl transition-all ${method === m ? 'bg-vinho text-white' : 'text-cinza hover:bg-rosa/10'}`}
                  >
                    {m === 'cash' ? 'À VISTA' : m === 'pix' ? 'PIX' : 'CARTÃO'}
                  </button>
                ))}
              </div>
            </div>

            {method === 'card' && (
              <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-black text-cinza uppercase ml-1">Parcelas</label>
                <input 
                  type="number"
                  className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                  value={installments}
                  onChange={e => setInstallments(parseInt(e.target.value) || 1)}
                />
              </div>
            )}
          </div>

          <button 
            type="submit"
            className="w-full bg-dourado text-white py-5 rounded-[24px] font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl uppercase tracking-widest mt-4"
          >
            Salvar no Estoque
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
