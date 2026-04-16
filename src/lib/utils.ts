export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

export function getDaysRemaining(deadline: Date | null): number | null {
  if (!deadline) return null;
  const today = new Date(2026, 3, 12); // Using fixed today for demo consistency
  const diffTime = deadline.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getStatusColor(days: number | null, isPartnership: boolean): string {
  if (isPartnership) return 'border-cinza';
  if (days === null) return 'border-verde';
  if (days <= 3) return 'border-vermelho';
  if (days <= 7) return 'border-amarelo';
  return 'border-verde';
}
