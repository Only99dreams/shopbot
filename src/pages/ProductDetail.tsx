import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ShoppingCart, Minus, Plus, Heart, Share2, Shield, Truck, RotateCcw, Star } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function ProductDetailContent() {
  const { shopId, productId } = useParams<{ shopId: string; productId: string }>();
  const navigate = useNavigate();
  const { addItem, items, updateQuantity } = useCart();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('id', productId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!productId
  });

  const { data: shop } = useQuery({
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

  // Fetch seller rating
  const { data: sellerRating } = useQuery({
    queryKey: ['seller-rating', shop?.owner_id],
    queryFn: async () => {
      if (!shop?.owner_id) return null;
      const { data } = await supabase
        .from('seller_ratings')
        .select('rating')
        .eq('seller_id', shop.owner_id);
      if (!data) return null;
      const count = data.length;
      const avg = count > 0 ? data.reduce((s, r) => s + Number(r.rating), 0) / count : null;
      return { avg, count };
    },
    enabled: !!shop?.owner_id
  });

  // Fetch subscription to check if shop owner has active subscription
  const { data: subscription } = useQuery({
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

  // Check if subscription is active OR shop is_active (legacy support)
  const isSubscriptionActive = subscription?.status === 'active' || shop?.is_active === true;

  const cartItem = items.find(item => item.id === productId);
  const isOutOfStock = product?.stock_quantity !== null && product?.stock_quantity <= 0;
  const hasDiscount = product?.compare_at_price && product.compare_at_price > product.price;
  const discountPercent = hasDiscount 
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0;

  const handleAddToCart = () => {
    if (product && !isOutOfStock) {
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || undefined,
        shopId: shopId!
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-muted-foreground mb-4">This product doesn't exist or is no longer available.</p>
          <Link to={`/shop/${shopId}`}>
            <Button>Back to Shop</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Redirect to shop page if subscription is not active (shop page will show unavailable message)
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

  const images = product.images || [];

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} - ₦${product.price.toLocaleString()}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      // User cancelled
    }
  };

  const handleAddToCartWithQuantity = () => {
    if (product && !isOutOfStock) {
      for (let i = 0; i < quantity; i++) {
        addItem({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || undefined,
          shopId: shopId!
        });
      }
      toast.success(`Added ${quantity} item(s) to cart`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/shop/${shopId}`)} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setIsLiked(!isLiked)}
            >
              <Heart className={cn("h-5 w-5", isLiked && "fill-red-500 text-red-500")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={handleShare}
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <Link to={`/shop/${shopId}/checkout`}>
              <Button variant="outline" size="icon" className="relative h-10 w-10 rounded-full">
                <ShoppingCart className="h-5 w-5" />
                {items.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {items.reduce((count, item) => count + item.quantity, 0)}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square rounded-2xl overflow-hidden bg-muted relative group">
              {images.length > 0 ? (
                <img
                  src={images[selectedImageIndex]}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <ShoppingCart className="h-16 w-16 mx-auto mb-2 opacity-30" />
                    <p>No Image Available</p>
                  </div>
                </div>
              )}
              
              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {hasDiscount && (
                  <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1.5 text-sm shadow-lg">
                    -{discountPercent}% OFF
                  </Badge>
                )}
                {cartItem && (
                  <Badge className="bg-primary text-primary-foreground font-medium px-3 py-1.5 shadow-lg">
                    In Cart ({cartItem.quantity})
                  </Badge>
                )}
              </div>
              
              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                  <Badge variant="secondary" className="text-lg px-6 py-2">Out of Stock</Badge>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={cn(
                      "w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all",
                      selectedImageIndex === index 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-transparent hover:border-muted-foreground/30"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category & Rating */}
            <div className="flex items-center gap-3 flex-wrap">
              {product.categories && (
                <Badge variant="secondary" className="text-xs">
                  {(product.categories as { name: string }).name}
                </Badge>
              )}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>4.8</span>
                <span className="text-muted-foreground/50">|</span>
                <span>50+ sold</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">{product.name}</h1>

            {/* Price */}
            <div className="flex items-baseline gap-4">
              <span className="text-3xl sm:text-4xl font-bold text-primary">
                ₦{product.price.toLocaleString()}
              </span>
              {hasDiscount && (
                <span className="text-xl text-muted-foreground line-through">
                  ₦{product.compare_at_price?.toLocaleString()}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            {/* Stock Info */}
            {product.stock_quantity !== null && !isOutOfStock && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm text-green-600 font-medium">
                  {product.stock_quantity} items in stock
                </span>
              </div>
            )}

            {/* Quantity Selector */}
            {!isOutOfStock && !cartItem && (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center bg-muted rounded-full">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center text-lg font-semibold">{quantity}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Cart Controls */}
            {cartItem ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <span className="text-sm font-medium">In your cart:</span>
                  <div className="flex items-center bg-background rounded-full border">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-full"
                      onClick={() => updateQuantity(cartItem.id, cartItem.quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center font-semibold">{cartItem.quantity}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-full"
                      onClick={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="ml-auto font-bold text-primary">
                    ₦{(cartItem.quantity * product.price).toLocaleString()}
                  </span>
                </div>
                <Link to={`/shop/${shopId}/checkout`}>
                  <Button size="lg" className="w-full rounded-full h-12 text-base font-semibold shadow-lg shadow-primary/25">
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Proceed to Checkout
                  </Button>
                </Link>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full rounded-full h-12 text-base font-semibold shadow-lg shadow-primary/25"
                onClick={handleAddToCartWithQuantity}
                disabled={isOutOfStock}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {isOutOfStock ? 'Out of Stock' : `Add to Cart${quantity > 1 ? ` (${quantity})` : ''}`}
              </Button>
            )}

            {/* Rating UI */}
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>{sellerRating?.avg ? Number(sellerRating.avg).toFixed(1) : '—'}</span>
                <span className="text-muted-foreground/50">|</span>
                <span className="text-sm text-muted-foreground">{sellerRating?.count || 0} ratings</span>
              </div>
              <RatingForm shop={shop} />
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Secure<br/>Payment</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Fast<br/>Delivery</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                  <RotateCcw className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Easy<br/>Returns</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            Powered by <span className="font-semibold text-primary">ShopAfrica</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function ProductDetail() {
  return <ProductDetailContent />;
}

// RatingForm component
function RatingForm({ shop }: { shop: any }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');

  const submitRating = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const buyerId = userData?.data?.user?.id;
    if (!shop?.owner_id) return toast.error('Invalid seller');

    const { error } = await supabase.from('seller_ratings').insert({
      seller_id: shop.owner_id,
      buyer_id: buyerId || null, // Allow anonymous ratings
      rating,
      review,
    });

    if (error) {
      toast.error('Failed to submit rating');
    } else {
      toast.success('Rating submitted');
      setReview('');
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        {[1,2,3,4,5].map((s) => (
          <button key={s} onClick={() => setRating(s)} className={cn('p-1', rating >= s ? 'text-yellow-400' : 'text-muted-foreground')}>
            <Star className="w-5 h-5" />
          </button>
        ))}
      </div>
      <textarea value={review} onChange={(e) => setReview(e.target.value)} className="w-full p-2 border rounded-md text-black" placeholder="Write a short review (optional)" />
      <div>
        <Button onClick={submitRating} size="sm">Submit Rating</Button>
      </div>
    </div>
  );
}
