'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Clock, User, Palette, DollarSign,
  CheckCircle2, Loader2, CreditCard, Banknote, QrCode, X,
  Package, Plus, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../../../lib/api';
import { cn, formatCurrency, statusColor, statusLabel } from '../../../../lib/utils';
import Link from 'next/link';

const PAYMENT_METHODS = [
  { value: 'PIX', label: 'Pix', icon: QrCode },
  { value: 'CREDIT_CARD', label: 'Crédito', icon: CreditCard },
  { value: 'DEBIT_CARD', label: 'Débito', icon: CreditCard },
  { value: 'CASH', label: 'Dinheiro', icon: Banknote },
];

interface CheckoutForm {
  grossAmount: string;
  discount: string;
  tip: string;
  paymentMethod: string;
  notes: string;
  touchUpDate: string;
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showCheckout, setShowCheckout] = useState(false);
  const [productsUsed, setProductsUsed] = useState<{ productId: string; name: string; qty: number }[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [form, setForm] = useState<CheckoutForm>({
    grossAmount: '',
    discount: '0',
    tip: '0',
    paymentMethod: 'PIX',
    notes: '',
    touchUpDate: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.get(`/appointments/${id}`).then((r) => r.data.data),
  });

  const { data: checkoutData } = useQuery({
    queryKey: ['appointment-checkout', id],
    queryFn: () =>
      api.get(`/appointments/${id}/checkout`).then((r) => r.data.data).catch(() => null),
    enabled: !!data,
  });

  const { data: storeProducts } = useQuery<{ id: string; name: string; sku: string; stock: number }[]>({
    queryKey: ['store-products-simple'],
    queryFn: () => api.get('/store/products?limit=200').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    enabled: showCheckout,
  });

  const { data: preview } = useQuery({
    queryKey: ['checkout-preview', id, form.grossAmount, form.discount, form.tip],
    queryFn: () =>
      api
        .post(`/appointments/${id}/checkout-preview`, {
          grossAmount: +form.grossAmount,
          discount: +form.discount,
          tip: +form.tip,
          paymentMethod: form.paymentMethod,
        })
        .then((r) => r.data.data),
    enabled: showCheckout && !!form.grossAmount && +form.grossAmount > 0,
  });

  const doCheckout = useMutation({
    mutationFn: () =>
      api.post(`/appointments/${id}/checkout`, {
        grossAmount: +form.grossAmount,
        discount: +form.discount,
        tip: +form.tip,
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
        touchUpDate: form.touchUpDate || undefined,
        productsUsed: productsUsed.length
          ? productsUsed.map(({ productId, qty }) => ({ productId, qty }))
          : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment', id] });
      qc.invalidateQueries({ queryKey: ['appointment-checkout', id] });
      qc.invalidateQueries({ queryKey: ['appointments-week'] });
      setShowCheckout(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-400" size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-ink-400">
        <p>Agendamento não encontrado.</p>
        <Link href="/appointments" className="text-brand-400 text-sm mt-2 block">
          ← Voltar
        </Link>
      </div>
    );
  }

  const apt = data;
  const isCompleted = apt.status === 'COMPLETED';
  const isCancelled = apt.status === 'CANCELLED';

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Agendamento</h1>
          <p className="text-ink-400 text-sm">
            {format(new Date(apt.date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <span className={cn('ml-auto badge', statusColor(apt.status))}>{statusLabel(apt.status)}</span>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-400 text-xs uppercase tracking-wider">Detalhes</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-ink-300">
            <User size={14} className="text-ink-500 flex-shrink-0" />
            <span className="text-ink-400">Cliente:</span>
            <span className="font-medium">{apt.client?.name}</span>
          </div>
          <div className="flex items-center gap-2 text-ink-300">
            <Palette size={14} className="text-ink-500 flex-shrink-0" />
            <span className="text-ink-400">Tatuador:</span>
            <span className="font-medium">{apt.artist?.user?.name}</span>
          </div>
          <div className="flex items-center gap-2 text-ink-300">
            <Clock size={14} className="text-ink-500 flex-shrink-0" />
            <span className="text-ink-400">Duração:</span>
            <span>{apt.durationMinutes} min</span>
          </div>
          {apt.estimatedValue && (
            <div className="flex items-center gap-2 text-ink-300">
              <DollarSign size={14} className="text-ink-500 flex-shrink-0" />
              <span className="text-ink-400">Estimado:</span>
              <span>{formatCurrency(apt.estimatedValue)}</span>
            </div>
          )}
          {apt.bodyPart && (
            <div className="text-ink-300 sm:col-span-2">
              <span className="text-ink-400">Local do corpo: </span>{apt.bodyPart}
            </div>
          )}
          {apt.description && (
            <div className="sm:col-span-2 bg-ink-800 rounded-xl p-3 text-ink-300 text-xs leading-relaxed">
              {apt.description}
            </div>
          )}
        </div>
      </div>

      {/* Checkout realizado */}
      {checkoutData && (
        <div className="card border-green-500/30 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-400" />
            <h2 className="font-semibold text-green-400 text-xs uppercase tracking-wider">
              Sessão finalizada
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-ink-800 rounded-xl p-3">
              <p className="text-xs text-ink-400 mb-1">Valor final</p>
              <p className="font-bold text-lg">{formatCurrency(checkoutData.finalAmount)}</p>
            </div>
            <div className="bg-ink-800 rounded-xl p-3">
              <p className="text-xs text-ink-400 mb-1">Comissão</p>
              <p className="font-bold text-amber-400">{formatCurrency(checkoutData.commissionAmount)}</p>
            </div>
            <div className="bg-ink-800 rounded-xl p-3">
              <p className="text-xs text-ink-400 mb-1">Pontos</p>
              <p className="font-bold text-purple-400">+{checkoutData.pointsAwarded} pts</p>
            </div>
            {Number(checkoutData.discount) > 0 && (
              <div className="bg-ink-800 rounded-xl p-3">
                <p className="text-xs text-ink-400 mb-1">Desconto</p>
                <p className="text-red-400">-{formatCurrency(checkoutData.discount)}</p>
              </div>
            )}
            {Number(checkoutData.tip) > 0 && (
              <div className="bg-ink-800 rounded-xl p-3">
                <p className="text-xs text-ink-400 mb-1">Gorjeta</p>
                <p className="text-green-400">+{formatCurrency(checkoutData.tip)}</p>
              </div>
            )}
            <div className="bg-ink-800 rounded-xl p-3">
              <p className="text-xs text-ink-400 mb-1">Pagamento</p>
              <p className="capitalize text-sm">
                {checkoutData.paymentMethod?.toLowerCase().replace('_', ' ')}
              </p>
            </div>
          </div>
          {checkoutData.touchUpDate && (
            <p className="text-xs text-ink-400">
              📅 Retoque agendado para{' '}
              {format(new Date(checkoutData.touchUpDate), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          )}
        </div>
      )}

      {/* Botão finalizar sessão */}
      {!isCompleted && !isCancelled && !checkoutData && (
        <button
          onClick={() => {
            setForm((f) => ({ ...f, grossAmount: apt.estimatedValue?.toString() ?? '' }));
            setShowCheckout(true);
          }}
          className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-base font-semibold"
        >
          <CheckCircle2 size={18} /> Finalizar sessão
        </button>
      )}

      {/* Modal checkout */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-ink-800">
              <h2 className="font-bold text-lg">Finalizar sessão</h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-ink-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="text-xs text-ink-400 mb-1 block">Valor da sessão (R$) *</label>
                <input
                  type="number"
                  value={form.grossAmount}
                  onChange={(e) => setForm((f) => ({ ...f, grossAmount: e.target.value }))}
                  placeholder="Ex: 450"
                  className="input w-full text-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">Desconto (R$)</label>
                  <input
                    type="number"
                    value={form.discount}
                    onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">Gorjeta (R$)</label>
                  <input
                    type="number"
                    value={form.tip}
                    onChange={(e) => setForm((f) => ({ ...f, tip: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-ink-400 mb-2 block">Forma de pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, paymentMethod: value }))}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all',
                        form.paymentMethod === value
                          ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                          : 'border-ink-700 bg-ink-800 text-ink-400 hover:border-ink-500',
                      )}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-ink-400 mb-1 block">Agendar retoque (opcional)</label>
                <input
                  type="date"
                  value={form.touchUpDate}
                  onChange={(e) => setForm((f) => ({ ...f, touchUpDate: e.target.value }))}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="text-xs text-ink-400 mb-1 block">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Anotações sobre a sessão..."
                  className="input w-full resize-none text-sm"
                />
              </div>

              {/* Produtos consumidos na sessão */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowProducts((v) => !v)}
                  className="flex items-center gap-2 text-xs text-ink-400 hover:text-ink-200 transition-colors"
                >
                  <Package size={13} />
                  Produtos consumidos na sessão
                  {productsUsed.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-brand-500/20 text-brand-400 rounded text-[10px]">
                      {productsUsed.length}
                    </span>
                  )}
                </button>

                {showProducts && (
                  <div className="mt-2 space-y-2">
                    {productsUsed.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 bg-ink-800 rounded-lg px-3 py-2">
                        <span className="flex-1 text-sm truncate">{p.name}</span>
                        <input
                          type="number"
                          min={1}
                          value={p.qty}
                          onChange={(e) => setProductsUsed((prev) =>
                            prev.map((x, j) => j === i ? { ...x, qty: +e.target.value || 1 } : x)
                          )}
                          className="w-14 text-center bg-ink-700 border border-ink-600 rounded px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-ink-500">un</span>
                        <button
                          onClick={() => setProductsUsed((prev) => prev.filter((_, j) => j !== i))}
                          className="text-ink-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {(storeProducts?.length ?? 0) > 0 && (
                      <select
                        className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-ink-300"
                        value=""
                        onChange={(e) => {
                          const prod = storeProducts?.find((p) => p.id === e.target.value);
                          if (!prod) return;
                          const exists = productsUsed.find((x) => x.productId === prod.id);
                          if (exists) return;
                          setProductsUsed((prev) => [...prev, { productId: prod.id, name: prod.name, qty: 1 }]);
                        }}
                      >
                        <option value="">+ Adicionar produto...</option>
                        {storeProducts?.map((p) => (
                          <option key={p.id} value={p.id} disabled={productsUsed.some((x) => x.productId === p.id)}>
                            {p.name} (estoque: {p.stock})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {preview && (
                <div className="bg-ink-800 rounded-xl p-4 space-y-2 text-sm border border-ink-700">
                  <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider mb-3">
                    Resumo
                  </p>
                  <div className="flex justify-between">
                    <span className="text-ink-400">Valor bruto</span>
                    <span>{formatCurrency(preview.grossAmount)}</span>
                  </div>
                  {preview.discount > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>Desconto</span>
                      <span>-{formatCurrency(preview.discount)}</span>
                    </div>
                  )}
                  {preview.tip > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Gorjeta</span>
                      <span>+{formatCurrency(preview.tip)}</span>
                    </div>
                  )}
                  {preview.depositDeducted > 0 && (
                    <div className="flex justify-between text-blue-400">
                      <span>Sinal já pago</span>
                      <span>-{formatCurrency(preview.depositDeducted)}</span>
                    </div>
                  )}
                  <div className="border-t border-ink-600 pt-2 flex justify-between font-bold text-base">
                    <span>A receber agora</span>
                    <span className="text-brand-400">{formatCurrency(preview.amountDue)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-ink-400 pt-1">
                    <span>
                      Comissão {apt.artist?.user?.name?.split(' ')[0]} (
                      {(preview.commissionRate * 100).toFixed(0)}%)
                    </span>
                    <span className="text-amber-400">{formatCurrency(preview.commissionAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-ink-400">
                    <span>Pontos p/ {apt.client?.name?.split(' ')[0]}</span>
                    <span className="text-purple-400">+{preview.pointsAwarded} pts</span>
                  </div>
                </div>
              )}

              {doCheckout.isError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {(doCheckout.error as any)?.response?.data?.message ?? 'Erro ao finalizar sessão'}
                </p>
              )}

              <button
                onClick={() => doCheckout.mutate()}
                disabled={doCheckout.isPending || !form.grossAmount || +form.grossAmount <= 0}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2 text-base font-semibold disabled:opacity-50"
              >
                {doCheckout.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {doCheckout.isPending ? 'Finalizando...' : 'Confirmar e finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
