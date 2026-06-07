'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/api';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch {
      setError('Erro ao enviar. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail size={24} className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Recuperar senha</h1>
          <p className="text-ink-400 text-sm">
            {sent
              ? 'Verifique seu e-mail'
              : 'Digite seu e-mail e enviaremos um link de redefinição.'}
          </p>
        </div>

        <div className="card">
          {sent ? (
            <div className="text-center space-y-4">
              <CheckCircle size={40} className="text-green-400 mx-auto" />
              <p className="text-ink-300 text-sm">
                Se o endereço <span className="text-white font-medium">{getValues('email')}</span> estiver
                cadastrado, você receberá um e-mail com o link para redefinir sua senha.
              </p>
              <p className="text-ink-500 text-xs">Não recebeu? Verifique a pasta de spam ou tente novamente em 5 minutos.</p>
              <Link href="/login" className="btn-secondary w-full flex items-center justify-center gap-2 mt-4">
                <ArrowLeft size={16} /> Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm text-ink-300 mb-1.5 block">E-mail da conta</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="seu@email.com"
                  className="input"
                  autoFocus
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
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
                {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <div className="text-center pt-2 border-t border-ink-800">
                <Link href="/login" className="text-sm text-ink-400 hover:text-ink-200 flex items-center justify-center gap-1">
                  <ArrowLeft size={14} /> Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
