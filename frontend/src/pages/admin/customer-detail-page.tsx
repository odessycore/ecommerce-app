import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { useAdminCustomer, useCustomerMutations } from '@/hooks/use-admin';
import { apiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import type { Customer, UserStatus } from '@/lib/types';

const STATUSES: UserStatus[] = ['ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED'];

function EditCustomerDialog({ customer }: { customer: Customer }) {
  const { update } = useCustomerMutations();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(customer.firstName ?? '');
  const [lastName, setLastName] = useState(customer.lastName ?? '');
  const [phone, setPhone] = useState(customer.phone ?? '');
  const [status, setStatus] = useState<UserStatus>(customer.status);

  useEffect(() => {
    setFirstName(customer.firstName ?? '');
    setLastName(customer.lastName ?? '');
    setPhone(customer.phone ?? '');
    setStatus(customer.status);
  }, [customer]);

  const submit = async () => {
    try {
      await update.mutateAsync({
        id: customer.id,
        payload: {
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
          status,
        },
      });
      toast.success('Customer updated');
      setOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as UserStatus)}>
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
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={update.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCustomerDetailPage() {
  const { id } = useParams();
  const { data: customer, isLoading } = useAdminCustomer(id);
  const { remove } = useCustomerMutations();

  if (isLoading || !customer) return <PageLoader />;

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
  const addresses = (customer as Customer & { addresses?: Record<string, unknown>[] }).addresses;

  const handleDeactivate = async () => {
    if (!window.confirm(`Deactivate ${name || customer.email}?`)) return;
    try {
      await remove.mutateAsync(customer.id);
      toast.success('Customer deactivated');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <Link
        to="/admin/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to customers
      </Link>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{name || customer.email}</h1>
        <div className="flex items-center gap-2">
          <EditCustomerDialog customer={customer} />
          <Button variant="destructive" onClick={handleDeactivate} disabled={remove.isPending}>
            Deactivate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span>{name || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="truncate">{customer.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge kind="user" value={customer.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{customer.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span>{formatDate(customer.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last login</span>
                <span>{customer.lastLoginAt ? formatDate(customer.lastLoginAt) : '—'}</span>
              </div>
            </CardContent>
          </Card>

          {addresses && addresses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Addresses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                {addresses.map((address, index) => (
                  <div key={index} className="space-y-0.5 rounded-md border border-border p-3">
                    {Object.values(address)
                      .filter(Boolean)
                      .map((line, lineIndex) => (
                        <p key={lineIndex}>{String(line)}</p>
                      ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!customer.orders || customer.orders.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No orders" description="This customer has not placed any orders." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link to={`/admin/orders/${order.id}`} className="hover:underline">
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="order" value={order.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(order.totalAmount, order.currency)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
