import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Store,
  ShoppingCart, 
  BarChart3, 
  Settings, 
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Share2,
  Package,
  Wallet,
  UserCog,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/admin" },
  { icon: UserCog, label: "Seller Management", href: "/admin/sellers-management" },
  { icon: Users, label: "Sellers", href: "/admin/sellers" },
  { icon: Store, label: "Shops", href: "/admin/shops" },
  { icon: Package, label: "Products", href: "/admin/products" },
  { icon: ShoppingCart, label: "Orders", href: "/admin/orders" },
  { icon: Wallet, label: "Payments", href: "/admin/payments" },
  { icon: CreditCard, label: "Subscriptions", href: "/admin/subscriptions" },
  { icon: Share2, label: "Referrals", href: "/admin/referrals" },
  { icon: BarChart3, label: "Analytics", href: "/admin/analytics" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut, user } = useAuth();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile menu on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 flex w-full">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="ShopAfrica" className="h-8 w-8 object-contain" />
          <span className="text-lg font-bold">Admin Panel</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300",
          "lg:translate-x-0",
          collapsed ? "lg:w-16" : "lg:w-64",
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full",
          "lg:top-0 top-14"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo - Hidden on mobile since we have mobile header */}
          <div className="hidden lg:flex h-16 items-center justify-between px-4 border-b border-border">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="ShopAfrica" className="h-8 w-8 object-contain" />
                <span className="text-lg font-bold">Admin Panel</span>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border space-y-2">
            <div className={cn("flex items-center", collapsed ? "lg:justify-center" : "justify-between")}>
              {(!collapsed || mobileOpen) && (
                <span className="text-sm text-muted-foreground truncate">
                  {user?.email}
                </span>
              )}
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={signOut}
              className={cn("w-full justify-start gap-3", collapsed && !mobileOpen && "lg:justify-center")}
            >
              <LogOut className="h-5 w-5" />
              {(!collapsed || mobileOpen) && <span>Logout</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 min-h-screen transition-all duration-300",
          "pt-14 lg:pt-0", // Account for mobile header
          "ml-0", // No margin on mobile
          collapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        {children}
      </main>
    </div>
  );
}
