'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, AlertTriangle, Package } from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/api';
import { cn, formatCurrency } from '../../../lib/utils';

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  salePrice: number;
  costPrice: number;
  category: { name: string } | null;
  supplier: { name: string } | null;
  active: boolean;
}

export default function StorePage() {
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [addStockModal, setAddStockModal] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState(1);
  const [stockType, setStockType] = useState('PURCHASE');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, lowStockOnly],
    queryFn: () =>
      api.get('/store/products', { params: { search: search || undefined, lowStock: lowStockOnly || undefined } })
        .then((r) => r.data.data as Product[]),
  });

  const addStock = useMutation({
    mutationFn: ({ id, type, qty }: { id: string; type: string; qty: number }) =>
      api.post(`/store/products/${id}/stock`, { type, quantity: qty }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setAddStockModal(null); },
  });

  const products = data ?? [];
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={22} className="text-brand-400" />
          <div>
            <h1 className="text-2xl font-bold">Loja de Materiais</h1>
            {lowStockCount > 0 && (
              <p className="text-xs text-orange-400 flex items-center gap-1">
                <AlertTriangle size={12} /> {lowStockCount} produto{lowStockCount !== 1 ? 's' : ''} com estoque baixo
              </p>
            )}
          </div>
        </div>
        <Link href="/store/products/new" className="btn-primary flex items-center gap-2"><Plus size={16} /> Novo produto</Link>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou SKU..." className="input pl-10" />
        </div>
        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={cn('btn-outline flex items-center gap-2 px-4', lowStockOnly && 'border-orange-500/50 text-orange-400')}
        >
          <AlertTriangle size={16} /> Estoque baixo
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="card h-14 bg-ink-800" />)}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-400 border-b border-ink-800">
                <th className="text-left pb-3 font-medium">Produto</th>
                <th className="text-left pb-3 font-medium">SKU</th>
                <th className="text-left pb-3 font-medium">Categoria</th>
                <th className="text-right pb-3 font-medium">Custo</th>
                <th className="text-right pb-3 font-medium">Venda</th>
                <th className="text-right pb-3 font-medium">Estoque</th>
                <th className="text-right pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-ink-800/50 transition-colors">
                  <td className="py-3 font-medium">{p.name}</td>
                  <td className="py-3 font-mono text-xs text-ink-400">{p.sku}</td>
                  <td className="py-3 text-ink-400">{p.category?.name ?? '—'}</td>
                  <td className="py-3 text-right text-ink-400">{formatCurrency(p.costPrice)}</td>
                  <td className="py-3 text-right font-semibold">{formatCurrency(p.salePrice)}</td>
                  <td className="py-3 text-right">
                    <span className={cn('font-semibold', p.stock <= p.minStock ? 'text-orange-400' : 'text-green-400')}>
                      {p.stock}
                    </span>
                    <span className="text-ink-500 text-xs"> / min {p.minStock}</span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => { setAddStockModal(p); setStockQty(1); setStockType('PURCHASE'); }}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      Entrada
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <p className="text-center text-ink-400 py-12">Nenhum produto encontrado</p>
          )}
        </div>
      )}

      {/* Add stock modal */}
      {addStockModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm">
            <h2 className="font-semibold text-lg mb-4">Movimentação de estoque</h2>
            <p className="text-sm text-ink-400 mb-4">{addStockModal.name} · atual: <strong>{addStockModal.stock}</strong></p>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-ink-300 mb-1.5 block">Tipo</label>
                <select value={stockType} onChange={(e) => setStockType(e.target.value)} className="input">
                  <option value="PURCHASE">Compra / Entrada</option>
                  <option value="ADJUSTMENT">Ajuste</option>
                  <option value="SALE">Venda</option>
                  <option value="INTERNAL_USE">Uso interno</option>
                  <option value="LOSS">Perda</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-ink-300 mb-1.5 block">Quantidade</label>
                <input type="number" min={1} value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} className="input" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAddStockModal(null)} className="btn-ghost flex-1">Cancelar</button>
                <button
                  onClick={() => addStock.mutate({ id: addStockModal.id, type: stockType, qty: stockQty })}
                  disabled={addStock.isPending}
                  className="btn-primary flex-1"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
