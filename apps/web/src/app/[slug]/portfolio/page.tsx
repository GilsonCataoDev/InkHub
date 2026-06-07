import { Metadata } from 'next';
import PublicPortfolioClient from './client';

// Next.js 15: params e searchParams são Promises
type PageParams = Promise<{ slug: string }>;
type PageSearchParams = Promise<{ style?: string; page?: string }>;

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function generateMetadata(
  { params }: { params: PageParams },
): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API}/public/${slug}/info`, { next: { revalidate: 3600 } });
    if (!res.ok) return { title: 'Portfólio' };
    const { data } = await res.json();
    return {
      title: `Portfólio — ${data.name}`,
      description: `Veja os trabalhos do estúdio ${data.name}. Tatuagens únicas feitas por artistas especializados.`,
      openGraph: {
        title: `Portfólio — ${data.name}`,
        images: data.logoUrl ? [data.logoUrl] : [],
      },
    };
  } catch {
    return { title: 'Portfólio' };
  }
}

export default async function PublicPortfolioPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: PageSearchParams;
}) {
  const { slug } = await params;
  const { style } = await searchParams;
  return <PublicPortfolioClient slug={slug} initialStyle={style} />;
}
