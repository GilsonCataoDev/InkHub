'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Target, Trophy, Calendar, DollarSign, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '../../../../lib/api';
import { cn, getInitials, formatCurrency } from '../../../../lib/utils';

interface ArtistDetail {
  id: string;
  bio: string | null;
  specialties: string[];
  portfolioUrl: string | null;
  active: boolean;
  user: { name: string; email: string; avatarUrl: string | null };
  commissions: Array<{ id: string; type: string; value: number; serviceType: string; active: boolean }>;
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  goals: Array<{ month: number; year: number; target: number; achieved: number }>;
  _count: { appointments: number };
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const now = new Date();
  const [perfMonth, setPerfMonth] = useState(now.getMonth() + 1);
  const [perfYear, setPerfYear] = useState(now.getFullYear());
  const [goalTarget, setGoalTarget] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['artist', id],
    queryFn: () => api.get(`/tattoo-artists/${id}`).then((r) => r.data.data as ArtistDetail),
  });

  const { data: perf } = useQuery({
    queryKey: ['artist-perf', id, perfMonth, perfYear],
    queryFn: () =>
      api.get(`/tattoo-artists/${id}/performance`, { params: { month: perfMonth, year: perfYear } })
        .then((r) => r.data.data),
  });

  const setGoal = useMutation({
    mutationFn: (target: number) =>
      api.post(`/tattoo-artists/${id}/goal`, { month: perfMonth, year: perfYear, target }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['artist', id] });
      qc.invalidateQueries({ queryKey: ['artist-perf', id, perfMonth, perfYear] });
      setGoalTarget('');
    },
  });

  if (isLoading) return <div className="animate-pulse space-y-4 max-w-4xl"><div className="card h-40 bg-ink-800" /></div>;
  if (!data) return <div className="text-ink-400">Tatuador não encontrado.</div>;

  const a = data;
  const commission = a.commissions.find((c) => c.serviceType === 'DEFAULT' && c.active);
  const goalPct = perf?.goalPercentage ? Math.min(100, perf.goalPercentage) : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/tattoo-artists" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold flex-1">Perfil do tatuador</h1>
      </div>

      {/* Header */}
      <div className="card">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center text-brand-400 font-bold text-2xl flex-shrink-0">
            {getInitials(a.user.name)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{a.user.name}</h2>
            <p className="text-ink-400 text-sm">{a.user.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {a.specialties.map((s) => (
                <span key={s} className="text-xs bg-ink-800 text-ink-300 px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
            {a.bio && <p className="text-ink-400 text-sm mt-3 max-w-xl">{a.bio}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold">{a._count.appointments}</p>
            <p className="text-xs text-ink-400">total de sessões</p>
            {commission && (
              <p className="text-sm text-brand-400 mt-2 font-semibold">
                {commission.value}{commission.type === 'PERCENTAGE' ? '%' : ' R$'} comissão
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Performance */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-brand-400" />
            <h3 className="font-semibold">Performance mensal</h3>
          </div>

          <div className="flex gap-2 mb-4">
            <select value={perfMonth} onChange={(e) => setPerfMonth(Number(e.target.value))} className="input text-sm flex-1">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2025, i, 1).toLocaleString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
            <input type="number" value={perfYear} onChange={(e) => setPerfYear(Number(e.target.value))} className="input text-sm w-24" />
          </div>

          {perf && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-ink-800 rounded-lg p-3">
                  <p className="text-xs text-ink-400 flex items-center gap-1"><Calendar size={11} />Sessões</p>
                  <p className="text-xl font-bold">{perf.totalAppointments}</p>
                </div>
                <div className="bg-ink-800 rounded-lg p-3">
                  <p className="text-xs text-ink-400 flex items-center gap-1"><DollarSign size={11} />Receita</p>
                  <p className="text-lg font-bold text-green-400">{formatCurrency(perf.totalRevenue)}</p>
                </div>
              </div>

              {perf.goal && (
                <div>
                  <div className="flex justify-between text-xs text-ink-400 mb-1.5">
                    <span className="flex items-center gap-1"><Target size={11} />Meta</span>
                    <span>{goalPct?.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-ink-800 rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full transition-all', goalPct === 100 ? 'bg-green-500' : 'bg-brand-500')}
                      style={{ width: `${goalPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-ink-500 mt-1">
                    <span>{formatCurrency(perf.totalRevenue)}</span>
                    <span>meta: {formatCurrency(perf.goal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-ink-800 mt-4 pt-4">
            <p className="text-xs text-ink-400 mb-2">Definir meta do período</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="R$ meta"
                className="input text-sm flex-1"
              />
              <button
                onClick={() => goalTarget && setGoal.mutate(Number(goalTarget))}
                disabled={!goalTarget || setGoal.isPending}
                className="btn-primary px-3 text-sm"
              >
                {setGoal.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="card">
          <h3 className="font-semibold mb-4">Horários de trabalho</h3>
          {a.schedules.length === 0 ? (
            <p className="text-ink-400 text-sm text-center py-6">Nenhum horário cadastrado</p>
          ) : (
            <div className="space-y-2">
              {a.schedules
                .sort((x, y) => x.dayOfWeek - y.dayOfWeek)
                .map((s) => (
                  <div key={s.dayOfWeek} className="flex items-center justify-between text-sm">
                    <span className="w-8 font-medium text-ink-300">{DAYS[s.dayOfWeek]}</span>
                    <span className="text-ink-400">{s.startTime} – {s.endTime}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Commissions */}
          {a.commissions.length > 0 && (
            <div className="border-t border-ink-800 mt-4 pt-4">
              <h4 className="text-sm font-semibold mb-3">Comissões</h4>
              <div className="space-y-2">
                {a.commissions.filter((c) => c.active).map((c) => (
                  <div key={c.id} className="flex justify-between text-sm">
                    <span className="text-ink-400 capitalize">{c.serviceType === 'DEFAULT' ? 'Padrão' : c.serviceType}</span>
                    <span className="font-semibold text-brand-400">
                      {c.value}{c.type === 'PERCENTAGE' ? '%' : ` R$ fixo`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Past goals */}
      {a.goals.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Histórico de metas</h3>
          <div className="space-y-3">
            {a.goals.map((g) => {
              const pct = Math.min(100, (Number(g.achieved) / Number(g.target)) * 100);
              return (
                <div key={`${g.month}-${g.year}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink-300">
                      {new Date(g.year, g.month - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                    <span className={cn('font-semibold', pct >= 100 ? 'text-green-400' : 'text-ink-300')}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-ink-800 rounded-full h-1.5">
                    <div className={cn('h-1.5 rounded-full', pct >= 100 ? 'bg-green-500' : 'bg-brand-500')} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-ink-500 mt-0.5">
                    <span>{formatCurrency(Number(g.achieved))}</span>
                    <span>de {formatCurrency(Number(g.target))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
