import Link from 'next/link';
import {
  Calendar, Users, Coffee, ShoppingBag, TrendingUp, Shield,
  Star, ChevronRight, Zap, BarChart3, MessageSquare, Check,
} from 'lucide-react';

const features = [
  {
    icon: Calendar,
    title: 'Agenda Inteligente',
    desc: 'Calendário visual por tatuador, confirmação automática, gestão de sessões e depósitos.',
    role: 'Tatuadores',
  },
  {
    icon: Users,
    title: 'CRM de Clientes',
    desc: 'Histórico completo, galeria de fotos, termo de consentimento digital e programa de fidelidade.',
    role: 'Recepcionistas',
  },
  {
    icon: Coffee,
    title: 'Cafeteria Integrada',
    desc: 'Cardápio, controle de mesas, comandas abertas e baixa automática de estoque.',
    role: 'Baristas',
  },
  {
    icon: ShoppingBag,
    title: 'Loja de Materiais',
    desc: 'Gestão de produtos com SKU, controle de estoque e alertas de reposição.',
    role: 'Estoquistas',
  },
  {
    icon: TrendingUp,
    title: 'Financeiro Completo',
    desc: 'Fluxo de caixa, DRE mensal, contas a pagar/receber e exportação em PDF.',
    role: 'Gestores',
  },
  {
    icon: BarChart3,
    title: 'Dashboard em Tempo Real',
    desc: 'Faturamento do dia, ranking de tatuadores, alertas de estoque e gráficos de receita.',
    role: 'Admins',
  },
];

const plans = [
  {
    name: 'Free',
    price: 0,
    desc: 'Para estúdios que estão começando',
    features: ['Até 3 usuários', 'Até 100 clientes', 'Agenda básica', 'Dashboard'],
    cta: 'Começar grátis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 197,
    desc: 'O mais popular para estúdios em crescimento',
    features: ['Até 15 usuários', 'Clientes ilimitados', 'Cafeteria + Loja', 'CRM completo', 'Financeiro avançado', 'Suporte prioritário'],
    cta: 'Assinar Pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: null,
    desc: 'Para redes de estúdios e franquias',
    features: ['Usuários ilimitados', 'Multi-tenant gerenciado', 'API dedicada', 'SLA 99.9%', 'Onboarding personalizado'],
    cta: 'Falar com vendas',
    highlight: false,
  },
];

