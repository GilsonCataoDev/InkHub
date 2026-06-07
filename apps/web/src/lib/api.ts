import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
  // VULN-007: envia cookies httpOnly em todas as requisições (auth automático)
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const { tenantId } = useAuthStore.getState();
    // Tokens NÃO são mais enviados no header — o cookie httpOnly é enviado automaticamente
    if (tenantId) config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(ok: boolean) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Ignora erros que não sejam 401 ou que já foram retentados
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Evita múltiplas chamadas simultâneas de refresh
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((ok) => {
          if (ok) resolve(api(original));
          else reject(error);
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // VULN-007: o refresh_token httpOnly é enviado automaticamente via cookie
      // Não precisamos mais ler do store
      await axios.post(
        `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/auth/refresh`,
        {},
        { withCredentials: true },
      );

      // Cookie de access_token renovado — retentar requisição original
      refreshQueue.forEach((cb) => cb(true));
      refreshQueue = [];
      return api(original);
    } catch {
      refreshQueue.forEach((cb) => cb(false));
      refreshQueue = [];
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
