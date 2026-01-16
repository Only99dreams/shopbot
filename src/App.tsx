import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Analytics from "./pages/Analytics";
import Messages from "./pages/Messages";
import Referrals from "./pages/Referrals";
import Subscription from "./pages/Subscription";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
// Public storefront pages
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import Marketplace from "./pages/Marketplace";
// Admin pages
import Sellers from "./pages/admin/Sellers";
import Shops from "./pages/admin/Shops";
import AdminProducts from "./pages/admin/AdminProducts";
import Transactions from "./pages/admin/Transactions";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminReferrals from "./pages/admin/AdminReferrals";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminSellersManagement from "./pages/admin/AdminSellersManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="shopnaija-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Public storefront routes */}
              <Route path="/shop/:shopId" element={<Shop />} />
              <Route path="/shop/:shopId/product/:productId" element={<ProductDetail />} />
              <Route path="/shop/:shopId/checkout" element={<Checkout />} />
              {/* Seller dashboard routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
              <Route path="/dashboard/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
              <Route path="/dashboard/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/dashboard/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
              <Route path="/dashboard/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/dashboard/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/dashboard/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
              <Route path="/dashboard/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              {/* Admin routes */}
              <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/sellers" element={<ProtectedRoute requireAdmin><Sellers /></ProtectedRoute>} />
              <Route path="/admin/sellers-management" element={<ProtectedRoute requireAdmin><AdminSellersManagement /></ProtectedRoute>} />
              <Route path="/admin/shops" element={<ProtectedRoute requireAdmin><Shops /></ProtectedRoute>} />
              <Route path="/admin/products" element={<ProtectedRoute requireAdmin><AdminProducts /></ProtectedRoute>} />
              <Route path="/admin/orders" element={<ProtectedRoute requireAdmin><AdminOrders /></ProtectedRoute>} />
              <Route path="/admin/payments" element={<ProtectedRoute requireAdmin><AdminPayments /></ProtectedRoute>} />
              <Route path="/admin/transactions" element={<ProtectedRoute requireAdmin><Transactions /></ProtectedRoute>} />
              <Route path="/admin/subscriptions" element={<ProtectedRoute requireAdmin><AdminSubscriptions /></ProtectedRoute>} />
              <Route path="/admin/referrals" element={<ProtectedRoute requireAdmin><AdminReferrals /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><AdminAnalytics /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
