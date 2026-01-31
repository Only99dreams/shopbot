import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "./useShop";
import { startOfWeek, endOfWeek, format, subDays, eachDayOfInterval } from "date-fns";

export interface AnalyticsData {
  stats: {
    totalRevenue: number;
    totalOrders: number;
    productsSold: number;
    newCustomers: number;
    revenueChange: number;
    ordersChange: number;
    productsChange: number;
    customersChange: number;
  };
  salesData: Array<{
    name: string;
    sales: number;
    orders: number;
    date: string;
  }>;
  categoryData: Array<{
    name: string;
    value: number;
  }>;
  topProducts: Array<{
    name: string;
    sales: number;
    revenue: number;
  }>;
}

export function useAnalytics() {
  const { shop } = useShop();

  return useQuery({
    queryKey: ['analytics', shop?.id],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!shop?.id) {
        throw new Error('Shop not found');
      }

      // Get date range for current week and previous week
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const prevWeekStart = subDays(weekStart, 7);
      const prevWeekEnd = subDays(weekEnd, 7);

      // Get all days in current week for chart data
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

      // Fetch current week data
      const [currentWeekOrders, prevWeekOrders, categories, products] = await Promise.all([
        // Current week orders with items
        supabase
          .from('orders')
          .select(`
            id,
            total,
            created_at,
            order_items (
              quantity,
              unit_price,
              product_id
            )
          `)
          .eq('shop_id', shop.id)
          .eq('payment_status', 'paid')
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString()),

        // Previous week orders for comparison
        supabase
          .from('orders')
          .select('id, total, created_at, order_items(quantity)')
          .eq('shop_id', shop.id)
          .eq('payment_status', 'paid')
          .gte('created_at', prevWeekStart.toISOString())
          .lte('created_at', prevWeekEnd.toISOString()),

        // Categories with product sales
        supabase
          .from('categories')
          .select(`
            id,
            name,
            products (
              id,
              order_items (
                quantity,
                unit_price,
                orders!inner (
                  payment_status,
                  created_at
                )
              )
            )
          `)
          .eq('shop_id', shop.id),

        // Top products
        supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            order_items (
              quantity,
              unit_price,
              orders!inner (
                payment_status,
                created_at
              )
            )
          `)
          .eq('shop_id', shop.id)
      ]);

      if (currentWeekOrders.error) throw currentWeekOrders.error;
      if (prevWeekOrders.error) throw prevWeekOrders.error;
      if (categories.error) throw categories.error;
      if (products.error) throw products.error;

      // Calculate stats
      const currentOrders = currentWeekOrders.data || [];
      const prevOrders = prevWeekOrders.data || [];

      const totalRevenue = currentOrders.reduce((sum, order) => sum + Number(order.total), 0);
      const totalOrders = currentOrders.length;
      const productsSold = currentOrders.reduce((sum, order) =>
        sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
      );

      const prevRevenue = prevOrders.reduce((sum, order) => sum + Number(order.total), 0);
      const prevOrderCount = prevOrders.length;
      const prevProductsSold = prevOrders.reduce((sum, order) =>
        sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
      );

      // Calculate new customers (customers who made their first order this week)
      const currentWeekCustomerIds = new Set(
        currentOrders
          .filter(order => order.customer_id)
          .map(order => order.customer_id)
      );

      const newCustomers = currentWeekCustomerIds.size; // Simplified - in a real app you'd check first-time customers

      // Calculate percentage changes
      const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
      const ordersChange = prevOrderCount > 0 ? ((totalOrders - prevOrderCount) / prevOrderCount) * 100 : 0;
      const productsChange = prevProductsSold > 0 ? ((productsSold - prevProductsSold) / prevProductsSold) * 100 : 0;
      const customersChange = 0; // Would need more complex logic for accurate customer change

      // Prepare sales data for chart
      const salesData = weekDays.map(day => {
        const dayOrders = currentOrders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate.toDateString() === day.toDateString();
        });

        const dayRevenue = dayOrders.reduce((sum, order) => sum + Number(order.total), 0);
        const dayOrderCount = dayOrders.length;

        return {
          name: format(day, 'EEE'), // Mon, Tue, etc.
          sales: dayRevenue,
          orders: dayOrderCount,
          date: day.toISOString()
        };
      });

      // Calculate category distribution
      const categoryData: Array<{ name: string; value: number }> = [];
      const totalCategoryRevenue = categories.data?.reduce((sum, category) => {
        const categoryRevenue = category.products?.reduce((catSum, product) => {
          const productRevenue = product.order_items?.reduce((prodSum, item) => {
            return prodSum + (item.quantity * Number(item.unit_price));
          }, 0) || 0;
          return catSum + productRevenue;
        }, 0) || 0;
        if (categoryRevenue > 0) {
          categoryData.push({
            name: category.name,
            value: Math.round((categoryRevenue / totalRevenue) * 100) || 0
          });
        }
        return sum + categoryRevenue;
      }, 0) || 0;

      // Calculate top products
      const topProducts = products.data
        ?.map(product => {
          const totalSold = product.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
          const totalRevenue = product.order_items?.reduce((sum, item) =>
            sum + (item.quantity * Number(item.unit_price)), 0) || 0;

          return {
            name: product.name,
            sales: totalSold,
            revenue: totalRevenue
          };
        })
        .filter(product => product.sales > 0)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5) || [];

      return {
        stats: {
          totalRevenue,
          totalOrders,
          productsSold,
          newCustomers,
          revenueChange,
          ordersChange,
          productsChange,
          customersChange
        },
        salesData,
        categoryData,
        topProducts
      };
    },
    enabled: !!shop?.id,
  });
}