'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { useAuthStore } from '../../../../store/auth.store';
import {
  QrCode, WifiOff, RefreshCw,
  Eye, EyeOff, CheckCircle2, AlertCircle, Smartphone,
  Settings2, Zap,
} from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface WaConfig {
  provider?: string;
  instanceUrl?: string;
  apiKey?: string;
  phoneNumber?: string;
  active?: boolean;
  template48h?: string;
  template2h?: string;
}

interface QrSession {
  status: 'connecting' | 'qr' | 'connected' | 'disconnected';
  qrBase64?: string;
  phone?: string;
  connectedAt?: string;
}

type Tab = 'qr' | 'evolution' | 'templates';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WhatsAppSettingsPage() {
  const [tab, setTab] = useState<Tab>('qr');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conecte seu número e envie lembretes automáticos aos clientes
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: 'qr', label: 'QR Code', icon: QrCode },
          { key: 'evolution', label: 'Evolution API', icon: Settings2 },
          { key: 'templates', label: 'Templates', icon: Zap },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'qr' && <QrTab />}
      {tab === 'evolution' && <EvolutionTab />}
      {tab === 'templates' && <TemplatesTab />}
    </div>
  );
}

// ─── QR Tab ───────────────────────────────────────────────────────────────────

function QrTab() {
  const qc = useQueryClient();
  const [streaming, setStreaming] = useState(false);
  const [session, setSession] = useState<QrSession>({ status: 'disconnected' });
  const abortRef = useRef<AbortController | null>(null);

  const { data: config } = useQuery<WaConfig>({
    queryKey: ['wpp-config'],
    queryFn: () => api.get('/whatsapp/config').then(r => r.data?.data ?? r.data),
  });

  const { data: statusData } = useQuery<QrSession>({
    queryKey: ['wpp-qr-status'],
    queryFn: () => api.get('/whatsapp/qr/status').then(r => r.data?.data ?? r.data),
    refetchInterval: streaming ? false : 10_000,
  });

  useEffect(() => {
    if (statusData) setSession(statusData);
  }, [statusData]);

  const connectMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/qr/connect'),
    onSuccess: () => startStream(),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete('/whatsapp/qr/disconnect'),
    onSuccess: () => {
      setSession({ status: 'disconnected' });
      qc.invalidateQueries({ queryKey: ['wpp-config'] });
      qc.invalidateQueries({ queryKey: ['wpp-qr-status'] });
    },
  });

  function startStream() {
    if (abortRef.current) abortRef.current.abort();
    setStreaming(true);

    // VULN-003: fetch() com credentials em vez de EventSource com query params
    // Cookies httpOnly são enviados automaticamente — tokens nunca em URLs
    const { tenantId } = useAuthStore.getState();
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`${apiBase}/whatsapp/qr/stream`, {
      credentials: 'include',
      headers: {
        'X-Tenant-ID': tenantId ?? '',
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) { setStreaming(false); return; }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.replace(/^data: /, '').trim();
            if (!line) continue;
            try {
              const data: QrSession = JSON.parse(line);
              setSession(data);
              if (data.status === 'connected' || data.status === 'disconnected') {
                controller.abort();
                setStreaming(false);
                qc.invalidateQueries({ queryKey: ['wpp-config'] });
                qc.invalidateQueries({ queryKey: ['wpp-qr-status'] });
              }
            } catch { /* ignore malformed */ }
          }
        }
        setStreaming(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setStreaming(false);
      });
  }

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const isBaileys = config?.provider === 'baileys';
  const isConnected = session.status === 'connected' || (isBaileys && config?.active);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <strong className="block mb-1">📱 Conexão direta — sem taxa mensal</strong>
        Escaneie o QR Code com o WhatsApp do seu estúdio. As mensagens saem do seu próprio
        número, sem precisar de Evolution API ou serviços externos.
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        {isConnected ? (
          <ConnectedState
            phone={session.phone ?? config?.phoneNumber}
            connectedAt={session.connectedAt}
            onDisconnect={() => disconnectMutation.mutate()}
            loading={disconnectMutation.isPending}
          />
        ) : session.status === 'qr' && session.qrBase64 ? (
          <QrCodeDisplay
            qrBase64={session.qrBase64}
            onRefresh={() => connectMutation.mutate()}
          />
        ) : session.status === 'connecting' ? (
          <ConnectingState />
        ) : (
          <DisconnectedState
            onConnect={() => connectMutation.mutate()}
            loading={connectMutation.isPending}
          />
        )}
      </div>

      {!isConnected && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-3">Como conectar</h3>
          <ol className="space-y-2 text-sm text-gray-600">
            {[
              'Abra o WhatsApp no celular do estúdio',
              'Toque em "Mais opções" (⋮) → "Aparelhos conectados"',
              'Toque em "Conectar um aparelho"',
              'Escaneie o QR Code que aparece acima',
            ].map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center font-medium mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ConnectedState({ phone, connectedAt, onDisconnect, loading }: {
  phone?: string;
  connectedAt?: string;
  onDisconnect: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="text-green-600" size={24} />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-900">WhatsApp conectado</p>
        {phone && (
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
            <Smartphone size={13} />
            +{phone.replace(/\D/g, '')}
          </p>
        )}
        {connectedAt && (
          <p className="text-xs text-gray-400 mt-0.5">
            Conectado em {new Date(connectedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
      <button
        onClick={onDisconnect}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        <WifiOff size={14} />
        {loading ? 'Desconectando...' : 'Desconectar'}
      </button>
    </div>
  );
}

function QrCodeDisplay({ qrBase64, onRefresh }: { qrBase64: string; onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group cursor-pointer" onClick={onRefresh}>
        <img src={qrBase64} alt="QR Code WhatsApp" className="w-56 h-56 rounded-xl" />
        <div className="absolute inset-0 flex items-center justify-center bg-white/0 group-hover:bg-white/80 rounded-xl transition-all">
          <RefreshCw
            size={24}
            className="text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
      <p className="text-sm text-gray-500 text-center">
        Escaneie com o WhatsApp do celular do estúdio
        <br />
        <span className="text-xs text-gray-400">O QR expira em ~60s — clique para gerar novo</span>
      </p>
    </div>
  );
}

function ConnectingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
      <p className="text-sm text-gray-500">Gerando QR Code...</p>
    </div>
  );
}

function DisconnectedState({ onConnect, loading }: { onConnect: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <QrCode size={32} className="text-gray-400" />
      </div>
      <div className="text-center">
        <p className="font-medium text-gray-900">Nenhum número conectado</p>
        <p className="text-sm text-gray-400 mt-1">
          Conecte o WhatsApp do estúdio para enviar lembretes automáticos
        </p>
      </div>
      <button
        onClick={onConnect}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium text-sm"
      >
        <QrCode size={16} />
        {loading ? 'Iniciando...' : 'Gerar QR Code'}
      </button>
    </div>
  );
}

// ─── Evolution Tab ────────────────────────────────────────────────────────────

function EvolutionTab() {
  const qc = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState<WaConfig>({
    provider: 'evolution',
    instanceUrl: '',
    apiKey: '',
    phoneNumber: '',
    active: false,
  });
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<'ok' | 'err' | null>(null);

  const { data: config } = useQuery<WaConfig>({
    queryKey: ['wpp-config'],
    queryFn: () => api.get('/whatsapp/config').then(r => r.data?.data ?? r.data),
  });

  useEffect(() => {
    if (config) setForm(f => ({ ...f, ...config }));
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: WaConfig) => api.post('/whatsapp/config', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wpp-config'] }),
  });

  const testMutation = useMutation({
    mutationFn: (phone: string) => api.post('/whatsapp/test', { phone }),
    onSuccess: () => {
      setTestResult('ok');
      setTimeout(() => setTestResult(null), 3000);
    },
    onError: () => {
      setTestResult('err');
      setTimeout(() => setTestResult(null), 3000);
    },
  });

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
        <strong className="block mb-1">⚡ Evolution API (avançado)</strong>
        Requer servidor Evolution API próprio. Use a aba QR Code para uma solução mais simples.
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        <div className="flex items-center justify-between p-5">
          <div>
            <p className="font-medium text-gray-900">Ativar lembretes</p>
            <p className="text-xs text-gray-400 mt-0.5">Envia mensagens automáticas aos clientes</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, active: !f.active }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-green-500' : 'bg-gray-200'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field
            label="URL da instância"
            value={form.instanceUrl ?? ''}
            onChange={v => setForm(f => ({ ...f, instanceUrl: v }))}
            placeholder="https://evolution.meusite.com"
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey ?? ''}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••••••••••"
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <Field
            label="Número conectado"
            value={form.phoneNumber ?? ''}
            onChange={v => setForm(f => ({ ...f, phoneNumber: v }))}
            placeholder="5511999999999"
          />
        </div>

        <div className="p-5 flex justify-end">
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-medium text-gray-900">Testar envio</h3>
        <div className="flex gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="5511999999999"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => testMutation.mutate(testPhone)}
            disabled={!testPhone || testMutation.isPending}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
          >
            {testMutation.isPending ? 'Enviando...' : 'Enviar teste'}
          </button>
        </div>
        {testResult === 'ok' && (
          <p className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 size={14} /> Mensagem enviada!
          </p>
        )}
        {testResult === 'err' && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle size={14} /> Erro ao enviar. Verifique as configurações.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

const DEFAULT_48H =
  `Olá {nome}! 👋\n\nLembrando que você tem uma sessão amanhã às {hora} com {tatuador} no {estudio}.\n\nResponda SIM para confirmar ou NÃO para cancelar.\n\nAté lá! 🎨`;
const DEFAULT_2H =
  `Oi {nome}! ⏰\n\nSua sessão começa em 2 horas (às {hora}) no {estudio}.\n\nNos vemos logo!`;

function TemplatesTab() {
  const qc = useQueryClient();
  const [t48h, setT48h] = useState(DEFAULT_48H);
  const [t2h, setT2h] = useState(DEFAULT_2H);

  const { data: config } = useQuery<WaConfig>({
    queryKey: ['wpp-config'],
    queryFn: () => api.get('/whatsapp/config').then(r => r.data?.data ?? r.data),
  });

  useEffect(() => {
    if (config?.template48h) setT48h(config.template48h);
    if (config?.template2h) setT2h(config.template2h);
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<WaConfig>) => api.post('/whatsapp/config', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wpp-config'] }),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Variáveis disponíveis</p>
        <div className="flex flex-wrap gap-2">
          {['{nome}', '{hora}', '{estudio}', '{tatuador}'].map(v => (
            <span key={v} className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">
              {v}
            </span>
          ))}
        </div>
      </div>

      <TemplateField
        label="Lembrete 48h antes"
        value={t48h}
        onChange={setT48h}
        hint="Enviado às 9h do dia anterior ao agendamento"
      />

      <TemplateField
        label="Lembrete 2h antes"
        value={t2h}
        onChange={setT2h}
        hint="Enviado em janelas de 30 min"
      />

      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate({ template48h: t48h, template2h: t2h })}
          disabled={saveMutation.isPending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Salvando...' : 'Salvar templates'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function TemplateField({ label, value, onChange, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-0.5">{label}</label>
      <p className="text-xs text-gray-400 mb-1">{hint}</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={5}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
