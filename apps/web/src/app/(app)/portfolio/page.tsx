'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Images, Plus, Star, Eye, EyeOff, Trash2, Loader2, X,
  Upload, ExternalLink, Copy, Check,
} from 'lucide-react';
import api from '../../../lib/api';
import { cn } from '../../../lib/utils';
import { useAuthStore } from '../../../store/auth.store';

interface Artist {
  id: string;
  user: { name: string };
}

interface PortfolioItem {
  id: string;
  artistId: string;
  artist: { user: { name: string } };
  imageUrl: string;
  style: string;
  placement: string | null;
  description: string | null;
  tags: string[];
  featured: boolean;
  public: boolean;
  viewCount: number;
  slug: string;
  createdAt: string;
}

const STYLES = [
  'Realismo', 'Old School', 'New School', 'Geométrico', 'Aquarela',
  'Blackwork', 'Fineline', 'Japonês', 'Tribal', 'Neotradicional', 'Outro',
];

export default function PortfolioPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const slug = user?.tenant?.slug ?? '';
  const portfolioUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${slug}/portfolio`
    : `/${slug}/portfolio`;

  const [form, setForm] = useState({
    artistId: '',
    style: '',
    placement: '',
    description: '',
    tags: '',
    featured: false,
    public: true,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['portfolio', filter],
    queryFn: () =>
      api.get(`/portfolio${filter ? `?style=${filter}` : ''}`).then((r) => r.data.data as PortfolioItem[]),
  });

  const { data: artists = [] } = useQuery({
    queryKey: ['artists-list'],
    queryFn: () => api.get('/tattoo-artists').then((r) => r.data.data as Artist[]),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (selectedFile) fd.append('image', selectedFile);
      return api.post('/portfolio', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      setShowForm(false);
      setSelectedFile(null);
      setPreview(null);
      setForm({ artistId: '', style: '', placement: '', description: '', tags: '', featured: false, public: true });
    },
  });

  const togglePublic = useMutation({
    mutationFn: (id: string) => api.patch(`/portfolio/${id}/toggle-public`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  });

  const toggleFeatured = useMutation({
    mutationFn: (id: string) => api.patch(`/portfolio/${id}/toggle-featured`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/portfolio/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(portfolioUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const publicItems = items.filter((i) => i.public).length;
  const featuredItems = items.filter((i) => i.featured).length;
  const totalViews = items.reduce((s, i) => s + i.viewCount, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Images size={22} className="text-brand-400" />
            <h1 className="text-2xl font-bold">Portfólio</h1>
          </div>
          <p className="text-ink-400 text-sm">Gerencie as fotos públicas do estúdio</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Link público */}
          <div className="flex items-center gap-2 bg-ink-800 border border-ink-700 rounded-xl px-3 py-2 max-w-xs">
            <span className="text-xs text-ink-400 truncate">{portfolioUrl}</span>
            <button onClick={copyLink} className="text-brand-400 flex-shrink-0">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <a href={portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-ink-400 hover:text-ink-100">
              <ExternalLink size={14} />
            </a>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Adicionar foto
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de fotos', value: items.length, color: 'text-brand-400' },
          { label: 'Públicas', value: publicItems, color: 'text-green-400' },
          { label: 'Destaques', value: featuredItems, color: 'text-amber-400' },
          { label: 'Visualizações', value: totalViews, color: 'text-blue-400' },
        ].map((s) => (
          <div key={s.label} className="card text-center py-3">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-ink-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtro por estilo */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('')}
          className={cn('px-3 py-1.5 rounded-full text-xs transition-colors', !filter ? 'bg-brand-500 text-ink-950 font-semibold' : 'bg-ink-800 text-ink-400')}
        >
          Todos
        </button>
        {STYLES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s === filter ? '' : s)}
            className={cn('px-3 py-1.5 rounded-full text-xs transition-colors', filter === s ? 'bg-brand-500 text-ink-950 font-semibold' : 'bg-ink-800 text-ink-400')}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Grid de fotos */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-brand-400" size={32} />
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-16">
          <Images size={40} className="mx-auto text-ink-600 mb-3" />
          <p className="text-ink-400">Nenhuma foto no portfólio ainda.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={16} /> Adicionar primeira foto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <div key={item.id} className="group relative rounded-xl overflow-hidden bg-ink-800 aspect-square">
              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />

              {/* Badges */}
              <div className="absolute top-2 left-2 flex gap-1">
                {item.featured && (
                  <span className="bg-amber-500/90 text-amber-950 text-xs px-1.5 py-0.5 rounded-md font-semibold">⭐</span>
                )}
                {!item.public && (
                  <span className="bg-zinc-900/90 text-zinc-300 text-xs px-1.5 py-0.5 rounded-md">Privado</span>
                )}
              </div>

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => toggleFeatured.mutate(item.id)}
                    className={cn('p-1.5 rounded-lg transition-colors', item.featured ? 'bg-amber-500 text-amber-950' : 'bg-zinc-800/80 text-zinc-300 hover:bg-amber-500 hover:text-amber-950')}
                    title="Destacar"
                  >
                    <Star size={12} />
                  </button>
                  <button
                    onClick={() => togglePublic.mutate(item.id)}
                    className="p-1.5 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    title={item.public ? 'Despublicar' : 'Publicar'}
                  >
                    {item.public ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    onClick={() => { if (confirm('Remover esta foto?')) deleteMutation.mutate(item.id); }}
                    className="p-1.5 rounded-lg bg-zinc-800/80 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                    title="Remover"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="text-white text-xs">
                  <p className="font-semibold">{item.style}</p>
                  {item.placement && <p className="text-zinc-300">{item.placement}</p>}
                  <p className="text-zinc-400">{item.artist.user.name}</p>
                  <p className="text-zinc-500 text-[10px] mt-0.5">{item.viewCount} views</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal adicionar foto */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-ink-800">
              <h2 className="font-bold text-lg">Adicionar ao portfólio</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Upload */}
              <div>
                <label className="text-xs text-ink-400 mb-2 block">Foto *</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {preview ? (
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-ink-800">
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setPreview(null); setSelectedFile(null); }}
                      className="absolute top-2 right-2 bg-zinc-900/80 rounded-full p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-ink-700 hover:border-brand-500 rounded-xl py-10 flex flex-col items-center gap-2 text-ink-400 hover:text-brand-400 transition-colors"
                  >
                    <Upload size={28} />
                    <span className="text-sm">Clique para selecionar foto</span>
                    <span className="text-xs text-ink-500">JPG, PNG, WEBP até 15MB</span>
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs text-ink-400 mb-1 block">Tatuador *</label>
                <select
                  value={form.artistId}
                  onChange={(e) => setForm((f) => ({ ...f, artistId: e.target.value }))}
                  className="input w-full"
                >
                  <option value="">Selecione o tatuador</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>{a.user.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">Estilo *</label>
                  <select
                    value={form.style}
                    onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">Selecione</option>
                    {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">Local do corpo</label>
                  <input
                    value={form.placement}
                    onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
                    placeholder="Ex: antebraço"
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-ink-400 mb-1 block">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Contexto da tatuagem, técnica usada..."
                  className="input w-full resize-none text-sm"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="text-ink-300">⭐ Destaque</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={form.public}
                    onChange={(e) => setForm((f) => ({ ...f, public: e.target.checked }))}
                    className="w-4 h-4 accent-brand-500"
                  />
                  <span className="text-ink-300">Pública</span>
                </label>
              </div>

              {createMutation.isError && (
                <p className="text-red-400 text-sm">Erro ao adicionar foto. Tente novamente.</p>
              )}

              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.artistId || !form.style || !selectedFile}
                className="w-full btn-primary py-3 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {createMutation.isPending ? 'Adicionando...' : 'Adicionar ao portfólio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
