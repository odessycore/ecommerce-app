import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { PageLoader } from '@/components/ui/misc';
import { useAdminOrder, useOrderMutations } from '@/hooks/use-admin';
import { apiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import type { Order, OrderStatus } from '@/lib/types';

const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'FULFILLED', 'COMPLETED', 'CANCELLED'];

function StatusActions({ order, id }: { order: Order; id: string }) {
  const { setStatus } = useOrderMutations(id);
  const [next, setNext] = useState<OrderStatus>(order.status);

  useEffect(() => {
    setNext(order.status);
  }, [order.status]);

  const submit = async () => {
    try {
      await setStatus.mutateAsync({ status: next });
      toast.success('Status updated');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-2">
      <Label>Order status</Label>
      <div className="flex gap-2">
        <Select value={next} onValueChange={(value) => setNext(value as OrderStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={submit} disabled={setStatus.isPending || next === order.status}>
          Update
        </Button>
      </div>
    </div>
  );
}

function RefundDialog({ order, id }: { order: Order; id: string }) {
  const { refund } = useOrderMutations(id);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const submit = async () => {
    try {
      await refund.mutateAsync({
        amount: amount.trim() ? Math.round(Number(amount) * 100) : undefined,
        reason: reason.trim() || undefined,
      });
      toast.success('Refund issued');
      setOpen(false);
      setAmount('');
      setReason('');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Issue refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue refund</DialogTitle>
          <DialogDescription>
            Leave the amount blank to refund the full remaining total of{' '}
            {formatMoney(order.totalAmount - order.refundedAmount, order.currency)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Amount ($)</Label>
            <Input
              id="refund-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Full remaining amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={refund.isPending}>
            Issue refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ order, id }: { order: Order; id: string }) {
  const { createReturn } = useOrderMutations(id);
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');

  const submit = async () => {
    const items = Object.entries(quantities)
      .map(([orderItemId, value]) => ({ orderItemId, quantity: Math.round(Number(value) || 0) }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      toast.error('Select at least one item to return');
      return;
    }

    try {
      await createReturn.mutateAsync({ items, reason: reason.trim() || undefined });
      toast.success('Return created');
      setOpen(false);
      setQuantities({});
      setReason('');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Create return
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create return</DialogTitle>
          <DialogDescription>Choose how many of each item to return.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {(order.items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.sku} · ordered {item.quantity}
                </p>
              </div>
              <Input
                type="number"
                min="0"
                max={item.quantity}
                value={quantities[item.id] ?? ''}
                onChange={(e) =>
                  setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
                className="w-20"
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="return-reason">Reason</Label>
            <Textarea
              id="return-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createReturn.isPending}>
            Create return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminOrderDetailPage() {
  const { id } = useParams();
  const { data: order, isLoading } = useAdminOrder(id);

  if (isLoading || !order || !id) return <PageLoader />;

  return (
    <div>
      <Link
        to="/admin/orders"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to orders
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Order {order.orderNumber}</h1>
        <StatusBadge kind="order" value={order.status} />
        <StatusBadge kind="payment" value={order.paymentStatus} />
        <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(order.items ?? []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.sku}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(item.unitAmount, order.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(item.totalAmount, order.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="space-y-1 border-t border-border p-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoney(order.subtotalAmount, order.currency)}</span>
                </div>
                {order.refundedAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Refunded</span>
                    <span>-{formatMoney(order.refundedAmount, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(order.totalAmount, order.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {(order.events ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                <ol className="space-y-4">
                  {(order.events ?? []).map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {event.type.replace(/_/g, ' ').toLowerCase()}
                        </p>
                        {event.message && (
                          <p className="text-sm text-muted-foreground">{event.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {order.customer && (
                <Link
                  to={`/admin/customers/${order.customer.id}`}
                  className="font-medium hover:underline"
                >
                  {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') ||
                    'View customer'}
                </Link>
              )}
              <p className="text-muted-foreground">{order.email}</p>
            </CardContent>
          </Card>

          {order.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5 text-sm text-muted-foreground">
                {Object.values(order.shippingAddress)
                  .filter(Boolean)
                  .map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusActions order={order} id={id} />
              <RefundDialog order={order} id={id} />
              <ReturnDialog order={order} id={id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
