import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface CartDrawerProps {
  shopId: string;
}

export function CartDrawer({ shopId }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, getTotal, getItemCount } = useCart();
  const navigate = useNavigate();
  const itemCount = getItemCount();

  const handleCheckout = () => {
    navigate(`/shop/${shopId}/checkout`);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {itemCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your Cart ({itemCount} items)</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 flex flex-col h-[calc(100vh-10rem)]">
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Your cart is empty
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-4">
                {items.map(item => (
                  <div key={item.id} className="flex gap-4 p-3 bg-muted/50 rounded-lg">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-16 h-16 rounded object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        No Image
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{item.name}</h4>
                      <p className="text-primary font-semibold">₦{item.price.toLocaleString()}</p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-destructive ml-auto"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span className="text-primary">₦{getTotal().toLocaleString()}</span>
                </div>
                
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  size="lg"
                  onClick={handleCheckout}
                >
                  Proceed to Checkout
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
