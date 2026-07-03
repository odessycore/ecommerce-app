import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Product } from '@/lib/types';

export function useRecommendations(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['recommendations', productId],
    queryFn: async () => {
      const { data } = await api.get<Product[]>(`/ai/recommendations/${productId}`);
      return data;
    },
    enabled: enabled && Boolean(productId),
  });
}
