import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Category,
  Customer,
  DashboardMetrics,
  Order,
  Paginated,
  Product,
} from '@/lib/types';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get<DashboardMetrics>('/admin/dashboard/metrics');
      return data;
    },
  });
}

// ── Products ──────────────────────────────────────────────────
export function useAdminProducts(params: { search?: string; page?: number }) {
  return useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Product>>('/admin/products', { params });
      return data;
    },
  });
}

export function useAdminProduct(id?: string) {
  return useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: async () => {
      const { data } = await api.get<Product>(`/admin/products/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useProductMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });

  const create = useMutation({
    mutationFn: async (payload: unknown) => (await api.post('/admin/products', payload)).data,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: unknown }) =>
      (await api.patch(`/admin/products/${id}`, payload)).data,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/products/${id}`)).data,
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

// ── Categories ────────────────────────────────────────────────
export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => (await api.get<Category[]>('/admin/categories')).data,
  });
}

export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
  const create = useMutation({
    mutationFn: async (payload: unknown) => (await api.post('/admin/categories', payload)).data,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: unknown }) =>
      (await api.patch(`/admin/categories/${id}`, payload)).data,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/categories/${id}`)).data,
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

// ── Orders ────────────────────────────────────────────────────
export function useAdminOrders(params: { search?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: async () => (await api.get<Paginated<Order>>('/admin/orders', { params })).data,
  });
}

export function useAdminOrder(id?: string) {
  return useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: async () => (await api.get<Order>(`/admin/orders/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useOrderMutations(id: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'order', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
  };
  const setStatus = useMutation({
    mutationFn: async (payload: { status: string; note?: string }) =>
      (await api.patch(`/admin/orders/${id}/status`, payload)).data,
    onSuccess: invalidate,
  });
  const refund = useMutation({
    mutationFn: async (payload: { amount?: number; reason?: string }) =>
      (await api.post(`/admin/orders/${id}/refund`, payload)).data,
    onSuccess: invalidate,
  });
  const createReturn = useMutation({
    mutationFn: async (payload: unknown) =>
      (await api.post(`/admin/orders/${id}/returns`, payload)).data,
    onSuccess: invalidate,
  });
  return { setStatus, refund, createReturn };
}

// ── Customers ─────────────────────────────────────────────────
export function useAdminCustomers(params: { search?: string; page?: number }) {
  return useQuery({
    queryKey: ['admin', 'customers', params],
    queryFn: async () =>
      (await api.get<Paginated<Customer>>('/admin/customers', { params })).data,
  });
}

export function useAdminCustomer(id?: string) {
  return useQuery({
    queryKey: ['admin', 'customer', id],
    queryFn: async () => (await api.get<Customer>(`/admin/customers/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useCustomerMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
  const create = useMutation({
    mutationFn: async (payload: unknown) => (await api.post('/admin/customers', payload)).data,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: unknown }) =>
      (await api.patch(`/admin/customers/${id}`, payload)).data,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/customers/${id}`)).data,
    onSuccess: invalidate,
  });
  return { create, update, remove };
}
