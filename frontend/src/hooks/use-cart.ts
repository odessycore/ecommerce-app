import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { setCartToken } from '@/lib/cart-token';
import type { Cart } from '@/lib/types';

const CART_KEY = ['cart'];

export function useCart() {
  return useQuery({
    queryKey: CART_KEY,
    queryFn: async () => {
      const { data } = await api.get<Cart | null>('/cart');
      if (data?.token) setCartToken(data.token);
      return data;
    },
  });
}

export function useCartMutations() {
  const queryClient = useQueryClient();
  const sync = (cart: Cart) => {
    if (cart?.token) setCartToken(cart.token);
    queryClient.setQueryData(CART_KEY, cart);
  };

  const addItem = useMutation({
    mutationFn: async (input: { variantId: string; quantity: number }) => {
      const { data } = await api.post<Cart>('/cart/items', input);
      return data;
    },
    onSuccess: sync,
  });

  const updateItem = useMutation({
    mutationFn: async (input: { itemId: string; quantity: number }) => {
      const { data } = await api.patch<Cart>(`/cart/items/${input.itemId}`, {
        quantity: input.quantity,
      });
      return data;
    },
    onSuccess: sync,
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await api.delete<Cart>(`/cart/items/${itemId}`);
      return data;
    },
    onSuccess: sync,
  });

  return { addItem, updateItem, removeItem };
}
