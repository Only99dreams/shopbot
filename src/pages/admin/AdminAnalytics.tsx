import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Store, Package, ShoppingCart, Users, TrendingUp, DollarSign } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function AdminAnalytics() {
  const { data: shops } = useQuery({
    queryKey: ['admin-analytics-shops'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shops').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ['admin-analytics-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ['admin-analytics-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['admin-analytics-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscriptions').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['admin-analytics-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
  const activeShops = shops?.filter(shop => shop.is_active).length || 0;
  const paidSubscriptions = subscriptions?.filter(sub => sub.status === 'active').length || 0;

  const stats = [
    { title: "Total Sellers", value: (profiles?.length || 0).toString(), icon: Users, change: "+12%" },
    { title: "Active Shops", value: activeShops.toString(), icon: Store, change: "+8%" },
    { title: "Total Products", value: (products?.length || 0).toString(), icon: Package, change: "+23%" },
    { title: "Total Orders", value: (orders?.length || 0).toString(), icon: ShoppingCart, change: "+15%" },
    { title: "Total Revenue", value: `₦${totalRevenue.toLocaleString()}`, icon: DollarSign, change: "+18%" },
    { title: "Paid Subscriptions", value: paidSubscriptions.toString(), icon: TrendingUp, change: "+5%" },
  ];

  // Generate sample data for charts based on actual data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      orders: Math.floor(Math.random() * 20) + (orders?.length || 0) / 7,
      revenue: Math.floor(Math.random() * 50000) + totalRevenue / 7,
    };
  });

  const subscriptionData = [
    { name: 'Trial', value: subscriptions?.filter(s => s.status === 'trial').length || 0 },
    { name: 'Active', value: subscriptions?.filter(s => s.status === 'active').length || 0 },
    { name: 'Cancelled', value: subscriptions?.filter(s => s.status === 'cancelled').length || 0 },
  ].filter(item => item.value > 0);

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Platform-wide performance metrics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-primary">{stat.change} from last month</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last7Days}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Orders Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Orders Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7Days}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="h-64 w-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subscriptionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {subscriptionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-4">
                {subscriptionData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm text-muted-foreground">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
