'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, ChevronRight, Star, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/api';
import { cn, getInitials, formatDate } from '../../../lib/utils';

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  loyaltyPoints: { points: number } | null;
  _count: { appointments: number };
}

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, page],
    queryFn: () =>
      api.get('/clients', { params: { search: search || undefined, page, limit: 20 } }).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });

  const clients: Client[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const pages: number = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-ink-400 text-sm">{total} clientes cadastrados</p>
        </div>
        <Link href="/clients/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo cliente
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nome, e-mail, telefone ou CPF..."
          className="input pl-10"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="card h-16 bg-ink-800 animate-pulse" />)}
        </div>
      ) : clients.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-ink-400">Nenhum cliente encontrado</p>
          <Link href="/clients/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={16} /> Cadastrar primeiro cliente
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="card hover:border-ink-700 transition-colors flex items-center gap-4 group"
            >
              <div className="w-10 h-10 bg-brand-500/10 rounded-full flex items-center justify-center text-brand-400 font-bold text-sm flex-shrink-0">
                {getInitials(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.name}</p>
                <div className="flex items-center gap-3 text-xs text-ink-400 mt-0.5">
                  {c.email && <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone size={11} />{c.phone}</span>}
                  {c.birthDate && <span>Nasc. {formatDate(c.birthDate)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-ink-400 flex-shrink-0">
                <span>{c._count.appointments} sessões</span>
                {c.loyaltyPoints && (
                  <span className="flex items-center gap-1 text-brand-400">
                    <Star size={14} fill="currentColor" />
                    {c.loyaltyPoints.points} pts
                  </span>
                )}
                <ChevronRight size={16} className="group-hover:text-ink-100 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-ink-400">{page} / {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="btn-outline px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
