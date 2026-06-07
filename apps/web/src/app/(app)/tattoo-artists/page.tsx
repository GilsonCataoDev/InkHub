'use client';

import { useQuery } from '@tanstack/react-query';
import { User2, Star, Calendar, Plus } from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/api';
import { getInitials, formatCurrency } from '../../../lib/utils';

interface Artist {
  id: string;
  specialties: string[];
  active: boolean;
  user: { name: string; email: string; avatarUrl: string | null };
  commissions: Array<{ type: string; value: number; serviceType: string }>;
  goals: Array<{ month: number; year: number; target: number; achieved: number }>;
  _count: { appointments: number };
}

export default function TattooArtistsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tattoo-artists'],
    queryFn: () => api.get('/tattoo-artists').then((r) => r.data.data as Artist[]),
  });

  const artists = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User2 size={22} className="text-brand-400" />
          <h1 className="text-2xl font-bold">Tatuadores</h1>
        </div>
        <Link href="/tattoo-artists/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo tatuador
        </Link>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-48 bg-ink-800" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artists.map((a) => {
            const currentGoal = (a.goals ?? [])[0];
            const goalPct = currentGoal ? Math.min(100, (Number(currentGoal.achieved) / Number(currentGoal.target)) * 100) : null;
            const commission = (a.commissions ?? []).find((c) => c.serviceType === 'DEFAULT');

            return (
              <Link key={a.id} href={`/tattoo-artists/${a.id}`} className="card hover:border-ink-700 transition-colors block">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-brand-500/10 rounded-full flex items-center justify-center text-brand-400 font-bold text-lg flex-shrink-0">
                    {getInitials(a.user.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{a.user.name}</p>
                    <p className="text-xs text-ink-400 truncate">{a.user.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {a.specialties.map((s) => (
                        <span key={s} className="text-xs bg-ink-800 text-ink-300 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div className="bg-ink-800 rounded-lg p-2">
                    <p className="text-xs text-ink-400 flex items-center gap-1"><Calendar size={11} />Sessões</p>
                    <p className="font-semibold">{a._count.appointments}</p>
                  </div>
                  <div className="bg-ink-800 rounded-lg p-2">
                    <p className="text-xs text-ink-400 flex items-center gap-1"><Star size={11} />Comissão</p>
                    <p className="font-semibold">{commission ? `${commission.value}${commission.type === 'PERCENTAGE' ? '%' : ' fixo'}` : '—'}</p>
                  </div>
                </div>

                {goalPct !== null && (
                  <div>
                    <div className="flex justify-between text-xs text-ink-400 mb-1">
                      <span>Meta do mês</span>
                      <span>{goalPct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-ink-800 rounded-full h-1.5">
                      <div
                        className="bg-brand-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${goalPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-ink-500 mt-1">
                      <span>{formatCurrency(Number(currentGoal.achieved))}</span>
                      <span>{formatCurrency(Number(currentGoal.target))}</span>
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
