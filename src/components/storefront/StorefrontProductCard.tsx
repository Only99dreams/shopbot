import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';

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
  const { addItem } = useCart();
  const isOutOfStock = stockQuantity !== null && stockQuantity <= 0;
  const hasDiscount = compareAtPrice && compareAtPrice > price;
  const discountPercent = hasDiscount 
    ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
    : 0;

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

  return (
    <Link to={`/shop/${shopId}/product/${id}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 h-full">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {image ? (
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
          
          {hasDiscount && (
            <Badge className="absolute top-2 left-2 bg-red-500 hover:bg-red-600">
              -{discountPercent}%
            </Badge>
          )}
          
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="secondary" className="text-lg">Out of Stock</Badge>
            </div>
          )}
        </div>
        
        <CardContent className="p-3 sm:p-4">
          <h3 className="font-semibold text-sm sm:text-lg line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {name}
          </h3>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-bold text-primary">
                ₦{price.toLocaleString()}
              </span>
              {hasDiscount && (
                <span className="text-xs sm:text-sm text-muted-foreground line-through">
                  ₦{compareAtPrice.toLocaleString()}
                </span>
              )}
            </div>
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="w-full sm:w-auto sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-9"
            >
              <ShoppingCart className="h-4 w-4 mr-1 sm:mr-0" />
              <span className="sm:hidden">Add to Cart</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
