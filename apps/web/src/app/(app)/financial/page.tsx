'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuthStore } from '../../../store/auth.store';
import { TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';
import api from '../../../lib/api';
import { formatCurrency, statusColor, statusLabel, cn } from '../../../lib/utils';

export default function FinancialPage() {
  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [tab, setTab] = useState<'cashflow' | 'invoices' | 'dre'>('cashflow');
  const { tenantId } = useAuthStore();

  const downloadFile = (url: string, filename: string) => {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
    // VULN-007: cookies httpOnly são enviados automaticamente (credentials: 'include')
    fetch(`${apiBase}${url}`, {
      credentials: 'include',
      headers: { 'X-Tenant-ID': tenantId ?? '' },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
      });
  };

  const { data: cfData } = useQuery({
    queryKey: ['cashflow', startDate, endDate],
    queryFn: () =>
      api.get('/financial/cash-flow', { params: { startDate, endDate } }).then((r) => r.data.data),
    enabled: tab === 'cashflow',
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/financial/invoices').then((r) => r.data.data),
    enabled: tab === 'invoices',
  });

  const { data: dreData } = useQuery({
    queryKey: ['dre', now.getMonth() + 1, now.getFullYear()],
    queryFn: () =>
      api.get('/financial/dre', { params: { month: now.getMonth() + 1, year: now.getFullYear() } }).then((r) => r.data.data),
    enabled: tab === 'dre',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <DollarSign size={22} className="text-brand-400" />
        <h1 className="text-2xl font-bold">Financeiro</h1>
      </div>

      <div className="flex bg-ink-800 rounded-lg p-1 w-fit">
        {(['cashflow', 'invoices', 'dre'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-4 py-1.5 rounded text-sm transition-colors', tab === t ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}
          >
            {{ cashflow: 'Fluxo de Caixa', invoices: 'Contas a Pagar/Receber', dre: 'DRE' }[t]}
          </button>
        ))}
      </div>

      {tab === 'cashflow' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs text-ink-400 mb-1 block">De</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Até</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input text-sm" />
            </div>
          </div>

          {cfData && (
            <>
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => downloadFile(`/financial/export/csv?startDate=${startDate}&endDate=${endDate}`, `fluxo-${startDate}.csv`)}
                  className="btn-outline flex items-center gap-2 text-sm"
                >
                  <Download size={14} /> Exportar CSV
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="card">
                  <div className="flex items-center gap-2 text-green-400 mb-1"><TrendingUp size={16} /><span className="text-xs">Entradas</span></div>
                  <p className="text-xl font-bold text-green-400">{formatCurrency(cfData.totalIncome)}</p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 text-red-400 mb-1"><TrendingDown size={16} /><span className="text-xs">Saídas</span></div>
                  <p className="text-xl font-bold text-red-400">{formatCurrency(cfData.totalExpense)}</p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-2 text-brand-400 mb-1"><DollarSign size={16} /><span className="text-xs">Saldo</span></div>
                  <p className={cn('text-xl font-bold', cfData.balance >= 0 ? 'text-brand-400' : 'text-red-400')}>
                    {formatCurrency(cfData.balance)}
                  </p>
                </div>
              </div>

              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-ink-400 border-b border-ink-800">
                      <th className="text-left pb-3 font-medium">Data</th>
                      <th className="text-left pb-3 font-medium">Descrição</th>
                      <th className="text-left pb-3 font-medium">Categoria</th>
                      <th className="text-right pb-3 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-800">
                    {cfData.entries.map((e: { id: string; date: string; description: string; category: string; type: string; amount: number }) => (
                      <tr key={e.id}>
                        <td className="py-2.5 text-ink-400">{format(new Date(e.date), 'dd/MM')}</td>
                        <td className="py-2.5">{e.description}</td>
                        <td className="py-2.5 text-ink-400">{e.category}</td>
                        <td className={cn('py-2.5 text-right font-semibold', e.type === 'INCOME' ? 'text-green-400' : 'text-red-400')}>
                          {e.type === 'INCOME' ? '+' : '-'}{formatCurrency(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'invoices' && invoicesData && (
        <div className="space-y-2">
          {invoicesData.map((inv: { id: string; type: string; description: string; amount: number; dueDate: string; status: string }) => (
            <div key={inv.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{inv.description}</p>
                  <span className={cn('badge', inv.type === 'RECEIVABLE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                    {inv.type === 'RECEIVABLE' ? 'A Receber' : 'A Pagar'}
                  </span>
                  <span className={cn('badge', statusColor(inv.status))}>{statusLabel(inv.status)}</span>
                </div>
                <p className="text-xs text-ink-400 mt-0.5">Venc. {format(new Date(inv.dueDate), 'dd/MM/yyyy')}</p>
              </div>
              <p className={cn('font-bold flex-shrink-0', inv.type === 'RECEIVABLE' ? 'text-green-400' : 'text-red-400')}>
                {formatCurrency(inv.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'dre' && dreData && (
        <div className="card max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">DRE — {format(new Date(now.getFullYear(), now.getMonth(), 1), 'MMMM yyyy')}</h2>
            <button
              onClick={() => downloadFile(`/financial/export/pdf?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, `dre-${now.getFullYear()}-${now.getMonth() + 1}.pdf`)}
              className="btn-outline flex items-center gap-2 text-xs px-3 py-1.5"
            >
              <Download size={12} /> PDF
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm border-b border-ink-800 pb-3">
              <span className="text-ink-300">Receita Bruta</span>
              <span className="font-semibold text-green-400">{formatCurrency(dreData.grossRevenue)}</span>
            </div>
            <div className="flex justify-between text-sm border-b border-ink-800 pb-3">
              <span className="text-ink-300">Custos e Despesas</span>
              <span className="font-semibold text-red-400">({formatCurrency(dreData.totalCosts)})</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Lucro Líquido</span>
              <span className={cn(dreData.netProfit >= 0 ? 'text-brand-400' : 'text-red-400')}>
                {formatCurrency(dreData.netProfit)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-ink-400 pt-1">
              <span>Margem</span>
              <span>{dreData.margin.toFixed(1)}%</span>
            </div>
          </div>
          {Object.keys(dreData.revenueBySource).length > 0 && (
            <div className="mt-4 pt-4 border-t border-ink-800">
              <p className="text-xs text-ink-400 mb-2">Receita por fonte</p>
              {Object.entries(dreData.revenueBySource).map(([src, val]) => (
                <div key={src} className="flex justify-between text-sm py-1">
                  <span className="capitalize text-ink-300">{src}</span>
                  <span>{formatCurrency(val as number)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
