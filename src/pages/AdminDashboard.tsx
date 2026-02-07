import { AdminLayout } from "@/components/AdminLayout";
import { 
  Users, 
  Store,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  AlertTriangle,
  ShoppingCart,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const { data: shops, isLoading: shopsLoading } = useQuery({
    queryKey: ['admin-dashboard-shops'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shops').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ['admin-dashboard-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscriptions').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['admin-dashboard-payments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('*').eq('status', 'success');
      if (error) throw error;
      return data;
    },
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-dashboard-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*, shops(name)').order('created_at', { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingPayouts } = useQuery({
    queryKey: ['admin-dashboard-pending-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payout_requests').select('*').eq('status', 'pending');
      if (error) throw error;
      return data;
    },
  });

  const isLoading = shopsLoading || subsLoading || paymentsLoading || ordersLoading;

  const totalSellers = shops?.length || 0;
  const activeShops = shops?.filter(s => s.is_active)?.length || 0;
  const activeRate = totalSellers > 0 ? Math.round((activeShops / totalSellers) * 100) : 0;
  const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const platformFees = payments?.reduce((sum, p) => sum + Number(p.platform_fee || 0), 0) || 0;
  const activeSubscriptions = subscriptions?.filter(s => s.status === 'active')?.length || 0;
  const pendingPayoutsCount = pendingPayouts?.length || 0;

  const stats = [
    { title: "Total Sellers", value: totalSellers.toString(), change: `${activeShops} active`, icon: Users, color: "bg-blue-500" },
    { title: "Active Shops", value: activeShops.toString(), change: `${activeRate}% active rate`, icon: Store, color: "bg-green-500" },
    { title: "Total Revenue", value: `₦${totalRevenue.toLocaleString()}`, change: `₦${platformFees.toLocaleString()} platform fees`, icon: TrendingUp, color: "bg-purple-500" },
    { title: "Subscriptions", value: activeSubscriptions.toString(), change: `${activeSubscriptions} active`, icon: CreditCard, color: "bg-orange-500" },
  ];

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-500',
      confirmed: 'bg-blue-500/10 text-blue-500',
      processing: 'bg-purple-500/10 text-purple-500',
      shipped: 'bg-indigo-500/10 text-indigo-500',
      delivered: 'bg-green-500/10 text-green-500',
      cancelled: 'bg-red-500/10 text-red-500',
    };
    return <Badge className={colors[status] || 'bg-muted text-muted-foreground'}>{status}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage the platform</p>
          </div>
          <Button className="w-full md:w-auto">Export Report</Button>
        </div>

        {/* Alerts */}
        {pendingPayoutsCount > 0 && (
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span className="text-sm">{pendingPayoutsCount} pending payout request(s) require attention</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))
          ) : (
            stats.map((stat) => (
              <div key={stat.title} className="bg-card rounded-xl p-6 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className={`h-12 w-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold mb-1">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-xs text-primary mt-2">{stat.change}</p>
              </div>
            ))
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-card rounded-xl border border-border mb-8">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Recent Orders
            </h2>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/orders">View All</a>
            </Button>
          </div>
          {ordersLoading ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : orders && orders.length > 0 ? (
            <>
              {/* Mobile card list */}
              <div className="lg:hidden space-y-4 p-4">
                {orders.map((order) => (
                  <div key={order.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{order.order_number}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'MMM d, yyyy')}</div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{(order.shops as any)?.name || 'Unknown'}</div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">₦{Number(order.total).toLocaleString()}</div>
                      <div>{getStatusBadge(order.status)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{(order.shops as any)?.name || 'Unknown'}</TableCell>
                        <TableCell>₦{Number(order.total).toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{format(new Date(order.created_at), 'MMM d, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No orders yet</h3>
              <p className="text-sm text-muted-foreground">
                When customers place orders, they'll appear here.
              </p>
            </div>
          )}
        </div>

        {/* Recent Sellers */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Shops
            </h2>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/shops">View All</a>
            </Button>
          </div>
          {shopsLoading ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : shops && shops.length > 0 ? (
            <>
              {/* Mobile card list */}
              <div className="lg:hidden space-y-4 p-4">
                {shops.slice(0, 5).map((s) => (
                  <div key={s.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'MMM d, yyyy')}</div>
                    </div>
                    <div>
                      <Badge className={s.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shop Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shops.slice(0, 5).map((shop) => (
                      <TableRow key={shop.id}>
                        <TableCell className="font-medium">{shop.name}</TableCell>
                        <TableCell>
                          <Badge className={shop.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}>
                            {shop.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(shop.created_at), 'MMM d, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No sellers yet</h3>
              <p className="text-sm text-muted-foreground">
                When sellers register, they'll appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
