import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShopHeader } from '@/components/storefront/ShopHeader';
import { StorefrontProductCard } from '@/components/storefront/StorefrontProductCard';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { CartProvider } from '@/hooks/useCart';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DynamicMeta } from '@/components/SEO/DynamicMeta';

function ShopContent() {
  const { shopId } = useParams<{ shopId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId!)
        .eq('is_active', true)
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

  if (shopLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-40 w-full" />
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
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

  const shopUrl = `${window.location.origin}/shop/${shopId}`;
  const ogDescription = shop.description || `Shop amazing products at ${shop.name}. Fast delivery, secure payments, and great customer service on WAShop.`;
  const ogImage = shop.logo_url || '/og-default.jpg';

  return (
    <div className="min-h-screen bg-background">
      <DynamicMeta 
        title={`${shop.name} | Shop Now on WAShop`}
        description={ogDescription}
        image={ogImage}
        url={shopUrl}
      />
      
      <ShopHeader 
        name={shop.name}
        description={shop.description}
        logoUrl={shop.logo_url}
        whatsappNumber={shop.whatsapp_number}
      />

      {/* Search and Cart Bar */}
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <CartDrawer shopId={shopId!} />
        </div>
      </div>

      {/* Category Tabs */}
      {categories && categories.length > 0 && (
        <div className="border-b overflow-x-auto">
          <div className="container mx-auto px-4">
            <div className="flex gap-2 py-3">
              <Button
                variant={selectedCategory === null ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <main className="container mx-auto px-4 py-8">
        {productsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : filteredProducts && filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No products found</p>
          </div>
        )}
      </main>

      {/* Floating WhatsApp Button */}
      {shop.whatsapp_number && (
        <a
          href={`https://wa.me/${shop.whatsapp_number.replace(/\D/g, '')}?text=Hi, I'm interested in your products!`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 z-50"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}

      {/* Footer */}
      <footer className="bg-muted py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            Powered by <span className="font-semibold text-primary">ShopNaija</span>
          </p>
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
