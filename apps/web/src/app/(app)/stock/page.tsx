'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, AlertTriangle, TrendingDown, TrendingUp, ArrowRightLeft, DollarSign } from 'lucide-react';
import api from '../../../lib/api';
import { cn, formatCurrency, formatDateTime } from '../../../lib/utils';

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  unitCost: string | null;
  createdAt: string;
  product: { name: string; sku: string } | null;
  cafeItem: { name: string } | null;
}

interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  category: { name: string } | null;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; sign: string }> = {
  PURCHASE: { label: 'Compra', color: 'text-green-400', sign: '+' },
  SALE: { label: 'Venda', color: 'text-blue-400', sign: '-' },
  INTERNAL_USE: { label: 'Uso interno', color: 'text-orange-400', sign: '-' },
  ADJUSTMENT: { label: 'Ajuste', color: 'text-purple-400', sign: '±' },
  LOSS: { label: 'Perda', color: 'text-red-400', sign: '-' },
  RETURN: { label: 'Devolução', color: 'text-green-400', sign: '+' },
};

export default function StockPage() {
  const [tab, setTab] = useState<'movements' | 'alerts' | 'inventory'>('movements');

  const { data: movements, isLoading: movLoading } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: () =>
      api.get('/store/products').then(async (r) => {
        const products = r.data.data as { id: string }[];
        const allMovements: StockMovement[] = [];
        for (const p of products.slice(0, 5)) {
          const detail = await api.get(`/store/products/${p.id}`);
          allMovements.push(...detail.data.data.stockMovements);
        }
        return allMovements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }),
    enabled: tab === 'movements',
  });

  const { data: lowStock, isLoading: lowLoading } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () =>
      api.get('/store/products', { params: { lowStock: true } }).then((r) => r.data.data as LowStockProduct[]),
    enabled: tab === 'alerts',
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: () =>
      api.get('/store/products').then((r) => r.data.data as Array<{
        id: string; name: string; sku: string; stock: number; costPrice: number; salePrice: number;
        category: { name: string } | null;
      }>),
    enabled: tab === 'inventory',
  });

  const totalInventoryValue = inventory?.reduce((s, p) => s + p.stock * Number(p.costPrice), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Package size={22} className="text-brand-400" />
        <h1 className="text-2xl font-bold">Estoque</h1>
      </div>

      <div className="flex bg-ink-800 rounded-lg p-1 w-fit gap-1">
        {[
          { key: 'movements', label: 'Movimentações', icon: ArrowRightLeft },
          { key: 'alerts', label: 'Alertas', icon: AlertTriangle },
          { key: 'inventory', label: 'Inventário', icon: Package },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={cn('px-4 py-1.5 rounded text-sm transition-colors flex items-center gap-2', tab === t.key ? 'bg-ink-700 text-ink-100' : 'text-ink-400')}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Movements */}
      {tab === 'movements' && (
        <div className="card">
          <h3 className="font-semibold mb-4 text-sm">Últimas movimentações</h3>
          {movLoading ? (
            <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-ink-800 rounded" />)}</div>
          ) : (movements?.length ?? 0) === 0 ? (
            <p className="text-ink-400 text-sm text-center py-8">Nenhuma movimentação registrada</p>
          ) : (
            <div className="space-y-1 divide-y divide-ink-800">
              {movements?.map((m) => {
                const cfg = TYPE_CONFIG[m.type] ?? { label: m.type, color: 'text-ink-300', sign: '' };
                const itemName = m.product?.name ?? m.cafeItem?.name ?? 'Item desconhecido';
                const isPositive = ['PURCHASE', 'RETURN', 'ADJUSTMENT'].includes(m.type);
                return (
                  <div key={m.id} className="flex items-center gap-4 py-2.5 text-sm">
                    <div className={cn('flex-shrink-0', isPositive ? 'text-green-400' : 'text-red-400')}>
                      {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{itemName}</p>
                      <p className="text-xs text-ink-400">{m.reason ?? cfg.label} · {formatDateTime(m.createdAt)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn('font-semibold', cfg.color)}>{cfg.sign}{m.quantity} un</p>
                      {m.unitCost && <p className="text-xs text-ink-500">{formatCurrency(Number(m.unitCost))} /un</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Alerts */}
      {tab === 'alerts' && (
        <div className="space-y-3">
          {lowLoading ? (
            <div className="animate-pulse space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="card h-14 bg-ink-800" />)}</div>
          ) : (lowStock?.length ?? 0) === 0 ? (
            <div className="card text-center py-12">
              <Package size={32} className="text-green-400 mx-auto mb-3" />
              <p className="text-ink-300 font-medium">Estoque em dia!</p>
              <p className="text-ink-400 text-sm mt-1">Nenhum produto abaixo do estoque mínimo.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-orange-400">
                <AlertTriangle size={16} />
                <p className="text-sm font-medium">{lowStock?.length} produto(s) precisam de reposição</p>
              </div>
              {lowStock?.map((p) => (
                <div key={p.id} className="card border-orange-500/20 flex items-center gap-4">
                  <AlertTriangle size={18} className="text-orange-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-ink-400">{p.category?.name ?? '—'} · SKU: {p.sku}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-orange-400">{p.stock} un</p>
                    <p className="text-xs text-ink-400">mín: {p.minStock}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Inventory */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="card inline-flex items-center gap-3">
            <DollarSign size={18} className="text-brand-400" />
            <div>
              <p className="text-xs text-ink-400">Valor total em estoque (custo)</p>
              <p className="text-xl font-bold text-brand-400">{formatCurrency(totalInventoryValue)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink-400 border-b border-ink-800">
                  <th className="text-left pb-3 font-medium">Produto</th>
                  <th className="text-left pb-3 font-medium">Categoria</th>
                  <th className="text-right pb-3 font-medium">Estoque</th>
                  <th className="text-right pb-3 font-medium">Custo unit.</th>
                  <th className="text-right pb-3 font-medium">Valor total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {inventory?.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-800/50 transition-colors">
                    <td className="py-2.5">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-ink-500 font-mono">{p.sku}</p>
                    </td>
                    <td className="py-2.5 text-ink-400">{p.category?.name ?? '—'}</td>
                    <td className="py-2.5 text-right font-semibold">{p.stock}</td>
                    <td className="py-2.5 text-right text-ink-400">{formatCurrency(Number(p.costPrice))}</td>
                    <td className="py-2.5 text-right font-semibold">{formatCurrency(p.stock * Number(p.costPrice))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
