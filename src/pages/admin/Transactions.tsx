import { AdminLayout } from '@/components/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';

export default function Transactions() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*, shops(name), customers(name, phone)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = { pending: 'secondary', confirmed: 'default', completed: 'default', cancelled: 'destructive' };
    return colors[status] || 'secondary';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><ShoppingBag className="h-8 w-8" /> Transactions</h1><p className="text-muted-foreground">All orders across the platform</p></div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Shop</TableHead><TableHead>Customer</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow> : orders?.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No orders found</TableCell></TableRow> : orders?.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{(order.shops as { name: string })?.name}</TableCell>
                  <TableCell>{(order.customers as { name: string })?.name || 'Guest'}</TableCell>
                  <TableCell>₦{order.total.toLocaleString()}</TableCell>
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
