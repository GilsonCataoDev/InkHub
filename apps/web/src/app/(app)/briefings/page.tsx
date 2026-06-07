'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquarePlus, CheckCircle2, Phone, Mail, Instagram,
  ChevronRight, Loader2, Copy, Check, Archive,
} from 'lucide-react';
import api from '../../../lib/api';
import { cn, formatDateTime } from '../../../lib/utils';
import { useAuthStore } from '../../../store/auth.store';

interface Briefing {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  instagram: string | null;
  idea: string;
  style: string | null;
  placement: string | null;
  size: string | null;
  budget: string | null;
  colorOrBlack: string | null;
  isFirstTattoo: boolean;
  referenceImages: string[];
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'ARCHIVED';
  notes: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contatado',
  CONVERTED: 'Convertido',
  ARCHIVED: 'Arquivado',
};
const STATUS_COLOR: Record<string, string> = {
  NEW: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  CONTACTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CONVERTED: 'bg-green-500/20 text-green-400 border-green-500/30',
  ARCHIVED: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export default function BriefingsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<Briefing | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  const slug = user?.tenant?.slug ?? 'demo-studio';
  const formLink = typeof window !== 'undefined' ? `${window.location.origin}/form/${slug}` : `/form/${slug}`;

  const { data, isLoading } = useQuery({
    queryKey: ['briefings', filter],
    queryFn: () => api.get(`/briefings${filter ? `?status=${filter}` : ''}`).then((r) => r.data.data as Briefing[]),
  });

  const { data: statsData } = useQuery({
    queryKey: ['briefings-stats'],
    queryFn: () => api.get('/briefings/stats').then((r) => r.data.data as Record<string, number>),
  });

  const update = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; status?: string; notes?: string }) =>
      api.patch(`/briefings/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['briefings'] });
      qc.invalidateQueries({ queryKey: ['briefings-stats'] });
      if (selected) {
        setSelected((prev) => prev ? { ...prev, ...(update.variables as Partial<Briefing>) } as Briefing : null);
      }
    },
  });

  const copyLink = () => {
    navigator.clipboard.writeText(formLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const briefings = data ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquarePlus size={22} className="text-brand-400" />
            <h1 className="text-2xl font-bold">Briefings</h1>
          </div>
          <p className="text-ink-400 text-sm">Formulários enviados por clientes interessados</p>
        </div>

        {/* Link do formulário */}
        <div className="flex items-center gap-2 bg-ink-800 border border-ink-700 rounded-xl px-3 py-2 max-w-sm w-full">
          <span className="text-xs text-ink-400 truncate flex-1">{formLink}</span>
          <button onClick={copyLink} className="text-brand-400 hover:text-brand-300 flex-shrink-0 transition-colors">
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_LABEL).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(filter === k ? '' : k)}
            className={cn('card text-center py-3 transition-all border', filter === k ? 'border-brand-500' : 'border-ink-800')}
          >
            <p className="text-2xl font-bold text-brand-400">{statsData?.[k] ?? 0}</p>
            <p className="text-xs text-ink-400 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      <div className={cn('grid gap-4', selected ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        {/* Lista */}
        <div className="space-y-2">
          {isLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="card h-24 bg-ink-800 animate-pulse" />)
          ) : briefings.length === 0 ? (
            <div className="card text-center py-12 text-ink-400">
              <MessageSquarePlus size={32} className="mx-auto mb-3 text-ink-600" />
              <p>Nenhum briefing {filter ? 'com este status' : 'ainda'}.</p>
              {!filter && (
                <p className="text-sm mt-2">
                  Compartilhe o link do formulário com seus clientes.
                </p>
              )}
            </div>
          ) : (
            briefings.map((b) => (
              <button
                key={b.id}
                onClick={() => { setSelected(b); setNotes(b.notes ?? ''); }}
                className={cn('card w-full text-left hover:border-ink-700 transition-colors', selected?.id === b.id && 'border-brand-500')}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-brand-500/10 rounded-full flex items-center justify-center text-brand-400 font-bold text-sm flex-shrink-0">
                    {b.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{b.name}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLOR[b.status])}>
                        {STATUS_LABEL[b.status]}
                      </span>
                      {b.isFirstTattoo && (
                        <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">1ª tattoo</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400 truncate mt-0.5">{b.idea}</p>
                    <p className="text-xs text-ink-500 mt-1">{formatDateTime(b.createdAt)}</p>
                  </div>
                  <ChevronRight size={16} className="text-ink-600 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detalhe */}
        {selected && (
          <div className="card space-y-5 h-fit sticky top-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg">{selected.name}</h2>
                <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLOR[selected.status])}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-ink-500 hover:text-ink-200 text-xs">✕</button>
            </div>

            {/* Contato */}
            <div className="space-y-2">
              <h3 className="text-xs text-ink-400 font-medium uppercase tracking-wider">Contato</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-ink-300">
                  <Mail size={13} className="text-ink-500" />
                  <a href={`mailto:${selected.email}`} className="hover:text-brand-400 transition-colors">{selected.email}</a>
                </div>
                {selected.phone && (
                  <div className="flex items-center gap-2 text-ink-300">
                    <Phone size={13} className="text-ink-500" />
                    <a href={`tel:${selected.phone}`} className="hover:text-brand-400 transition-colors">{selected.phone}</a>
                  </div>
                )}
                {selected.instagram && (
                  <div className="flex items-center gap-2 text-ink-300">
                    <Instagram size={13} className="text-ink-500" />
                    <a href={`https://instagram.com/${selected.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-400 transition-colors">{selected.instagram}</a>
                  </div>
                )}
              </div>
            </div>

            {/* Briefing */}
            <div className="space-y-2">
              <h3 className="text-xs text-ink-400 font-medium uppercase tracking-wider">Briefing</h3>
              <p className="text-sm text-ink-200 bg-ink-800 rounded-xl p-3 leading-relaxed">{selected.idea}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {selected.style && <div className="bg-ink-800 rounded-lg p-2"><span className="text-ink-400">Estilo: </span>{selected.style}</div>}
                {selected.placement && <div className="bg-ink-800 rounded-lg p-2"><span className="text-ink-400">Local: </span>{selected.placement}</div>}
                {selected.size && <div className="bg-ink-800 rounded-lg p-2"><span className="text-ink-400">Tamanho: </span>{selected.size}</div>}
                {selected.budget && <div className="bg-ink-800 rounded-lg p-2"><span className="text-ink-400">Orçamento: </span>{selected.budget}</div>}
                {selected.colorOrBlack && (
                  <div className="bg-ink-800 rounded-lg p-2">
                    <span className="text-ink-400">Cor: </span>
                    {selected.colorOrBlack === 'color' ? 'Colorida' : selected.colorOrBlack === 'black_grey' ? 'Preto e cinza' : 'Indefinido'}
                  </div>
                )}
                {selected.isFirstTattoo && <div className="bg-purple-500/10 rounded-lg p-2 text-purple-400">Primeira tatuagem</div>}
              </div>
            </div>

            {/* Imagens de referência */}
            {selected.referenceImages.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs text-ink-400 font-medium uppercase tracking-wider">Referências ({selected.referenceImages.length})</h3>
                <div className="grid grid-cols-3 gap-2">
                  {selected.referenceImages.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="w-full aspect-square object-cover rounded-lg hover:opacity-80 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Notas internas */}
            <div className="space-y-2">
              <h3 className="text-xs text-ink-400 font-medium uppercase tracking-wider">Notas internas</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => update.mutate({ id: selected.id, notes })}
                rows={3}
                placeholder="Anotações para o time..."
                className="input w-full resize-none text-sm"
              />
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-ink-800">
              {selected.status === 'NEW' && (
                <button
                  onClick={() => update.mutate({ id: selected.id, status: 'CONTACTED' })}
                  disabled={update.isPending}
                  className="btn-primary text-sm flex items-center gap-1.5"
                >
                  <Phone size={13} /> Marcar contatado
                </button>
              )}
              {selected.status === 'CONTACTED' && (
                <button
                  onClick={() => update.mutate({ id: selected.id, status: 'CONVERTED' })}
                  disabled={update.isPending}
                  className="bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 size={13} /> Convertido em cliente
                </button>
              )}
              {selected.status !== 'ARCHIVED' && (
                <button
                  onClick={() => update.mutate({ id: selected.id, status: 'ARCHIVED' })}
                  disabled={update.isPending}
                  className="btn-ghost text-sm flex items-center gap-1.5 text-ink-400"
                >
                  <Archive size={13} /> Arquivar
                </button>
              )}
              {update.isPending && <Loader2 size={14} className="animate-spin text-ink-400 self-center" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
