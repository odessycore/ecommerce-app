import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader, EmptyState } from '@/components/ui/misc';
import { useProductBySlug } from '@/hooks/use-catalog';
import { useCartMutations } from '@/hooks/use-cart';
import { Recommendations } from '@/components/store/recommendations';
import { trackEvent } from '@/lib/analytics';
import { apiErrorMessage } from '@/lib/api';
import { cn, formatMoney } from '@/lib/utils';
import type { Product, ProductImage, ProductVariant } from '@/lib/types';

function Gallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const main = images[active]?.url;

  return (
    <div className="space-y-4">
      <div className="aspect-square overflow-hidden rounded-xl border border-border bg-secondary">
        {main ? (
          <img src={main} alt={name} className="size-full object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-secondary to-background" />
        )}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-3">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                'aspect-square overflow-hidden rounded-md border bg-secondary transition-colors',
                active === index ? 'border-foreground' : 'border-border',
              )}
            >
              <img src={image.url} alt={image.alt ?? name} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border">
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </Button>
      <span className="w-10 text-center text-sm">{value}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function ProductDetail({ product }: { product: Product }) {
  const activeVariants = product.variants.filter((variant) => variant.isActive);
  const variants = activeVariants.length ? activeVariants : product.variants;
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCartMutations();

  const selected = useMemo<ProductVariant | undefined>(
    () => variants.find((variant) => variant.id === selectedId) ?? variants[0],
    [variants, selectedId],
  );

  const outOfStock = !selected || selected.inventoryQuantity === 0;

  async function handleAdd() {
    if (!selected) return;
    try {
      await addItem.mutateAsync({ variantId: selected.id, quantity });
      toast.success('Added to bag');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not add to bag'));
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <Gallery images={product.images} name={product.name} />

      <div className="space-y-8">
        <div className="space-y-3">
          {product.brand && (
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {product.brand}
            </p>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
          <p className="text-2xl">{selected ? formatMoney(selected.priceAmount) : '—'}</p>
        </div>

        {product.description && (
          <p className="leading-relaxed text-muted-foreground">{product.description}</p>
        )}

        {variants.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Variant</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  disabled={variant.inventoryQuantity === 0}
                  onClick={() => setSelectedId(variant.id)}
                  className={cn(
                    'rounded-md border px-4 py-2 text-sm transition-colors disabled:opacity-40',
                    selected?.id === variant.id
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:border-foreground/50',
                  )}
                >
                  {variant.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <QuantityStepper value={quantity} onChange={setQuantity} />
          <Button onClick={handleAdd} disabled={outOfStock || addItem.isPending} size="lg">
            {outOfStock ? 'Out of stock' : addItem.isPending ? 'Adding…' : 'Add to bag'}
          </Button>
          {outOfStock && <Badge variant="muted">Sold out</Badge>}
        </div>
      </div>
    </div>
  );
}

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { data: product, isLoading, isError } = useProductBySlug(slug);

  useEffect(() => {
    if (product) trackEvent('PRODUCT_VIEWED', { productId: product.id });
  }, [product?.id]);

  return (
    <div className="space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to shop
      </Link>

      {isLoading ? (
        <PageLoader />
      ) : isError || !product ? (
        <EmptyState title="Product not found" description="This product may no longer be available." />
      ) : (
        <>
          <ProductDetail product={product} />
          <Recommendations productId={product.id} />
        </>
      )}
    </div>
  );
}
