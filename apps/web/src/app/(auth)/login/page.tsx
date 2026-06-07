'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/auth.store';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  tenantSlug: z.string().min(1, 'Informe o subdomínio do estúdio'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { setTenantId } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      // Resolve tenantId from slug
      const tenantRes = await api.get(`/tenants/slug/${data.tenantSlug}`);
      const tenantId = tenantRes.data.data.id as string;
      setTenantId(tenantId);

      const res = await api.post('/auth/login', { email: data.email, password: data.password }, {
        headers: { 'X-Tenant-ID': tenantId },
      });

      // Tokens ficam em cookies httpOnly — não precisamos armazená-los no store
      const meRes = await api.get('/auth/me', {
        headers: { 'X-Tenant-ID': tenantId },
      });

      useAuthStore.getState().setUser(meRes.data.data);
      router.push('/dashboard');
    } catch {
      setError('Credenciais inválidas ou estúdio não encontrado.');
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="InkHub" className="h-12 mx-auto mb-2 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
          <p className="text-ink-400 text-sm mt-1">Acesse o painel do seu estúdio</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm text-ink-300 mb-1.5 block">Subdomínio do estúdio</label>
              <div className="flex">
                <input
                  {...register('tenantSlug')}
                  placeholder="meu-studio"
                  className="input rounded-r-none border-r-0 flex-1"
                />
                <span className="bg-ink-700 border border-ink-700 px-3 py-2 text-ink-400 text-sm rounded-r-lg flex items-center">
                  .inkhub.app
                </span>
              </div>
              {errors.tenantSlug && <p className="text-red-400 text-xs mt-1">{errors.tenantSlug.message}</p>}
            </div>

            <div>
              <label className="text-sm text-ink-300 mb-1.5 block">E-mail</label>
              <input {...register('email')} type="email" placeholder="seu@email.com" className="input" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-ink-300">Senha</label>
                <Link href="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-ink-800 space-y-3">
            <p className="text-center text-sm text-ink-500">
              Não tem conta?{' '}
              <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium">
                Criar estúdio grátis
              </Link>
            </p>
            <p className="text-center text-sm text-ink-500">
              Demo: <span className="text-ink-300 font-mono">demo-studio</span> ·{' '}
              <span className="text-ink-300 font-mono">admin@demo-studio.com</span> ·{' '}
              <span className="text-ink-300 font-mono">Admin@123456</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
