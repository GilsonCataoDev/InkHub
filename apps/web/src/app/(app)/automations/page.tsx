'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Plus, Power, Trash2, Loader2, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '../../../lib/api';
import { cn } from '../../../lib/utils';

interface Automation {
  id: string;
  name: string;
  trigger: string;
  triggerLabel: string;
  delayDays: number;
  channel: string;
  template: string;
  active: boolean;
  runCount: number;
  lastRunAt: string | null;
  _count: { executions: number };
}

interface Template {
  trigger: string;
  name: string;
  channel: string;
  template: string;
  delayDays: number;
}

const TRIGGER_LABELS: Record<string, string> = {
  birthday: '🎂 Aniversário',
  post_session: '🎨 Pós-sessão',
  inactive_30: '😴 Inativo 30 dias',
  inactive_60: '😴 Inativo 60 dias',
  touchup_due: '🔄 Retoque pendente',
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: '📱 WhatsApp',
  email: '📧 E-mail',
  both: '📱📧 Ambos',
};

export default function AutomationsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    trigger: '',
    delayDays: '0',
    channel: 'whatsapp',
    template: '',
  });

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations').then((r) => r.data.data as Automation[]),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['automation-templates'],
    queryFn: () => api.get('/automations/templates').then((r) => r.data.data as Template[]),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/automations', {
        ...form,
        delayDays: +form.delayDays,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      setShowForm(false);
      setForm({ name: '', trigger: '', delayDays: '0', channel: 'whatsapp', template: '' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/automations/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });

  const applyTemplate = (t: Template) => {
    setForm({
      name: t.name,
      trigger: t.trigger,
      delayDays: String(t.delayDays),
      channel: t.channel,
      template: t.template,
    });
    setShowForm(true);
  };

  const activeCount = automations.filter((a) => a.active).length;
  const totalExecutions = automations.reduce((s, a) => s + a._count.executions, 0);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={22} className="text-brand-400" />
            <h1 className="text-2xl font-bold">Automações CRM</h1>
          </div>
          <p className="text-ink-400 text-sm">
            Configure mensagens automáticas para clientes. Roda todo dia às 08h.
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={16} /> Nova automação
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-brand-400">{automations.length}</p>
          <p className="text-xs text-ink-400">Total</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-green-400">{activeCount}</p>
          <p className="text-xs text-ink-400">Ativas</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-amber-400">{totalExecutions}</p>
          <p className="text-xs text-ink-400">Execuções</p>
        </div>
      </div>

      {/* Templates sugeridos */}
      {automations.length === 0 && !isLoading && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-sm">Templates prontos para usar</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {templates.map((t) => (
              <button
                key={t.trigger}
                onClick={() => applyTemplate(t)}
                className="text-left p-3 bg-ink-800 hover:bg-ink-700 rounded-xl transition-colors border border-ink-700 hover:border-brand-500"
              >
                <p className="font-medium text-sm mb-0.5">{t.name}</p>
                <p className="text-xs text-ink-400">{TRIGGER_LABELS[t.trigger]}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de automações */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-brand-400" size={28} />
        </div>
      ) : automations.length > 0 ? (
        <div className="space-y-3">
          {automations.map((automation) => (
            <div key={automation.id} className={cn('card border', automation.active ? 'border-ink-700' : 'border-ink-800 opacity-70')}>
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <button
                  onClick={() => toggleMutation.mutate(automation.id)}
                  className={cn(
                    'mt-0.5 w-10 h-6 rounded-full transition-colors relative flex-shrink-0',
                    automation.active ? 'bg-green-500' : 'bg-ink-700',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                      automation.active ? 'translate-x-4' : 'translate-x-0.5',
                    )}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{automation.name}</p>
                    <span className="text-xs bg-ink-800 text-ink-400 px-2 py-0.5 rounded-full">
                      {TRIGGER_LABELS[automation.trigger] ?? automation.trigger}
                    </span>
                    <span className="text-xs bg-ink-800 text-ink-400 px-2 py-0.5 rounded-full">
                      {CHANNEL_LABELS[automation.channel] ?? automation.channel}
                    </span>
                    {automation.delayDays > 0 && (
                      <span className="text-xs text-ink-500">+{automation.delayDays}d</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-ink-500">
                    <span>{automation._count.executions} execuções</span>
                    {automation.lastRunAt && (
                      <span>
                        Último: {new Date(automation.lastRunAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>

                  {/* Template expandível */}
                  <button
                    onClick={() => setExpandedId(expandedId === automation.id ? null : automation.id)}
                    className="text-xs text-ink-400 hover:text-ink-200 mt-1 flex items-center gap-1"
                  >
                    Ver mensagem
                    {expandedId === automation.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {expandedId === automation.id && (
                    <div className="mt-2 bg-ink-800 rounded-lg p-3 text-xs text-ink-300 font-mono leading-relaxed">
                      {automation.template}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { if (confirm('Remover automação?')) deleteMutation.mutate(automation.id); }}
                  className="text-ink-500 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12 text-ink-400">
          <Zap size={36} className="mx-auto text-ink-600 mb-3" />
          <p>Nenhuma automação criada ainda.</p>
          <p className="text-sm mt-1">Use os templates acima para começar rapidamente.</p>
        </div>
      )}

      {/* Formulário modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-ink-800">
              <h2 className="font-bold text-lg">Nova automação</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Templates rápidos */}
              <div>
                <p className="text-xs text-ink-400 mb-2">Templates rápidos:</p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.trigger}
                      onClick={() => applyTemplate(t)}
                      className="text-xs px-2.5 py-1 bg-ink-800 hover:bg-ink-700 rounded-lg text-ink-300 transition-colors border border-ink-700"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-ink-400 mb-1 block">Nome da automação *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Lembrete de retoque"
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">Gatilho *</label>
                  <select
                    value={form.trigger}
                    onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">Selecione</option>
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">Canal</label>
                  <select
                    value={form.channel}
                    onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="both">Ambos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-ink-400 mb-1 block">Atraso (dias após o evento)</label>
                <input
                  type="number"
                  value={form.delayDays}
                  onChange={(e) => setForm((f) => ({ ...f, delayDays: e.target.value }))}
                  min="0"
                  className="input w-full"
                />
                <p className="text-xs text-ink-500 mt-1">
                  Ex: pós-sessão com 3 dias de atraso = mensagem 3 dias após a sessão
                </p>
              </div>

              <div>
                <label className="text-xs text-ink-400 mb-1 block">Mensagem *</label>
                <textarea
                  value={form.template}
                  onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
                  rows={4}
                  placeholder="Use {nome}, {estudio}, {tatuador} como variáveis"
                  className="input w-full resize-none text-sm font-mono"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {['{nome}', '{estudio}', '{tatuador}'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, template: f.template + v }))}
                      className="text-xs bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded font-mono hover:bg-brand-500/20"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {createMutation.isError && (
                <p className="text-red-400 text-sm">Erro ao criar automação. Tente novamente.</p>
              )}

              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.name || !form.trigger || !form.template}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {createMutation.isPending ? 'Criando...' : 'Criar automação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
