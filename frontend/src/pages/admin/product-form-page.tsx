import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageLoader } from '@/components/ui/misc';
import { useAdminCategories, useAdminProduct, useProductMutations } from '@/hooks/use-admin';
import { apiErrorMessage } from '@/lib/api';
import type { ProductStatus } from '@/lib/types';

interface VariantForm {
  id?: string;
  sku: string;
  name: string;
  price: string;
  inventory: string;
}

interface ImageForm {
  url: string;
}

const NO_CATEGORY = '__none__';

export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const { data: product, isLoading } = useAdminProduct(id);
  const { data: categories } = useAdminCategories();
  const { create, update } = useProductMutations();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState<ProductStatus>('DRAFT');
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);
  const [images, setImages] = useState<ImageForm[]>([]);
  const [variants, setVariants] = useState<VariantForm[]>([
    { sku: '', name: '', price: '', inventory: '' },
  ]);

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setDescription(product.description ?? '');
    setBrand(product.brand ?? '');
    setStatus(product.status);
    setCategoryId(product.category?.id ?? NO_CATEGORY);
    setImages(product.images.map((image) => ({ url: image.url })));
    setVariants(
      product.variants.length > 0
        ? product.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            name: variant.name,
            price: (variant.priceAmount / 100).toString(),
            inventory: variant.inventoryQuantity.toString(),
          }))
        : [{ sku: '', name: '', price: '', inventory: '' }],
    );
  }, [product]);

  const updateVariant = (index: number, patch: Partial<VariantForm>) => {
    setVariants((prev) => prev.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!variants.some((variant) => variant.sku.trim())) {
      toast.error('At least one variant with a SKU is required');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      brand: brand.trim() || undefined,
      status,
      categoryId: categoryId === NO_CATEGORY ? undefined : categoryId,
      attributes: {},
      variants: variants
        .filter((variant) => variant.sku.trim())
        .map((variant) => ({
          ...(variant.id ? { id: variant.id } : {}),
          sku: variant.sku.trim(),
          name: variant.name.trim() || variant.sku.trim(),
          priceAmount: Math.round((Number(variant.price) || 0) * 100),
          inventoryQuantity: Math.round(Number(variant.inventory) || 0),
        })),
      images: images
        .filter((image) => image.url.trim())
        .map((image, index) => ({ url: image.url.trim(), position: index })),
    };

    try {
      if (isEdit && id) {
        await update.mutateAsync({ id, payload });
        toast.success('Product updated');
      } else {
        await create.mutateAsync(payload);
        toast.success('Product created');
      }
      navigate('/admin/products');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  if (isEdit && isLoading) return <PageLoader />;

  const isPending = create.isPending || update.isPending;

  return (
    <div>
      <Link
        to="/admin/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to products
      </Link>
      <PageHeader title={isEdit ? 'Edit product' : 'New product'} />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Variants</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setVariants((prev) => [...prev, { sku: '', name: '', price: '', inventory: '' }])
                }
              >
                <Plus className="size-4" /> Add variant
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {variants.map((variant, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">SKU</Label>
                    <Input
                      value={variant.sku}
                      onChange={(e) => updateVariant(index, { sku: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={variant.name}
                      onChange={(e) => updateVariant(index, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={variant.price}
                      onChange={(e) => updateVariant(index, { price: e.target.value })}
                      className="sm:w-28"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Inventory</Label>
                    <Input
                      type="number"
                      min="0"
                      value={variant.inventory}
                      onChange={(e) => updateVariant(index, { inventory: e.target.value })}
                      className="sm:w-24"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setVariants((prev) => prev.filter((_, i) => i !== index))}
                      disabled={variants.length === 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Images</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImages((prev) => [...prev, { url: '' }])}
              >
                <Plus className="size-4" /> Add image
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {images.length === 0 && (
                <p className="text-sm text-muted-foreground">No images added.</p>
              )}
              {images.map((image, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={image.url}
                    placeholder="https://..."
                    onChange={(e) =>
                      setImages((prev) =>
                        prev.map((img, i) => (i === index ? { url: e.target.value } : img)),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as ProductStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>None</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isPending}>
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/products">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
