import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
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
        <Button variant="outline" size="icon" className="relative h-11 w-11 rounded-full">
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary animate-in zoom-in"
            >
              {itemCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Your Cart
            <Badge variant="secondary" className="ml-2">{itemCount} items</Badge>
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden mt-4">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <ShoppingCart className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground text-sm">
                Add some products to get started!
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {items.map(item => (
                  <div key={item.id} className="flex gap-4 p-3 bg-muted/30 rounded-xl border">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        No Image
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate text-sm">{item.name}</h4>
                      <p className="text-primary font-bold mt-1">₦{item.price.toLocaleString()}</p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center bg-background rounded-full border">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 rounded-full"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 rounded-full"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
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
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-xl font-bold text-primary">₦{getTotal().toLocaleString()}</span>
                </div>
                
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 rounded-full gap-2 h-12 text-base font-semibold shadow-lg shadow-primary/25" 
                  size="lg"
                  onClick={handleCheckout}
                >
                  Checkout
                  <ArrowRight className="h-5 w-5" />
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  Shipping & taxes calculated at checkout
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
