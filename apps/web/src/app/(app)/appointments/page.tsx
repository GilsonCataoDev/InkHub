'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Filter } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import api from '../../../lib/api';
import { cn, statusColor, statusLabel, formatCurrency } from '../../../lib/utils';

interface Appointment {
  id: string;
  date: string;
  status: string;
  durationMinutes: number;
  estimatedValue: number | null;
  description: string | null;
  client: { name: string; phone: string | null };
  artist: { user: { name: string } };
}

const STATUS_OPTIONS = ['', 'PENDING', 'CONFIRMED', 'IN_SESSION', 'COMPLETED', 'CANCELLED'];
const NEXT_STATUS: Record<string, string | null> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'IN_SESSION',
  IN_SESSION: 'COMPLETED',
  COMPLETED: null,
  CANCELLED: null,
};

export default function AppointmentsPage() {
  const [view, setView] = useState<'week' | 'list'>('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  const weekEnd = addDays(weekStart, 6);

  const { data: weekData } = useQuery({
    queryKey: ['appointments-week', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () =>
      api.get('/appointments/week', { params: { weekStart: format(weekStart, 'yyyy-MM-dd') } }).then((r) => r.data.data as Appointment[]),
    enabled: view === 'week',
  });

  const { data: listData } = useQuery({
    queryKey: ['appointments-list', statusFilter],
    queryFn: () =>
      api.get('/appointments', { params: { status: statusFilter || undefined, limit: 50 } }).then((r) => r.data.data),
    enabled: view === 'list',
  });

  const advanceStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/appointments/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments-week'] }); qc.invalidateQueries({ queryKey: ['appointments-list'] }); },
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-ink-800 rounded-lg p-1">
            <button onClick={() => setView('week')} className={cn('px-3 py-1 rounded text-sm transition-colors', view === 'week' ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}>Semana</button>
            <button onClick={() => setView('list')} className={cn('px-3 py-1 rounded text-sm transition-colors', view === 'list' ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}>Lista</button>
          </div>
          <Link href="/appointments/new" className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Agendar
          </Link>
        </div>
      </div>

      {view === 'week' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setWeekStart((d) => addDays(d, -7))} className="btn-ghost p-2">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-semibold text-sm">
              {format(weekStart, "d 'de' MMMM", { locale: ptBR })} — {format(weekEnd, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <button onClick={() => setWeekStart((d) => addDays(d, 7))} className="btn-ghost p-2">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const dayApts = (weekData ?? []).filter((a) => isSameDay(new Date(a.date), day));
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="min-h-24">
                  <div className={cn('text-center py-1.5 mb-2 rounded-lg text-xs font-medium', isToday ? 'bg-brand-500 text-ink-950' : 'text-ink-400')}>
                    <div>{format(day, 'EEE', { locale: ptBR })}</div>
                    <div className="text-base font-bold">{format(day, 'd')}</div>
                  </div>
                  <div className="space-y-1">
                    {dayApts.map((apt) => (
                      <Link
                        key={apt.id}
                        href={`/appointments/${apt.id}`}
                        className={cn('block rounded p-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity', statusColor(apt.status))}
                      >
                        <p className="font-medium truncate">{format(new Date(apt.date), 'HH:mm')}</p>
                        <p className="truncate">{apt.client.name}</p>
                        <p className="truncate text-ink-400">{apt.artist.user.name}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Filter size={16} className="text-ink-400" />
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn('px-3 py-1 rounded-full text-xs transition-colors', statusFilter === s ? 'bg-brand-500 text-ink-950 font-semibold' : 'bg-ink-800 text-ink-400 hover:text-ink-100')}
                >
                  {s ? statusLabel(s) : 'Todos'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {(listData?.data ?? []).map((apt: Appointment) => {
              const next = NEXT_STATUS[apt.status];
              return (
                <div key={apt.id} className="card flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{apt.client.name}</p>
                      <span className={cn('badge', statusColor(apt.status))}>{statusLabel(apt.status)}</span>
                    </div>
                    <p className="text-xs text-ink-400">
                      {format(new Date(apt.date), "dd/MM/yyyy 'às' HH:mm")} · {apt.artist.user.name}
                      {apt.estimatedValue ? ` · ${formatCurrency(apt.estimatedValue)}` : ''}
                      {apt.description ? ` · ${apt.description}` : ''}
                    </p>
                  </div>
                  {next && (
                    <button
                      onClick={() => advanceStatus.mutate({ id: apt.id, status: next })}
                      disabled={advanceStatus.isPending}
                      className="btn-outline text-xs px-3 py-1.5 flex-shrink-0"
                    >
                      → {statusLabel(next)}
                    </button>
                  )}
                  <Link href={`/appointments/${apt.id}`} className="btn-ghost p-2">
                    <ChevronRight size={16} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
