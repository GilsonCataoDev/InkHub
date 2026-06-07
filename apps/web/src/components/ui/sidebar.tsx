'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Calendar, User2, Coffee, ShoppingBag,
  TrendingUp, Package, MessageSquare, LogOut, ChevronLeft, ChevronRight, Settings,
  MessageSquarePlus, Images, Zap, MessageCircle,
} from 'lucide-react';
import { useState } from 'react';
import { cn, getInitials } from '../../lib/utils';
import { useAuthStore } from '../../store/auth.store';
import api from '../../lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [] },
  { href: '/clients', label: 'Clientes', icon: Users, roles: [] },
  { href: '/appointments', label: 'Agenda', icon: Calendar, roles: [] },
  { href: '/tattoo-artists', label: 'Tatuadores', icon: User2, roles: ['ADMIN', 'MANAGER'] },
  { href: '/cafe', label: 'Cafeteria', icon: Coffee, roles: ['ADMIN', 'MANAGER', 'BARISTA'] },
  { href: '/store', label: 'Loja', icon: ShoppingBag, roles: ['ADMIN', 'MANAGER', 'STOCK_KEEPER'] },
  { href: '/financial', label: 'Financeiro', icon: TrendingUp, roles: ['ADMIN', 'MANAGER'] },
  { href: '/stock', label: 'Estoque', icon: Package, roles: ['ADMIN', 'MANAGER', 'STOCK_KEEPER'] },
  { href: '/crm', label: 'CRM', icon: MessageSquare, roles: ['ADMIN', 'MANAGER'] },
  { href: '/briefings', label: 'Briefings', icon: MessageSquarePlus, roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/portfolio', label: 'Portfólio', icon: Images, roles: ['ADMIN', 'MANAGER', 'TATTOO_ARTIST'] },
  { href: '/automations', label: 'Automações', icon: Zap, roles: ['ADMIN', 'MANAGER'] },
  { href: '/settings/whatsapp', label: 'WhatsApp', icon: MessageCircle, roles: ['ADMIN', 'MANAGER'] },
  { href: '/settings', label: 'Configurações', icon: Settings, roles: ['ADMIN', 'MANAGER'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    router.push('/login');
  };

  const visibleItems = navItems.filter(
    (item) => item.roles.length === 0 || item.roles.includes(user?.role ?? ''),
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-ink-900 border-r border-ink-800 transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-ink-800 flex-shrink-0">
        {collapsed ? (
          <img src="/logo-icon.svg" alt="InkHub" className="w-8 h-8 object-contain flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
        ) : (
          <img src="/logo.svg" alt="InkHub" className="h-7 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
        )}
        {!collapsed && (
          <p className="text-xs text-ink-400 truncate ml-auto">{user?.tenant?.name ?? 'Studio'}</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('sidebar-link', active && 'active', collapsed && 'justify-center px-2')}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="flex-shrink-0 border-t border-ink-800 p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0">
            {user ? getInitials(user.name) : '?'}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium truncate">{user?.name}</p>
              <p className="text-xs text-ink-500 truncate">{user?.role}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={handleLogout} className="text-ink-500 hover:text-red-400 transition-colors" title="Sair">
              <LogOut size={16} />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={handleLogout} className="mt-2 w-full flex justify-center text-ink-500 hover:text-red-400 transition-colors">
            <LogOut size={16} />
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-ink-800 border border-ink-700 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-100 transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
