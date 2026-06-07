'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Eye, Calendar, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../../../lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface PortfolioItem {
  id: string;
  imageUrl: string;
  style: string;
  placement: string | null;
  description: string | null;
  featured: boolean;
  viewCount: number;
  artist: { user: { name: string } };
}

interface StudioInfo {
  name: string;
  primaryColor: string;
  logoUrl: string | null;
}

const STYLES = [
  'Realismo', 'Old School', 'New School', 'Geométrico', 'Aquarela',
  'Blackwork', 'Fineline', 'Japonês', 'Tribal', 'Neotradicional', 'Outro',
];

export default function PublicPortfolioClient({
  slug,
  initialStyle,
}: {
  slug: string;
  initialStyle?: string;
}) {
  const [style, setStyle] = useState(initialStyle ?? '');
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['public-portfolio', slug, style],
    queryFn: () =>
      axios
        .get(`${API}/public/${slug}/portfolio${style ? `?style=${style}` : ''}`)
        .then((r) => r.data.data as { items: PortfolioItem[]; studio: StudioInfo; total: number }),
  });

  const studio = data?.studio;
  const items = data?.items ?? [];

  const formLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/form/${slug}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {studio?.logoUrl ? (
              <img src={studio.logoUrl} alt={studio?.name} className="h-8 object-contain" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-zinc-900 text-sm flex-shrink-0"
                style={{ background: studio?.primaryColor ?? '#f59e0b' }}
              >
                {studio?.name?.[0] ?? '?'}
              </div>
            )}
            <div>
              <p className="font-semibold text-sm">{studio?.name}</p>
              <p className="text-xs text-zinc-400">Portfólio</p>
            </div>
          </div>

          <a
            href={formLink}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-900 transition-opacity hover:opacity-90 flex-shrink-0"
            style={{ background: studio?.primaryColor ?? '#f59e0b' }}
          >
            Quero uma tattoo
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Nossos trabalhos</h1>
          <p className="text-zinc-400">
            {data?.total ?? '...'} tatuagens no portfólio
          </p>
        </div>

        {/* Filtro de estilos */}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setStyle('')}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              !style ? 'text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100',
            )}
            style={!style ? { background: studio?.primaryColor ?? '#f59e0b' } : undefined}
          >
            Todos
          </button>
          {STYLES.map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s === style ? '' : s)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                style === s ? 'text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100',
              )}
              style={style === s ? { background: studio?.primaryColor ?? '#f59e0b' } : undefined}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin" size={32} style={{ color: studio?.primaryColor ?? '#f59e0b' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <p>Nenhum trabalho encontrado para este estilo.</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="break-inside-avoid group relative rounded-xl overflow-hidden cursor-pointer bg-zinc-800"
                onClick={() => setLightbox(item)}
              >
                <img
                  src={item.imageUrl}
                  alt={`${item.style}${item.placement ? ` — ${item.placement}` : ''}`}
                  className="w-full object-cover transition-transform group-hover:scale-105 duration-500"
                  loading="lazy"
                />
                {item.featured && (
                  <div className="absolute top-2 left-2 bg-amber-500/90 text-amber-950 text-xs px-1.5 py-0.5 rounded font-semibold">
                    ⭐ Destaque
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <p className="text-white text-xs font-semibold">{item.style}</p>
                  {item.placement && <p className="text-zinc-300 text-xs">{item.placement}</p>}
                  <p className="text-zinc-400 text-xs">{item.artist.user.name}</p>
                  <p className="text-zinc-500 text-[10px] flex items-center gap-1 mt-0.5">
                    <Eye size={9} /> {item.viewCount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div
          className="rounded-2xl p-8 text-center text-zinc-900"
          style={{ background: `linear-gradient(135deg, ${studio?.primaryColor ?? '#f59e0b'}, ${studio?.primaryColor ?? '#f59e0b'}99)` }}
        >
          <h2 className="text-2xl font-bold mb-2">Gostou do que viu?</h2>
          <p className="mb-6 opacity-80">Envie seu briefing e vamos criar algo único juntos.</p>
          <a
            href={formLink}
            className="inline-block bg-zinc-900 text-white px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            Enviar minha ideia 🖊️
          </a>
        </div>
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-zinc-800 rounded-full p-2 hover:bg-zinc-700 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          <div
            className="max-w-2xl w-full bg-zinc-900 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.imageUrl}
              alt=""
              className="w-full object-contain max-h-[70vh]"
            />
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full text-zinc-900"
                  style={{ background: studio?.primaryColor ?? '#f59e0b' }}
                >
                  {lightbox.style}
                </span>
                {lightbox.placement && (
                  <span className="text-xs text-zinc-400">{lightbox.placement}</span>
                )}
              </div>
              {lightbox.description && (
                <p className="text-sm text-zinc-300 leading-relaxed">{lightbox.description}</p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">por {lightbox.artist.user.name}</p>
                <a
                  href={formLink}
                  className="text-xs font-semibold text-zinc-900 px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                  style={{ background: studio?.primaryColor ?? '#f59e0b' }}
                >
                  Quero similar
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-zinc-800 mt-16 py-8 text-center text-zinc-600 text-sm">
        <p>{studio?.name} · Powered by InkHub</p>
      </footer>
    </div>
  );
}
