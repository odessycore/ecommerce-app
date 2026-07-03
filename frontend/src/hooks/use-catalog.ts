import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Category, Paginated, Product } from '@/lib/types';

interface ProductFilters {
  search?: string;
  categoryId?: string;
  page?: number;
}

export function useStorefrontProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Product>>('/products', { params: filters });
      return data;
    },
  });
}

export function useProductBySlug(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data } = await api.get<Product>(`/products/${slug}`);
      return data;
    },
    enabled: Boolean(slug),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories');
      return data;
    },
  });
}
