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
  LogOut,
  Search,
  Truck,
  HelpCircle,
  ShieldCheck,
  Tag,
  PackageSearch,
  ChevronDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { INITIAL_ORDERS, TODAY } from './constants';
import { Order, PaymentInfo, InventoryItem, Adicional, Produto, StockItem } from './types';
import { formatCurrency, getDaysRemaining, getStatusColor } from './lib/utils';
import { supabase } from './lib/supabase';
import SubscriptionModal from './components/SubscriptionModal';
import TrialExpiredModal from './components/TrialExpiredModal';
import SettingsModal from './components/SettingsModal';
import SecurityPrivacyModal from './components/SecurityPrivacyModal';
import AdicionaisModal from './components/AdicionaisModal';
import ProdutosModal from './components/ProdutosModal';
import StockModal from './components/StockModal';


export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [adicionais, setAdicionais] = useState<Adicional[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [trialInfo, setTrialInfo] = useState<any>(null);
  const [pdfDownloadCount, setPdfDownloadCount] = useState<number>(0);
  const [xlsDownloadCount, setXlsDownloadCount] = useState<number>(0);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);

  // Calcula dias restantes do trial (null = sem info, negativo = expirado)
  const trialDaysRemaining = trialInfo
    ? Math.floor((new Date(trialInfo.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isTrialExpired = trialDaysRemaining !== null && trialDaysRemaining < 0;
  const isOnTrial = trialDaysRemaining !== null && trialDaysRemaining >= 0;

  const fetchSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
    }
  };

  const fetchTrialInfo = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('trial_started_at, trial_ends_at, phone_number')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setTrialInfo(data);
    } catch (err) {
      console.error('Error fetching trial info:', err);
    }
  };

  const fetchPdfDownloadCount = async (userId: string) => {
    try {
      // Busca a assinatura para saber se é trial ou assinante
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const isSubscriber = sub && sub.status === 'active';

      let query = supabase
        .from('pdf_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Assinantes: conta só o mês atual. Trial: conta todos (desde sempre)
      if (isSubscriber) {
        const startOfMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1).toISOString();
        const endOfMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0, 23, 59, 59).toISOString();
        query = query.gte('downloaded_at', startOfMonth).lte('downloaded_at', endOfMonth);
      }

      const { count, error } = await query;
      if (error) throw error;
      setPdfDownloadCount(count || 0);
    } catch (err) {
      console.error('Error fetching PDF download count:', err);
    }
  };

  const fetchXlsDownloadCount = async (userId: string) => {
    try {
      // Busca a assinatura para saber se é trial ou assinante
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const isSubscriber = sub && sub.status === 'active';

      let query = supabase
        .from('xls_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Assinantes: conta só o mês atual. Trial: conta todos (desde sempre)
      if (isSubscriber) {
        const startOfMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1).toISOString();
        const endOfMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0, 23, 59, 59).toISOString();
        query = query.gte('downloaded_at', startOfMonth).lte('downloaded_at', endOfMonth);
      }

      const { count, error } = await query;
      if (error) throw error;
      setXlsDownloadCount(count || 0);
    } catch (err) {
      console.error('Error fetching XLS download count:', err);
    }
  };

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchOrders();
        fetchInventory();
        fetchAdicionais();
        fetchProdutos();
        fetchStockItems();
        fetchSubscription(session.user.id);
        fetchTrialInfo(session.user.id);
        fetchPdfDownloadCount(session.user.id);
        fetchXlsDownloadCount(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchOrders();
        fetchInventory();
        fetchAdicionais();
        fetchProdutos();
        fetchStockItems();
        fetchSubscription(session.user.id);
        fetchTrialInfo(session.user.id);
        fetchPdfDownloadCount(session.user.id);
        fetchXlsDownloadCount(session.user.id);
      } else {
        setOrders([]);
        setSubscription(null);
        setTrialInfo(null);
        setPdfDownloadCount(0);
        setXlsDownloadCount(0);
        setLoading(false);
      }
    });

    // Check URL parameters for Stripe redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setSubscriptionMessage('Assinatura processada com sucesso! Bem-vinda ao Bastidor Premium.');
      // Limpa os parâmetros da URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('payment') === 'cancel') {
      setSubscriptionMessage('O processo de assinatura foi cancelado.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => authSub.unsubscribe();
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
          payment: o.payment,
          selectedAdicionais: o.selected_adicionais || [],
          usedStockItems: o.used_stock_items || []
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

  const fetchAdicionais = async () => {
    try {
      const { data, error } = await supabase
        .from('adicionais')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) {
        setAdicionais(data.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price.toString(),
        })));
      }
    } catch (err) {
      console.error('Error fetching adicionais:', err);
    }
  };

  const fetchProdutos = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) {
        setProdutos(data.map(item => ({
          id: item.id,
          name: item.name,
        })));
      }
    } catch (err) {
      console.error('Error fetching produtos:', err);
    }
  };

  const fetchStockItems = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_items')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) {
        setStockItems(data.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
        })));
      }
    } catch (err) {
      console.error('Error fetching stock items:', err);
    }
  };


  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'received' | 'pending' | 'urgent' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
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
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isAdicionaisOpen, setIsAdicionaisOpen] = useState(false);
  const [isProdutosOpen, setIsProdutosOpen] = useState(false);
  const [isShippingOpen, setIsShippingOpen] = useState(false);
  const [isUrgencyInfoOpen, setIsUrgencyInfoOpen] = useState(false);
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);

  const reportMonths = useMemo(() => {
    const cur = TODAY.getMonth();
    const yr = TODAY.getFullYear();
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(yr, cur - i, 1);
      months.push({ 
        name: new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d),
        val: d.getMonth(),
        year: d.getFullYear()
      });
    }
    return months;
  }, []);


  const months = useMemo(() => {
    const currentMonth = TODAY.getMonth();
    const currentYear = TODAY.getFullYear();
    const arr = [];
    for (let m = currentMonth; m <= 11; m++) {
      arr.push({ month: m, year: currentYear });
    }
    return arr;
  }, []);

  // Derived Stats
  const stats = useMemo(() => {
    const activeOrders = orders.filter(o => !o.completed && !o.isPartnership);
    const urgentCount = activeOrders.filter(o => {
      const days = getDaysRemaining(o.deadline);
      return days !== null && days <= 10;
    }).length;

    let totalReceived = 0;
    let totalPending = 0;
    let receivedCount = 0;
    let pendingCount = 0;

    const monthlyTotals: Record<number, { total: number; received: number }> = {};
    months.forEach(m => {
      monthlyTotals[m.month] = { total: 0, received: 0 };
    });

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

  }, [orders, inventory]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (searchTerm.trim() !== '') {
      result = result.filter(o => 
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

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
  }, [orders, activeFilter, selectedDate, searchTerm]);

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

    // Verificação de limites baseados no plano
    const isBasic = subscription && subscription.status === 'active' && subscription.plan_tier === 'basic';
    const isPremium = subscription && subscription.status === 'active' && subscription.plan_tier === 'premium';
    const isFree = !subscription || subscription.status !== 'active';

    // No trial ou sem plano, limite de 5 pedidos
    if (isFree && orders.length >= 5) {
      alert("Limite de 5 pedidos atingido no período de teste! Assine um plano para continuar cadastrando.");
      setIsAddingOrder(false);
      setIsSubscriptionModalOpen(true);
      return;
    }

    if (isBasic && orders.length >= 15) {
      alert("Limite de 15 pedidos atingido no Plano Básico! Faça o upgrade para o Plano Premium para pedidos ilimitados.");
      setIsAddingOrder(false);
      setIsSubscriptionModalOpen(true);
      return;
    }
    
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        customer_name: newOrder.customerName,
        piece_description: newOrder.pieceDescription,
        notes: newOrder.notes,
        deadline: newOrder.deadline?.toISOString(),
        is_partnership: newOrder.isPartnership,
        payment: newOrder.payment,
        selected_adicionais: newOrder.selectedAdicionais || [],
        used_stock_items: newOrder.usedStockItems || [],
        user_id: user.id,
        completed: false
      }])
      .select()
      .single();
      
    if (!error && data) {
      // Deduz do estoque localmente e no banco
      if (newOrder.usedStockItems && newOrder.usedStockItems.length > 0) {
        newOrder.usedStockItems.forEach(async (usedItem) => {
          const item = stockItems.find(s => s.id === usedItem.stockItemId);
          if (item) {
            const newQuantity = Math.max(0, item.quantity - usedItem.quantity);
            await supabase.from('stock_items').update({ quantity: newQuantity }).eq('id', item.id);
            setStockItems(prev => prev.map(s => s.id === item.id ? { ...s, quantity: newQuantity } : s));
          }
        });
      }

      const mapped: Order = {
        id: data.id,
        customerName: data.customer_name,
        pieceDescription: data.piece_description,
        notes: data.notes,
        deadline: data.deadline ? new Date(data.deadline) : null,
        isPartnership: data.is_partnership,
        completed: data.completed,
        payment: data.payment,
        selectedAdicionais: data.selected_adicionais || [],
        usedStockItems: data.used_stock_items || []
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
        payment: updatedOrder.payment,
        selected_adicionais: updatedOrder.selectedAdicionais || [],
        used_stock_items: updatedOrder.usedStockItems || []
      })
      .eq('id', id);
      
    if (!error) {
      // Ajusta o estoque verificando a diferença
      const oldOrder = orders.find(o => o.id === id);
      const oldStock = oldOrder?.usedStockItems || [];
      const newStock = updatedOrder.usedStockItems || [];

      const stockDiffs: Record<string, number> = {};
      
      // Devolve o que foi usado antes
      oldStock.forEach(item => {
        stockDiffs[item.stockItemId] = (stockDiffs[item.stockItemId] || 0) + item.quantity;
      });
      // Retira o que está sendo usado agora
      newStock.forEach(item => {
        stockDiffs[item.stockItemId] = (stockDiffs[item.stockItemId] || 0) - item.quantity;
      });

      Object.entries(stockDiffs).forEach(async ([stockItemId, diff]) => {
        if (diff !== 0) {
          const item = stockItems.find(s => s.id === stockItemId);
          if (item) {
            const newQuantity = Math.max(0, item.quantity + diff);
            await supabase.from('stock_items').update({ quantity: newQuantity }).eq('id', stockItemId);
            setStockItems(prev => prev.map(s => s.id === stockItemId ? { ...s, quantity: newQuantity } : s));
          }
        }
      });

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
    if (deletingOrderId) {
      const orderToDelete = orders.find(o => o.id === deletingOrderId);
      
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', deletingOrderId);
        
      if (!error) {
        // Devolve os itens ao estoque
        if (orderToDelete?.usedStockItems && orderToDelete.usedStockItems.length > 0) {
          orderToDelete.usedStockItems.forEach(async (usedItem) => {
            const item = stockItems.find(s => s.id === usedItem.stockItemId);
            if (item) {
              const newQuantity = item.quantity + usedItem.quantity;
              await supabase.from('stock_items').update({ quantity: newQuantity }).eq('id', item.id);
              setStockItems(prev => prev.map(s => s.id === item.id ? { ...s, quantity: newQuantity } : s));
            }
          });
        }

        setOrders(prev => prev.filter(o => o.id !== deletingOrderId));
        setDeletingOrderId(null);
      } else {
        console.error('Error deleting order:', error);
      }
    }
  };

  const addInventoryItem = async (newItem: Omit<InventoryItem, 'id'>) => {
    if (!user) return;

    const isBasic = subscription && subscription.status === 'active' && subscription.plan_tier === 'basic';
    const isPremium = subscription && subscription.status === 'active' && subscription.plan_tier === 'premium';
    const isFree = !subscription || subscription.status !== 'active';

    if (isFree) {
      alert("O controle de estoque é exclusivo para assinantes! Escolha um plano para ativar.");
      setIsInventoryOpen(false);
      setIsSubscriptionModalOpen(true);
      return;
    }

    if (isBasic && inventory.length >= 20) {
      alert("Limite de 20 itens no estoque atingido no Plano Básico! Faça o upgrade para o Plano Premium para ter estoque ilimitado.");
      setIsInventoryOpen(false);
      setIsSubscriptionModalOpen(true);
      return;
    }
    
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

  const updateInventoryItem = async (id: string, updatedItem: Omit<InventoryItem, 'id'>) => {
    const { error } = await supabase
      .from('inventory')
      .update({
        name: updatedItem.name,
        category: updatedItem.category,
        quantity: updatedItem.quantity,
        price: parseFloat(updatedItem.price.replace(',', '.')) || 0,
        purchase_date: updatedItem.purchaseDate.toISOString(),
        payment_method: updatedItem.paymentMethod,
        installments: updatedItem.installments || 1
      })
      .eq('id', id);
      
    if (!error) {
      setInventory(prev => prev.map(item => item.id === id ? {
        id,
        name: updatedItem.name,
        category: updatedItem.category,
        quantity: updatedItem.quantity,
        price: updatedItem.price,
        purchaseDate: updatedItem.purchaseDate,
        paymentMethod: updatedItem.paymentMethod,
        installments: updatedItem.installments
      } : item));
    } else {
      console.error('Error updating inventory item:', error);
    }
  };

  const addAdicional = async (newItem: Omit<Adicional, 'id'>) => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('adicionais')
      .insert([{
        name: newItem.name,
        price: parseFloat(newItem.price.replace(',', '.')) || 0,
        user_id: user.id
      }])
      .select()
      .single();
      
    if (!error && data) {
      setAdicionais(prev => [{
        id: data.id,
        name: data.name,
        price: data.price.toString()
      }, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (error) {
      console.error('Error adding adicional:', error);
    }
  };

  const updateAdicional = async (id: string, updatedItem: Omit<Adicional, 'id'>) => {
    const { error } = await supabase
      .from('adicionais')
      .update({
        name: updatedItem.name,
        price: parseFloat(updatedItem.price.replace(',', '.')) || 0
      })
      .eq('id', id);
      
    if (!error) {
      setAdicionais(prev => prev.map(item => item.id === id ? {
        id,
        name: updatedItem.name,
        price: updatedItem.price
      } : item).sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      console.error('Error updating adicional:', error);
    }
  };

  const deleteAdicional = async (id: string) => {
    const { error } = await supabase
      .from('adicionais')
      .delete()
      .eq('id', id);
      
    if (!error) {
      setAdicionais(prev => prev.filter(item => item.id !== id));
    } else {
      console.error('Error deleting adicional:', error);
    }
  };

  const addProduto = async (newItem: Omit<Produto, 'id'>) => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('produtos')
      .insert([{
        name: newItem.name,
        user_id: user.id
      }])
      .select()
      .single();
      
    if (!error && data) {
      setProdutos(prev => [{
        id: data.id,
        name: data.name,
      }, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (error) {
      console.error('Error adding produto:', error);
    }
  };

  const updateProduto = async (id: string, updatedItem: Omit<Produto, 'id'>) => {
    const { error } = await supabase
      .from('produtos')
      .update({
        name: updatedItem.name,
      })
      .eq('id', id);
      
    if (!error) {
      setProdutos(prev => prev.map(item => item.id === id ? {
        id,
        name: updatedItem.name,
      } : item).sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      console.error('Error updating produto:', error);
    }
  };

  const deleteProduto = async (id: string) => {
    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', id);
      
    if (!error) {
      setProdutos(prev => prev.filter(item => item.id !== id));
    } else {
      console.error('Error deleting produto:', error);
    }
  };

  const addStockItem = async (newItem: Omit<StockItem, 'id'>) => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('stock_items')
      .insert([{
        name: newItem.name,
        category: newItem.category,
        quantity: newItem.quantity,
        user_id: user.id
      }])
      .select()
      .single();
      
    if (!error && data) {
      setStockItems(prev => [{
        id: data.id,
        name: data.name,
        category: data.category,
        quantity: data.quantity,
      }, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (error) {
      console.error('Error adding stock item:', error);
    }
  };

  const updateStockItem = async (id: string, updatedItem: Omit<StockItem, 'id'>) => {
    const { error } = await supabase
      .from('stock_items')
      .update({
        name: updatedItem.name,
        category: updatedItem.category,
        quantity: updatedItem.quantity,
      })
      .eq('id', id);
      
    if (!error) {
      setStockItems(prev => prev.map(item => item.id === id ? {
        id,
        name: updatedItem.name,
        category: updatedItem.category,
        quantity: updatedItem.quantity,
      } : item).sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      console.error('Error updating stock item:', error);
    }
  };

  const deleteStockItem = async (id: string) => {
    const { error } = await supabase
      .from('stock_items')
      .delete()
      .eq('id', id);
      
    if (!error) {
      setStockItems(prev => prev.filter(item => item.id !== id));
    } else {
      console.error('Error deleting stock item:', error);
    }
  };


  const generatePDF = async () => {
    // 1. Verificações de limites de PDF
    const isBasic = subscription && subscription.status === 'active' && subscription.plan_tier === 'basic';
    const isPremium = subscription && subscription.status === 'active' && subscription.plan_tier === 'premium';
    const isFree = !subscription || subscription.status !== 'active';

    if (isFree) {
      // No trial: limite de 1 PDF no total do período (contagem total, não mensal)
      if (pdfDownloadCount >= 1) {
        alert("Você já utilizou seu relatório PDF de teste! Assine um plano para gerar relatórios ilimitados.");
        setIsSubscriptionModalOpen(true);
        return;
      }
    } else if (isBasic) {
      if (isCustomRange) {
        alert("Relatórios personalizados por período são exclusivos do Plano Premium! Faça o upgrade para liberar.");
        setIsSubscriptionModalOpen(true);
        return;
      }
      if (pdfDownloadCount >= 2) {
        alert("Você atingiu o limite de 2 downloads de relatório PDF este mês no Plano Básico! Faça o upgrade para o Plano Premium para ter downloads ilimitados.");
        setIsSubscriptionModalOpen(true);
        return;
      }
    }

    const doc = new jsPDF();
    let reportTitle = '';
    let filteredOrders: Order[] = [];
    let filteredInventory: InventoryItem[] = [];
    let periodLabel = '';

    if (isCustomRange && startDate && endDate) {
      const startParts = startDate.split('-');
      const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]), 0, 0, 0);
      const endParts = endDate.split('-');
      const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]), 23, 59, 59);
      
      periodLabel = `${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`;
      reportTitle = `Relatório Personalizado`;
      
      filteredOrders = orders.filter(o => o.deadline && o.deadline >= start && o.deadline <= end && !o.isPartnership);
      filteredInventory = inventory.filter(i => i.purchaseDate >= start && i.purchaseDate <= end);
    } else {
      const monthDate = new Date(TODAY.getFullYear(), reportMonth, 1);
      const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(monthDate);
      periodLabel = `${monthName} ${TODAY.getFullYear()}`;
      reportTitle = `Relatório Financeiro`;
      
      const start = new Date(TODAY.getFullYear(), reportMonth, 1, 0, 0, 0);
      const end = new Date(TODAY.getFullYear(), reportMonth + 1, 0, 23, 59, 59);

      filteredOrders = orders.filter(o => o.deadline && o.deadline >= start && o.deadline <= end && !o.isPartnership);
      filteredInventory = inventory.filter(i => i.purchaseDate >= start && i.purchaseDate <= end);
    }
    
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
    doc.text(`${reportTitle} • ${periodLabel}`, 105, 46, { align: 'center' });
    
    // Summary Section
    const statsForReport = filteredOrders.reduce((acc, o) => {
      const value = parseFloat(o.payment.totalValue.replace(',', '.')) || 0;
      acc.total += value;
      if (o.payment.type === 'pix') {
        const totalValueNum = value;
        const entryAmnt = parseFloat(o.payment.pixEntryAmount?.replace(',', '.') || '0') || (totalValueNum * 0.5);
        const remainingAmnt = totalValueNum - entryAmnt;
        if (o.payment.pixEntryPaid) acc.received += entryAmnt;
        if (o.payment.pixRemainingPaid) acc.received += remainingAmnt;
      } else if (o.payment.type === 'card' && o.payment.cardPaid) {
        acc.received += value;
      }
      return acc;
    }, { total: 0, received: 0 });

    const totalGastos = filteredInventory.reduce((sum, item) => sum + (parseFloat(item.price.replace(',', '.')) || 0), 0);
    const pending = statsForReport.total - statsForReport.received;
    const caixa = statsForReport.received - totalGastos;
    
    doc.setTextColor(74, 55, 40);
    doc.setFontSize(14);
    doc.text('Resumo do Período', 14, 60);
    
    autoTable(doc, {
      startY: 65,
      head: [['Descrição', 'Valor']],
      body: [
        ['Total em Encomendas', formatCurrency(statsForReport.total)],
        ['Total Recebido', formatCurrency(statsForReport.received)],
        ['Total a Receber', formatCurrency(pending)],
        ['Gastos Totais', formatCurrency(totalGastos)],
        ['Caixa (Recebido - Gastos)', formatCurrency(caixa)],
      ],
      headStyles: { fillColor: [74, 55, 40] },
      margin: { left: 14, right: 14 },
    });
    
    // Detailed Transactions
    doc.setFontSize(16);
    doc.text('Detalhamento de Recebidos', 14, (doc as any).lastAutoTable.finalY + 15);
    
    const tableData: any[] = [];
    
    filteredOrders.forEach(o => {
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

    // Detailed Gastos
    const gastosData: any[] = [];
    filteredInventory.forEach(item => {
      gastosData.push([
        item.name, 
        item.category, 
        item.paymentMethod === 'cash' ? 'À Vista' : item.paymentMethod === 'pix' ? 'PIX' : 'Cartão', 
        formatCurrency(parseFloat(item.price.replace(',', '.')) || 0)
      ]);
    });

    if (gastosData.length > 0) {
      doc.setFontSize(16);
      doc.text('Detalhamento de Gastos', 14, (doc as any).lastAutoTable.finalY + 15);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Item', 'Categoria', 'Pagamento', 'Valor']],
        body: gastosData,
        headStyles: { fillColor: [166, 93, 71] },
        margin: { left: 14, right: 14 },
      });
    }
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} - Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
    }
    
    doc.save(`Relatorio_Bastidor_${periodLabel.replace(/ /g, '_')}.pdf`);

    // 2. Registrar download de PDF caso o plano seja Gratuito ou Básico
    if (isFree || isBasic) {
      try {
        const { error } = await supabase
          .from('pdf_downloads')
          .insert([{ user_id: user.id }]);
        
        if (!error) {
          setPdfDownloadCount(prev => prev + 1);
        }
      } catch (err) {
        console.error('Erro ao registrar cota de download de PDF:', err);
      }
    }
  };

  const generateXLS = async () => {
    // 1. Verificações de limites de XLS
    const isBasic = subscription && subscription.status === 'active' && subscription.plan_tier === 'basic';
    const isPremium = subscription && subscription.status === 'active' && subscription.plan_tier === 'premium';
    const isFree = !subscription || subscription.status !== 'active';

    if (isFree) {
      // No trial: permite 1 planilha XLS no total do período
      if (xlsDownloadCount >= 1) {
        alert("Você já utilizou sua planilha XLS de teste! Assine um plano para exportar planilhas ilimitadas.");
        setIsSubscriptionModalOpen(true);
        return;
      }
    } else if (isBasic) {
      if (isCustomRange) {
        alert("Relatórios personalizados por período são exclusivos do Plano Premium! Faça o upgrade para liberar.");
        setIsSubscriptionModalOpen(true);
        return;
      }
      if (xlsDownloadCount >= 1) {
        alert("Você atingiu o limite de 1 download de relatório XLS este mês no Plano Básico! Faça o upgrade para o Plano Premium para ter downloads ilimitados.");
        setIsSubscriptionModalOpen(true);
        return;
      }
    }

    let filteredInventory: InventoryItem[] = [];
    let periodLabel = '';

    if (isCustomRange && startDate && endDate) {
      const startParts = startDate.split('-');
      const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]), 0, 0, 0);
      const endParts = endDate.split('-');
      const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]), 23, 59, 59);
      
      periodLabel = `${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`;
      filteredInventory = inventory.filter(i => i.purchaseDate >= start && i.purchaseDate <= end);
    } else {
      const monthDate = new Date(TODAY.getFullYear(), reportMonth, 1);
      const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(monthDate);
      periodLabel = `${monthName} ${TODAY.getFullYear()}`;
      
      const start = new Date(TODAY.getFullYear(), reportMonth, 1, 0, 0, 0);
      const end = new Date(TODAY.getFullYear(), reportMonth + 1, 0, 23, 59, 59);

      filteredInventory = inventory.filter(i => i.purchaseDate >= start && i.purchaseDate <= end);
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Balanço');

      // Colunas
      worksheet.columns = [
        { header: 'Data', key: 'date', width: 15 },
        { header: 'Descrição', key: 'description', width: 35 },
        { header: 'Pagamento', key: 'payment', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Qtd', key: 'qtd', width: 10 },
        { header: 'Valor (R$)', key: 'value', width: 18 }
      ];

      // Estilo do cabeçalho
      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4A3728' } // Marrom do ateliê
        };
        cell.font = {
          color: { argb: 'FFFFFFFF' },
          bold: true,
          name: 'Calibri',
          size: 11
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
          right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
        };
      });

      // Adicionar linhas de dados
      filteredInventory.forEach((item, index) => {
        const rowData = {
          date: item.purchaseDate.toLocaleDateString('pt-BR'),
          description: item.name,
          payment: item.paymentMethod === 'pix' ? 'Pix' : item.paymentMethod === 'card' ? 'Cartão' : 'Dinheiro',
          status: 'Quitado',
          qtd: parseFloat(item.quantity.replace(',', '.')) || 0,
          value: parseFloat(item.price.replace(',', '.')) || 0
        };

        const row = worksheet.addRow(rowData);
        row.height = 20;

        const isEven = index % 2 === 1;
        const bgColor = isEven ? 'FFF2F5F9' : 'FFFFFFFF';

        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          };
          cell.font = { name: 'Calibri', size: 11 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
          };

          if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else if (colNumber === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else if (colNumber === 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.numFmt = '#,##0.00';
          } else if (colNumber === 6) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.numFmt = '"R$ " #,##0.00';
          }
        });
      });

      const totalQtd = filteredInventory.reduce((acc, item) => acc + (parseFloat(item.quantity.replace(',', '.')) || 0), 0);
      const totalValue = filteredInventory.reduce((acc, item) => acc + (parseFloat(item.price.replace(',', '.')) || 0), 0);

      // Linha TOTAL GERAL
      const totalRow = worksheet.addRow({
        date: 'TOTAL GERAL',
        description: '',
        payment: '',
        status: '',
        qtd: totalQtd,
        value: totalValue
      });
      totalRow.height = 20;
      totalRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 11, bold: true };
        cell.border = {
          top: { style: 'double', color: { argb: 'FF000000' } },
          bottom: { style: 'double', color: { argb: 'FF000000' } }
        };
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.numFmt = '#,##0.00';
        } else if (colNumber === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.numFmt = '"R$ " #,##0.00';
        }
      });

      // Linha SUBTOTAL QUITADOS
      const subtotalQuitadosRow = worksheet.addRow({
        date: 'SUBTOTAL QUITADOS',
        description: '',
        payment: '',
        status: '',
        qtd: '',
        value: totalValue
      });
      subtotalQuitadosRow.height = 20;
      subtotalQuitadosRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 11, bold: true };
        cell.border = {
          top: { style: 'double', color: { argb: 'FF000000' } },
          bottom: { style: 'double', color: { argb: 'FF000000' } }
        };
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.numFmt = '"R$ " #,##0.00';
        }
      });

      // Linha SUBTOTAL PENDENTES
      const subtotalPendentesRow = worksheet.addRow({
        date: 'SUBTOTAL PENDENTES',
        description: '',
        payment: '',
        status: '',
        qtd: '',
        value: 0
      });
      subtotalPendentesRow.height = 20;
      subtotalPendentesRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 11, bold: true };
        cell.border = {
          top: { style: 'double', color: { argb: 'FF000000' } },
          bottom: { style: 'double', color: { argb: 'FF000000' } }
        };
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.numFmt = '"R$ " #,##0.00';
        }
      });

      // Salvar
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Relatorio_Financeiro_Bastidor_${periodLabel.replace(/ /g, '_')}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);

      // Registrar download de XLS (trial ou básico)
      if (isFree || isBasic) {
        try {
          const { error } = await supabase
            .from('xls_downloads')
            .insert([{ user_id: user.id }]);
          
          if (!error) {
            setXlsDownloadCount(prev => prev + 1);
          }
        } catch (err) {
          console.error('Erro ao registrar cota de download de XLS:', err);
        }
      }

    } catch (error) {
      console.error('Erro ao gerar planilha XLS:', error);
      alert('Ocorreu um erro ao gerar a planilha.');
    }
  };

  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(TODAY.getFullYear(), reportMonth));

  if (loading) {
    return (
      <div className="min-h-screen bg-creme flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vinho"></div>
      </div>
    );
  }

  if (isResettingPassword) {
    return (
      <ResetPasswordPage 
        onReset={async (newPassword) => {
          try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            alert('Senha redefinida com sucesso! Você já está conectada.');
            setIsResettingPassword(false);
          } catch (err: any) {
            alert(err.message);
          }
        }} 
        onClose={() => setIsResettingPassword(false)} 
      />
    );
  }

  if (!user) {
    return <LandingPage onEnter={async (name, email, password, isRegistering, phone, coupon) => {
      try {
        if (isRegistering) {
          // Normaliza o telefone (apenas dígitos)
          const phoneNormalized = (phone || '').replace(/\D/g, '');
          if (!phoneNormalized || phoneNormalized.length < 10) {
            throw new Error('Por favor, informe um número de telefone válido com DDD.');
          }

          // Verifica se o telefone já está cadastrado
          const { data: existingPhone } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('phone_number', phoneNormalized)
            .maybeSingle();

          if (existingPhone) {
            throw new Error('Este número de telefone já está cadastrado. Cada pessoa pode ter apenas uma conta. Se você já possui conta, entre com seu e-mail e senha.');
          }

          // Cria a conta no Supabase Auth
          const { data: signUpData, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: name, phone: phoneNormalized }
            }
          });
          if (error) throw error;

          // Insere o perfil com telefone e datas de trial padrão (15 dias)
          if (signUpData.user) {
            const { error: profileError } = await supabase
              .from('user_profiles')
              .insert([{
                user_id: signUpData.user.id,
                phone_number: phoneNormalized,
              }]);
            if (profileError) {
              console.error('Erro ao criar perfil:', profileError);
            }

            // Se cupom informado, aplica via função segura do banco
            const couponTrimmed = (coupon || '').trim().toUpperCase();
            if (couponTrimmed && signUpData.user) {
              const { data: couponResult } = await supabase
                .rpc('apply_coupon', {
                  p_user_id: signUpData.user.id,
                  p_code: couponTrimmed,
                });

              if (couponResult?.success) {
                alert(`Cadastro realizado! 🎉\n\nCupom "${couponTrimmed}" aplicado com sucesso!\nSeu período de teste é de ${couponResult.total_days} dias. Bem-vinda!`);
              } else {
                // Cupom inválido — conta foi criada mas trial fica em 15 dias
                alert(`Cadastro realizado com sucesso! Seu período de teste de 15 dias começou agora. Bem-vinda! 🎉\n\nAtenção: ${couponResult?.error || 'O cupom informado não é válido.'}`);
              }
            } else {
              alert('Cadastro realizado com sucesso! Seu período de teste de 15 dias começou agora. Bem-vinda! 🎉');
            }
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (error) throw error;
        }
      } catch (err: any) {
        const authErrors: Record<string, string> = {
          'Invalid login credentials': 'E-mail ou senha incorretos.',
          'User already registered': 'Este e-mail já possui uma conta cadastrada. Clique em "já tenho uma conta" para entrar.',
          'Email already in use': 'Este e-mail já está em uso. Tente fazer login.',
          'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
          'Unable to validate email address: invalid format': 'Formato de e-mail inválido.',
          'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
          'For security purposes, you can only request this after': 'Por segurança, aguarde antes de tentar novamente.',
        };
        const msg = authErrors[err.message] || err.message;
        alert(msg);
      }
    }} />;
  }

  // Bloqueia acesso se trial expirado e sem assinatura ativa
  const hasActiveSubscription = subscription && subscription.status === 'active';
  if (isTrialExpired && !hasActiveSubscription) {
    return (
      <TrialExpiredModal
        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
        onLogout={() => supabase.auth.signOut()}
        onSubscriptionSuccess={() => fetchSubscription(user.id)}
      />
    );
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

              <nav className="flex-1 p-4 space-y-2 mt-4">
                <button 
                  onClick={() => {
                    const isFree = !subscription || subscription.status !== 'active';
                    if (isFree) {
                      alert("O controle de estoque físico é exclusivo para assinantes! Escolha um plano para ativar.");
                      setIsSidebarOpen(false);
                      setIsSubscriptionModalOpen(true);
                    } else {
                      setIsStockModalOpen(true);
                      setIsSidebarOpen(false);
                    }
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <Package className="w-5 h-5" />
                  <span>Estoque Físico</span>
                </button>
                <button 
                  onClick={() => {
                    const isFree = !subscription || subscription.status !== 'active';
                    if (isFree) {
                      alert("O controle de compras é exclusivo para assinantes! Escolha um plano para ativar.");
                      setIsSidebarOpen(false);
                      setIsSubscriptionModalOpen(true);
                    } else {
                      setIsInventoryOpen(true);
                      setIsSidebarOpen(false);
                    }
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <TrendingUp className="w-5 h-5" />
                  <span>Compras & Gastos</span>
                </button>
                <button 
                  onClick={() => {
                    setIsAdicionaisOpen(true);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <Tag className="w-5 h-5" />
                  <span>Adicionais (Extras)</span>
                </button>
                <button 
                  onClick={() => {
                    setIsProdutosOpen(true);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <PackageSearch className="w-5 h-5" />
                  <span>Meus Produtos</span>
                </button>
                <button 
                  onClick={() => {
                    setIsShippingOpen(true);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <Truck className="w-5 h-5" />
                  <span>Fretes & Envios</span>
                </button>
                <button 
                  onClick={() => {
                    setIsSubscriptionModalOpen(true);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="flex-1 text-left">Minha Assinatura</span>
                  {subscription && subscription.status === 'active' && (
                    <span className="text-[8px] bg-dourado text-white font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                      {subscription.plan_tier === 'premium' ? 'Premium' : 'Básico'}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => {
                    setIsSettingsOpen(true);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-vinho hover:bg-rosa/10 transition-all font-bold"
                >
                  <Settings className="w-5 h-5" />
                  <span>Configurações</span>
                </button>
                <button 
                  onClick={() => {
                    setIsSecurityOpen(true);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-verde/90 hover:bg-verde/10 transition-all font-bold"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Segurança e Privacidade</span>
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

      {subscriptionMessage && (
        <div className="bg-verde text-creme text-center py-3.5 px-6 text-xs font-black uppercase tracking-wider flex justify-between items-center shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="flex-1 text-center">✦ {subscriptionMessage} ✦</span>
          <button 
            onClick={() => setSubscriptionMessage(null)}
            className="p-1 text-creme hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner de Trial — exibe somente para usuários em período de teste */}
      {isOnTrial && !hasActiveSubscription && (
        <div
          className={`text-center py-2.5 px-6 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-3 cursor-pointer transition-all hover:opacity-90`}
          style={{
            background: (trialDaysRemaining !== null && trialDaysRemaining <= 3)
              ? 'linear-gradient(90deg, #C0392B, #E74C3C)'
              : 'linear-gradient(90deg, #C9A84C, #E8C76B)',
            color: 'white'
          }}
          onClick={() => setIsSubscriptionModalOpen(true)}
        >
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {trialDaysRemaining !== null && trialDaysRemaining <= 3
              ? `⚠️ Apenas ${trialDaysRemaining} dia${trialDaysRemaining !== 1 ? 's' : ''} de teste restante${trialDaysRemaining !== 1 ? 's' : ''}! Assine agora`
              : `✦ Período de teste: ${trialDaysRemaining} dia${trialDaysRemaining !== 1 ? 's' : ''} restante${trialDaysRemaining !== 1 ? 's' : ''} — Conheça os planos ✦`
            }
          </span>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
        </div>
      )}

      <div className="bg-dourado text-white text-center py-2 text-xs font-medium tracking-wider">
        hoje: {TODAY.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
      </div>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-8">
        {/* Finance Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-rosa pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-vinho" />
              <h2 className="text-xl font-serif text-vinho">Resumo Financeiro</h2>
            </div>
            <div className="text-[10px] text-cinza font-black uppercase tracking-widest">{monthName}</div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setFinanceDetailType('received');
                setIsFinanceDetailsOpen(true);
              }}
              className={`p-5 rounded-3xl shadow-lg text-left transition-all flex flex-col justify-between min-h-[140px] ${activeFilter === 'received' ? 'ring-4 ring-dourado bg-vinho text-white' : 'bg-vinho text-white'}`}
            >
              <div className="bg-white/10 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-rosa" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-1">Total Recebido</div>
                <div className="text-2xl font-serif font-black">{formatCurrency(stats.totalReceived)}</div>
                <div className="text-[10px] opacity-40 font-bold mt-1 lowercase">{stats.receivedCount} pagamentos identificados</div>
              </div>
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setFinanceDetailType('pending');
                setIsFinanceDetailsOpen(true);
              }}
              className={`p-5 rounded-3xl shadow-sm text-left border-2 transition-all flex flex-col justify-between min-h-[140px] ${activeFilter === 'pending' ? 'ring-4 ring-vinho bg-white border-rosa' : 'bg-white border-rosa'}`}
            >
              <div className="bg-rosa/10 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-vinho" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-black tracking-widest text-cinza mb-1">A Receber</div>
                <div className="text-2xl font-serif font-black text-vinho">{formatCurrency(stats.totalPending)}</div>
                <div className="text-[10px] text-cinza opacity-60 font-bold mt-1 lowercase">{stats.pendingCount} pendências este mês</div>
              </div>
            </motion.button>

            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="p-5 rounded-3xl bg-creme border-2 border-rosa/50 shadow-sm flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-vermelho/10 w-10 h-10 rounded-2xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-vermelho" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-cinza font-black uppercase">{inventory.length} compras</div>
                  <div className="text-[8px] text-cinza opacity-40 uppercase font-bold">estoque & insumos</div>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-black tracking-widest text-cinza mb-1">Gastos Totais</div>
                <div className="text-2xl font-serif font-black text-vermelho">{formatCurrency(stats.totalInventoryExpenses)}</div>
                <div className="text-[10px] text-cinza opacity-40 font-bold mt-1 lowercase">deduzido do balanço geral</div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="p-5 rounded-3xl bg-verde/10 border-2 border-verde/30 shadow-sm flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-verde/20 w-10 h-10 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-verde" />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-black tracking-widest text-cinza mb-1">Caixa</div>
                <div className="text-2xl font-serif font-black text-verde">{formatCurrency(stats.totalReceived - stats.totalInventoryExpenses)}</div>
                <div className="text-[10px] text-cinza opacity-60 font-bold mt-1 lowercase">recebido - gastos</div>
              </div>
            </motion.div>
          </div>


          <div className="grid grid-cols-3 gap-2">
            {months.map(m => (
              <div key={m.month} className="bg-white p-3 rounded-xl text-center shadow-sm border border-creme">
                <div className="text-[10px] text-cinza uppercase tracking-wider">
                  {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(m.year, m.month))}
                </div>
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
          <div className="flex items-center justify-between border-b border-rosa pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-vinho" />
              <h2 className="text-xl font-serif text-vinho">Relatórios Mensais</h2>
            </div>
            {!isCustomRange && (
               <span className="text-[10px] font-black text-rosa uppercase tracking-widest bg-rosa/10 px-2 py-0.5 rounded">
                 {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, reportMonth))}
               </span>
            )}
          </div>
          
          <div className="bg-white p-6 rounded-[40px] border-2 border-rosa shadow-sm space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {reportMonths.map(m => (
                <button
                  key={`${m.val}-${m.year}`}
                  onClick={() => {
                    setReportMonth(m.val);
                    setIsCustomRange(false);
                  }}
                  className={`py-4 px-3 rounded-2xl text-xs font-black transition-all border-2 uppercase tracking-tighter ${
                    !isCustomRange && reportMonth === m.val 
                    ? 'bg-vinho border-vinho text-creme shadow-lg scale-105' 
                    : 'bg-white border-rosa/30 text-vinho/60 hover:border-vinho hover:text-vinho'
                  }`}
                >
                  {m.name.substring(0, 3)}
                </button>
              ))}
              <button
                onClick={() => setIsCustomRange(true)}
                className={`py-4 px-3 rounded-2xl text-xs font-black transition-all border-2 uppercase tracking-tighter flex items-center justify-center gap-2 ${
                  isCustomRange 
                  ? 'bg-dourado border-dourado text-white shadow-lg scale-105' 
                  : 'bg-white border-rosa/30 text-vinho/60 hover:border-vinho hover:text-vinho'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Personalizado
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isCustomRange && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-creme/50 p-6 rounded-3xl border-2 border-dashed border-rosa/50 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-cinza uppercase tracking-widest ml-1">Início do Período</label>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-white border-2 border-rosa/30 rounded-xl px-4 py-3 text-sm font-bold text-vinho outline-none focus:border-vinho transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-cinza uppercase tracking-widest ml-1">Fim do Período</label>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-white border-2 border-rosa/30 rounded-xl px-4 py-3 text-sm font-bold text-vinho outline-none focus:border-vinho transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="pt-2 space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generatePDF}
                disabled={isCustomRange && (!startDate || !endDate)}
                className="w-full bg-vinho text-creme py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-3 shadow-xl hover:bg-opacity-90 transition-all uppercase tracking-[2px] disabled:opacity-50 disabled:scale-100"
              >
                <Download className="w-5 h-5" />
                GERAR PDF DETALHADO
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateXLS}
                disabled={isCustomRange && (!startDate || !endDate)}
                className="w-full bg-white border-2 border-vinho text-vinho py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-3 shadow-md hover:bg-vinho hover:text-white transition-all uppercase tracking-[2px] disabled:opacity-50 disabled:scale-100"
              >
                <FileText className="w-5 h-5" />
                GERAR PLANILHA EM XLS
              </motion.button>
              
              <p className="text-center text-[10px] text-cinza font-bold uppercase tracking-widest mt-4 opacity-40">
                ✦ {isCustomRange ? 'Relatório por período personalizado' : 'Relatório consolidado do mês selecionado'} ✦
              </p>
            </div>
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
          {stats.urgentCount > 0 && (() => {
            const urgentOrders = orders.filter(o => !o.completed && !o.isPartnership && getDaysRemaining(o.deadline) !== null && (getDaysRemaining(o.deadline) || 0) <= 10);
            const hasRedAlert = urgentOrders.some(o => (getDaysRemaining(o.deadline) || 0) <= 5);
            
            const headerBg = hasRedAlert ? 'bg-vermelho' : 'bg-laranja';
            const borderClass = hasRedAlert ? 'border-vermelho/30' : 'border-laranja/30';
            const containerBg = hasRedAlert ? 'bg-[#fffcfb]' : 'bg-[#fffdfa]';
            const dividerClass = hasRedAlert ? 'divide-vermelho/10' : 'divide-laranja/10';

            return (
              <motion.section 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`${containerBg} border-2 ${borderClass} rounded-2xl overflow-hidden shadow-sm`}
              >
                <div className={`${headerBg} text-white px-4 py-3 text-xs font-bold tracking-widest uppercase flex items-center justify-between transition-all`}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-white" />
                    <span>Atenção Imediata</span>
                  </div>
                  <button 
                    onClick={() => setIsUrgencyInfoOpen(true)}
                    className="p-1 hover:bg-white/15 rounded-full transition-all text-white/80 hover:text-white"
                    title="Explicar cores de urgência"
                  >
                    <HelpCircle className="w-4.5 h-4.5" />
                  </button>
                </div>
                <div className={`divide-y ${dividerClass}`}>
                  {urgentOrders.map(o => {
                    const days = getDaysRemaining(o.deadline);
                    const isRed = days !== null && days <= 5;
                    const badgeBg = isRed ? 'bg-vermelho' : 'bg-laranja';
                    const itemBorderClass = isRed ? 'border-l-4 border-vermelho' : 'border-l-4 border-laranja';
                    const itemBg = isRed ? 'hover:bg-vermelho/5' : 'hover:bg-laranja/5';
                    
                    return (
                      <div key={o.id} className={`p-4 flex justify-between items-center group transition-colors ${itemBorderClass} ${itemBg}`}>
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-vinho">{o.customerName}</div>
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
                          <div className={`${badgeBg} text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-sm`}>
                            {days === 0 ? 'HOJE!' : days! < 0 ? `${Math.abs(days!)}d atrasado` : `${days}d`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            );
          })()}
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

          {/* Barra de Pesquisa */}
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa transition-colors group-focus-within:text-vinho">
              <Search className="w-4 h-4" />
            </div>
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-cinza hover:text-vinho transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <input 
              type="text" 
              className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-10 py-3 text-sm outline-none focus:border-vinho focus:ring-4 focus:ring-vinho/5 transition-all text-vinho font-medium placeholder:text-cinza/30 shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Pesquisar cliente por nome..."
            />
          </div>

          <div className="space-y-4">
            {(activeFilter !== 'all' || selectedDate || searchTerm.trim() !== '') && (
              <div className="flex items-center justify-between bg-creme/30 p-2 rounded-lg border border-rosa/30">
                <span className="text-xs font-medium text-vinho">
                  {selectedDate ? (
                    <>Pedidos para: <span className="font-bold uppercase">{selectedDate.toLocaleDateString('pt-BR')}</span></>
                  ) : activeFilter !== 'all' ? (
                    <>Filtrando por: <span className="font-bold uppercase">{
                      activeFilter === 'received' ? 'Já recebi' :
                      activeFilter === 'pending' ? 'A receber' :
                      activeFilter === 'urgent' ? 'Urgente' :
                      activeFilter === 'completed' ? 'Concluídos' : ''
                    }</span></>
                  ) : (
                    <>Pesquisando por: <span className="font-bold">"{searchTerm}"</span></>
                  )}
                </span>
                <button 
                  onClick={() => {
                    setActiveFilter('all');
                    setSelectedDate(null);
                    setSearchTerm('');
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
            produtos={produtos}
            adicionais={adicionais}
            stockItems={stockItems}
            onClose={() => setIsAddingOrder(false)} 
            onAdd={addNewOrder} 
          />
        )}
        {editingOrder && (
          <AddOrderModal 
            produtos={produtos}
            adicionais={adicionais}
            stockItems={stockItems}
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
        {isAdicionaisOpen && (
          <AdicionaisModal 
            adicionais={adicionais}
            onClose={() => setIsAdicionaisOpen(false)}
            onAdd={addAdicional}
            onUpdate={updateAdicional}
            onDelete={deleteAdicional}
          />
        )}
        {isStockModalOpen && (
          <StockModal 
            stockItems={stockItems}
            onClose={() => setIsStockModalOpen(false)}
            onAdd={addStockItem}
            onUpdate={updateStockItem}
            onDelete={deleteStockItem}
          />
        )}
        {isProdutosOpen && (
          <ProdutosModal 
            produtos={produtos}
            onClose={() => setIsProdutosOpen(false)}
            onAdd={addProduto}
            onUpdate={updateProduto}
            onDelete={deleteProduto}
          />
        )}
        {isInventoryOpen && (
          <InventoryModal 
            items={inventory}
            onClose={() => setIsInventoryOpen(false)}
            onAdd={addInventoryItem}
            onUpdate={updateInventoryItem}
            onDelete={deleteInventoryItem}
          />
        )}
        {isSubscriptionModalOpen && (
          <SubscriptionModal 
            onClose={() => setIsSubscriptionModalOpen(false)}
            currentPlan={subscription?.plan_tier}
            subscriptionStatus={subscription?.status}
            invoiceUrl={subscription?.stripe_checkout_url || subscription?.asaas_invoice_url}
            onSubscriptionUpdated={async () => {
              if (user) {
                await fetchSubscription(user.id);
              }
            }}
          />
        )}
        {isSettingsOpen && (
          <SettingsModal 
            onClose={() => setIsSettingsOpen(false)}
            userEmail={user?.email}
          />
        )}
        {isSecurityOpen && (
          <SecurityPrivacyModal 
            onClose={() => setIsSecurityOpen(false)}
          />
        )}
        {isShippingOpen && (
          <ShippingModal 
            orders={orders}
            onClose={() => setIsShippingOpen(false)}
          />
        )}
        {isUrgencyInfoOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-vinho/60 backdrop-blur-md z-[200] flex items-center justify-center p-4"
            onClick={() => setIsUrgencyInfoOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-creme max-w-sm w-full rounded-[32px] p-6 shadow-2xl border-2 border-rosa/30 text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-vinho/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-6 h-6 text-vinho" />
              </div>
              <h3 className="text-xl font-serif font-black text-vinho mb-3">Cores de Urgência</h3>
              <p className="text-cinza text-xs mb-6 leading-relaxed">
                Para ajudar você a gerenciar seus prazos, os pedidos ativos são sinalizados automaticamente de acordo com os dias restantes:
              </p>
              <div className="space-y-3 mb-6 text-left">
                <div className="flex items-start gap-3 p-3 bg-white rounded-2xl border border-rosa/20">
                  <div className="w-3.5 h-3.5 rounded-full bg-vermelho shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-vermelho uppercase tracking-wider">Urgência Crítica (Até 5 dias)</div>
                    <div className="text-[10px] text-cinza">Pedidos que precisam ser produzidos ou despachados com prioridade máxima.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white rounded-2xl border border-rosa/20">
                  <div className="w-3.5 h-3.5 rounded-full bg-laranja shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-laranja uppercase tracking-wider">Atenção Moderada (6 a 10 dias)</div>
                    <div className="text-[10px] text-cinza">Pedidos com prazos intermediários para você planejar sua produção sem pressa.</div>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsUrgencyInfoOpen(false)}
                className="w-full bg-vinho text-white py-3.5 rounded-xl font-black text-xs hover:bg-opacity-95 transition-all shadow-md uppercase tracking-wider"
              >
                Entendi, fechar
              </button>
            </motion.div>
          </motion.div>
        )}
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
  onDelete: (id: string) => void;
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

function ResetPasswordPage({ onReset, onClose }: { onReset: (password: string) => void; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      onReset(password);
    }
  };

  return (
    <div className="min-h-screen bg-creme flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 border-[20px] border-rosa/20 rounded-full" />
      <div className="absolute bottom-[-5%] left-[-5%] w-48 h-48 border-[15px] border-vinho/5 rounded-full" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="text-vinho mb-4">
            <HoopLogo className="w-32 h-32" />
          </div>
          <h1 className="text-5xl font-serif font-black text-vinho tracking-tighter mb-2">bastidor</h1>
          <p className="text-cinza text-sm font-medium tracking-wide max-w-[250px] mx-auto leading-relaxed">
            redefinir sua senha de acesso
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[40px] shadow-2xl border border-rosa/30 space-y-5">
          <h2 className="text-2xl font-serif font-black text-vinho mb-2">Nova Senha</h2>
          <p className="text-xs text-cinza mb-4">
            Digite sua nova senha abaixo para atualizar seu acesso.
          </p>

          <div className="text-left">
            <label className="block text-[10px] font-bold text-cinza uppercase tracking-widest mb-2 ml-1">Nova Senha</label>
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
            salvar nova senha
          </button>

          <div className="pt-2">
            <button 
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-cinza hover:text-vinho transition-colors uppercase tracking-widest"
            >
              cancelar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function LandingPage({ onEnter }: { onEnter: (name: string, email: string, password?: string, isRegistering?: boolean, phone?: string, coupon?: string) => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);

  // Formata o telefone conforme o usuário digita: (XX) XXXXX-XXXX
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7,11)}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecovering) {
      handleRecoverPassword();
      return;
    }
    if ((isRegistering ? name : true) && email && password) {
      onEnter(name, email, password, isRegistering, phone, couponCode);
    }
  };

  const handleRecoverPassword = async () => {
    if (!email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      alert('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setIsRecovering(false);
    } catch (err: any) {
      alert(err.message);
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
          {isRecovering ? (
            <>
              <h2 className="text-2xl font-serif font-black text-vinho mb-2">Recuperar Senha</h2>
              <p className="text-xs text-cinza mb-4">
                Digite seu e-mail cadastrado para receber as instruções de recuperação.
              </p>
              
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

              <button 
                type="submit"
                className="w-full bg-vinho text-creme py-5 rounded-2xl font-black text-lg hover:bg-opacity-90 transition-all shadow-xl mt-4 active:scale-95"
              >
                enviar link de recuperação
              </button>

              <div className="pt-2">
                <button 
                  type="button"
                  onClick={() => setIsRecovering(false)}
                  className="text-xs font-bold text-cinza hover:text-vinho transition-colors uppercase tracking-widest"
                >
                  voltar para o login
                </button>
              </div>
            </>
          ) : (
            <>
              <AnimatePresence mode="wait">
                {isRegistering && (
                  <motion.div 
                    key="register-fields"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="text-left space-y-4"
                  >
                    <div>
                      <label className="block text-[10px] font-bold text-cinza uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                      <input 
                        required={isRegistering}
                        type="text" 
                        className="w-full bg-fundo/30 border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Como quer ser chamada?"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-cinza uppercase tracking-widest mb-2 ml-1">Telefone (WhatsApp)</label>
                      <input 
                        required={isRegistering}
                        type="tel" 
                        className="w-full bg-fundo/30 border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho transition-all"
                        value={phone}
                        onChange={e => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        maxLength={15}
                      />
                      <p className="text-[10px] text-cinza/60 mt-1.5 ml-1 font-medium">
                        🔒 Usado para garantir uma conta por pessoa
                      </p>
                    </div>

                    {/* Campo de Cupom */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowCoupon(!showCoupon)}
                        className="text-[10px] font-black text-vinho/50 hover:text-vinho transition-colors uppercase tracking-widest flex items-center gap-1.5 ml-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        {showCoupon ? 'Remover cupom' : 'Tenho um cupom de desconto'}
                      </button>
                      <AnimatePresence>
                        {showCoupon && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mt-2"
                          >
                            <input
                              type="text"
                              className="w-full bg-fundo/30 border-2 border-dourado/40 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-dourado transition-all font-black tracking-widest text-vinho placeholder:text-cinza/30 uppercase"
                              value={couponCode}
                              onChange={e => setCouponCode(e.target.value.toUpperCase())}
                              placeholder="EX: BASTIDOR20"
                              maxLength={20}
                            />
                            <p className="text-[10px] text-dourado/70 mt-1.5 ml-1 font-bold">
                              ✦ Cupom válido estende seu período de teste
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
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
                {!isRegistering && (
                  <div className="text-right mt-2">
                    <button 
                      type="button"
                      onClick={() => setIsRecovering(true)}
                      className="text-xs font-bold text-cinza hover:text-vinho transition-colors uppercase tracking-widest"
                    >
                      esqueceu a senha?
                    </button>
                  </div>
                )}
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
            </>
          )}
        </form>

        <div className="mt-12 text-[10px] text-cinza font-bold uppercase tracking-[4px] opacity-40">
          ✦ feito com amor para bordadeiras ✦
        </div>
      </motion.div>
    </div>
  );
}

const ESTADOS_BR = [
  { value: '', label: 'Selecione o Estado' },
  { value: 'AC', label: 'Acre (AC)' },
  { value: 'AL', label: 'Alagoas (AL)' },
  { value: 'AP', label: 'Amapá (AP)' },
  { value: 'AM', label: 'Amazonas (AM)' },
  { value: 'BA', label: 'Bahia (BA)' },
  { value: 'CE', label: 'Ceará (CE)' },
  { value: 'DF', label: 'Distrito Federal (DF)' },
  { value: 'ES', label: 'Espírito Santo (ES)' },
  { value: 'GO', label: 'Goiás (GO)' },
  { value: 'MA', label: 'Maranhão (MA)' },
  { value: 'MT', label: 'Mato Grosso (MT)' },
  { value: 'MS', label: 'Mato Grosso do Sul (MS)' },
  { value: 'MG', label: 'Minas Gerais (MG)' },
  { value: 'PA', label: 'Pará (PA)' },
  { value: 'PB', label: 'Paraíba (PB)' },
  { value: 'PR', label: 'Paraná (PR)' },
  { value: 'PE', label: 'Pernambuco (PE)' },
  { value: 'PI', label: 'Piauí (PI)' },
  { value: 'RJ', label: 'Rio de Janeiro (RJ)' },
  { value: 'RN', label: 'Rio Grande do Norte (RN)' },
  { value: 'RS', label: 'Rio Grande do Sul (RS)' },
  { value: 'RO', label: 'Rondônia (RO)' },
  { value: 'RR', label: 'Roraima (RR)' },
  { value: 'SC', label: 'Santa Catarina (SC)' },
  { value: 'SP', label: 'São Paulo (SP)' },
  { value: 'SE', label: 'Sergipe (SE)' },
  { value: 'TO', label: 'Tocantins (TO)' }
];

function AddOrderModal({ 
  produtos,
  adicionais,
  stockItems,
  onClose, 
  onAdd, 
  orderToEdit 
}: { 
  produtos: Produto[];
  adicionais: Adicional[];
  stockItems: StockItem[];
  onClose: () => void; 
  onAdd: (order: Omit<Order, 'id' | 'completed'>) => void;
  orderToEdit?: Order | null;
}) {
  const [name, setName] = useState(orderToEdit?.customerName || '');
  const [selectedProdutos, setSelectedProdutos] = useState<Produto[]>(orderToEdit?.selectedProdutos || []);
  const [isProdutosDropdownOpen, setIsProdutosDropdownOpen] = useState(false);
  const [selectedAdicionais, setSelectedAdicionais] = useState<Adicional[]>(orderToEdit?.selectedAdicionais || []);
  const [usedStockItems, setUsedStockItems] = useState<{ stockItemId: string; quantity: number }[]>(orderToEdit?.usedStockItems || []);
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);
  const [notes, setNotes] = useState(orderToEdit?.notes || '');
  const [date, setDate] = useState(orderToEdit?.deadline ? orderToEdit.deadline.toISOString().split('T')[0] : '');
  const [isPartnership, setIsPartnership] = useState(orderToEdit?.isPartnership || false);
  const [value, setValue] = useState(orderToEdit?.payment.totalValue || '');
  const [entryAmount, setEntryAmount] = useState(orderToEdit?.payment.pixEntryAmount || '');
  const [shippingValue, setShippingValue] = useState(orderToEdit?.payment.shippingValue || '');
  const [shippingState, setShippingState] = useState(orderToEdit?.payment.shippingState || '');

  const handleToggleProduto = (prod: Produto) => {
    const isSelected = selectedProdutos.some(p => p.id === prod.id);
    if (isSelected) {
      setSelectedProdutos(prev => prev.filter(p => p.id !== prod.id));
    } else {
      setSelectedProdutos(prev => [...prev, prod]);
    }
  };

  const handleToggleStockItem = (item: StockItem) => {
    const existing = usedStockItems.find(s => s.stockItemId === item.id);
    if (existing) {
      setUsedStockItems(prev => prev.filter(s => s.stockItemId !== item.id));
    } else {
      setUsedStockItems(prev => [...prev, { stockItemId: item.id, quantity: 1 }]);
    }
  };

  const updateStockItemQuantity = (id: string, delta: number) => {
    setUsedStockItems(prev => prev.map(s => {
      if (s.stockItemId === id) {
        const newQ = Math.max(1, s.quantity + delta);
        return { ...s, quantity: newQ };
      }
      return s;
    }));
  };

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
    if (!name || selectedProdutos.length === 0) {
      alert("Por favor, selecione pelo menos um produto.");
      return;
    }

    onAdd({
      customerName: name,
      pieceDescription: selectedProdutos.map(p => p.name).join(', '),
      notes,
      deadline: date ? new Date(date + 'T12:00:00') : null,
      isPartnership,
      payment: orderToEdit ? { ...orderToEdit.payment, totalValue: value, pixEntryAmount: entryAmount, shippingValue, shippingState } : {
        totalValue: value,
        type: null,
        pixEntryAmount: entryAmount,
        pixEntryPaid: false,
        pixRemainingPaid: false,
        cardInstallments: 1,
        cardPaid: false,
        shippingValue,
        shippingState
      },
      selectedAdicionais,
      selectedProdutos,
      usedStockItems
    });
  };

  const handleToggleAdicional = (adc: Adicional) => {
    const isSelected = selectedAdicionais.some(a => a.id === adc.id);
    let currentValNum = parseFloat(value.replace(',', '.')) || 0;
    const adcPrice = parseFloat(adc.price.replace(',', '.')) || 0;

    if (isSelected) {
      setSelectedAdicionais(prev => prev.filter(a => a.id !== adc.id));
      currentValNum -= adcPrice;
    } else {
      setSelectedAdicionais(prev => [...prev, adc]);
      currentValNum += adcPrice;
    }

    setValue(currentValNum > 0 ? formatCurrency(currentValNum).replace('R$', '').trim() : '');
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

            <div className="space-y-1.5 relative">
              <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">O que vamos bordar?</label>
              
              {produtos.length > 0 ? (
                <div className="relative">
                  <div 
                    onClick={() => setIsProdutosDropdownOpen(!isProdutosDropdownOpen)}
                    className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-10 py-4 text-sm outline-none focus:border-vinho transition-all text-vinho font-medium shadow-sm cursor-pointer min-h-[56px] flex items-center"
                  >
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    {selectedProdutos.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedProdutos.map(p => (
                          <span key={p.id} className="bg-rosa/10 text-vinho px-2 py-1 rounded-lg text-xs font-bold border border-rosa/20 flex items-center gap-1">
                            {p.name}
                            <X className="w-3 h-3 cursor-pointer hover:text-vermelho" onClick={(e) => {
                              e.stopPropagation();
                              handleToggleProduto(p);
                            }} />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-cinza/50">Selecione os produtos...</span>
                    )}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-rosa">
                      <ChevronDown className={`w-4 h-4 transition-transform ${isProdutosDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isProdutosDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-rosa/30 rounded-2xl shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto"
                      >
                        {produtos.map(prod => {
                          const isSelected = selectedProdutos.some(p => p.id === prod.id);
                          return (
                            <div 
                              key={prod.id}
                              onClick={() => handleToggleProduto(prod)}
                              className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between ${
                                isSelected ? 'bg-vinho/5 text-vinho font-bold' : 'hover:bg-rosa/5 text-cinza'
                              }`}
                            >
                              <span>{prod.name}</span>
                              {isSelected && <Check className="w-4 h-4 text-vinho" />}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-4 py-4 text-sm text-cinza/50 shadow-sm flex items-center relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa/50">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  Nenhum produto cadastrado.
                </div>
              )}
            </div>

            {stockItems.length > 0 && (
              <div className="space-y-1.5 relative z-10">
                <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">Materiais do Estoque Utilizados</label>
                <div className="relative">
                  <div 
                    onClick={() => setIsStockDropdownOpen(!isStockDropdownOpen)}
                    className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-10 py-4 text-sm outline-none focus:border-vinho transition-all text-vinho font-medium shadow-sm cursor-pointer min-h-[56px] flex items-center"
                  >
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa">
                      <Package className="w-4 h-4" />
                    </div>
                    {usedStockItems.length > 0 ? (
                      <div className="flex flex-wrap gap-2 w-full pr-2">
                        {usedStockItems.map(s => {
                          const item = stockItems.find(i => i.id === s.stockItemId);
                          if (!item) return null;
                          return (
                            <div key={s.stockItemId} className="bg-creme text-vinho px-2 py-1 rounded-lg text-xs font-bold border border-rosa/20 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <span className="truncate max-w-[100px]">{item.name}</span>
                              <div className="flex items-center gap-1 bg-white rounded border border-rosa/20 px-1">
                                <button type="button" onClick={() => updateStockItemQuantity(s.stockItemId, -1)} className="hover:text-vermelho">-</button>
                                <span className="text-[10px] w-4 text-center">{s.quantity}</span>
                                <button type="button" onClick={() => updateStockItemQuantity(s.stockItemId, 1)} className="hover:text-verde">+</button>
                              </div>
                              <X className="w-3 h-3 cursor-pointer hover:text-vermelho ml-1" onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStockItem(item);
                              }} />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-cinza/50">Selecione bastidores, caixas, etc...</span>
                    )}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-rosa pointer-events-none">
                      <ChevronDown className={`w-4 h-4 transition-transform ${isStockDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isStockDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-rosa/30 rounded-2xl shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto"
                      >
                        {stockItems.map(item => {
                          const isSelected = usedStockItems.some(s => s.stockItemId === item.id);
                          return (
                            <div 
                              key={item.id}
                              onClick={() => handleToggleStockItem(item)}
                              className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between ${
                                isSelected ? 'bg-vinho/5 text-vinho font-bold' : 'hover:bg-rosa/5 text-cinza'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{item.name}</span>
                                <span className="text-[10px] bg-creme px-1.5 py-0.5 rounded text-cinza">{item.category}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-cinza">{item.quantity} disp.</span>
                                {isSelected && <Check className="w-4 h-4 text-vinho" />}
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}


            {adicionais.length > 0 && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">Adicionais</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {adicionais.map(adc => {
                    const isSelected = selectedAdicionais.some(a => a.id === adc.id);
                    return (
                      <div 
                        key={adc.id}
                        onClick={() => handleToggleAdicional(adc)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected ? 'border-vinho bg-vinho/5' : 'border-rosa/30 bg-white hover:border-rosa'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all shrink-0 ${
                          isSelected ? 'bg-vinho border-vinho text-white' : 'border-rosa/50 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 font-bold" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-vinho truncate">{adc.name}</p>
                          <p className="text-[10px] font-bold text-cinza">R$ {adc.price}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 flex-1">
                <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">Valor do Frete</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rosa transition-colors group-focus-within:text-vinho">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-rosa">BRL</div>
                  <input 
                    type="text" 
                    className="w-full bg-white border-2 border-rosa/30 rounded-2xl pl-11 pr-12 py-4 text-sm outline-none focus:border-vinho focus:ring-4 focus:ring-vinho/5 transition-all text-vinho font-medium shadow-sm"
                    value={shippingValue}
                    onChange={e => setShippingValue(e.target.value.replace(/[^0-9,.]/g, ''))}
                    placeholder="0,00"
                  />
                </div>
                <div className="flex items-center gap-2 mt-1.5 ml-1">
                  <input 
                    type="checkbox" 
                    id="freeShippingAdd"
                    checked={shippingValue === '0,00' || shippingValue === '0'}
                    onChange={e => {
                      if (e.target.checked) {
                        setShippingValue('0,00');
                      } else {
                        setShippingValue('');
                      }
                    }}
                    className="rounded text-vinho focus:ring-vinho cursor-pointer w-4 h-4"
                  />
                  <label htmlFor="freeShippingAdd" className="text-[10px] font-bold text-cinza uppercase cursor-pointer select-none">Envio Grátis</label>
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="block text-[10px] font-black text-cinza uppercase tracking-wider ml-1">Estado de Envio</label>
                <div className="relative group">
                  <select 
                    className="w-full bg-white border-2 border-rosa/30 rounded-2xl px-5 py-4 text-sm outline-none focus:border-vinho focus:ring-4 focus:ring-vinho/5 transition-all text-vinho font-medium shadow-sm appearance-none"
                    value={shippingState}
                    onChange={e => setShippingState(e.target.value)}
                  >
                    {ESTADOS_BR.map(st => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-rosa">
                    ▼
                  </div>
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
        <div className="bg-creme/30 border-t border-rosa/10 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <span className="text-[10px] font-black text-cinza/60 uppercase">Valor Peça:</span>
                <div className="relative flex-1 sm:flex-initial">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-cinza/40">R$</span>
                  <input 
                     type="text" 
                     className="bg-white border-2 border-rosa/30 rounded-xl pl-9 pr-3 py-2 text-sm font-black text-vinho w-full sm:w-32 outline-none focus:border-vinho transition-all"
                     value={order.payment.totalValue}
                     onChange={(e) => onUpdatePayment({ totalValue: e.target.value })}
                     placeholder="0,00"
                   />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-cinza/60 uppercase">Frete:</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-cinza/40">R$</span>
                    <input 
                       type="text" 
                       className="bg-white border-2 border-rosa/30 rounded-xl pl-9 pr-3 py-2 text-sm font-black text-vinho w-24 outline-none focus:border-vinho transition-all"
                       value={order.payment.shippingValue || ''}
                       onChange={(e) => onUpdatePayment({ shippingValue: e.target.value.replace(/[^0-9,.]/g, '') })}
                       placeholder="0,00"
                     />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input 
                    type="checkbox" 
                    id={`freeShippingCard-${order.id}`}
                    checked={order.payment.shippingValue === '0,00' || order.payment.shippingValue === '0'}
                    onChange={e => onUpdatePayment({ shippingValue: e.target.checked ? '0,00' : '' })}
                    className="rounded text-vinho focus:ring-vinho cursor-pointer w-3.5 h-3.5"
                  />
                  <label htmlFor={`freeShippingCard-${order.id}`} className="text-[9px] font-black text-cinza/60 uppercase cursor-pointer select-none">Envio Grátis</label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-cinza/60 uppercase">UF:</span>
                  <select 
                    className="bg-white border-2 border-rosa/30 rounded-xl px-2 py-1.5 text-xs font-black text-vinho outline-none focus:border-vinho transition-all"
                    value={order.payment.shippingState || ''}
                    onChange={(e) => onUpdatePayment({ shippingState: e.target.value })}
                  >
                    {ESTADOS_BR.map(st => (
                      <option key={st.value} value={st.value}>{st.value || 'SELECIONE'}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between items-end gap-3">
              <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-3">
                <span className="text-[10px] font-black text-cinza/60 uppercase">Pagamento:</span>
                <div className="flex bg-white border-2 border-rosa/30 rounded-xl overflow-hidden p-1 shadow-sm">
                  <button 
                     onClick={() => onUpdatePayment({ type: 'pix' })}
                     className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${order.payment.type === 'pix' ? 'bg-verde text-white' : 'text-cinza hover:bg-creme'}`}
                   >
                     PIX
                   </button>
                   <button 
                     onClick={() => onUpdatePayment({ type: 'card' })}
                     className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${order.payment.type === 'card' ? 'bg-azul text-white' : 'text-cinza hover:bg-creme'}`}
                   >
                     CARTÃO
                   </button>
                </div>
              </div>
              {order.payment.shippingValue && parseFloat(order.payment.shippingValue.replace(',', '.')) > 0 && (
                <div className="text-[9px] font-black text-vinho/70 uppercase tracking-wider text-right w-full">
                  Total Geral: {formatCurrency((parseFloat(order.payment.totalValue.replace(',', '.')) || 0) + (parseFloat(order.payment.shippingValue.replace(',', '.')) || 0))}
                </div>
              )}
            </div>
          </div>

          {order.payment.type === 'pix' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              {(() => {
                const total = parseFloat(order.payment.totalValue.replace(',', '.')) || 0;
                const entry = parseFloat(order.payment.pixEntryAmount?.replace(',', '.') || '0') || (total * 0.5);
                const remaining = total - entry;
                const entryPct = total > 0 ? Math.round((entry / total) * 100) : 0;
                
                return (
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border-2 border-creme hover:border-rosa/20 transition-all shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-cinza uppercase tracking-widest mb-0.5">Sinal ({entryPct}%)</span>
                        <span className="text-sm font-black text-vinho">
                          {formatCurrency(entry)}
                        </span>
                      </div>
                      <button 
                        onClick={() => onUpdatePayment({ pixEntryPaid: !order.payment.pixEntryPaid })}
                        className={`text-[10px] font-black px-4 py-2 rounded-xl border-2 transition-all ${order.payment.pixEntryPaid ? 'bg-verde border-verde text-white' : 'border-verde text-verde hover:bg-verde/5'}`}
                      >
                        {order.payment.pixEntryPaid ? 'RECEBIDO' : 'CONFIRMAR'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border-2 border-creme hover:border-rosa/20 transition-all shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-cinza uppercase tracking-widest mb-0.5">Saldo ({100 - entryPct}%)</span>
                        <span className="text-sm font-black text-vinho">
                          {formatCurrency(remaining)}
                        </span>
                      </div>
                      <button 
                        onClick={() => onUpdatePayment({ pixRemainingPaid: !order.payment.pixRemainingPaid })}
                        className={`text-[10px] font-black px-4 py-2 rounded-xl border-2 transition-all ${order.payment.pixRemainingPaid ? 'bg-verde border-verde text-white' : 'border-verde text-verde hover:bg-verde/5'}`}
                      >
                        {order.payment.pixRemainingPaid ? 'RECEBIDO' : 'CONFIRMAR'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {order.payment.type === 'card' && (
            <div className="flex items-center justify-between bg-white p-3 rounded-2xl border-2 border-creme animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-azul/10 p-2 rounded-xl text-azul">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[8px] font-black text-cinza uppercase tracking-widest">Parcelamento</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input 
                      type="number" 
                      className="w-12 bg-creme border-none rounded-lg px-2 py-1 text-xs font-black text-vinho outline-none"
                      value={order.payment.cardInstallments}
                      onChange={(e) => onUpdatePayment({ cardInstallments: parseInt(e.target.value) || 1 })}
                    />
                    <span className="text-[10px] font-bold text-cinza">vezes</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onUpdatePayment({ cardPaid: !order.payment.cardPaid })}
                className={`text-[10px] font-black px-4 py-2 rounded-xl border-2 transition-all ${order.payment.cardPaid ? 'bg-verde border-verde text-white' : 'border-verde text-verde hover:bg-verde/5'}`}
              >
                {order.payment.cardPaid ? 'PAGO' : 'CONFIRMAR'}
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
  onUpdate,
  onDelete
}: { 
  items: InventoryItem[]; 
  onClose: () => void;
  onAdd: (item: Omit<InventoryItem, 'id'>) => void;
  onUpdate: (id: string, updatedItem: Omit<InventoryItem, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-xl font-serif text-vinho border-l-4 border-dourado pl-3">Últimas Compras</h3>
            <button 
              onClick={() => setIsAddingItem(true)}
              className="bg-dourado text-white px-8 py-4 rounded-[20px] font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all w-full sm:w-auto uppercase tracking-widest"
            >
              <Plus className="w-5 h-5" />
              Registrar Compra
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 pb-12">
            {items.length > 0 ? (
              items.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-[32px] border-2 border-rosa/20 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center group hover:border-vinho/20 transition-all gap-4">
                  <div className="flex gap-4 items-center min-w-0">
                    <div className="bg-creme p-4 rounded-2xl group-hover:bg-rosa/10 transition-colors shrink-0">
                      <Sparkles className="w-6 h-6 text-vinho/40" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-vinho text-lg truncate leading-tight mb-1">{item.name}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black bg-rosa/20 text-vinho px-2 py-0.5 rounded uppercase tracking-tighter">{item.category}</span>
                        <span className="text-[10px] text-cinza font-bold">{item.quantity}</span>
                        <span className="text-[10px] text-cinza opacity-40 hidden sm:inline">•</span>
                        <span className="text-[10px] text-cinza uppercase font-bold">{item.purchaseDate.toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-none pt-4 sm:pt-0 border-creme">
                    <div className="sm:text-right">
                      <div className="text-2xl font-serif font-black text-vinho leading-none mb-1">{formatCurrency(parseFloat(item.price.replace(',', '.')))}</div>
                      <div className="text-[9px] text-cinza font-black uppercase tracking-widest opacity-60">
                        {item.paymentMethod === 'cash' ? 'À Vista' : item.paymentMethod === 'pix' ? 'PIX' : `Cartão ${item.installments}x`}
                      </div>
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
          {editingItem && (
            <AddInventoryModal 
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

function AddInventoryModal({ 
  itemToEdit,
  onClose, 
  onAdd 
}: { 
  itemToEdit?: InventoryItem;
  onClose: () => void; 
  onAdd: (item: Omit<InventoryItem, 'id'>) => void;
}) {
  const [name, setName] = useState(itemToEdit?.name || '');
  const [category, setCategory] = useState(itemToEdit?.category || '');
  const [quantity, setQuantity] = useState(itemToEdit?.quantity || '');
  const [price, setPrice] = useState(itemToEdit?.price || '');
  const [date, setDate] = useState(itemToEdit ? itemToEdit.purchaseDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'cash' | 'pix' | 'card'>(itemToEdit?.paymentMethod || 'pix');
  const [installments, setInstallments] = useState(itemToEdit?.installments || 1);

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
          <h3 className="text-3xl font-serif font-black tracking-tight">{itemToEdit ? 'Editar Insumo' : 'Novo Insumo'}</h3>
          <p className="text-rosa/60 text-[10px] uppercase tracking-widest font-bold mt-1">{itemToEdit ? 'Atualize as informações da compra' : 'O que você comprou para o ateliê?'}</p>
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
            {itemToEdit ? 'Salvar Alterações' : 'Salvar no Estoque'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

interface ShippingModalProps {
  orders: Order[];
  onClose: () => void;
}

function ShippingModal({ orders, onClose }: ShippingModalProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const shippingOrders = useMemo(() => {
    return orders.filter(o => {
      const val = parseFloat(o.payment.shippingValue?.replace(',', '.') || '0') || 0;
      if (val <= 0) return false;

      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        if (!o.deadline || o.deadline < start) return false;
      }

      if (endDate) {
        const end = new Date(endDate + 'T23:59:59');
        if (!o.deadline || o.deadline > end) return false;
      }

      return true;
    });
  }, [orders, startDate, endDate]);

  const totalShippingCost = useMemo(() => {
    return shippingOrders.reduce((sum, o) => {
      const val = parseFloat(o.payment.shippingValue?.replace(',', '.') || '0') || 0;
      return sum + val;
    }, 0);
  }, [shippingOrders]);

  const stateStats = useMemo(() => {
    const stats: Record<string, { count: number; totalValue: number }> = {};
    shippingOrders.forEach(o => {
      const uf = o.payment.shippingState || 'N/D';
      const val = parseFloat(o.payment.shippingValue?.replace(',', '.') || '0') || 0;
      if (!stats[uf]) {
        stats[uf] = { count: 0, totalValue: 0 };
      }
      stats[uf].count += 1;
      stats[uf].totalValue += val;
    });

    return Object.entries(stats)
      .map(([state, data]) => ({ state, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [shippingOrders]);

  const maxCount = useMemo(() => {
    return Math.max(...stateStats.map(s => s.count), 1);
  }, [stateStats]);

  const generateShippingPDF = () => {
    const doc = new jsPDF();
    
    doc.setFillColor(74, 55, 40);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(26);
    doc.text('bastidor', 105, 20, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(217, 197, 178);

    let periodLabel = 'Relatorio Financeiro de Fretes e Envios';
    if (startDate || endDate) {
      const startFmt = startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início';
      const endFmt = endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Fim';
      periodLabel += ` (${startFmt} a ${endFmt})`;
    }
    doc.text(periodLabel, 105, 30, { align: 'center' });

    doc.setTextColor(74, 55, 40);
    doc.setFontSize(14);
    doc.text('Resumo de Envios', 14, 50);

    const mainState = stateStats[0]?.state || 'Nenhum';
    
    autoTable(doc, {
      startY: 55,
      head: [['Metrica', 'Consolidado']],
      body: [
        ['Total de Pedidos Enviados', shippingOrders.length.toString()],
        ['Total Gasto em Frete', formatCurrency(totalShippingCost)],
        ['Estado com Maior Volume de Envio', mainState],
      ],
      headStyles: { fillColor: [74, 55, 40] },
      margin: { left: 14, right: 14 },
    });

    doc.setFontSize(14);
    doc.text('Envios por Estado', 14, (doc as any).lastAutoTable.finalY + 12);
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head: [['Estado (UF)', 'Qtd Envios', 'Custo Total de Frete']],
      body: stateStats.map(s => [s.state, s.count.toString(), formatCurrency(s.totalValue)]),
      headStyles: { fillColor: [166, 93, 71] },
      margin: { left: 14, right: 14 },
    });

    doc.setFontSize(14);
    doc.text('Listagem Detalhada de Envios', 14, (doc as any).lastAutoTable.finalY + 12);
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 16,
      head: [['Cliente', 'Peca', 'Estado (UF)', 'Valor Frete']],
      body: shippingOrders.map(o => [
        o.customerName,
        o.pieceDescription,
        o.payment.shippingState || 'N/D',
        formatCurrency(parseFloat(o.payment.shippingValue?.replace(',', '.') || '0') || 0)
      ]),
      headStyles: { fillColor: [74, 55, 40] },
      margin: { left: 14, right: 14 },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} - Pagina ${i} de ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save('Relatorio_Fretes_Bastidor.pdf');
  };

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
                  <Truck className="w-8 h-8 text-rosa" />
                </div>
                <h2 className="text-3xl font-serif font-black lowercase tracking-tighter">fretes</h2>
              </div>
              <p className="text-rosa/60 text-xs uppercase tracking-widest font-bold">controle financeiro de fretes</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all">
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full p-6 md:p-8 space-y-6 custom-scrollbar">
          {/* Filtro de Período */}
          <div className="bg-white p-5 rounded-[24px] border-2 border-rosa/20 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-vinho" />
              <h3 className="text-xs font-serif font-black text-vinho uppercase tracking-wider">Filtrar por Período</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-cinza uppercase ml-1">De</label>
                <input 
                  type="date"
                  className="w-full bg-creme/30 border-2 border-rosa/20 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-vinho focus:bg-white transition-all text-vinho font-bold"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-cinza uppercase ml-1">Até</label>
                <input 
                  type="date"
                  className="w-full bg-creme/30 border-2 border-rosa/20 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-vinho focus:bg-white transition-all text-vinho font-bold"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-[9px] font-black text-vermelho hover:underline block ml-1 uppercase tracking-wider"
              >
                Limpar Filtro
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-[24px] border-2 border-rosa/20 shadow-sm">
              <span className="text-[10px] text-cinza font-black uppercase tracking-wider block mb-1">Total de Envios</span>
              <span className="text-3xl font-serif font-black text-vinho">{shippingOrders.length}</span>
              <span className="text-[10px] text-cinza opacity-50 block mt-1">pedidos com frete cadastrado</span>
            </div>
            <div className="bg-white p-5 rounded-[24px] border-2 border-rosa/20 shadow-sm">
              <span className="text-[10px] text-cinza font-black uppercase tracking-wider block mb-1">Custo Total de Fretes</span>
              <span className="text-3xl font-serif font-black text-verde">{formatCurrency(totalShippingCost)}</span>
              <span className="text-[10px] text-cinza opacity-50 block mt-1">investimento total de logistica</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[32px] border-2 border-rosa/20 shadow-sm space-y-4">
            <h3 className="text-lg font-serif text-vinho font-black">Envios por Estado</h3>
            {stateStats.length > 0 ? (
              <div className="space-y-3">
                {stateStats.map(stat => {
                  const percentage = Math.round((stat.count / maxCount) * 100);
                  return (
                    <div key={stat.state} className="flex items-center gap-3">
                      <div className="w-8 text-xs font-black text-vinho">{stat.state}</div>
                      <div className="flex-1 bg-creme h-6 rounded-full overflow-hidden relative flex items-center px-2">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="absolute left-0 top-0 bottom-0 bg-vinho/20 rounded-full"
                        />
                        <span className="relative z-10 text-[10px] font-bold text-vinho">{stat.count} {stat.count === 1 ? 'envio' : 'envios'}</span>
                      </div>
                      <div className="w-20 text-right text-xs font-bold text-cinza">{formatCurrency(stat.totalValue)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-cinza italic text-center py-6">Nenhum envio cadastrado ainda para gerar o grafico.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-2">
            <h3 className="text-xl font-serif text-vinho border-l-4 border-dourado pl-3">Lista de Envios</h3>
            <button 
              onClick={generateShippingPDF}
              disabled={shippingOrders.length === 0}
              className="bg-dourado text-white px-6 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all w-full sm:w-auto uppercase tracking-widest disabled:opacity-50 disabled:scale-100"
            >
              <Download className="w-4 h-4" />
              Exportar Relatorio PDF
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 pb-12">
            {shippingOrders.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-2xl border border-rosa/20 shadow-sm flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-vinho text-sm">{order.customerName}</h4>
                  <p className="text-[10px] text-cinza uppercase tracking-wider">{order.pieceDescription}</p>
                  <span className="inline-block text-[9px] font-black bg-rosa/20 text-vinho px-2 py-0.5 rounded mt-1.5 uppercase">
                    Estado: {order.payment.shippingState || 'N/D'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-serif font-black text-vinho">
                    {formatCurrency(parseFloat(order.payment.shippingValue?.replace(',', '.') || '0') || 0)}
                  </span>
                  <span className="block text-[8px] text-cinza font-bold uppercase tracking-widest mt-0.5">Valor do Frete</span>
                </div>
              </div>
            ))}
            {shippingOrders.length === 0 && (
              <div className="text-center py-12 bg-white/50 rounded-2xl border-2 border-dashed border-rosa/30">
                <p className="text-cinza text-sm italic">Nenhum frete cadastrado ate o momento.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
