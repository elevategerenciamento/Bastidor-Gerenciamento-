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
  pixEntryPaid: boolean;
  pixRemainingPaid: boolean;
  cardInstallments: number;
  cardPaid: boolean;
}

export type MonthKey = 3 | 4 | 5; // April, May, June 2026
