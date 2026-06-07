'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Upload, X, CheckCircle, Loader2, Image as ImageIcon,
  User, Phone, Mail, Instagram, Palette, Ruler, MapPin, DollarSign, Lightbulb,
} from 'lucide-react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  instagram: z.string().optional(),
  idea: z.string().min(10, 'Descreva sua ideia (mínimo 10 caracteres)'),
  style: z.string().optional(),
  placement: z.string().optional(),
  size: z.string().optional(),
  budget: z.string().optional(),
  colorOrBlack: z.string().optional(),
  isFirstTattoo: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

const STYLES = ['Realismo', 'Old School', 'New School', 'Geométrico', 'Aquarela', 'Blackwork', 'Fineline', 'Japonês', 'Tribal', 'Neotradicional', 'Outro'];
const SIZES = ['Pequeno (até 5cm)', 'Médio (5–15cm)', 'Grande (15–30cm)', 'Extra grande (30cm+)', 'Não sei ainda'];
const BUDGETS = ['Até R$300', 'R$300–600', 'R$600–1.000', 'R$1.000–2.000', 'Acima de R$2.000', 'Aberto a orçamento'];

export default function BriefingFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: studioData, isLoading: loadingStudio } = useQuery({
    queryKey: ['public-studio', slug],
    queryFn: () => axios.get(`${API}/public/${slug}/info`).then((r) => r.data.data as { name: string; logoUrl: string | null; primaryColor: string; slug: string }),
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).slice(0, 5 - files.length);
    setFiles((prev) => [...prev, ...arr]);
    arr.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((prev) => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== '') fd.append(k, String(v)); });
      files.forEach((f) => fd.append('images', f));
      await axios.post(`${API}/public/${slug}/briefing`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
    } catch {
      setSubmitError('Ocorreu um erro ao enviar. Tente novamente.');
    }
  };

  if (loadingStudio) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (!studioData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Estúdio não encontrado.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={64} className="text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Briefing enviado!</h1>
          <p className="text-zinc-400 mb-1">Obrigado, {studioData.name} vai entrar em contato em breve.</p>
          <p className="text-zinc-500 text-sm mt-4">Você pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {studioData.logoUrl ? (
            <img src={studioData.logoUrl} alt={studioData.name} className="h-8 object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-zinc-900 text-sm" style={{ background: studioData.primaryColor }}>
              {studioData.name[0]}
            </div>
          )}
          <div>
            <p className="font-semibold text-sm">{studioData.name}</p>
            <p className="text-xs text-zinc-400">Formulário de briefing</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Conta pra gente sua ideia 🖊️</h1>
          <p className="text-zinc-400 text-sm">Quanto mais detalhes você trouxer, melhor conseguimos orçar e preparar seu projeto.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Contato */}
          <section className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 space-y-4">
            <h2 className="font-semibold text-amber-400 flex items-center gap-2"><User size={16} /> Seus dados</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Nome *</label>
                <input {...register('name')} placeholder="Seu nome completo" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">E-mail *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input {...register('email')} type="email" placeholder="seu@email.com" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input {...register('phone')} placeholder="(11) 99999-9999" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Instagram</label>
                <div className="relative">
                  <Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input {...register('instagram')} placeholder="@seuperfil" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
              </div>
            </div>
          </section>

          {/* Ideia */}
          <section className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 space-y-4">
            <h2 className="font-semibold text-amber-400 flex items-center gap-2"><Lightbulb size={16} /> Sua ideia</h2>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Descreva a tatuagem que você quer *</label>
              <textarea
                {...register('idea')}
                rows={4}
                placeholder="Ex: Quero uma rosa com espinhos no estilo realismo, com tons de vermelho e preto. Simboliza superação para mim..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
              {errors.idea && <p className="text-red-400 text-xs mt-1">{errors.idea.message}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block flex items-center gap-1"><Palette size={12} /> Estilo</label>
                <select {...register('style')} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors">
                  <option value="">Não sei / Aberto</option>
                  {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block flex items-center gap-1"><MapPin size={12} /> Local do corpo</label>
                <input {...register('placement')} placeholder="Ex: antebraço direito, costela..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block flex items-center gap-1"><Ruler size={12} /> Tamanho aproximado</label>
                <select {...register('size')} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors">
                  <option value="">Não sei ainda</option>
                  {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block flex items-center gap-1"><DollarSign size={12} /> Orçamento</label>
                <select {...register('budget')} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors">
                  <option value="">Prefiro receber orçamento</option>
                  {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            {/* Cor ou preto e branco */}
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Preferência de cor</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'color', label: '🎨 Colorida' },
                  { v: 'black_grey', label: '⚫ Preto e cinza' },
                  { v: 'undecided', label: '🤔 Ainda não sei' },
                ].map(({ v, label }) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" {...register('colorOrBlack')} value={v} className="accent-amber-500" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Primeira tatuagem */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register('isFirstTattoo')} className="w-4 h-4 accent-amber-500" />
              <span className="text-sm text-zinc-300">Esta será minha primeira tatuagem</span>
            </label>
          </section>

          {/* Referências */}
          <section className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 space-y-4">
            <h2 className="font-semibold text-amber-400 flex items-center gap-2"><ImageIcon size={16} /> Imagens de referência</h2>
            <p className="text-xs text-zinc-400">Envie até 5 imagens que te inspiram (tatuagens, desenhos, fotos...)</p>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 bg-zinc-900/80 rounded-full p-0.5 hover:bg-red-500/80 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length < 5 && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-zinc-700 hover:border-amber-500 rounded-xl py-6 flex flex-col items-center gap-2 transition-colors text-zinc-400 hover:text-amber-400"
                >
                  <Upload size={24} />
                  <span className="text-sm">Clique para adicionar imagens</span>
                  <span className="text-xs text-zinc-500">{files.length}/5 imagens · JPG, PNG, WEBP até 10MB</span>
                </button>
              </>
            )}
          </section>

          {submitError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl font-bold text-zinc-900 flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 text-base"
            style={{ background: studioData.primaryColor }}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {isSubmitting ? 'Enviando...' : 'Enviar briefing 🖊️'}
          </button>

          <p className="text-center text-xs text-zinc-500">
            Seus dados são usados apenas para contato sobre seu projeto de tatuagem.
          </p>
        </form>
      </div>
    </div>
  );
}
