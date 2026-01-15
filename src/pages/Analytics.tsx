import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ShoppingCart, Package, Users, DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const salesData = [
  { name: "Mon", sales: 4000, orders: 24 },
  { name: "Tue", sales: 3000, orders: 18 },
  { name: "Wed", sales: 5000, orders: 32 },
  { name: "Thu", sales: 2780, orders: 15 },
  { name: "Fri", sales: 6890, orders: 45 },
  { name: "Sat", sales: 8390, orders: 52 },
  { name: "Sun", sales: 4490, orders: 28 },
];

const categoryData = [
  { name: "T-Shirts", value: 35 },
  { name: "Shoes", value: 25 },
  { name: "Accessories", value: 20 },
  { name: "Bags", value: 12 },
  { name: "Other", value: 8 },
];

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const stats = [
  { title: "Total Revenue", value: "₦2,450,000", change: "+12.5%", up: true, icon: DollarSign },
  { title: "Total Orders", value: "1,234", change: "+8.2%", up: true, icon: ShoppingCart },
  { title: "Products Sold", value: "3,456", change: "+15.3%", up: true, icon: Package },
  { title: "New Customers", value: "234", change: "-2.1%", up: false, icon: Users },
];

export default function Analytics() {
  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your shop's performance</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${stat.up ? 'text-green-500' : 'text-destructive'}`}>
                    {stat.up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-bold">{stat.value}</h3>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Chart */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-muted-foreground" />
                    <YAxis className="text-muted-foreground" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary) / 0.2)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Orders Chart */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Orders This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-muted-foreground" />
                    <YAxis className="text-muted-foreground" />
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

        {/* Category Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="shadow-card lg:col-span-1">
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {categoryData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index] }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card className="shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Classic White Tee", sales: 156, revenue: "₦858,000" },
                  { name: "Running Sneakers", sales: 124, revenue: "₦2,728,000" },
                  { name: "Leather Watch", sales: 98, revenue: "₦833,000" },
                  { name: "Designer Handbag", sales: 87, revenue: "₦1,044,000" },
                  { name: "Denim Jacket", sales: 65, revenue: "₦975,000" },
                ].map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-primary">#{index + 1}</span>
                      <div>
                        <h4 className="font-medium">{product.name}</h4>
                        <p className="text-sm text-muted-foreground">{product.sales} sold</p>
                      </div>
                    </div>
                    <span className="font-semibold">{product.revenue}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
