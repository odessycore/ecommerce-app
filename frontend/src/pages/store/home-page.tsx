import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton, EmptyState } from '@/components/ui/misc';
import { Pagination } from '@/components/pagination';
import { useCategories, useStorefrontProducts } from '@/hooks/use-catalog';
import { cn, formatMoney } from '@/lib/utils';
import type { Product } from '@/lib/types';

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-black px-8 py-20 text-center md:py-28">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
      <div className="relative mx-auto max-w-2xl space-y-6">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">New season</p>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
          Considered essentials in monochrome
        </h1>
        <p className="text-muted-foreground md:text-lg">
          A curated wardrobe of timeless pieces, designed to last and made to move with you.
        </p>
      </div>
    </section>
  );
}

function CategoryChips({
  selected,
  onSelect,
}: {
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  const { data: categories } = useCategories();
  const chip = (active: boolean) =>
    cn(
      'rounded-full border px-4 py-1.5 text-sm transition-colors',
      active
        ? 'border-foreground bg-foreground text-background'
        : 'border-border text-muted-foreground hover:text-foreground',
    );

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={chip(!selected)} onClick={() => onSelect(undefined)}>
        All
      </button>
      {categories?.map((category) => (
        <button
          key={category.id}
          type="button"
          className={chip(selected === category.id)}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const image = product.images[0]?.url;
  const price = product.variants.length
    ? Math.min(...product.variants.map((variant) => variant.priceAmount))
    : 0;

  return (
    <Link to={`/products/${product.slug}`} className="group space-y-3">
      <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border bg-secondary">
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="size-full bg-gradient-to-br from-secondary to-background" />
        )}
      </div>
      <div className="space-y-1">
        {product.brand && (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{product.brand}</p>
        )}
        <p className="font-medium leading-tight">{product.name}</p>
        <p className="text-sm text-muted-foreground">{formatMoney(price)}</p>
      </div>
    </Link>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useStorefrontProducts({
    search: search || undefined,
    categoryId,
    page,
  });

  const products = data?.data ?? [];

  return (
    <div className="space-y-12">
      <Hero />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <CategoryChips
          selected={categoryId}
          onSelect={(id) => {
            setCategoryId(id);
            setPage(1);
          }}
        />
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search products"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <ProductGridSkeleton />
      ) : products.length === 0 ? (
        <EmptyState title="No products found" description="Try a different search or category." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pagination
            page={data?.meta.page ?? 1}
            totalPages={data?.meta.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
