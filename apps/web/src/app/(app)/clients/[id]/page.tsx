'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Phone, Mail, Calendar, Star, Camera, Edit2,
  Save, X, Loader2, Clock, CheckCircle, FileText,
} from 'lucide-react';
import Link from 'next/link';
import api from '../../../../lib/api';
import {
  cn, formatDate, formatCurrency, formatDateTime,
  getInitials, statusColor, statusLabel,
} from '../../../../lib/utils';

interface ClientDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  birthDate: string | null;
  notes: string | null;
  loyaltyPoints: { points: number } | null;
  photos: Array<{ id: string; url: string; caption: string | null; takenAt: string }>;
  appointments: Array<{
    id: string;
    date: string;
    status: string;
    description: string | null;
    estimatedValue: string | null;
    artist: { user: { name: string } };
  }>;
  consents: Array<{ id: string; signedAt: string }>;
  anamnesis: Array<{ id: string; fields: Record<string, string>; updatedAt: string }>;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ClientDetail>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'photos' | 'loyalty'>('overview');

  const { data, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then((r) => r.data.data as ClientDetail),
  });

  const update = useMutation({
    mutationFn: (d: Partial<ClientDetail>) => api.put(`/clients/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      setEditing(false);
    },
  });

  const softDelete = useMutation({
    mutationFn: () => api.delete(`/clients/${id}`),
    onSuccess: () => router.push('/clients'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-4xl">
        <div className="card h-32 bg-ink-800" />
        <div className="card h-64 bg-ink-800" />
      </div>
    );
  }

  if (!data) return <div className="text-ink-400">Cliente não encontrado.</div>;

  const c = data;

  const startEdit = () => {
    setEditData({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', cpf: c.cpf ?? '', notes: c.notes ?? '' });
    setEditing(true);
  };

  const tabs = [
    { key: 'overview', label: 'Dados' },
    { key: 'appointments', label: `Sessões (${c.appointments.length})` },
    { key: 'photos', label: `Fotos (${c.photos.length})` },
    { key: 'loyalty', label: 'Fidelidade' },
  ] as const;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/clients" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold flex-1 truncate">{c.name}</h1>
        {!editing && (
          <button onClick={startEdit} className="btn-outline flex items-center gap-2 text-sm">
            <Edit2 size={14} /> Editar
          </button>
        )}
      </div>

      {/* Profile card */}
      <div className="card">
        {editing ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-ink-400 mb-1 block">Nome</label>
                <input value={editData.name ?? ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs text-ink-400 mb-1 block">E-mail</label>
                <input value={editData.email ?? ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs text-ink-400 mb-1 block">Telefone</label>
                <input value={editData.phone ?? ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-xs text-ink-400 mb-1 block">CPF</label>
                <input value={editData.cpf ?? ''} onChange={(e) => setEditData({ ...editData, cpf: e.target.value })} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-ink-400 mb-1 block">Observações</label>
                <textarea value={editData.notes ?? ''} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} rows={2} className="input resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="btn-ghost flex items-center gap-2"><X size={14} /> Cancelar</button>
              <button onClick={() => update.mutate(editData)} disabled={update.isPending} className="btn-primary flex items-center gap-2">
                {update.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center text-brand-400 font-bold text-2xl flex-shrink-0">
              {getInitials(c.name)}
            </div>
            <div className="flex-1 grid sm:grid-cols-2 gap-3 text-sm">
              {c.email && (
                <div className="flex items-center gap-2 text-ink-300">
                  <Mail size={14} className="text-ink-500 flex-shrink-0" /> {c.email}
                </div>
              )}
              {c.phone && (
                <div className="flex items-center gap-2 text-ink-300">
                  <Phone size={14} className="text-ink-500 flex-shrink-0" /> {c.phone}
                </div>
              )}
              {c.birthDate && (
                <div className="flex items-center gap-2 text-ink-300">
                  <Calendar size={14} className="text-ink-500 flex-shrink-0" /> {formatDate(c.birthDate)}
                </div>
              )}
              {c.loyaltyPoints && (
                <div className="flex items-center gap-2 text-brand-400 font-semibold">
                  <Star size={14} fill="currentColor" /> {c.loyaltyPoints.points} pontos de fidelidade
                </div>
              )}
              {c.notes && (
                <div className="sm:col-span-2 text-ink-400 text-xs italic">{c.notes}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-ink-800 rounded-lg p-1 w-fit gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn('px-4 py-1.5 rounded text-sm transition-colors whitespace-nowrap', activeTab === t.key ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold mb-3 text-sm">Resumo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-400">Total de sessões</span>
                <span className="font-semibold">{c.appointments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">Sessões concluídas</span>
                <span className="font-semibold text-green-400">
                  {c.appointments.filter((a) => a.status === 'COMPLETED').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">Pontos de fidelidade</span>
                <span className="font-semibold text-brand-400">{c.loyaltyPoints?.points ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ink-400">Consentimento</span>
                {c.consents.length > 0 ? (
                  <span className="text-green-400 flex items-center gap-1"><CheckCircle size={12} /> Assinado</span>
                ) : (
                  <ConsentButton clientId={c.id} onSuccess={() => qc.invalidateQueries({ queryKey: ['client', id] })} />
                )}
              </div>
            </div>
          </div>

          {c.anamnesis.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-3 text-sm">Anamnese</h3>
              <div className="space-y-1.5 text-sm">
                {Object.entries(c.anamnesis[0].fields).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-ink-400 capitalize min-w-24">{k}:</span>
                    <span className="text-ink-200">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Appointments */}
      {activeTab === 'appointments' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-400">{c.appointments.length} sessão(ões)</p>
            <Link
              href={`/appointments/new?clientId=${c.id}`}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Calendar size={14} /> Nova sessão
            </Link>
          </div>
          {c.appointments.length === 0 ? (
            <div className="card text-center py-10 text-ink-400">Nenhuma sessão registrada</div>
          ) : (
            c.appointments.map((apt) => (
              <Link key={apt.id} href={`/appointments/${apt.id}`} className="card hover:border-ink-700 transition-colors flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium">{apt.description ?? 'Sessão de tatuagem'}</p>
                    <span className={cn('badge', statusColor(apt.status))}>{statusLabel(apt.status)}</span>
                  </div>
                  <p className="text-xs text-ink-400">
                    {formatDateTime(apt.date)} · {apt.artist.user.name}
                    {apt.estimatedValue ? ` · ${formatCurrency(Number(apt.estimatedValue))}` : ''}
                  </p>
                </div>
                {apt.status === 'COMPLETED' && <CheckCircle size={16} className="text-green-400 flex-shrink-0" />}
              </Link>
            ))
          )}
        </div>
      )}

      {/* Tab: Photos */}
      {activeTab === 'photos' && (
        <div>
          {c.photos.length === 0 ? (
            <div className="card text-center py-12">
              <Camera size={32} className="text-ink-600 mx-auto mb-3" />
              <p className="text-ink-400 text-sm">Nenhuma foto cadastrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {c.photos.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-ink-800 relative group">
                  <img src={photo.url} alt={photo.caption ?? ''} className="w-full h-full object-cover" />
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-ink-950/80 px-2 py-1 text-xs text-ink-200 opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Loyalty */}
      {activeTab === 'loyalty' && (
        <div className="card max-w-sm">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Star size={28} className="text-brand-400" fill="currentColor" />
            </div>
            <p className="text-4xl font-bold text-brand-400">{c.loyaltyPoints?.points ?? 0}</p>
            <p className="text-ink-400 text-sm mt-1">pontos acumulados</p>
          </div>
          <div className="border-t border-ink-800 pt-4 mt-4">
            <p className="text-xs text-ink-400 mb-3">Adicionar pontos manualmente</p>
            <AddPointsForm clientId={c.id} onSuccess={() => qc.invalidateQueries({ queryKey: ['client', id] })} />
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="border border-red-500/20 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-red-400 mb-2">Zona de perigo</h3>
        <p className="text-xs text-ink-400 mb-3">Esta ação remove o cliente do sistema (soft delete). Os dados históricos são preservados.</p>
        <button
          onClick={() => { if (confirm('Remover este cliente?')) softDelete.mutate(); }}
          disabled={softDelete.isPending}
          className="text-red-400 border border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg text-sm transition-colors"
        >
          Remover cliente
        </button>
      </div>
    </div>
  );
}

function AddPointsForm({ clientId, onSuccess }: { clientId: string; onSuccess: () => void }) {
  const [points, setPoints] = useState(50);
  const [reason, setReason] = useState('Bônus manual');

  const add = useMutation({
    mutationFn: () => api.post(`/clients/${clientId}/loyalty/add`, { points, reason }),
    onSuccess,
  });

  return (
    <div className="space-y-2">
      <input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} className="input text-sm" placeholder="Quantidade de pontos" />
      <input value={reason} onChange={(e) => setReason(e.target.value)} className="input text-sm" placeholder="Motivo" />
      <button onClick={() => add.mutate()} disabled={add.isPending} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
        {add.isPending && <Loader2 size={14} className="animate-spin" />}
        Adicionar pontos
      </button>
    </div>
  );
}

function ConsentButton({ clientId, onSuccess }: { clientId: string; onSuccess: () => void }) {
  const sign = useMutation({
    mutationFn: () => api.post(`/clients/${clientId}/consent/sign`),
    onSuccess,
  });

  return (
    <button
      onClick={() => sign.mutate()}
      disabled={sign.isPending}
      className="flex items-center gap-1 text-xs text-brand-400 border border-brand-500/30 hover:bg-brand-500/10 px-2 py-0.5 rounded-full transition-colors"
    >
      {sign.isPending ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
      Assinar agora
    </button>
  );
}
