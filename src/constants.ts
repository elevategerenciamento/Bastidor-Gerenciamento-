import { Order } from './types';

export const TODAY = new Date();

export const INITIAL_ORDERS: Order[] = [
  { 
    id: 1, 
    customerName: "Duda", 
    pieceDescription: "Bordado Personalizado", 
    notes: "Encomenda especial",
    deadline: new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 2), 
    isPartnership: false, 
    completed: false,
    payment: { totalValue: '150,00', type: 'pix', pixEntryAmount: '75,00', pixEntryPaid: true, pixRemainingPaid: false, cardInstallments: 1, cardPaid: false }
  },
  { 
    id: 2, 
    customerName: "Pai do Duda", 
    pieceDescription: "Bordado", 
    notes: "Encomenda pai falecido",
    deadline: new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 5), 
    isPartnership: false, 
    completed: false,
    payment: { totalValue: '280,00', type: 'pix', pixEntryAmount: '140,00', pixEntryPaid: true, pixRemainingPaid: true, cardInstallments: 1, cardPaid: false }
  },
  { 
    id: 3, 
    customerName: "Mari Santa Catarina", 
    pieceDescription: "Quadro Bordado", 
    deadline: new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 10), 
    isPartnership: false, 
    completed: false,
    payment: { totalValue: '200,00', type: 'card', pixEntryAmount: '', pixEntryPaid: false, pixRemainingPaid: false, cardInstallments: 2, cardPaid: true }
  },
  { 
    id: 4, 
    customerName: "Miguel e Maísa", 
    pieceDescription: "Encomenda", 
    deadline: new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 5), 
    isPartnership: false, 
    completed: false,
    payment: { totalValue: '', type: null, pixEntryAmount: '', pixEntryPaid: false, pixRemainingPaid: false, cardInstallments: 2, cardPaid: false }
  },
];