const testimonials = [
  {
    name: 'Rodrigo Ferreira',
    studio: 'Dark Arts Studio, SP',
    text: 'Antes usávamos 3 planilhas diferentes. O InkHub unificou tudo em um lugar. Nossa receita cresceu 40% em 6 meses.',
    avatar: 'RF',
  },
  {
    name: 'Camila Duarte',
    studio: 'Bloom Ink, RJ',
    text: 'O módulo de cafeteria foi o diferencial. Agora meus clientes ficam mais tempo no estúdio e gastam mais.',
    avatar: 'CD',
  },
  {
    name: 'Thiago Santos',
    studio: 'Black Lines, BH',
    text: 'Os relatórios de comissão dos tatuadores são automáticos. Economizo 4 horas por semana só nisso.',
    avatar: 'TS',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-ink-50">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ink-950/80 backdrop-blur-sm border-b border-ink-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="InkHub" className="h-8 w-auto object-contain" />
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-ink-400">
              <a href="#features" className="hover:text-ink-100 transition-colors">Funcionalidades</a>
              <a href="#plans" className="hover:text-ink-100 transition-colors">Planos</a>
              <a href="#testimonials" className="hover:text-ink-100 transition-colors">Depoimentos</a>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="btn-ghost text-sm">Entrar</Link>
              <Link href="/register" className="btn-primary text-sm">Começar grátis</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 text-brand-400 text-sm mb-6">
            <Zap size={14} />
            ERP completo para estúdios de tatuagem
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
            Gerencie seu estúdio{' '}
            <span className="text-brand-400">do jeito que ele merece</span>
          </h1>
          <p className="text-xl text-ink-400 mb-10 max-w-2xl mx-auto">
            Agenda, clientes, cafeteria, loja de materiais e financeiro em uma única plataforma.
            Feito para estúdios que levam o negócio a sério.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="btn-primary text-base px-8 py-3 flex items-center gap-2">
              Começar trial gratuito <ChevronRight size={18} />
            </Link>
            <a href="#features" className="btn-outline text-base px-8 py-3">
              Ver funcionalidades
            </a>
          </div>
          <p className="mt-4 text-sm text-ink-500">Sem cartão de crédito · Setup em 3 minutos</p>
        </div>

        {/* Dashboard preview mock */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-ink-800 bg-ink-900">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-800">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-4 text-xs text-ink-500">InkHub — Dashboard</span>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Receita hoje', value: 'R$ 2.840', up: true },
                { label: 'Agendamentos', value: '8 hoje', up: true },
                { label: 'Clientes ativos', value: '342', up: true },
                { label: 'Alertas estoque', value: '3 itens', up: false },
              ].map((s) => (
                <div key={s.label} className="bg-ink-800 rounded-lg p-3">
                  <p className="text-xs text-ink-500">{s.label}</p>
                  <p className="text-lg font-bold text-ink-100 mt-1">{s.value}</p>
                  <p className={`text-xs mt-1 ${s.up ? 'text-green-400' : 'text-orange-400'}`}>
                    {s.up ? '↑ +12%' : '↓ atenção'}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <div className="bg-ink-800 rounded-lg p-4 h-32 flex items-end gap-2">
                {[60, 80, 55, 90, 70, 85, 95].map((h, i) => (
                  <div key={i} className="flex-1 bg-brand-500/60 rounded-t" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="text-xs text-ink-500 mt-2">Receita dos últimos 7 dias</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 border-t border-ink-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Tudo que seu estúdio precisa</h2>
            <p className="text-ink-400 text-lg">Módulos integrados para cada área do negócio</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card hover:border-brand-500/30 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-brand-500/10 rounded-lg flex items-center justify-center text-brand-400 group-hover:bg-brand-500/20 transition-colors flex-shrink-0">
                    <f.icon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{f.title}</h3>
                      <span className="text-xs bg-ink-800 text-ink-400 px-2 py-0.5 rounded-full">{f.role}</span>
                    </div>
                    <p className="text-sm text-ink-400">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="py-20 px-4 border-t border-ink-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Planos e preços</h2>
            <p className="text-ink-400 text-lg">Comece grátis, escale quando precisar</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`card relative flex flex-col ${p.highlight ? 'border-brand-500/50 bg-ink-900' : ''}`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-ink-950 text-xs font-bold px-3 py-1 rounded-full">
                    MAIS POPULAR
                  </div>
                )}
                <h3 className="text-lg font-bold mb-1">{p.name}</h3>
                <p className="text-sm text-ink-400 mb-4">{p.desc}</p>
                <div className="mb-6">
                  {p.price !== null ? (
                    <>
                      <span className="text-4xl font-bold">R$ {p.price}</span>
                      <span className="text-ink-400 text-sm">/mês</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-ink-300">Sob consulta</span>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check size={16} className="text-brand-400 flex-shrink-0" />
                      <span className="text-ink-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={p.highlight ? 'btn-primary text-center' : 'btn-outline text-center'}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 border-t border-ink-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">O que estúdios dizem</h2>
            <div className="flex justify-center gap-1 text-brand-400">
              {[...Array(5)].map((_, i) => <Star key={i} size={20} fill="currentColor" />)}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="card">
                <MessageSquare size={20} className="text-brand-400 mb-3" />
                <p className="text-sm text-ink-300 mb-4 leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-3 border-t border-ink-800">
                  <div className="w-9 h-9 bg-brand-500/20 rounded-full flex items-center justify-center text-brand-400 text-sm font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-ink-400">{t.studio}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-ink-800">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Pronto para transformar seu estúdio?</h2>
          <p className="text-ink-400 mb-8">Configure em 3 comandos e comece a usar hoje mesmo.</p>
          <Link href="/register" className="btn-primary text-base px-10 py-4 inline-flex items-center gap-2">
            Criar conta gratuita <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-800 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="InkHub" className="h-6 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-6 text-sm text-ink-400">
            <a href="#" className="hover:text-ink-200">Privacidade</a>
            <a href="#" className="hover:text-ink-200">Termos de Uso</a>
            <a href="#" className="hover:text-ink-200">Segurança</a>
            <a href="#" className="hover:text-ink-200">Contato</a>
          </div>
          <p className="text-sm text-ink-500">© 2025 InkHub. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
