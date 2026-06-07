'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import Link from 'next/link';
import api from '../../../../lib/api';
import { useToast } from '../../../../hooks/useToast';

const schema = z.object({
  userId: z.string().min(1, 'Selecione um usuário'),
  bio: z.string().optional(),
  portfolioUrl: z.string().url('URL inválida').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function NewArtistPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specInput, setSpecInput] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users-for-artist'],
    queryFn: () => api.get('/users').then((r) =>
      (r.data.data as { id: string; name: string; role: string; tattooArtist: null | object }[])
        .filter((u) => u.role === 'TATTOO_ARTIST' && !u.tattooArtist),
    ),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/tattoo-artists', { ...data, specialties, portfolioUrl: data.portfolioUrl || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tattoo-artists'] });
      toast.success('Tatuador cadastrado!');
      router.push(`/tattoo-artists/${res.data.data.id}`);
    },
    onError: () => toast.error('Erro ao cadastrar tatuador'),
  });

  const addSpecialty = () => {
    const s = specInput.trim();
    if (s && !specialties.includes(s)) {
      setSpecialties([...specialties, s]);
      setSpecInput('');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/tattoo-artists" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold">Cadastrar tatuador</h1>
      </div>

      <form onSubmit={handleSubmit((d) => create.mutate(d))} className="card space-y-5">
        <div>
          <label className="text-sm text-ink-300 mb-1.5 block">Usuário *</label>
          <select {...register('userId')} className="input">
            <option value="">Selecione um usuário com role Tatuador</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {errors.userId && <p className="text-red-400 text-xs mt-1">{errors.userId.message}</p>}
          {(users ?? []).length === 0 && (
            <p className="text-xs text-ink-400 mt-1">
              Nenhum usuário disponível. Crie um usuário com role <strong>TATTOO_ARTIST</strong> em{' '}
              <Link href="/settings" className="text-brand-400 underline">Configurações</Link> primeiro.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm text-ink-300 mb-1.5 block">Bio</label>
          <textarea {...register('bio')} rows={3} className="input resize-none" placeholder="Apresentação do tatuador, estilo, experiência..." />
        </div>

        <div>
          <label className="text-sm text-ink-300 mb-1.5 block">URL do portfólio</label>
          <input {...register('portfolioUrl')} placeholder="https://instagram.com/..." className="input" />
          {errors.portfolioUrl && <p className="text-red-400 text-xs mt-1">{errors.portfolioUrl.message}</p>}
        </div>

        <div>
          <label className="text-sm text-ink-300 mb-1.5 block">Especialidades</label>
          <div className="flex gap-2 mb-2">
            <input
              value={specInput}
              onChange={(e) => setSpecInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
              placeholder="Ex: Blackwork, Realismo..."
              className="input flex-1"
            />
            <button type="button" onClick={addSpecialty} className="btn-outline px-3">
              <Plus size={16} />
            </button>
          </div>
          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <span key={s} className="flex items-center gap-1.5 bg-ink-800 text-ink-200 px-3 py-1 rounded-full text-sm">
                  {s}
                  <button type="button" onClick={() => setSpecialties(specialties.filter((x) => x !== s))}>
                    <X size={12} className="text-ink-400 hover:text-ink-100" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/tattoo-artists" className="btn-ghost flex-1 text-center">Cancelar</Link>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {create.isPending && <Loader2 size={16} className="animate-spin" />}
            {create.isPending ? 'Cadastrando...' : 'Cadastrar tatuador'}
          </button>
        </div>
      </form>
    </div>
  );
}
