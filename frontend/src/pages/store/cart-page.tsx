import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { useCart, useCartMutations } from '@/hooks/use-cart';
import { apiErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import type { Cart, CartItem } from '@/lib/types';

function CartRow({ item, currency }: { item: CartItem; currency: string }) {
  const { updateItem, removeItem } = useCartMutations();

  async function changeQuantity(quantity: number) {
    try {
      await updateItem.mutateAsync({ itemId: item.id, quantity });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not update quantity'));
    }
  }

  async function remove() {
    try {
      await removeItem.mutateAsync(item.id);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not remove item'));
    }
  }

  const busy = updateItem.isPending || removeItem.isPending;

  return (
    <Card>
      <CardContent className="flex gap-4 p-4">
        <div className="size-24 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
          ) : (
            <div className="size-full bg-gradient-to-br from-secondary to-background" />
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium leading-tight">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.variantName}</p>
              <p className="text-xs text-muted-foreground">SKU {item.sku}</p>
            </div>
            <p className="font-medium">{formatMoney(item.lineTotal, currency)}</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="inline-flex items-center rounded-md border border-border">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={busy || item.quantity <= 1}
                onClick={() => changeQuantity(item.quantity - 1)}
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-9 text-center text-sm">{item.quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={busy}
                onClick={() => changeQuantity(item.quantity + 1)}
                aria-label="Increase quantity"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={remove}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Summary({ cart }: { cart: Cart }) {
  return (
    <Card className="lg:sticky lg:top-24">
      <CardContent className="space-y-4 p-6">
        <h2 className="font-semibold">Summary</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatMoney(cart.subtotal, cart.currency)}</span>
        </div>
        <p className="text-xs text-muted-foreground">Shipping and taxes calculated at checkout.</p>
        <Button asChild size="lg" className="w-full">
          <Link to="/checkout">Checkout</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function CartPage() {
  const { data: cart, isLoading } = useCart();

  if (isLoading) return <PageLoader />;

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Your bag</h1>

      {isEmpty ? (
        <div className="space-y-6">
          <EmptyState title="Your bag is empty" description="Discover something you'll love." />
          <div className="flex justify-center">
            <Button asChild>
              <Link to="/">Continue shopping</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {cart.items.map((item) => (
              <CartRow key={item.id} item={item} currency={cart.currency} />
            ))}
          </div>
          <Summary cart={cart} />
        </div>
      )}
    </div>
  );
}
