import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, locale = 'pt-BR', currency = 'BRL') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

export function formatDate(date: string | Date, format = 'dd/MM/yyyy') {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    CONFIRMED: 'Confirmado',
    IN_SESSION: 'Em sessão',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
    FREE: 'Livre',
    OCCUPIED: 'Ocupada',
    BILL_REQUESTED: 'Conta pedida',
    OPEN: 'Aberta',
    CLOSED: 'Fechada',
    PAID: 'Pago',
    OVERDUE: 'Vencida',
  };
  return labels[status] ?? status;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400',
    CONFIRMED: 'bg-blue-500/20 text-blue-400',
    IN_SESSION: 'bg-purple-500/20 text-purple-400',
    COMPLETED: 'bg-green-500/20 text-green-400',
    CANCELLED: 'bg-red-500/20 text-red-400',
    FREE: 'bg-green-500/20 text-green-400',
    OCCUPIED: 'bg-red-500/20 text-red-400',
    BILL_REQUESTED: 'bg-orange-500/20 text-orange-400',
    PAID: 'bg-green-500/20 text-green-400',
    OVERDUE: 'bg-red-500/20 text-red-400',
  };
  return colors[status] ?? 'bg-ink-700 text-ink-300';
}
