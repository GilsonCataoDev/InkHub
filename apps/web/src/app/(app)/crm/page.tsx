'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp, MessageSquare } from 'lucide-react';
import api from '../../../lib/api';
import { cn, formatDate, getInitials } from '../../../lib/utils';

export default function CrmPage() {
  const [tab, setTab] = useState<'birthdays' | 'inactive' | 'campaigns'>('birthdays');
  const [inactiveDays, setInactiveDays] = useState(60);

  const { data: birthdays } = useQuery({
    queryKey: ['crm-birthdays'],
    queryFn: () => api.get('/crm/birthdays').then((r) => r.data.data),
    enabled: tab === 'birthdays',
  });

  const { data: inactive } = useQuery({
    queryKey: ['crm-inactive', inactiveDays],
    queryFn: () => api.get('/crm/inactive', { params: { days: inactiveDays } }).then((r) => r.data.data),
    enabled: tab === 'inactive',
  });

  const { data: campaigns } = useQuery({
    queryKey: ['crm-campaigns'],
    queryFn: () => api.get('/crm/campaigns').then((r) => r.data.data),
    enabled: tab === 'campaigns',
  });

  const tabs = [
    { key: 'birthdays', label: 'Aniversariantes', count: birthdays?.length },
    { key: 'inactive', label: 'Inativos', count: inactive?.length },
    { key: 'campaigns', label: 'Campanhas', count: campaigns?.length },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare size={22} className="text-brand-400" />
        <h1 className="text-2xl font-bold">CRM</h1>
      </div>

      <div className="flex bg-ink-800 rounded-lg p-1 w-fit gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('px-4 py-1.5 rounded text-sm transition-colors flex items-center gap-2', tab === t.key ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}
          >
            {t.label}
            {t.count != null && (
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full', tab === t.key ? 'bg-brand-500 text-ink-950' : 'bg-ink-700 text-ink-300')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'birthdays' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-400">Clientes com aniversário este mês</p>
          {!birthdays?.length ? (
            <div className="card text-center py-12 text-ink-400">Nenhum aniversariante este mês</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {birthdays.map((c: { id: string; name: string; email: string | null; phone: string | null; birthDate: string }) => (
                <div key={c.id} className="card flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-500/10 rounded-full flex items-center justify-center text-brand-400 font-bold flex-shrink-0">
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-ink-400">{c.birthDate ? formatDate(c.birthDate) : '—'}</p>
                    {c.phone && <p className="text-xs text-ink-400">{c.phone}</p>}
                  </div>
                  <span className="text-2xl">🎂</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'inactive' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-400">Inativos há mais de</span>
            <select value={inactiveDays} onChange={(e) => setInactiveDays(Number(e.target.value))} className="input w-28 text-sm">
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
              <option value={180}>180 dias</option>
            </select>
          </div>
          {!inactive?.length ? (
            <div className="card text-center py-12 text-ink-400">Nenhum cliente inativo no período</div>
          ) : (
            <div className="space-y-2">
              {inactive.map((c: { id: string; name: string; email: string | null; _count: { appointments: number }; loyaltyPoints: { points: number } | null }) => (
                <div key={c.id} className="card flex items-center gap-4">
                  <div className="w-9 h-9 bg-ink-700 rounded-full flex items-center justify-center text-ink-400 font-bold text-sm flex-shrink-0">
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-ink-400">{c._count.appointments} sessões · {c.loyaltyPoints?.points ?? 0} pontos</p>
                  </div>
                  <button className="btn-outline text-xs px-3 py-1.5">Contatar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="space-y-4">
          <button className="btn-primary flex items-center gap-2"><MessageSquare size={16} /> Nova campanha</button>
          {!campaigns?.length ? (
            <div className="card text-center py-12 text-ink-400">Nenhuma campanha criada</div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c: { id: string; name: string; subject: string; segment: string; sentAt: string | null; recipientCount: number; createdAt: string }) => (
                <div key={c.id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-ink-400">{c.subject}</p>
                      <p className="text-xs text-ink-500 mt-1">Segmento: {c.segment} · {c.recipientCount} destinatários</p>
                    </div>
                    <span className={cn('badge flex-shrink-0', c.sentAt ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>
                      {c.sentAt ? 'Enviada' : 'Rascunho'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
