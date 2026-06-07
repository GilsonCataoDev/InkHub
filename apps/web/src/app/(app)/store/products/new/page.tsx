'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '../../../../../lib/api';
import { useToast } from '../../../../../hooks/useToast';

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  sku: z.string().min(1, 'SKU obrigatório'),
  costPrice: z.number().min(0, 'Valor inválido'),
  salePrice: z.number().min(0, 'Valor inválido'),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().default('un'),
  minStock: z.number().min(0).default(5),
});

type FormData = z.infer<typeof schema>;

export default function NewProductPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/store/categories').then((r) => r.data.data as { id: string; name: string }[]),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/store/suppliers').then((r) => r.data.data as { id: string; name: string }[]),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { unit: 'un', minStock: 5 },
  });

  const create = useMutation({
    mutationFn: (data: FormData) => api.post('/store/products', {
      ...data,
      categoryId: data.categoryId || undefined,
      supplierId: data.supplierId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto criado!');
      router.push('/store');
    },
    onError: () => toast.error('SKU já cadastrado ou dados inválidos'),
  });

  const UNITS = ['un', 'cx', 'kg', 'g', 'ml', 'L', 'pct', 'par'];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/store" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold">Novo produto</h1>
      </div>

      <form onSubmit={handleSubmit((d) => create.mutate(d))} className="card space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm text-ink-300 mb-1.5 block">Nome do produto *</label>
            <input {...register('name')} placeholder="Ex: Tinta Preta 30ml" className="input" />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">SKU *</label>
            <input {...register('sku')} placeholder="Ex: TIN-001" className="input font-mono" />
            {errors.sku && <p className="text-red-400 text-xs mt-1">{errors.sku.message}</p>}
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Unidade</label>
            <select {...register('unit')} className="input">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Preço de custo (R$) *</label>
            <input {...register('costPrice', { valueAsNumber: true })} type="number" min={0} step={0.01} placeholder="0,00" className="input" />
            {errors.costPrice && <p className="text-red-400 text-xs mt-1">{errors.costPrice.message}</p>}
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Preço de venda (R$) *</label>
            <input {...register('salePrice', { valueAsNumber: true })} type="number" min={0} step={0.01} placeholder="0,00" className="input" />
            {errors.salePrice && <p className="text-red-400 text-xs mt-1">{errors.salePrice.message}</p>}
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Estoque mínimo</label>
            <input {...register('minStock', { valueAsNumber: true })} type="number" min={0} className="input" />
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Categoria</label>
            <select {...register('categoryId')} className="input">
              <option value="">Sem categoria</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm text-ink-300 mb-1.5 block">Fornecedor</label>
            <select {...register('supplierId')} className="input">
              <option value="">Sem fornecedor</option>
              {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm text-ink-300 mb-1.5 block">Descrição</label>
            <textarea {...register('description')} rows={2} className="input resize-none" placeholder="Descrição opcional do produto..." />
          </div>
        </div>

        {create.isError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
            Erro ao criar produto. SKU pode já estar em uso.
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link href="/store" className="btn-ghost flex-1 text-center">Cancelar</Link>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {create.isPending && <Loader2 size={16} className="animate-spin" />}
            {create.isPending ? 'Salvando...' : 'Criar produto'}
          </button>
        </div>
      </form>
    </div>
  );
}
