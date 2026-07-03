import { Badge } from '@/components/ui/badge';
import type { OrderStatus, PaymentStatus, ProductStatus, UserStatus } from '@/lib/types';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'muted' | 'outline';

const ORDER: Record<OrderStatus, Variant> = {
  PENDING: 'warning',
  PAID: 'default',
  FULFILLED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};

const PAYMENT: Record<PaymentStatus, Variant> = {
  REQUIRES_PAYMENT: 'warning',
  PROCESSING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'destructive',
  REFUNDED: 'muted',
  PARTIALLY_REFUNDED: 'muted',
};

const PRODUCT: Record<ProductStatus, Variant> = {
  DRAFT: 'muted',
  ACTIVE: 'success',
  ARCHIVED: 'destructive',
};

const USER: Record<UserStatus, Variant> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  SUSPENDED: 'destructive',
  DEACTIVATED: 'muted',
};

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase();

export function StatusBadge({
  kind,
  value,
}: {
  kind: 'order' | 'payment' | 'product' | 'user';
  value: string;
}) {
  const map = { order: ORDER, payment: PAYMENT, product: PRODUCT, user: USER }[kind] as Record<
    string,
    Variant
  >;
  return (
    <Badge variant={map[value] ?? 'default'} className="capitalize">
      {label(value)}
    </Badge>
  );
}
