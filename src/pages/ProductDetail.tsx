import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CartProvider, useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ShoppingCart, MessageCircle, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function ProductDetailContent() {
  const { shopId, productId } = useParams<{ shopId: string; productId: string }>();
  const navigate = useNavigate();
  const { addItem, items, updateQuantity } = useCart();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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

  const handleWhatsAppOrder = () => {
    if (shop?.whatsapp_number && product) {
      const message = encodeURIComponent(
        `Hi! I'd like to order:\n\n*${product.name}*\nPrice: ₦${product.price.toLocaleString()}\n\nPlease confirm availability.`
      );
      window.open(`https://wa.me/${shop.whatsapp_number.replace(/\D/g, '')}?text=${message}`, '_blank');
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

  const images = product.images || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/shop/${shopId}`)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Shop
          </Button>
          <Link to={`/shop/${shopId}/checkout`}>
            <Button variant="outline" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {items.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {items.reduce((count, item) => count + item.quantity, 0)}
                </Badge>
              )}
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-muted relative">
              {images.length > 0 ? (
                <img
                  src={images[selectedImageIndex]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No Image Available
                </div>
              )}
              
              {hasDiscount && (
                <Badge className="absolute top-4 left-4 bg-red-500 hover:bg-red-600 text-lg px-3 py-1">
                  -{discountPercent}% OFF
                </Badge>
              )}
              
              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Badge variant="secondary" className="text-xl px-4 py-2">Out of Stock</Badge>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                      selectedImageIndex === index ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {product.categories && (
              <Badge variant="secondary">{(product.categories as { name: string }).name}</Badge>
            )}

            <h1 className="text-3xl font-bold">{product.name}</h1>

            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-primary">
                ₦{product.price.toLocaleString()}
              </span>
              {hasDiscount && (
                <span className="text-xl text-muted-foreground line-through">
                  ₦{product.compare_at_price?.toLocaleString()}
                </span>
              )}
            </div>

            {product.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            {product.stock_quantity !== null && !isOutOfStock && (
              <p className="text-sm text-muted-foreground">
                {product.stock_quantity} items in stock
              </p>
            )}

            {/* Add to Cart */}
            {cartItem ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">In Cart:</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateQuantity(cartItem.id, cartItem.quantity - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center text-lg font-semibold">{cartItem.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </Button>
            )}

            <Button
              size="lg"
              variant="outline"
              className="w-full bg-green-50 border-green-500 text-green-600 hover:bg-green-100"
              onClick={handleWhatsAppOrder}
              disabled={isOutOfStock}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Order via WhatsApp
            </Button>
          </div>
        </div>
      </main>

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

export default function ProductDetail() {
  return (
    <CartProvider>
      <ProductDetailContent />
    </CartProvider>
  );
}
