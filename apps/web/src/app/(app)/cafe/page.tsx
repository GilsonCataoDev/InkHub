'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Coffee, Plus, X, CheckCircle } from 'lucide-react';
import api from '../../../lib/api';
import { cn, formatCurrency, statusColor, statusLabel } from '../../../lib/utils';

interface Table {
  id: string;
  number: number;
  capacity: number;
  status: 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED';
  orders: Array<{
    id: string;
    status: string;
    items: Array<{ id: string; quantity: number; unitPrice: number; cafeItem?: { name: string }; product?: { name: string } }>;
  }>;
}

export default function CafePage() {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['cafe-tables'],
    queryFn: () => api.get('/cafe/tables').then((r) => r.data.data as Table[]),
    refetchInterval: 15000,
  });

  const { data: menuData } = useQuery({
    queryKey: ['cafe-menu'],
    queryFn: () => api.get('/cafe/menu').then((r) => r.data.data),
  });

  const openOrder = useMutation({
    mutationFn: (tableId: string) => api.post('/cafe/orders', { tableId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cafe-tables'] }),
  });

  const addItem = useMutation({
    mutationFn: ({ orderId, cafeItemId }: { orderId: string; cafeItemId: string }) =>
      api.post(`/cafe/orders/${orderId}/items`, { cafeItemId, quantity: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cafe-tables'] }),
  });

  const closeOrder = useMutation({
    mutationFn: ({ orderId, method }: { orderId: string; method: string }) =>
      api.post(`/cafe/orders/${orderId}/close`, { paymentMethod: method }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cafe-tables'] }); setSelectedTable(null); setShowPayModal(false); },
  });

  const tables = data ?? [];
  const menu = menuData ?? [];

  const openOrderOfTable = selectedTable?.orders.find((o) => o.status === 'OPEN');
  const orderTotal = openOrderOfTable?.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coffee size={22} className="text-brand-400" />
          <h1 className="text-2xl font-bold">Cafeteria</h1>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" />Livre</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" />Ocupada</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />Conta</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tables.map((t) => {
          const color = { FREE: 'border-green-500/30 hover:border-green-500/60', OCCUPIED: 'border-red-500/30 hover:border-red-500/60', BILL_REQUESTED: 'border-orange-500/30 hover:border-orange-500/60' }[t.status];
          const openOrd = t.orders.find((o) => o.status === 'OPEN');
          const total = openOrd?.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0) ?? 0;

          return (
            <button
              key={t.id}
              onClick={() => setSelectedTable(t)}
              className={cn('card border-2 text-left hover:bg-ink-800 transition-all', color, selectedTable?.id === t.id && 'ring-2 ring-brand-500')}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg">Mesa {t.number}</span>
                <span className="text-xs text-ink-400">{t.capacity} lugares</span>
              </div>
              <span className={cn('badge', statusColor(t.status))}>{statusLabel(t.status)}</span>
              {total > 0 && <p className="text-sm font-semibold text-brand-400 mt-2">{formatCurrency(total)}</p>}
              {openOrd && <p className="text-xs text-ink-400 mt-1">{openOrd.items.length} {openOrd.items.length === 1 ? 'item' : 'itens'}</p>}
            </button>
          );
        })}
      </div>

      {/* Table detail panel */}
      {selectedTable && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Current order */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Mesa {selectedTable.number}</h2>
              <button onClick={() => setSelectedTable(null)} className="text-ink-400 hover:text-ink-100"><X size={18} /></button>
            </div>

            {!openOrderOfTable ? (
              <div className="text-center py-8">
                <p className="text-ink-400 text-sm mb-4">Nenhuma comanda aberta</p>
                <button onClick={() => openOrder.mutate(selectedTable.id)} className="btn-primary flex items-center gap-2 mx-auto">
                  <Plus size={16} /> Abrir comanda
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {openOrderOfTable.items.length === 0 ? (
                    <p className="text-ink-400 text-sm text-center py-4">Adicione itens do cardápio</p>
                  ) : (
                    openOrderOfTable.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span>{item.quantity}x {item.cafeItem?.name ?? item.product?.name}</span>
                        <span className="text-ink-400">{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-ink-800 pt-3 flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-brand-400">{formatCurrency(orderTotal)}</span>
                </div>
                <button onClick={() => setShowPayModal(true)} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Fechar conta
                </button>
              </>
            )}
          </div>

          {/* Menu */}
          {openOrderOfTable && (
            <div className="card overflow-y-auto max-h-96">
              <h3 className="font-semibold mb-3">Cardápio</h3>
              <div className="space-y-3">
                {menu.map((cat: { name: string; items: Array<{ id: string; name: string; price: number; available: boolean }> }) => (
                  <div key={cat.name}>
                    <p className="text-xs font-semibold text-ink-400 uppercase mb-1">{cat.name}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {cat.items.filter((i) => i.available).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => addItem.mutate({ orderId: openOrderOfTable.id, cafeItemId: item.id })}
                          className="text-left bg-ink-800 hover:bg-ink-700 rounded-lg p-2 transition-colors"
                        >
                          <p className="text-xs font-medium">{item.name}</p>
                          <p className="text-xs text-brand-400">{formatCurrency(item.price)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pay modal */}
      {showPayModal && openOrderOfTable && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm">
            <h2 className="font-semibold text-lg mb-1">Fechar conta</h2>
            <p className="text-ink-400 text-sm mb-4">Total: <strong className="text-brand-400">{formatCurrency(orderTotal)}</strong></p>
            <div className="grid grid-cols-2 gap-3">
              {['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH'].map((m) => (
                <button
                  key={m}
                  onClick={() => closeOrder.mutate({ orderId: openOrderOfTable.id, method: m })}
                  disabled={closeOrder.isPending}
                  className="btn-outline text-sm py-3"
                >
                  {({ PIX: 'PIX', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito', CASH: 'Dinheiro' } as Record<string, string>)[m]}
                </button>
              ))}
            </div>
            <button onClick={() => setShowPayModal(false)} className="btn-ghost w-full mt-3 text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
