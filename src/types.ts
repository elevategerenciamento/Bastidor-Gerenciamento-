export interface Order {
  id: string;
  customerName: string;
  pieceDescription: string;
  notes?: string;
  deadline: Date | null;
  isPartnership: boolean;
  completed: boolean;
  payment: PaymentInfo;
}

export interface PaymentInfo {
  totalValue: string;
  type: 'pix' | 'card' | null;
  pixEntryAmount?: string;
  pixEntryPaid: boolean;
  pixRemainingPaid: boolean;
  cardInstallments: number;
  cardPaid: boolean;
}

export type MonthKey = 3 | 4 | 5; // April, May, June 2026

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  price: string;
  purchaseDate: Date;
  paymentMethod: 'cash' | 'pix' | 'card';
  installments?: number;
}
