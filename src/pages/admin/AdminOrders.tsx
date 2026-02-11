import { AdminLayout } from '@/components/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { Package, Search, Eye, ShoppingCart, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  processing: 'bg-purple-500',
  shipped: 'bg-indigo-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const paymentStatusColors: Record<string, string> = {
  unpaid: 'bg-gray-500',
  paid: 'bg-green-500',
  refunded: 'bg-orange-500',
};

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, shops(name), customers(name, phone, email)')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: orderItems } = useQuery({
    queryKey: ['order-items', selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', selectedOrder.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrder
  });

  const updateStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string, status: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order status updated');
    }
  });

  const totalOrders = orders?.length || 0;
  const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
  const totalRevenue = orders?.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.total), 0) || 0;
  const avgOrderValue = totalOrders > 0 ? (orders?.reduce((sum, o) => sum + Number(o.total), 0) || 0) / totalOrders : 0;

  const filtered = orders?.filter(o =>
    o.order_number.toLowerCase().includes(search.toLowerCase()) ||
    o.shops?.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.customers?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7 lg:h-8 lg:w-8" /> Order Management
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base">View and manage all platform orders</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 lg:p-6 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold">{totalOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 lg:p-6 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold text-yellow-600">{pendingOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 lg:p-6 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold">₦{totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 lg:p-6 lg:pb-2">
              <CardTitle className="text-xs lg:text-sm font-medium">Avg Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 lg:p-6 lg:pt-0">
              <div className="text-xl lg:text-2xl font-bold">₦{avgOrderValue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No orders found</div>
          ) : filtered?.map((order: any) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold">{order.order_number}</span>
                  <Badge className={paymentStatusColors[order.payment_status] || 'bg-gray-500'}>
                    {order.payment_status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Shop:</span>
                    <p className="font-medium truncate">{order.shops?.name || 'Unknown'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <p className="font-medium truncate">{order.customers?.name || 'Guest'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <p className="font-bold">₦{Number(order.total).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <p>{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <Select
                    value={order.status}
                    onValueChange={(value) => updateStatus.mutate({ orderId: order.id, status: value })}
                  >
                    <SelectTrigger className="w-[130px] h-8">
                      <Badge className={statusColors[order.status] || 'bg-gray-500'}>
                        {order.status}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => setSelectedOrder(order)}>
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden lg:block">
          <CardContent className="p-0">
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : filtered?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No orders found</TableCell>
                  </TableRow>
                ) : filtered?.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.shops?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      <div>{order.customers?.name || 'Guest'}</div>
                      <div className="text-sm text-muted-foreground">{order.customers?.phone}</div>
                    </TableCell>
                    <TableCell className="font-semibold">₦{Number(order.total).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={paymentStatusColors[order.payment_status] || 'bg-gray-500'}>
                        {order.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={order.status}
                        onValueChange={(value) => updateStatus.mutate({ orderId: order.id, status: value })}
                      >
                        <SelectTrigger className="w-[130px]">
                          <Badge className={statusColors[order.status] || 'bg-gray-500'}>
                            {order.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{format(new Date(order.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedOrder(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Shop</p>
                <p className="font-medium">{selectedOrder?.shops?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{selectedOrder?.customers?.name || 'Guest'}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder?.customers?.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={statusColors[selectedOrder?.status] || 'bg-gray-500'}>
                  {selectedOrder?.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment</p>
                <Badge className={paymentStatusColors[selectedOrder?.payment_status] || 'bg-gray-500'}>
                  {selectedOrder?.payment_status}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Notes/Address</p>
              <p className="text-sm bg-muted p-2 rounded">{selectedOrder?.notes || 'No notes'}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Order Items</p>
              {/* Mobile items view */}
              <div className="sm:hidden space-y-2">
                {orderItems?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-muted rounded">
                    <div>
                      <p className="font-medium text-sm">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ₦{Number(item.unit_price).toLocaleString()}</p>
                    </div>
                    <p className="font-semibold text-sm">₦{Number(item.total_price).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              {/* Desktop items table */}
              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>₦{Number(item.unit_price).toLocaleString()}</TableCell>
                      <TableCell>₦{Number(item.total_price).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold">₦{Number(selectedOrder?.total).toLocaleString()}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
