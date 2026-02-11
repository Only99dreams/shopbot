import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShopHeader } from '@/components/storefront/ShopHeader';
import { StorefrontProductCard } from '@/components/storefront/StorefrontProductCard';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal, Grid3X3, LayoutGrid, Package, Sparkles, ShoppingCart, CheckCircle, Clock, Loader2, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { DynamicMeta } from '@/components/SEO/DynamicMeta';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RedemptionCodeModal } from '@/components/RedemptionCodeModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrCode } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function ShopContent() {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState<2 | 3>(2);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const { user } = useAuth();
  const [ratingOpenFor, setRatingOpenFor] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [ratingReview, setRatingReview] = useState<string>('');

  // Check for payment success (Flutterwave callback legacy support)
  useEffect(() => {
    const paymentSuccess = searchParams.get('payment') === 'success';
    const txRef = searchParams.get('tx_ref');

    if (paymentSuccess && txRef) {
      const fetchRedemptionCode = async () => {
        try {
          const { data: payment } = await supabase
            .from('payments')
            .select(`
              order_id,
              orders (
                redemption_codes!order_id (code)
              )
            `)
            .eq('paystack_reference', txRef)
            .single();

          if (payment?.orders?.redemption_codes?.[0]?.code) {
            setRedemptionCode(payment.orders.redemption_codes[0].code);
            setShowPaymentSuccess(true);
            setSearchParams(new URLSearchParams());
          }
        } catch (error) {
          console.error('Error fetching redemption code:', error);
        }
      };

      fetchRedemptionCode();
    }
  }, [searchParams, setSearchParams]);

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
      // Filter out products with 0 or negative stock (if stock_quantity is set)
      return (data || []).filter(p => p.stock_quantity === null || p.stock_quantity > 0);
    },
    enabled: !!shopId
  });

  const { data: shopMetrics } = useQuery({
    queryKey: ['shop-metrics', shopId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_shop_metrics', {
        p_shop_id: shopId!,
      });
      if (error) throw error;
      return data as unknown as {
        avg_rating: number | null;
        rating_count: number | null;
        avg_response_minutes: number | null;
      };
    },
    enabled: !!shopId
  });

  const handleMessageSeller = async () => {
    if (!shopId) return;
    if (!user) {
      toast.error('Please sign in to message the seller.');
      navigate(`/auth?mode=login`);
      return;
    }
    navigate(`/shop/${shopId}/chat`);
  };

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

  // Fetch user orders for this shop
  const { data: userOrders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['shop-user-orders', shopId, user?.id],
    queryFn: async () => {
      if (!user?.id || !shopId) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          status,
          payment_status,
          redemption_confirmed,
          created_at,
          order_items (
            product_name,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('customer_id', user.id)
        .eq('shop_id', shopId)
        .eq('payment_status', 'paid')
        .eq('redemption_confirmed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!shopId
  });

  // Confirm receipt mutation
  const confirmReceiptMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { code: 'DIRECT_CONFIRM', action: 'confirm_receipt', orderId },
      });

      if (error) {
        let message = 'Failed to confirm receipt';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            message = body?.error || error.message || message;
          } else {
            message = error.message || message;
          }
        } catch {
          message = error.message || message;
        }
        throw new Error(message);
      }
      if (!data?.success) throw new Error(data?.error || 'Failed to confirm receipt');
      return data;
    },
    onSuccess: () => {
      toast.success('Receipt confirmed! Seller has been credited.');
      refetchOrders();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to confirm receipt');
    },
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

  // Check if subscription is active OR shop is_active (legacy support)
  const isSubscriptionActive = subscription?.status === 'active' || shop?.is_active === true;

  if (!isSubscriptionActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Subscription Required</h1>
          <p className="text-muted-foreground mb-6">
            This shop is currently inactive. The seller needs to subscribe to activate the shop.
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
  const avgRating = shopMetrics?.avg_rating ?? null;
  const ratingCount = shopMetrics?.rating_count ?? 0;
  const responseMinutes = shopMetrics?.avg_response_minutes ?? null;
  const responseTimeLabel = responseMinutes
    ? responseMinutes < 60
      ? `Usually responds in ${Math.round(responseMinutes)} min`
      : `Usually responds in ${Math.round(responseMinutes / 60)} hr`
    : 'Response time unavailable';

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
        rating={avgRating ?? undefined}
        ratingCount={ratingCount}
        responseTime={responseTimeLabel}
        onMessageSeller={handleMessageSeller}
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
        {user && userOrders && userOrders.length > 0 && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'products' | 'orders')} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="products">
                <Package className="w-4 h-4 mr-2" />
                Products
              </TabsTrigger>
              <TabsTrigger value="orders">
                <ShoppingCart className="w-4 h-4 mr-2" />
                My Orders ({userOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-6">
              {/* Products content will go here */}
            </TabsContent>

            <TabsContent value="orders" className="mt-6">
              {ordersLoading ? (
                <div className="space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="h-5 bg-muted rounded w-32" />
                          <div className="h-6 bg-muted rounded w-20" />
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-full" />
                          <div className="h-4 bg-muted rounded w-3/4" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : userOrders.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No pending orders</h3>
                  <p className="text-muted-foreground mb-4">
                    Orders from this shop awaiting your confirmation will appear here.
                  </p>
                  <Button onClick={() => setActiveTab('products')}>
                    Browse Products
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {userOrders.map((order) => (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-semibold">Order #{order.order_number}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">₦{order.total.toLocaleString()}</p>
                            <Badge variant="secondary" className="mt-1">
                              Paid
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-3 mb-4">
                          {order.order_items.slice(0, 2).map((item, index) => (
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
                          {order.order_items.length > 2 && (
                            <p className="text-sm text-muted-foreground">
                              +{order.order_items.length - 2} more items
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Awaiting your confirmation
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => confirmReceiptMutation.mutate(order.id)}
                              disabled={confirmReceiptMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {confirmReceiptMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <CheckCircle className="w-4 h-4 mr-2" />
                              )}
                              Confirm Receipt
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setRatingOpenFor(ratingOpenFor === order.id ? null : order.id)}
                            >
                              Rate Seller
                            </Button>
                          </div>
                        </div>
                        {ratingOpenFor === order.id && (
                          <div className="mt-4 border-t pt-4">
                            <div className="flex items-center gap-2 mb-2">
                              {[1,2,3,4,5].map((s) => (
                                <button key={s} onClick={() => setRatingValue(s)} className={cn('p-1', ratingValue >= s ? 'text-yellow-400' : 'text-muted-foreground')}>
                                  <Star className="w-5 h-5" />
                                </button>
                              ))}
                            </div>
                            <textarea value={ratingReview} onChange={(e) => setRatingReview(e.target.value)} className="w-full p-2 border rounded-md mb-2 text-black" placeholder="Write a short review (optional)" />
                            <div className="flex gap-2">
                              <Button onClick={async () => {
                                const { data: userData } = await supabase.auth.getUser();
                                const buyerId = userData?.data?.user?.id;
                                // Allow anonymous ratings
                                const { error } = await supabase.from('seller_ratings').insert({ 
                                  seller_id: shop.owner_id, 
                                  buyer_id: buyerId || null, 
                                  rating: ratingValue, 
                                  review: ratingReview 
                                });
                                if (error) return toast.error('Failed to submit rating');
                                toast.success('Rating submitted');
                                setRatingOpenFor(null);
                                setRatingReview('');
                              }}>Submit Rating</Button>
                              <Button variant="outline" onClick={() => setRatingOpenFor(null)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Products Content */}
        <div>
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
                ? 'No products match your search. Try a different search term.'
                : 'This shop hasn\'t added any products yet. Check back soon!'}
            </p>
          </div>
        )}
        </div>
      </main>

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

      {/* Payment Success Dialog */}
      <Dialog open={showPaymentSuccess} onOpenChange={setShowPaymentSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Payment Successful!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your payment has been processed successfully. Here's your redemption code:
            </p>
            {redemptionCode && (
              <div className="text-center">
                <div className="font-mono text-2xl font-bold text-primary bg-muted px-4 py-3 rounded-lg border-2 border-dashed border-primary/30">
                  {redemptionCode}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Take this code to the shop to complete your purchase.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPaymentSuccess(false)}
                className="flex-1"
              >
                Continue Shopping
              </Button>
              <Link to="/redeem" className="flex-1">
                <Button className="w-full">
                  <QrCode className="h-4 w-4 mr-2" />
                  Redeem Code
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Shop() {
  return <ShopContent />;
}
