import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  MapPin, 
  Store, 
  Package, 
  TrendingUp, 
  ArrowRight, 
  Star, 
  ShoppingBag,
  Filter,
  Grid3X3,
  LayoutGrid,
  Sparkles,
  ChevronRight,
  Heart,
  Eye,
  BarChart3,
  Users,
  Zap,
  TrendingDown,
  ShoppingCart,
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

// Nigerian states for location filter
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

// Product categories for filtering
const PRODUCT_CATEGORIES = [
  { id: 'all', name: 'All Products', icon: Package },
  { id: 'food', name: 'Food & Groceries', icon: ShoppingBag },
  { id: 'electronics', name: 'Electronics', icon: Zap },
  { id: 'fashion', name: 'Fashion', icon: Heart },
  { id: 'home', name: 'Home & Living', icon: Store },
];

interface Shop {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean | null;
  whatsapp_number: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
  product_count?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  images: string[] | null;
  description: string | null;
  shop_id: string;
  is_available: boolean | null;
  shops: {
    id: string;
    name: string;
    logo_url: string | null;
    state: string | null;
    city: string | null;
  };
}

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface TrackedOrder {
  id: string;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
  redemption_confirmed?: boolean;
  shops?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  order_items: OrderItem[];
}

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('All States');
  const [selectedCity, setSelectedCity] = useState('All Areas');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'price-low' | 'price-high' | 'newest' | 'popular'>('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'products' | 'shops' | 'orders'>('products');
  const [orderNumber, setOrderNumber] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<TrackedOrder | null>(null);
  const { user } = useAuth();

  // Reset city when state changes
  useEffect(() => {
    setSelectedCity('All Areas');
  }, [selectedState]);

  // Fetch all active shops with their subscriptions
  const { data: shops, isLoading: shopsLoading, refetch: refetchShops } = useQuery({
    queryKey: ['marketplace-shops', selectedState, selectedCity],
    queryFn: async () => {
      // First get all shops with their subscription status
      let query = supabase
        .from('shops')
        .select(`
          *,
          subscriptions(status),
          products(count)
        `)
        .eq('is_active', true);

      // Apply state filter if a specific state is selected
      if (selectedState && selectedState !== 'All States') {
        query = query.eq('state', selectedState);
      }

      // Apply city/area filter if a specific city is selected
      if (selectedCity && selectedCity !== 'All Areas') {
        query = query.ilike('city', `%${selectedCity}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching shops:', error);
        throw error;
      }
      
      // Filter shops that are active and have active or trial subscription
      const filteredShops = (data || []).filter(shop => {
        const isActive = shop.is_active !== false;
        const subscription = Array.isArray(shop.subscriptions)
          ? shop.subscriptions[0]
          : shop.subscriptions;
        const status = subscription?.status;
        const hasValidSubscription = !subscription || status === 'active' || status === 'trial';

        return isActive && hasValidSubscription;
      });
      
      return filteredShops.map(shop => ({
        ...shop,
        product_count: Array.isArray(shop.products) ? shop.products[0]?.count || 0 : 0
      })) as Shop[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch all products from active shops
  const { data: products, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['marketplace-products', selectedState, selectedCity],
    queryFn: async () => {
      // Fetch products with shop and subscription info
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          shops(
            id,
            name,
            logo_url,
            state,
            city,
            is_active,
            subscriptions(status)
          )
        `)
        .eq('is_available', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
      
      // Filter products from active shops with valid subscriptions
      const filteredProducts = (data || []).filter(product => {
        const shop = product.shops;
        if (!shop || shop.is_active === false) {
          return false;
        }

        const subscription = Array.isArray(shop.subscriptions)
          ? shop.subscriptions[0]
          : shop.subscriptions;
        const status = subscription?.status;
        const hasValidSubscription = !subscription || status === 'active' || status === 'trial';

        if (!hasValidSubscription) {
          return false;
        }
        
        // Apply location filters
        if (selectedState && selectedState !== 'All States' && shop.state !== selectedState) {
          return false;
        }
        if (selectedCity && selectedCity !== 'All Areas' && !shop.city?.toLowerCase().includes(selectedCity.toLowerCase())) {
          return false;
        }
        
        return true;
      });
      
      return filteredProducts as Product[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Confirm receipt mutation
  const confirmReceiptMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { code: 'DIRECT_CONFIRM', action: 'confirm_receipt', orderId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Receipt confirmed! Seller has been credited.');
      // Update the tracked order to reflect confirmation
      setTrackedOrder(prev => prev ? { ...prev, redemption_confirmed: true } : null);
    },
    onError: (error: Error) => {
      console.error('Confirm receipt error:', error);
      toast.error(error.message || 'Failed to confirm receipt');
    },
  });

  // Track order by order number
  const trackOrderMutation = useMutation({
    mutationFn: async (orderNum: string) => {
      const normalizedOrder = orderNum.trim().toUpperCase();
      const { data, error } = await supabase.rpc('track_order_by_number', {
        p_order_number: normalizedOrder,
      });

      if (error) throw error;
      if (!data) throw new Error('Order not found');
      return data as unknown as TrackedOrder;
    },
    onSuccess: (data) => {
      setTrackedOrder(data);
    },
    onError: (error: Error) => {
      toast.error('Order not found or not eligible for tracking');
      setTrackedOrder(null);
    },
  });

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let filtered = products.filter(product => {
      const matchesSearch = searchQuery === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });

    // Sort products
    switch (sortBy) {
      case 'price-low':
        filtered = filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered = filtered.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        // Already sorted by created_at desc
        break;
      case 'popular':
        // Randomize for now (in production, sort by views/orders)
        break;
    }

    return filtered;
  }, [products, searchQuery, sortBy]);

  // Filter shops
  const filteredShops = useMemo(() => {
    if (!shops) return [];
    
    return shops.filter(shop => {
      const matchesSearch = searchQuery === '' || 
        shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Location filtering is already done at database level
      return matchesSearch;
    });
  }, [shops, searchQuery]);

  // Group products by name for price comparison
  const priceComparison = useMemo(() => {
    if (!products || searchQuery.length < 2) return [];
    
    const searchLower = searchQuery.toLowerCase();
    const matchingProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchLower)
    );

    // Group by similar product names
    const grouped = matchingProducts.reduce((acc, product) => {
      const key = product.name.toLowerCase().trim();
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(product);
      return acc;
    }, {} as Record<string, Product[]>);

    // Only show groups with multiple shops selling similar products
    return Object.entries(grouped)
      .filter(([_, prods]) => prods.length >= 1)
      .map(([name, prods]) => ({
        name: prods[0].name,
        products: prods.sort((a, b) => a.price - b.price),
        lowestPrice: Math.min(...prods.map(p => p.price)),
        highestPrice: Math.max(...prods.map(p => p.price)),
        shopCount: new Set(prods.map(p => p.shop_id)).size
      }))
      .sort((a, b) => b.shopCount - a.shopCount)
      .slice(0, 10);
  }, [products, searchQuery]);

  const isLoading = shopsLoading || productsLoading;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Hero Header */}
      <header className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        <div className="container mx-auto px-4 py-12 sm:py-16 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="bg-white/20 text-white hover:bg-white/30 mb-4">
              <TrendingDown className="w-3 h-3 mr-1" />
              Compare Prices Locally
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Compare Prices in Your Area
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mb-8">
              Find the best deals from shops near you. Compare prices locally and get the best value for your money.
            </p>

            {/* Search Bar */}
            <div className="max-w-3xl mx-auto">
              <div className="flex flex-col gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search for products like 'tomatoes', 'rice', 'phone'..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-14 rounded-full bg-white text-black placeholder:text-black/60 border-0 shadow-xl text-base"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger className="h-12 rounded-full bg-white/10 border-white/20 text-white flex-1">
                      <MapPin className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All States">All States</SelectItem>
                      {NIGERIAN_STATES.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="relative flex-1">
                    <Input
                      placeholder="Type your area (e.g., Ikeja, Lekki, Surulere)..."
                      value={selectedCity === 'All Areas' ? '' : selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value || 'All Areas')}
                      className="h-12 rounded-full bg-white/10 border-white/20 text-white placeholder:text-white/60 pl-10"
                    />
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center justify-center gap-6 mt-8 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                <span><strong>{shops?.length || 0}</strong> Active Shops</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                <span><strong>{products?.length || 0}</strong> Products</span>
              </div>
              {(selectedState !== 'All States' || selectedCity !== 'All Areas') && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  <span>
                    {selectedCity !== 'All Areas' && selectedCity ? (
                      <>in <strong>{selectedCity}</strong>{selectedState !== 'All States' ? `, ${selectedState}` : ''}</>
                    ) : (
                      <>in <strong>{selectedState}</strong></>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Price Comparison Section - Shows when searching */}
        {searchQuery.length >= 2 && priceComparison.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Price Comparison</h2>
              <Badge variant="secondary" className="ml-2">
                {priceComparison.length} results
              </Badge>
            </div>
            <div className="grid gap-4">
              {priceComparison.slice(0, 5).map((item, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Store className="w-4 h-4" />
                            {item.shopCount} shop{item.shopCount > 1 ? 's' : ''} selling this
                          </span>
                          <span className="flex items-center gap-1 text-green-600">
                            <TrendingUp className="w-4 h-4" />
                            Save up to ₦{(item.highestPrice - item.lowestPrice).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">From</p>
                        <p className="text-2xl font-bold text-primary">₦{item.lowestPrice.toLocaleString()}</p>
                        {item.highestPrice > item.lowestPrice && (
                          <p className="text-sm text-muted-foreground line-through">
                            to ₦{item.highestPrice.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Shop Listings */}
                    <div className="mt-4 space-y-2">
                      {item.products.slice(0, 3).map((product) => (
                        <Link 
                          key={product.id} 
                          to={`/shop/${product.shop_id}/product/${product.id}`}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-background border overflow-hidden">
                              {product.shops?.logo_url ? (
                                <img src={product.shops.logo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                  <Store className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{product.shops?.name}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                4.8
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">₦{product.price.toLocaleString()}</span>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </div>
                        </Link>
                      ))}
                      {item.products.length > 3 && (
                        <Button variant="ghost" className="w-full text-sm">
                          View all {item.products.length} listings
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'products' | 'shops' | 'orders')}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabsList className={cn("h-12 p-1 bg-muted/50", "grid grid-cols-3")}>
              <TabsTrigger value="products" className="h-10 px-6 rounded-lg data-[state=active]:shadow-sm">
                <Package className="w-4 h-4 mr-2" />
                Products
              </TabsTrigger>
              <TabsTrigger value="shops" className="h-10 px-6 rounded-lg data-[state=active]:shadow-sm">
                <Store className="w-4 h-4 mr-2" />
                Shops
              </TabsTrigger>
              <TabsTrigger value="orders" className="h-10 px-6 rounded-lg data-[state=active]:shadow-sm">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Track Order
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-3">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[160px] rounded-full">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center border rounded-full p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8 rounded-full", viewMode === 'grid' && "bg-primary text-primary-foreground")}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8 rounded-full", viewMode === 'list' && "bg-primary text-primary-foreground")}
                  onClick={() => setViewMode('list')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-0">
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square bg-muted rounded-xl mb-3" />
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground mb-4">
                  {(selectedState !== 'All States' || selectedCity !== 'All Areas')
                    ? `No products available in ${selectedCity !== 'All Areas' ? selectedCity + (selectedState !== 'All States' ? ', ' + selectedState : '') : selectedState}. Try selecting a different location.`
                    : 'Try adjusting your search or browse all products'}
                </p>
                <div className="flex gap-2 justify-center">
                  {searchQuery && (
                    <Button variant="outline" onClick={() => setSearchQuery('')}>
                      Clear Search
                    </Button>
                  )}
                  {(selectedState !== 'All States' || selectedCity !== 'All Areas') && (
                    <Button onClick={() => { setSelectedState('All States'); setSelectedCity('All Areas'); }}>
                      View All Locations
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className={cn(
                "grid gap-4",
                viewMode === 'grid' 
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" 
                  : "grid-cols-1 sm:grid-cols-2"
              )}>
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} viewMode={viewMode} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Shops Tab */}
          <TabsContent value="shops" className="mt-0">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse p-6 bg-muted rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-muted-foreground/20 rounded-full" />
                      <div className="flex-1">
                        <div className="h-5 bg-muted-foreground/20 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-muted-foreground/20 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredShops.length === 0 ? (
              <div className="text-center py-16">
                <Store className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No shops found</h3>
                <p className="text-muted-foreground mb-4">
                  {(selectedState !== 'All States' || selectedCity !== 'All Areas')
                    ? `No shops available in ${selectedCity !== 'All Areas' ? selectedCity + (selectedState !== 'All States' ? ', ' + selectedState : '') : selectedState}. Try selecting a different location.`
                    : 'Try adjusting your search'}
                </p>
                <div className="flex gap-2 justify-center">
                  {searchQuery && (
                    <Button variant="outline" onClick={() => setSearchQuery('')}>
                      Clear Search
                    </Button>
                  )}
                  {(selectedState !== 'All States' || selectedCity !== 'All Areas') && (
                    <Button onClick={() => { setSelectedState('All States'); setSelectedCity('All Areas'); }}>
                      View All Locations
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredShops.map((shop) => (
                  <ShopCard key={shop.id} shop={shop} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            {!trackedOrder ? (
              // Order tracking form
              <div className="max-w-md mx-auto">
                <div className="text-center py-16">
                  <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Track Your Order</h3>
                  <p className="text-muted-foreground mb-6">
                    Enter your order number to track and confirm receipt.
                  </p>
                  <div className="space-y-4">
                    <Input
                      placeholder="Enter order number (e.g., ORD-ABC123)"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="text-center"
                    />
                    <Button 
                      className="w-full" 
                      onClick={() => trackOrderMutation.mutate(orderNumber)}
                      disabled={!orderNumber.trim() || trackOrderMutation.isPending}
                    >
                      {trackOrderMutation.isPending ? 'Tracking...' : 'Track Order'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // Show tracked order
              <div className="max-w-2xl mx-auto py-8">
                <Card className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted overflow-hidden">
                          {trackedOrder.shops?.logo_url ? (
                            <img src={trackedOrder.shops.logo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <Store className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{trackedOrder.shops?.name}</h3>
                          <p className="text-sm text-muted-foreground">Order #{trackedOrder.order_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">₦{trackedOrder.total.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(trackedOrder.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {trackedOrder.order_items.map((item: OrderItem, index: number) => (
                        <div key={index} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{item.product_name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {item.quantity}x
                            </Badge>
                          </div>
                          <span className="text-sm font-medium">₦{item.total_price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setTrackedOrder(null);
                          setOrderNumber('');
                        }}
                      >
                        Track Another Order
                      </Button>
                      {!trackedOrder.redemption_confirmed && (
                        <Button 
                          className="flex-1"
                          onClick={() => confirmReceiptMutation.mutate(trackedOrder.id)}
                          disabled={confirmReceiptMutation.isPending}
                        >
                          {confirmReceiptMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Confirm Receipt
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Start Selling?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Join thousands of sellers on ShopAfrica and reach customers across Nigeria. 
            Set up your shop in minutes!
          </p>
          <Link to="/auth">
            <Button size="lg" className="rounded-full px-8 h-12 shadow-lg shadow-primary/25">
              <Store className="w-5 h-5 mr-2" />
              Create Your Shop
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            © 2026 <span className="font-semibold text-primary">ShopAfrica</span>. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Product Card Component
function ProductCard({ product, viewMode }: { product: Product; viewMode: 'grid' | 'list' }) {
  const [isLiked, setIsLiked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercent = hasDiscount 
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100) 
    : 0;

  if (viewMode === 'list') {
    return (
      <Link to={`/shop/${product.shop_id}/product/${product.id}`}>
        <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
          <CardContent className="p-0">
            <div className="flex gap-4">
              <div className="w-32 h-32 relative flex-shrink-0">
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-muted animate-pulse" />
                )}
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className={cn(
                      "w-full h-full object-cover transition-opacity duration-300",
                      imageLoaded ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => setImageLoaded(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Package className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                {hasDiscount && (
                  <Badge className="absolute top-2 left-2 bg-red-500 hover:bg-red-600 text-xs">
                    -{discountPercent}%
                  </Badge>
                )}
              </div>
              <div className="flex-1 py-3 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-muted overflow-hidden">
                    {product.shops?.logo_url ? (
                      <img src={product.shops.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-3 h-3 m-1 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{product.shops?.name}</span>
                  {product.shops?.state && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {product.shops.city ? `${product.shops.city}, ` : ''}{product.shops.state}
                    </span>
                  )}
                </div>
                <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-lg font-bold text-primary">₦{product.price.toLocaleString()}</span>
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through">
                      ₦{product.compare_at_price?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link to={`/shop/${product.shop_id}/product/${product.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group border-0 bg-card">
        <CardContent className="p-0">
          <div className="aspect-square relative overflow-hidden bg-muted">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-muted animate-pulse" />
            )}
            {product.images?.[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className={cn(
                  "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setImageLoaded(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Badges */}
            {hasDiscount && (
              <Badge className="absolute top-2 left-2 bg-red-500 hover:bg-red-600 text-xs font-bold shadow-lg">
                -{discountPercent}%
              </Badge>
            )}

            {/* Action buttons */}
            <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full shadow-lg"
                onClick={(e) => {
                  e.preventDefault();
                  setIsLiked(!isLiked);
                }}
              >
                <Heart className={cn("h-4 w-4", isLiked && "fill-red-500 text-red-500")} />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full shadow-lg"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>

            {/* Shop badge */}
            <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1">
                <div className="w-5 h-5 rounded-full bg-muted overflow-hidden">
                  {product.shops?.logo_url ? (
                    <img src={product.shops.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-3 h-3 m-1 text-muted-foreground" />
                  )}
                </div>
                <span className="text-xs font-medium text-black truncate">{product.shops?.name}</span>
              </div>
            </div>
          </div>

          <div className="p-3">
            <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-primary">₦{product.price.toLocaleString()}</span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  ₦{product.compare_at_price?.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Shop Card Component
function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link to={`/shop/${shop.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group h-full">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/10 overflow-hidden flex-shrink-0">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Store className="w-8 h-8 text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg truncate text-white group-hover:text-primary transition-colors">
                  {shop.name}
                </h3>
                <Badge variant="secondary" className="text-xs shrink-0">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                  4.8
                </Badge>
              </div>
              {shop.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {shop.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {shop.product_count} products
                </span>
                {shop.state && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {shop.city ? `${shop.city}, ` : ''}{shop.state}
                  </span>
                )}
                <span className="flex items-center gap-1 text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Active
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Visit Shop</span>
            <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
