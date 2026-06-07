'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  tenantId: string;
  tenant: { name: string; slug: string; logoUrl: string | null; primaryColor: string } | null;
  tattooArtist: { id: string; specialties: string[] } | null;
}

interface AuthState {
  user: User | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  // Tokens NÃO são mais armazenados no store — ficam em cookies httpOnly (gerenciados pelo servidor)
  setUser: (user: User) => void;
  setTenantId: (id: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenantId: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true, tenantId: user.tenantId }),
      setTenantId: (tenantId) => set({ tenantId }),
      logout: () => set({ user: null, tenantId: null, isAuthenticated: false }),
    }),
    {
      name: 'inkhub-auth',
      // VULN-007: apenas dados de UI persistidos — tokens ficam em cookies httpOnly
      partialize: (s) => ({ tenantId: s.tenantId, user: s.user }),
    },
  ),
);
