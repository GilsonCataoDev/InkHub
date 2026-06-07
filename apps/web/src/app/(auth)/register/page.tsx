'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/auth.store';

const slugify = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

const schema = z.object({
  studioName: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  slug: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  adminName: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .regex(/[A-Z]/, 'Deve ter uma letra maiúscula')
    .regex(/[a-z]/, 'Deve ter uma letra minúscula')
    .regex(/\d/, 'Deve ter um número')
    .regex(/[@$!%*?&\-_#^()]/, 'Deve ter um símbolo (@$!%*?&-_#^())'),
});

type FormData = z.infer<typeof schema>;

const passwordRules = [
  { test: (p: string) => p.length >= 10, label: 'Mínimo 10 caracteres' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Letra maiúscula' },
  { test: (p: string) => /[a-z]/.test(p), label: 'Letra minúscula' },
  { test: (p: string) => /\d/.test(p), label: 'Número' },
  { test: (p: string) => /[@$!%*?&\-_#^()]/.test(p), label: 'Símbolo' },
];

export default function RegisterPage() {
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { setUser, setTenantId } = useAuthStore();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const pwd = watch('password') ?? '';

  const onStudioNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue('studioName', e.target.value);
    setValue('slug', slugify(e.target.value), { shouldValidate: false });
  };

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await api.post('/auth/signup', data);

      // Busca tenantId pelo slug para setar no store
      const tenantRes = await api.get(`/tenants/slug/${data.slug}`);
      const tenantId = tenantRes.data.data.id as string;
      setTenantId(tenantId);

      const meRes = await api.get('/auth/me', { headers: { 'X-Tenant-ID': tenantId } });
      setUser(meRes.data.data);

      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao criar estúdio. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Criar seu estúdio</h1>
          <p className="text-ink-400 text-sm">Configure em 2 minutos. Grátis pra começar.</p>
        </div>

        <div className="card space-y-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Studio name + slug */}
            <div>
              <label className="text-sm text-ink-300 mb-1.5 block">Nome do estúdio</label>
              <input
                {...register('studioName')}
                onChange={onStudioNameChange}
                placeholder="Ex: Tattoo Black Studio"
                className="input"
              />
              {errors.studioName && <p className="text-red-400 text-xs mt-1">{errors.studioName.message}</p>}
            </div>

            <div>
              <label className="text-sm text-ink-300 mb-1.5 block">Endereço do painel</label>
              <div className="flex">
                <input
                  {...register('slug')}
                  placeholder="meu-studio"
                  className="input rounded-r-none border-r-0 flex-1 font-mono"
                />
                <span className="bg-ink-700 border border-ink-700 px-3 py-2 text-ink-400 text-sm rounded-r-lg flex items-center whitespace-nowrap">
                  .inkhub.app
                </span>
              </div>
              {errors.slug && <p className="text-red-400 text-xs mt-1">{errors.slug.message}</p>}
            </div>

            <div className="border-t border-ink-800 pt-5">
              <p className="text-xs text-ink-500 mb-4 uppercase tracking-wide">Dados do administrador</p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-ink-300 mb-1.5 block">Seu nome</label>
                  <input {...register('adminName')} placeholder="João Silva" className="input" />
                  {errors.adminName && <p className="text-red-400 text-xs mt-1">{errors.adminName.message}</p>}
                </div>

                <div>
                  <label className="text-sm text-ink-300 mb-1.5 block">E-mail</label>
                  <input {...register('email')} type="email" placeholder="joao@studio.com" className="input" />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="text-sm text-ink-300 mb-1.5 block">Senha</label>
                  <div className="relative">
                    <input
                      {...register('password')}
                      type={showPwd ? 'text' : 'password'}
                      placeholder="••••••••••"
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

                  {/* Password strength checklist */}
                  {pwd.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {passwordRules.map((r) => (
                        <div key={r.label} className="flex items-center gap-1.5">
                          <Check size={12} className={r.test(pwd) ? 'text-green-400' : 'text-ink-600'} />
                          <span className={`text-xs ${r.test(pwd) ? 'text-green-400' : 'text-ink-500'}`}>{r.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 size={16} className="animate-spin" /> Criando estúdio...</>
              ) : (
                <>Criar estúdio grátis <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-ink-500 pt-2 border-t border-ink-800">
            Já tem conta?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
