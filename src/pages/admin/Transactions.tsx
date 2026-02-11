import { AdminLayout } from '@/components/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export default function Transactions() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, shops(name), customers(name, phone)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const totalTransactions = orders?.length || 0;
  const totalValue = orders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
  const paidOrders = orders?.filter(o => o.payment_status === 'paid').length || 0;

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      confirmed: 'default',
      completed: 'default',
      delivered: 'default',
      cancelled: 'destructive',
    };
    return colors[status] || 'secondary';
  };

  const getPaymentColor = (status: string) => {
    if (status === 'paid') return 'bg-green-500';
    if (status === 'unpaid') return 'bg-gray-500';
    return 'bg-orange-500';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 lg:h-8 lg:w-8" /> Transactions
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base">All orders across the platform</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 lg:gap-4">
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold">{totalTransactions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold">₦{totalValue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 lg:p-6 pb-2 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Paid</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold text-green-600">{paidOrders}</div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : orders?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No orders found</div>
          ) : orders?.map((order: any) => (
            <Card key={order.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">{order.order_number}</span>
                  <Badge className={getPaymentColor(order.payment_status)}>
                    {order.payment_status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Shop</span>
                    <p className="font-medium truncate">{(order.shops as any)?.name || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer</span>
                    <p className="font-medium truncate">{(order.customers as any)?.name || 'Guest'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total</span>
                    <p className="font-bold">₦{Number(order.total).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date</span>
                    <p>{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <Badge variant={getStatusColor(order.status)}>{order.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : orders?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders found</TableCell></TableRow>
              ) : orders?.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{(order.shops as any)?.name}</TableCell>
                  <TableCell>{(order.customers as any)?.name || 'Guest'}</TableCell>
                  <TableCell>₦{Number(order.total).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={getPaymentColor(order.payment_status)}>
                      {order.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant={getStatusColor(order.status)}>{order.status}</Badge></TableCell>
                  <TableCell>{format(new Date(order.created_at), 'MMM d, yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
