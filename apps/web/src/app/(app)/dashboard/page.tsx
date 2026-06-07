'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';
import { TrendingUp, Calendar, AlertTriangle, Users, Trophy } from 'lucide-react';
import api from '../../../lib/api';
import { formatCurrency, formatDateTime, statusLabel, statusColor, cn } from '../../../lib/utils';

interface DashboardData {
  revenue: { today: number; week: number; month: number };
  appointments: { today: { id: string; date: string; status: string; client: { name: string }; artist: { user: { name: string } } }[]; pending: number };
  lowStockAlerts: number;
  activeClients: number;
  artistRanking: { artistId: string; name: string; count: number }[];
  revenueBySource: { source: string; total: number }[];
}

interface ChartDay { date: string; receita: number; sessoes: number; }

const COLORS = ['#f59e0b', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444'];

const sourceLabel = (s: string) =>
  ({ tattoo: 'Tatuagem', cafe: 'Cafeteria', store: 'Loja', outros: 'Outros' })[s] ?? s;

export default function DashboardPage() {
  const { data, isLoading } = useQuery<{ data: DashboardData }>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: chartRaw } = useQuery<{ data: ChartDay[] }>({
    queryKey: ['dashboard-chart'],
    queryFn: () => api.get('/dashboard/revenue-chart?days=30').then((r) => r.data),
    refetchInterval: 120_000,
  });
  const chartData = chartRaw?.data ?? [];

  const d = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-24 bg-ink-800" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Receita hoje', value: formatCurrency(d?.revenue.today ?? 0), icon: TrendingUp, color: 'text-brand-400' },
    { label: 'Receita na semana', value: formatCurrency(d?.revenue.week ?? 0), icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Receita no mês', value: formatCurrency(d?.revenue.month ?? 0), icon: TrendingUp, color: 'text-purple-400' },
    { label: 'Clientes ativos', value: String(d?.activeClients ?? 0), icon: Users, color: 'text-green-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-ink-400">Atualiza a cada 30 segundos</p>
      </div>

      {/* Alerts */}
      {(d?.lowStockAlerts ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-orange-400 flex-shrink-0" />
          <p className="text-sm text-orange-300">
            <strong>{d?.lowStockAlerts}</strong> {d?.lowStockAlerts === 1 ? 'produto está' : 'produtos estão'} com estoque abaixo do mínimo.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-ink-400">{s.label}</span>
              <s.icon size={16} className={s.color} />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's appointments */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-brand-400" />
            <h2 className="font-semibold">Agendamentos hoje</h2>
            {(d?.appointments.pending ?? 0) > 0 && (
              <span className="ml-auto badge bg-yellow-500/20 text-yellow-400">
                {d?.appointments.pending} pendente{d!.appointments.pending !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {(d?.appointments.today.length ?? 0) === 0 ? (
            <p className="text-ink-500 text-sm text-center py-8">Nenhum agendamento hoje</p>
          ) : (
            <div className="space-y-2">
              {d?.appointments.today.map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 bg-ink-800 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{apt.client.name}</p>
                    <p className="text-xs text-ink-400">{apt.artist.user.name} · {formatDateTime(apt.date)}</p>
                  </div>
                  <span className={cn('badge', statusColor(apt.status))}>{statusLabel(apt.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Artist ranking */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-brand-400" />
            <h2 className="font-semibold">Ranking do mês</h2>
          </div>
          {(d?.artistRanking.length ?? 0) === 0 ? (
            <p className="text-ink-500 text-sm text-center py-8">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {d?.artistRanking.map((a, i) => (
                <div key={a.artistId} className="flex items-center gap-3">
                  <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    i === 0 ? 'bg-brand-500 text-ink-950' : 'bg-ink-700 text-ink-400')}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm truncate">{a.name}</span>
                  <span className="text-xs text-ink-400">{a.count} sessões</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily revenue chart (last 30 days) */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Receita diária — últimos 30 dias</h2>
            <span className="text-xs text-ink-400">
              Total: {formatCurrency(chartData.reduce((s, d) => s + d.receita, 0))}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
                formatter={(v: number, name: string) => [
                  name === 'receita' ? formatCurrency(v) : `${v} sessões`,
                  name === 'receita' ? 'Receita' : 'Sessões',
                ]}
              />
              <Bar dataKey="receita" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue by source chart */}
      {(d?.revenueBySource.length ?? 0) > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-4">Receita por fonte (mês atual)</h2>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={d?.revenueBySource.map((r) => ({ name: sourceLabel(r.source), value: r.total }))}
                  cx="50%" cy="50%" outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {d?.revenueBySource.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {d?.revenueBySource.map((r, i) => (
                <div key={r.source} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm flex-1">{sourceLabel(r.source)}</span>
                  <span className="text-sm font-semibold">{formatCurrency(r.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
