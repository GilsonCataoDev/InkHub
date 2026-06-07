'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '../../../../lib/api';

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewClientPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/clients', {
        ...data,
        email: data.email || undefined,
        birthDate: data.birthDate || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      router.push(`/clients/${res.data.data.id}`);
    },
  });

  const onSubmit = (data: FormData) => create.mutate(data);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/clients" className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold">Novo cliente</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm text-ink-300 mb-1.5 block">Nome completo *</label>
            <input {...register('name')} placeholder="Ex: Ana Paula Silva" className="input" />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">E-mail</label>
            <input {...register('email')} type="email" placeholder="ana@email.com" className="input" />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Telefone / WhatsApp</label>
            <input {...register('phone')} placeholder="(11) 99999-9999" className="input" />
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">CPF</label>
            <input {...register('cpf')} placeholder="000.000.000-00" className="input" />
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Data de nascimento</label>
            <input {...register('birthDate')} type="date" className="input" />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm text-ink-300 mb-1.5 block">Observações</label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Preferências, alergias, observações importantes..."
              className="input resize-none"
            />
          </div>
        </div>

        {create.isError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
            Erro ao criar cliente. Verifique os dados e tente novamente.
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link href="/clients" className="btn-ghost flex-1 text-center">Cancelar</Link>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {create.isPending && <Loader2 size={16} className="animate-spin" />}
            {create.isPending ? 'Salvando...' : 'Criar cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
