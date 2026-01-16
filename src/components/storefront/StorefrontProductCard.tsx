import { ShoppingCart, Heart, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface StorefrontProductCardProps {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  image?: string | null;
  shopId: string;
  stockQuantity?: number | null;
}

export function StorefrontProductCard({
  id,
  name,
  price,
  compareAtPrice,
  image,
  shopId,
  stockQuantity
}: StorefrontProductCardProps) {
  const { addItem, items } = useCart();
  const [isLiked, setIsLiked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const isOutOfStock = stockQuantity !== null && stockQuantity <= 0;
  const hasDiscount = compareAtPrice && compareAtPrice > price;
  const discountPercent = hasDiscount 
    ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
    : 0;
  const isInCart = items.some(item => item.id === id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOutOfStock) {
      addItem({
        id,
        name,
        price,
        image: image || undefined,
        shopId
      });
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLiked(!isLiked);
  };

  return (
    <Link to={`/shop/${shopId}/product/${id}`} className="group block">
      <div className="relative bg-background rounded-2xl overflow-hidden border shadow-sm hover:shadow-xl transition-all duration-300 h-full flex flex-col">
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden bg-muted">
          {/* Skeleton loader */}
          {!imageLoaded && image && (
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 animate-pulse" />
          )}
          
          {image ? (
            <img
              src={image}
              alt={name}
              onLoad={() => setImageLoaded(true)}
              className={cn(
                "w-full h-full object-cover transition-all duration-500",
                "group-hover:scale-110",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <div className="text-muted-foreground/50 text-center p-4">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <span className="text-xs">No Image</span>
              </div>
            </div>
          )}
          
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {hasDiscount && (
              <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold px-2 py-1 rounded-lg shadow-lg">
                -{discountPercent}% OFF
              </Badge>
            )}
            {isInCart && (
              <Badge className="bg-primary text-primary-foreground font-medium px-2 py-1 rounded-lg shadow-lg">
                In Cart
              </Badge>
            )}
          </div>

          {/* Quick actions */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
            <Button
              size="icon"
              variant="secondary"
              className={cn(
                "h-9 w-9 rounded-full shadow-lg transition-colors",
                isLiked ? "bg-red-500 hover:bg-red-600 text-white" : "bg-white/90 hover:bg-white"
              )}
              onClick={handleLike}
            >
              <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 rounded-full bg-white/90 hover:bg-white shadow-lg"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Out of Stock Overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
              <Badge variant="secondary" className="text-base px-4 py-2 bg-white/90">
                Out of Stock
              </Badge>
            </div>
          )}

          {/* Add to Cart Button - appears on hover */}
          {!isOutOfStock && (
            <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <Button 
                onClick={handleAddToCart}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </Button>
            </div>
          )}
        </div>
        
        {/* Product Info */}
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold text-sm sm:text-base line-clamp-2 mb-2 group-hover:text-primary transition-colors leading-tight">
            {name}
          </h3>
          
          <div className="mt-auto flex items-end justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-bold text-primary">
                ₦{price.toLocaleString()}
              </span>
              {hasDiscount && (
                <span className="text-xs sm:text-sm text-muted-foreground line-through">
                  ₦{compareAtPrice.toLocaleString()}
                </span>
              )}
            </div>
            
            {/* Mobile add to cart button */}
            <Button 
              size="sm" 
              variant={isInCart ? "secondary" : "outline"}
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="sm:hidden rounded-full h-9 w-9 p-0"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
