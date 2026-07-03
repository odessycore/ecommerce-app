import { Link } from 'react-router-dom';
import { useAuth } from '@/providers/auth-provider';
import { useRecommendations } from '@/hooks/use-recommendations';
import { Skeleton } from '@/components/ui/misc';
import { formatMoney } from '@/lib/utils';
import type { Product } from '@/lib/types';

function minPrice(product: Product): number {
  return product.variants.reduce(
    (min, v) => Math.min(min, v.priceAmount),
    product.variants[0]?.priceAmount ?? 0,
  );
}

export function Recommendations({ productId }: { productId: string }) {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';
  const { data, isLoading } = useRecommendations(productId, isCustomer);

  if (!isCustomer) return null;
  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className="space-y-5 border-t border-border pt-10">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">You might also like</h2>
        <p className="text-sm text-muted-foreground">Personalized from your taste and order history.</p>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)
          : data?.map((product) => (
              <Link key={product.id} to={`/products/${product.slug}`} className="group space-y-2">
                <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border bg-secondary">
                  {product.images[0]?.url ? (
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="size-full bg-gradient-to-br from-secondary to-background" />
                  )}
                </div>
                <div>
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{formatMoney(minPrice(product))}</p>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
