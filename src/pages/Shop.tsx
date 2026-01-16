import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShopHeader } from '@/components/storefront/ShopHeader';
import { StorefrontProductCard } from '@/components/storefront/StorefrontProductCard';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { CartProvider } from '@/hooks/useCart';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageCircle, SlidersHorizontal, Grid3X3, LayoutGrid, Package, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DynamicMeta } from '@/components/SEO/DynamicMeta';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function ShopContent() {
  const { shopId } = useParams<{ shopId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState<2 | 3>(2);

  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!shopId
  });

  // Fetch subscription to check if shop owner has active subscription
  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['shop-subscription', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('shop_id', shopId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!shopId
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['shop-products', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId!)
        .eq('is_available', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!shopId
  });

  const { data: categories } = useQuery({
    queryKey: ['shop-categories', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('shop_id', shopId!)
        .order('sort_order');

      if (error) throw error;
      return data;
    },
    enabled: !!shopId
  });

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (shopLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
        {/* Header Skeleton */}
        <Skeleton className="h-64 w-full" />
        <div className="container mx-auto px-4 -mt-20">
          <div className="bg-background rounded-2xl shadow-xl p-6 mb-8">
            <div className="flex items-center gap-6">
              <Skeleton className="w-32 h-32 rounded-2xl -mt-20" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-10 w-40 rounded-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Shop Not Found</h1>
          <p className="text-muted-foreground mb-4">This shop doesn't exist or is no longer active.</p>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if subscription is active
  const isSubscriptionActive = subscription?.status === 'active';

  if (!isSubscriptionActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Shop Currently Unavailable</h1>
          <p className="text-muted-foreground mb-6">
            This shop is temporarily closed. Please check back later or contact the shop owner.
          </p>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const shopUrl = `${window.location.origin}/shop/${shopId}`;
  const ogDescription = shop.description || `Shop amazing products at ${shop.name}. Fast delivery, secure payments, and great customer service on ShopAfrica.`;
  const ogImage = shop.logo_url || '/og-default.jpg';

  const productCount = products?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      <DynamicMeta 
        title={`${shop.name} | Shop Now on ShopAfrica`}
        description={ogDescription}
        image={ogImage}
        url={shopUrl}
      />
      
      <ShopHeader 
        name={shop.name}
        description={shop.description}
        logoUrl={shop.logo_url}
        whatsappNumber={shop.whatsapp_number}
        totalProducts={productCount}
        state={shop.state}
        city={shop.city}
      />

      {/* Sticky Search and Cart Bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 h-11 rounded-full border-muted-foreground/20 bg-muted/50 focus:bg-background transition-colors"
              />
            </div>
            
            {/* Grid Toggle - Desktop only */}
            <div className="hidden sm:flex items-center gap-1 bg-muted rounded-full p-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full",
                  gridCols === 2 && "bg-background shadow-sm"
                )}
                onClick={() => setGridCols(2)}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full",
                  gridCols === 3 && "bg-background shadow-sm"
                )}
                onClick={() => setGridCols(3)}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>

            {/* Cart */}
            <CartDrawer shopId={shopId!} />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      {categories && categories.length > 0 && (
        <div className="bg-background/50 backdrop-blur-sm border-b">
          <div className="container mx-auto px-4">
            <div className="flex gap-2 py-4 overflow-x-auto scrollbar-hide">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "rounded-full whitespace-nowrap transition-all",
                  selectedCategory === null 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                    : "hover:bg-muted"
                )}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                All Products
              </Button>
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "rounded-full whitespace-nowrap transition-all",
                    selectedCategory === category.id 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                      : "hover:bg-muted"
                  )}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Products Section */}
      <main className="container mx-auto px-4 py-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              {selectedCategory 
                ? categories?.find(c => c.id === selectedCategory)?.name 
                : 'All Products'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {filteredProducts?.length || 0} products available
            </p>
          </div>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className={cn(
            "grid gap-4 sm:gap-6",
            gridCols === 2 
              ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" 
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          )}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredProducts && filteredProducts.length > 0 ? (
          <div className={cn(
            "grid gap-4 sm:gap-6",
            gridCols === 2 
              ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" 
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          )}>
            {filteredProducts.map(product => (
              <StorefrontProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
                compareAtPrice={product.compare_at_price}
                image={product.images?.[0]}
                shopId={shopId!}
                stockQuantity={product.stock_quantity}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No products found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery 
                ? `No products match "${searchQuery}". Try a different search term.`
                : "This shop hasn't added any products yet. Check back soon!"}
            </p>
          </div>
        )}
      </main>

      {/* Floating WhatsApp Button */}
      {shop.whatsapp_number && (
        <a
          href={`https://wa.me/${shop.whatsapp_number.replace(/\D/g, '')}?text=Hi, I'm interested in your products!`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-xl shadow-green-500/30 transition-all hover:scale-110 hover:shadow-2xl hover:shadow-green-500/40 z-50 group"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-white text-gray-800 px-4 py-2 rounded-full text-sm font-medium shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Chat with us!
          </span>
        </a>
      )}

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-12 mt-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold">ShopAfrica</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-md">
              Empowering African businesses to sell online with ease. Start your own shop today!
            </p>
            <div className="flex items-center gap-4 mt-6">
              <Badge variant="secondary" className="text-xs">
                Secure Payments
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Fast Delivery
              </Badge>
              <Badge variant="secondary" className="text-xs">
                24/7 Support
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs mt-6">
              © {new Date().getFullYear()} ShopAfrica. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Shop() {
  return (
    <CartProvider>
      <ShopContent />
    </CartProvider>
  );
}
