'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../../store/auth.store';
import api from '../../../../lib/api';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    // VULN-007: tokens não chegam mais na URL — chegaram como cookies httpOnly
    // Só precisamos buscar os dados do usuário
    api.get('/auth/me')
      .then((res) => { setUser(res.data.data); router.push('/dashboard'); })
      .catch(() => router.push('/login'));
  }, [router, setUser]);

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 size={32} className="animate-spin text-brand-400 mx-auto mb-3" />
        <p className="text-ink-400">Autenticando...</p>
      </div>
    </div>
  );
}
