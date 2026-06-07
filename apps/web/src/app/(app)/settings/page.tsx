'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, Plus, Shield, Loader2, Check, X } from 'lucide-react';
import api from '../../../lib/api';
import { cn, getInitials, formatDate } from '../../../lib/utils';
import { useToast } from '../../../hooks/useToast';
import { useAuthStore } from '../../../store/auth.store';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Gerente',
  TATTOO_ARTIST: 'Tatuador',
  RECEPTIONIST: 'Recepcionista',
  BARISTA: 'Barista',
  STOCK_KEEPER: 'Estoquista',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/20 text-red-400',
  MANAGER: 'bg-orange-500/20 text-orange-400',
  TATTOO_ARTIST: 'bg-purple-500/20 text-purple-400',
  RECEPTIONIST: 'bg-blue-500/20 text-blue-400',
  BARISTA: 'bg-amber-500/20 text-amber-400',
  STOCK_KEEPER: 'bg-green-500/20 text-green-400',
};

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  plan: { name: string; type: string; maxUsers: number; maxClients: number };
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'studio' | 'team'>('studio');
  const [showNewUser, setShowNewUser] = useState(false);

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get('/tenants/me').then((r) => r.data.data as TenantSettings),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.data as User[]),
    enabled: tab === 'team',
  });

  const [studioForm, setStudioForm] = useState({ name: '', primaryColor: '' });

  const updateStudio = useMutation({
    mutationFn: (data: { name?: string; primaryColor?: string }) =>
      api.put('/tenants/me', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast.success('Configurações salvas!');
    },
  });

  const toggleUser = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/users/${id}/${active ? 'activate' : 'deactivate'}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado');
    },
  });

  const createUser = useMutation({
    mutationFn: (data: { name: string; email: string; password: string; role: string }) =>
      api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowNewUser(false);
      toast.success('Usuário criado com sucesso');
    },
    onError: () => toast.error('Erro ao criar usuário. E-mail pode já estar em uso.'),
  });

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Settings size={22} className="text-brand-400" />
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      <div className="flex bg-ink-800 rounded-lg p-1 w-fit gap-1">
        <button onClick={() => setTab('studio')} className={cn('px-4 py-1.5 rounded text-sm transition-colors flex items-center gap-2', tab === 'studio' ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}>
          <Settings size={14} /> Estúdio
        </button>
        <button onClick={() => setTab('team')} className={cn('px-4 py-1.5 rounded text-sm transition-colors flex items-center gap-2', tab === 'team' ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}>
          <Users size={14} /> Equipe
        </button>
      </div>

      {/* Studio tab */}
      {tab === 'studio' && tenantData && (
        <div className="space-y-4">
          {/* Plan badge */}
          <div className="card flex items-center gap-4">
            <Shield size={20} className="text-brand-400 flex-shrink-0" />
            <div>
              <p className="font-semibold">{tenantData.plan.name}</p>
              <p className="text-xs text-ink-400">
                Até {tenantData.plan.maxUsers} usuários · {tenantData.plan.maxClients >= 9999 ? 'Clientes ilimitados' : `${tenantData.plan.maxClients} clientes`}
              </p>
            </div>
            <span className="ml-auto badge bg-brand-500/20 text-brand-400">{tenantData.plan.type}</span>
          </div>

          <div className="card space-y-4">
            <h3 className="font-semibold">Dados do estúdio</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-ink-400 mb-1.5 block">Nome do estúdio</label>
                <input
                  defaultValue={tenantData.name}
                  onChange={(e) => setStudioForm((f) => ({ ...f, name: e.target.value }))}
                  className="input"
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="text-xs text-ink-400 mb-1.5 block">Subdomínio</label>
                <div className="flex items-center">
                  <input value={tenantData.slug} className="input rounded-r-none border-r-0 flex-1 bg-ink-700 text-ink-400 cursor-not-allowed" readOnly />
                  <span className="bg-ink-700 border border-ink-700 px-3 py-2 text-xs text-ink-500 rounded-r-lg">.inkhub.app</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-ink-400 mb-1.5 block">Cor primária</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    defaultValue={tenantData.primaryColor}
                    onChange={(e) => setStudioForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    className="w-12 h-10 rounded-lg border border-ink-700 bg-ink-800 cursor-pointer"
                    disabled={!isAdmin}
                  />
                  <span className="text-sm text-ink-400 font-mono">{studioForm.primaryColor || tenantData.primaryColor}</span>
                </div>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => updateStudio.mutate(studioForm)}
                disabled={updateStudio.isPending || (!studioForm.name && !studioForm.primaryColor)}
                className="btn-primary flex items-center gap-2"
              >
                {updateStudio.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Salvar configurações
              </button>
            )}
          </div>
        </div>
      )}

      {/* Team tab */}
      {tab === 'team' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <button onClick={() => setShowNewUser(!showNewUser)} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Novo usuário
              </button>
            </div>
          )}

          {showNewUser && (
            <NewUserForm
              onSubmit={(d) => createUser.mutate(d)}
              onCancel={() => setShowNewUser(false)}
              isLoading={createUser.isPending}
            />
          )}

          <div className="space-y-2">
            {(usersData ?? []).map((u) => (
              <div key={u.id} className={cn('card flex items-center gap-4', !u.active && 'opacity-50')}>
                <div className="w-10 h-10 bg-brand-500/10 rounded-full flex items-center justify-center text-brand-400 font-bold text-sm flex-shrink-0">
                  {getInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{u.name}</p>
                    <span className={cn('badge text-xs', ROLE_COLORS[u.role])}>{ROLE_LABELS[u.role] ?? u.role}</span>
                    {!u.active && <span className="badge bg-ink-700 text-ink-400 text-xs">Inativo</span>}
                  </div>
                  <p className="text-xs text-ink-400">{u.email}</p>
                  {u.lastLoginAt && <p className="text-xs text-ink-500">Último acesso: {formatDate(u.lastLoginAt)}</p>}
                </div>
                {isAdmin && u.id !== user?.id && (
                  <button
                    onClick={() => toggleUser.mutate({ id: u.id, active: !u.active })}
                    disabled={toggleUser.isPending}
                    className={cn('flex-shrink-0 px-3 py-1.5 rounded-lg text-xs border transition-colors', u.active ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10')}
                  >
                    {u.active ? 'Desativar' : 'Reativar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewUserForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (d: { name: string; email: string; password: string; role: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'RECEPTIONIST' });

  return (
    <div className="card border-brand-500/30 space-y-4">
      <h3 className="font-semibold text-sm">Novo usuário</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink-400 mb-1 block">Nome</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input text-sm" placeholder="Nome completo" />
        </div>
        <div>
          <label className="text-xs text-ink-400 mb-1 block">E-mail</label>
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input text-sm" type="email" placeholder="email@studio.com" />
        </div>
        <div>
          <label className="text-xs text-ink-400 mb-1 block">Senha temporária</label>
          <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="input text-sm" type="password" placeholder="Mínimo 8 caracteres" />
        </div>
        <div>
          <label className="text-xs text-ink-400 mb-1 block">Perfil</label>
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="input text-sm">
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'ADMIN').map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-ghost flex items-center gap-1.5 text-sm"><X size={14} /> Cancelar</button>
        <button
          onClick={() => form.name && form.email && form.password.length >= 8 && onSubmit(form)}
          disabled={isLoading || !form.name || !form.email || form.password.length < 8}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Criar usuário
        </button>
      </div>
    </div>
  );
}
