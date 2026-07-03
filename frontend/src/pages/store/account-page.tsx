import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import { formatDate, formatMoney, initials } from '@/lib/utils';
import type { Order, Paginated } from '@/lib/types';

function ProfileCard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Your account';

  async function handleSignOut() {
    await logout();
    navigate('/');
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
            {initials(user.firstName, user.lastName, user.email)}
          </span>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{name}</p>
              <Badge variant="outline" className="capitalize">
                {user.role.toLowerCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}

function OrdersCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Order>>('/orders');
      return data;
    },
  });

  const orders = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order history</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <PageLoader />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders yet" description="Your orders will appear here." />
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
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
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
  );
}

export function AccountPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Account</h1>
      <ProfileCard />
      <OrdersCard />
    </div>
  );
}
