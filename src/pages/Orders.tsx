import { useState, useEffect } from "react";
import { useMutation } from '@tanstack/react-query';
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  ShoppingCart,
  Loader2,
  Eye,
  QrCode
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { useToast } from "@/hooks/use-toast";
import { RedemptionCodeModal } from "@/components/RedemptionCodeModal";
import { OrderDetailsModal } from "@/components/OrderDetailsModal";

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  payment_status: string;
  redemption_confirmed: boolean;
  created_at: string;
  customers: {
    name: string | null;
    phone: string;
  } | null;
  redemption_codes: {
    code: string;
    status: string;
  } | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);

  const { shop } = useShop();
  const { toast } = useToast();

  useEffect(() => {
    if (shop) {
      fetchOrders();
    }
  }, [shop]);

  const fetchOrders = async () => {
    if (!shop) return;
    
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone),
        redemption_codes!order_id (code, status)
      `)
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      if (error) throw error;
      return { orderId, newStatus };
    },
    onMutate: async ({ orderId, newStatus }) => {
      // optimistic update
      const previous = orders;
      setOrders((prev) => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      return { previous };
    },
    onError: (err: any, _vars, context: any) => {
      setOrders(context?.previous || []);
      toast({ title: 'Error', description: err.message || 'Failed to update order', variant: 'destructive' });
    },
    onSuccess: (_data) => {
      toast({ title: 'Order updated', description: 'Order status changed.' });
      fetchOrders();
    }
  });

  const updateOrderStatus = (orderId: string, newStatus: string) => updateStatusMutation.mutate({ orderId, newStatus });

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customers?.phone.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Orders</h1>
            <p className="text-muted-foreground">Manage customer orders</p>
          </div>
          <RedemptionCodeModal
            mode="confirm_delivery"
            onSuccess={fetchOrders}
            trigger={
              <Button variant="outline">
                <QrCode className="h-4 w-4 mr-2" />
                Redeem Code
              </Button>
            }
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No orders yet</h3>
            <p className="text-sm text-muted-foreground">
              When customers place orders, they'll appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{order.order_number}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[order.status]}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Customer</span>
                    <span>{order.customers?.name || 'Guest'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{order.customers?.phone}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">₦{order.total.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Payment</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      order.payment_status === 'paid' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {order.payment_status}
                    </span>
                  </div>
                  {order.redemption_codes && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Code</span>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {order.redemption_codes.code}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Redemption</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      order.redemption_confirmed
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {order.redemption_confirmed ? 'Confirmed' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Select value={order.status} onValueChange={(value) => updateOrderStatus(order.id, value)}>
                      <SelectTrigger className="flex-1 h-9">
                        <SelectValue placeholder="Update Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setViewingOrderId(order.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Order</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Customer</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Total</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Payment</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Code</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Redemption</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-medium">{order.order_number}</td>
                        <td className="p-4">
                          <div>
                            <p className="text-sm">{order.customers?.name || 'Guest'}</p>
                            <p className="text-xs text-muted-foreground">{order.customers?.phone}</p>
                          </div>
                        </td>
                        <td className="p-4 font-medium">₦{order.total.toLocaleString()}</td>
                        <td className="p-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            order.payment_status === 'paid' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {order.payment_status}
                          </span>
                        </td>
                        <td className="p-4">
                          {order.redemption_codes ? (
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                              {order.redemption_codes.code}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            order.redemption_confirmed
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {order.redemption_confirmed ? 'Confirmed' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-4">
                          <Select value={order.status} onValueChange={(value) => updateOrderStatus(order.id, value)}>
                            <SelectTrigger className="w-32 h-8">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[order.status]}`}>
                                {order.status}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              <SelectItem value="shipped">Shipped</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setViewingOrderId(order.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <OrderDetailsModal
        orderId={viewingOrderId}
        open={!!viewingOrderId}
        onOpenChange={(open) => setViewingOrderId(open ? viewingOrderId : null)}
      />
    </DashboardLayout>
  );
}
