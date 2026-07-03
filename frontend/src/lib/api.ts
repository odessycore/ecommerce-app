import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { getCartToken } from './cart-token';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const apiBaseUrl = baseURL;

export const api = axios.create({ baseURL, withCredentials: true });

let accessToken: string | null = null;
let onAuthCleared: (() => void) | null = null;

export function authHeader(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function registerAuthClearedHandler(handler: () => void): void {
  onAuthCleared = handler;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  const cartToken = getCartToken();
  if (cartToken) {
    config.headers['x-cart-token'] = cartToken;
  }
  return config;
});

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = api
      .post('/auth/refresh')
      .then((res) => {
        const token = res.data.accessToken as string;
        setAccessToken(token);
        return token;
      })
      .catch(() => {
        setAccessToken(null);
        onAuthCleared?.();
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

interface RetriableConfig extends AxiosRequestConfig {
  _retried?: boolean;
  url?: string;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthRoute = config?.url?.includes('/auth/refresh') || config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && config && !config._retried && !isAuthRoute) {
      config._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return api.request(config);
      }
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message[0];
    if (typeof message === 'string') return message;
  }
  return fallback;
}
