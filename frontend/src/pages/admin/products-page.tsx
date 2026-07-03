import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, Spinner } from '@/components/ui/misc';
import { Pagination } from '@/components/pagination';
import { useAdminProducts, useProductMutations } from '@/hooks/use-admin';
import { formatMoney } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api';
import type { Product } from '@/lib/types';

function minPrice(product: Product): number {
  if (product.variants.length === 0) return 0;
  return Math.min(...product.variants.map((variant) => variant.priceAmount));
}

function totalInventory(product: Product): number {
  return product.variants.reduce((sum, variant) => sum + variant.inventoryQuantity, 0);
}

export function AdminProductsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminProducts({ search: search || undefined, page });
  const { remove } = useProductMutations();

  const handleArchive = async (product: Product) => {
    if (!window.confirm(`Archive "${product.name}"?`)) return;
    try {
      await remove.mutateAsync(product.id);
      toast.success('Product archived');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your catalog."
        actions={
          <Button asChild>
            <Link to="/admin/products/new">
              <Plus className="size-4" /> New product
            </Link>
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search products..."
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-6" />
            </div>
          ) : !data || data.data.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No products found" description="Create your first product to get started." />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Inventory</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                            {product.images[0]?.url && (
                              <img
                                src={product.images[0].url}
                                alt={product.name}
                                className="size-full object-cover"
                              />
                            )}
                          </div>
                          <Link
                            to={`/admin/products/${product.id}`}
                            className="font-medium hover:underline"
                          >
                            {product.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.category?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="product" value={product.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(minPrice(product))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {totalInventory(product)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon">
                            <Link to={`/admin/products/${product.id}`}>
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleArchive(product)}
                            disabled={remove.isPending}
                          >
                            <Archive className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-4 pb-4">
                <Pagination
                  page={data.meta.page}
                  totalPages={data.meta.totalPages}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
