'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import api from '../../../../lib/api';

const schema = z.object({
  clientId: z.string().min(1, 'Selecione um cliente'),
  artistId: z.string().min(1, 'Selecione um tatuador'),
  date: z.string().min(1, 'Data obrigatória'),
  time: z.string().min(1, 'Horário obrigatório'),
  durationMinutes: z.number().min(15).default(60),
  estimatedValue: z.number().optional(),
  deposit: z.number().optional(),
  description: z.string().optional(),
  bodyPart: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillClientId = searchParams.get('clientId') ?? '';
  const qc = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients', { params: { limit: 200 } }).then((r) => r.data.data.data as { id: string; name: string }[]),
  });

  const { data: artists } = useQuery({
    queryKey: ['artists-list'],
    queryFn: () => api.get('/tattoo-artists').then((r) => r.data.data as { id: string; user: { name: string } }[]),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { clientId: prefillClientId, durationMinutes: 60 },
  });

  const create = useMutation({
    mutationFn: (data: FormData) => {
      const { time, ...rest } = data;
      const date = new Date(`${rest.date}T${time}:00`).toISOString();
      return api.post('/appointments', { ...rest, date });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['appointments-week'] });
      qc.invalidateQueries({ queryKey: ['appointments-list'] });
      router.push(`/appointments/${res.data.data.id}`);
    },
  });

  const BODY_PARTS = ['braço', 'antebraço', 'perna', 'coxa', 'costas', 'peito', 'pescoço', 'tornozelo', 'pé', 'mão', 'costela', 'pescoço', 'cabeça'];
  const DURATIONS = [30, 60, 90, 120, 150, 180, 240, 300, 360];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/appointments" className="btn-ghost p-2"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold">Novo agendamento</h1>
      </div>

      <form onSubmit={handleSubmit((d) => create.mutate(d))} className="card space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Client */}
          <div className="sm:col-span-2">
            <label className="text-sm text-ink-300 mb-1.5 block">Cliente *</label>
            <select {...register('clientId')} className="input">
              <option value="">Selecione um cliente</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.clientId && <p className="text-red-400 text-xs mt-1">{errors.clientId.message}</p>}
          </div>

          {/* Artist */}
          <div className="sm:col-span-2">
            <label className="text-sm text-ink-300 mb-1.5 block">Tatuador *</label>
            <select {...register('artistId')} className="input">
              <option value="">Selecione um tatuador</option>
              {artists?.map((a) => (
                <option key={a.id} value={a.id}>{a.user.name}</option>
              ))}
            </select>
            {errors.artistId && <p className="text-red-400 text-xs mt-1">{errors.artistId.message}</p>}
          </div>

          {/* Date & time */}
          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Data *</label>
            <input {...register('date')} type="date" className="input" />
            {errors.date && <p className="text-red-400 text-xs mt-1">{errors.date.message}</p>}
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Horário *</label>
            <input {...register('time')} type="time" className="input" />
            {errors.time && <p className="text-red-400 text-xs mt-1">{errors.time.message}</p>}
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Duração estimada</label>
            <select {...register('durationMinutes', { valueAsNumber: true })} className="input">
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60}h${d % 60 ? ` ${d % 60}min` : ''}`}</option>
              ))}
            </select>
          </div>

          {/* Body part */}
          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Parte do corpo</label>
            <select {...register('bodyPart')} className="input">
              <option value="">Selecione</option>
              {BODY_PARTS.map((b) => (
                <option key={b} value={b} className="capitalize">{b}</option>
              ))}
            </select>
          </div>

          {/* Values */}
          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Valor estimado (R$)</label>
            <input {...register('estimatedValue', { valueAsNumber: true })} type="number" min={0} step={10} placeholder="0" className="input" />
          </div>

          <div>
            <label className="text-sm text-ink-300 mb-1.5 block">Sinal / Depósito (R$)</label>
            <input {...register('deposit', { valueAsNumber: true })} type="number" min={0} step={10} placeholder="0" className="input" />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="text-sm text-ink-300 mb-1.5 block">Descrição do trabalho</label>
            <input {...register('description')} placeholder="Ex: Manga japonesa em preto e branco" className="input" />
          </div>

          {/* Notes */}
          <div className="sm:col-span-2">
            <label className="text-sm text-ink-300 mb-1.5 block">Observações internas</label>
            <textarea {...register('notes')} rows={2} className="input resize-none" placeholder="Notas para o tatuador, preferências do cliente..." />
          </div>
        </div>

        {create.isError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
            Erro ao criar agendamento. Verifique os dados.
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link href="/appointments" className="btn-ghost flex-1 text-center">Cancelar</Link>
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {create.isPending && <Loader2 size={16} className="animate-spin" />}
            {create.isPending ? 'Salvando...' : 'Criar agendamento'}
          </button>
        </div>
      </form>
    </div>
  );
}
