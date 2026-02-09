import { DashboardLayout } from "@/components/DashboardLayout";
import { 
  ShoppingCart, 
  Package, 
  Users, 
  TrendingUp,
  ArrowUpRight,
  Share2,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareShopModal } from "@/components/ShareShopModal";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const { shop, subscription } = useShop();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Fetch real stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', shop?.id],
    queryFn: async () => {
      if (!shop?.id) return null;

      const [ordersRes, productsRes, customersRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, total, created_at')
          .eq('shop_id', shop.id),
        supabase
          .from('products')
          .select('id')
          .eq('shop_id', shop.id),
        supabase
          .from('customers')
          .select('id')
          .eq('shop_id', shop.id)
      ]);

      const orders = ordersRes.data || [];
      const totalSales = orders.reduce((sum, order) => sum + Number(order.total), 0);

      return {
        totalSales,
        ordersCount: orders.length,
        productsCount: productsRes.data?.length || 0,
        customersCount: customersRes.data?.length || 0
      };
    },
    enabled: !!shop?.id
  });

  // Fetch recent orders
  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['recent-orders', shop?.id],
    queryFn: async () => {
      if (!shop?.id) return [];

      const { data } = await supabase
        .from('orders')
        .select('*, customers(name, phone)')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!shop?.id
  });

  const shopLink = shop ? `${window.location.origin}/shop/${shop.id}` : '';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const statItems = [
    {
      title: "Total Sales",
      value: statsLoading ? null : formatCurrency(stats?.totalSales || 0),
      icon: TrendingUp,
    },
    {
      title: "Orders",
      value: statsLoading ? null : String(stats?.ordersCount || 0),
      icon: ShoppingCart,
    },
    {
      title: "Products",
      value: statsLoading ? null : String(stats?.productsCount || 0),
      icon: Package,
    },
    {
      title: "Customers",
      value: statsLoading ? null : String(stats?.customersCount || 0),
      icon: Users,
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Inactive Subscription Banner */}
        {subscription?.status !== 'active' && (
          <div className="mb-4 sm:mb-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-600 text-base">Activate Your Shop</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your shop is currently closed. Subscribe to a plan to open your shop, accept orders, and start selling to customers.
                </p>
              </div>
            </div>
            <Button size="default" className="w-full sm:w-auto flex-shrink-0" onClick={() => navigate('/dashboard/subscription')}>
              Activate Now
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
              Welcome, {shop?.name || user?.email?.split('@')[0] || 'Seller'}!
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">Here's what's happening with your shop today.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setShareModalOpen(true)} className="w-full sm:w-auto">
              <Share2 className="h-4 w-4 mr-2" />
              Share Shop
            </Button>
            <Button size="sm" onClick={() => shop && window.open(`/shop/${shop.id}`, '_blank')} className="w-full sm:w-auto">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Shop
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {statItems.map((stat) => (
            <div
              key={stat.title}
              className="bg-card rounded-xl p-4 sm:p-6 border border-border"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="flex items-center gap-1 text-sm font-medium text-primary">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
              {stat.value === null ? (
                <Skeleton className="h-6 sm:h-8 w-20 sm:w-24 mb-1" />
              ) : (
                <p className="text-lg sm:text-2xl font-bold mb-1 truncate">{stat.value}</p>
              )}
              <p className="text-xs sm:text-sm text-muted-foreground">{stat.title}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-card rounded-xl p-4 sm:p-6 border border-border">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Add Your First Product</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              Start selling by adding products to your shop.
            </p>
            <Button size="sm" asChild className="w-full sm:w-auto">
              <a href="/dashboard/products">Add Product</a>
            </Button>
          </div>
          <div className="bg-card rounded-xl p-4 sm:p-6 border border-border">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Set Up Categories</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              Organize your products into categories.
            </p>
            <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
              <a href="/dashboard/categories">Manage Categories</a>
            </Button>
          </div>
          <div className="bg-card rounded-xl p-4 sm:p-6 border border-border">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Share Your Shop</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
              Share your shop link on social media to start selling.
            </p>
            <Button size="sm" variant="outline" onClick={() => setShareModalOpen(true)} className="w-full sm:w-auto">
              Share Link
            </Button>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 sm:p-6 border-b border-border">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
          </div>
          {ordersLoading ? (
            <div className="p-4 sm:p-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentOrders && recentOrders.length > 0 ? (
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <div key={order.id} className="p-3 sm:p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{order.order_number}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {order.customers?.name || 'Unknown Customer'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-medium">{formatCurrency(order.total)}</p>
                    <p className="text-sm text-muted-foreground capitalize">{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No orders yet</h3>
              <p className="text-sm text-muted-foreground">
                When customers place orders, they'll appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <ShareShopModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        shopLink={shopLink}
        shopName={shop?.name || 'My Shop'}
      />
    </DashboardLayout>
  );
}
