'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Lock, Check, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/api';

const schema = z.object({
  newPassword: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .regex(/[A-Z]/, 'Deve ter letra maiúscula')
    .regex(/[a-z]/, 'Deve ter letra minúscula')
    .regex(/\d/, 'Deve ter um número')
    .regex(/[@$!%*?&\-_#^()]/, 'Deve ter um símbolo'),
  confirm: z.string(),
}).refine((d) => d.newPassword === d.confirm, {
  message: 'As senhas não coincidem',
  path: ['confirm'],
});

type FormData = z.infer<typeof schema>;

const rules = [
  { test: (p: string) => p.length >= 10, label: 'Mínimo 10 caracteres' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Letra maiúscula' },
  { test: (p: string) => /[a-z]/.test(p), label: 'Letra minúscula' },
  { test: (p: string) => /\d/.test(p), label: 'Número' },
  { test: (p: string) => /[@$!%*?&\-_#^()]/.test(p), label: 'Símbolo' },
];

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const pwd = watch('newPassword') ?? '';

  useEffect(() => {
    if (!token) setError('Link inválido. Solicite um novo link de recuperação.');
  }, [token]);

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword: data.newPassword });
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao redefinir senha. O link pode ter expirado.');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center space-y-4">
          <AlertTriangle size={36} className="text-orange-400 mx-auto" />
          <p className="text-white font-medium">Link inválido</p>
          <p className="text-ink-400 text-sm">Este link de recuperação é inválido ou já foi utilizado.</p>
          <Link href="/forgot-password" className="btn-primary w-full block text-center">
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Nova senha</h1>
          <p className="text-ink-400 text-sm">Crie uma senha forte para a sua conta.</p>
        </div>

        <div className="card">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle size={40} className="text-green-400 mx-auto" />
              <p className="text-white font-medium">Senha redefinida com sucesso!</p>
              <p className="text-ink-400 text-sm">Redirecionando para o login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm text-ink-300 mb-1.5 block">Nova senha</label>
                <div className="relative">
                  <input
                    {...register('newPassword')}
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••••"
                    className="input pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.newPassword && <p className="text-red-400 text-xs mt-1">{errors.newPassword.message}</p>}

                {pwd.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {rules.map((r) => (
                      <div key={r.label} className="flex items-center gap-1.5">
                        <Check size={12} className={r.test(pwd) ? 'text-green-400' : 'text-ink-600'} />
                        <span className={`text-xs ${r.test(pwd) ? 'text-green-400' : 'text-ink-500'}`}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm text-ink-300 mb-1.5 block">Confirmar senha</label>
                <div className="relative">
                  <input
                    {...register('confirm')}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••••"
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirm && <p className="text-red-400 text-xs mt-1">{errors.confirm.message}</p>}
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
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
