import { Link } from 'react-router-dom';
import { DollarSign, Package, ShoppingCart, Users, Clock } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { useDashboardMetrics } from '@/hooks/use-admin';
import { formatDate, formatMoney } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useDashboardMetrics();

  if (isLoading || !data) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Dashboard" description="An overview of your store performance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Gross revenue" value={formatMoney(data.grossRevenue)} icon={DollarSign} />
        <StatCard label="Orders" value={String(data.orderCount)} icon={ShoppingCart} />
        <StatCard label="Customers" value={String(data.customerCount)} icon={Users} />
        <StatCard label="Products" value={String(data.productCount)} icon={Package} />
        <StatCard label="Pending fulfillment" value={String(data.pendingOrders)} icon={Clock} />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" description="New orders will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentOrders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to={`/admin/orders/${order.id}`} className="hover:underline">
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.email}</TableCell>
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
  );
}
