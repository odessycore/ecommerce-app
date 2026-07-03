import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { EmptyState, Spinner } from '@/components/ui/misc';
import { Pagination } from '@/components/pagination';
import { useAdminCustomers, useCustomerMutations } from '@/hooks/use-admin';
import { apiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';

function AddCustomerDialog() {
  const { create } = useCustomerMutations();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const submit = async () => {
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    try {
      await create.mutateAsync({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      toast.success('Customer added');
      setOpen(false);
      setEmail('');
      setFirstName('');
      setLastName('');
      setPhone('');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" /> Add customer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>Create a new customer record.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            Add customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminCustomers({ search: search || undefined, page });

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage your customer base."
        actions={<AddCustomerDialog />}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search customers..."
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
              <EmptyState title="No customers found" description="Customers will appear here." />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((customer) => {
                    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
                    return (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          <Link
                            to={`/admin/customers/${customer.id}`}
                            className="hover:underline"
                          >
                            {name || '—'}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{customer.email}</TableCell>
                        <TableCell>
                          <StatusBadge kind="user" value={customer.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {customer._count?.orders ?? 0}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(customer.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
