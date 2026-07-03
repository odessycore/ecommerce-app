import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, Spinner } from '@/components/ui/misc';
import { Pagination } from '@/components/pagination';
import { useAdminOrders } from '@/hooks/use-admin';
import { formatDate, formatMoney } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';

const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'FULFILLED', 'COMPLETED', 'CANCELLED'];
const ALL = '__all__';

export function AdminOrdersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminOrders({
    search: search || undefined,
    status: status === ALL ? undefined : status,
    page,
  });

  return (
    <div>
      <PageHeader title="Orders" description="Track and fulfill customer orders." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search orders..."
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-6" />
            </div>
          ) : !data || data.data.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No orders found" description="Orders will appear here." />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link to={`/admin/orders/${order.id}`} className="hover:underline">
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{order.email}</TableCell>
                      <TableCell>
                        <StatusBadge kind="order" value={order.status} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="payment" value={order.paymentStatus} />
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
