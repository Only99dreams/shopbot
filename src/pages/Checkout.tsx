import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CartProvider, useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronLeft, MessageCircle, Trash2, CreditCard, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { BankTransferModal } from '@/components/storefront/BankTransferModal';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  address: z.string().min(10, 'Please enter a complete address'),
  notes: z.string().optional()
});

function CheckoutContent() {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { items, getTotal, clearCart, removeItem } = useCart();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<'whatsapp' | 'paystack' | 'bank_transfer'>('bank_transfer');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bankTransferOrder, setBankTransferOrder] = useState<{
    orderId: string;
    orderNumber: string;
  } | null>(null);

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

  const createOrder = useMutation({
    mutationFn: async () => {
      // Create customer if not exists
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .upsert({
          shop_id: shopId!,
          phone: formData.phone,
          name: formData.name,
          email: formData.email || null
        }, { onConflict: 'phone,shop_id' })
        .select()
        .single();

      if (customerError) throw customerError;

      // Generate order number
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          shop_id: shopId!,
          customer_id: customer.id,
          order_number: orderNumber,
          subtotal: getTotal(),
          total: getTotal(),
          notes: `${formData.address}${formData.notes ? `\n\nNotes: ${formData.notes}` : ''}`,
          status: 'pending',
          payment_status: 'unpaid',
          payment_method: paymentMethod
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return { order, orderNumber, customer };
    }
  });

  const handleWhatsAppCheckout = async (orderNumber: string) => {
    if (shop?.whatsapp_number) {
      const itemsList = items
        .map(item => `• ${item.name} x${item.quantity} - ₦${(item.price * item.quantity).toLocaleString()}`)
        .join('\n');

      const message = encodeURIComponent(
        `🛒 *NEW ORDER - ${orderNumber}*\n\n` +
        `*Customer:* ${formData.name}\n` +
        `*Phone:* ${formData.phone}\n` +
        `*Address:* ${formData.address}\n\n` +
        `*Items:*\n${itemsList}\n\n` +
        `*Total:* ₦${getTotal().toLocaleString()}\n\n` +
        `${formData.notes ? `*Notes:* ${formData.notes}` : ''}`
      );

      window.open(`https://wa.me/${shop.whatsapp_number.replace(/\D/g, '')}?text=${message}`, '_blank');
    }

    clearCart();
    toast.success('Order placed successfully!');
    navigate(`/shop/${shopId}`);
  };

  const handlePaystackCheckout = async (orderId: string) => {
    try {
      const callbackUrl = `${window.location.origin}/shop/${shopId}?payment=success`;
      
      const { data, error } = await supabase.functions.invoke('paystack-initialize', {
        body: {
          orderId,
          email: formData.email || `${formData.phone}@customer.shopnaija.com`,
          amount: getTotal(),
          callbackUrl
        }
      });

      if (error) throw error;

      if (data.success && data.authorization_url) {
        // Redirect to Paystack
        window.location.href = data.authorization_url;
      } else {
        throw new Error(data.error || 'Failed to initialize payment');
      }
    } catch (error: any) {
      console.error('Paystack error:', error);
      toast.error('Payment initialization failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleBankTransferCheckout = async (orderId: string, orderNumber: string) => {
    setBankTransferOrder({ orderId, orderNumber });
    setIsProcessing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      checkoutSchema.parse(formData);
      setErrors({});
      setIsProcessing(true);

      const result = await createOrder.mutateAsync();

      if (paymentMethod === 'whatsapp') {
        await handleWhatsAppCheckout(result.orderNumber);
      } else if (paymentMethod === 'paystack') {
        await handlePaystackCheckout(result.order.id);
      } else if (paymentMethod === 'bank_transfer') {
        await handleBankTransferCheckout(result.order.id, result.orderNumber);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        console.error('Order creation error:', error);
        toast.error('Failed to place order. Please try again.');
      }
      setIsProcessing(false);
    }
  };

  const handleBankTransferComplete = () => {
    clearCart();
    setBankTransferOrder(null);
    navigate(`/shop/${shopId}`);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-4">Add some products to proceed with checkout.</p>
          <Link to={`/shop/${shopId}`}>
            <Button>Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/shop/${shopId}`)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Shop
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Order Summary - Show first on mobile */}
          <Card className="lg:order-2">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g., 08012345678"
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email (for payment receipt)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Delivery Address *</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter your full delivery address"
                    rows={3}
                  />
                  {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Order Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any special instructions for your order"
                    rows={2}
                  />
                </div>

                {/* Payment Method Selection */}
                <div className="space-y-3 pt-4 border-t">
                  <Label>Payment Method *</Label>
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'whatsapp' | 'paystack' | 'bank_transfer')}>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                      <Label htmlFor="bank_transfer" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">Bank Transfer</p>
                            <p className="text-sm text-muted-foreground">Transfer & upload receipt</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="paystack" id="paystack" />
                      <Label htmlFor="paystack" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">Pay with Card</p>
                            <p className="text-sm text-muted-foreground">Secure payment via Paystack</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="whatsapp" id="whatsapp" />
                      <Label htmlFor="whatsapp" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">Pay on Delivery</p>
                            <p className="text-sm text-muted-foreground">Order via WhatsApp, pay when delivered</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className={`w-full ${paymentMethod === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : paymentMethod === 'paystack' ? (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Pay ₦{getTotal().toLocaleString()}
                    </>
                  ) : paymentMethod === 'bank_transfer' ? (
                    <>
                      <Building2 className="mr-2 h-5 w-5" />
                      Place Order - ₦{getTotal().toLocaleString()}
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 h-5 w-5" />
                      Place Order via WhatsApp
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-muted py-6 sm:py-8 mt-8 sm:mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm sm:text-base">
            Powered by <span className="font-semibold text-primary">ShopNaija</span>
          </p>
        </div>
      </footer>

      {/* Bank Transfer Modal */}
      {bankTransferOrder && shopId && shop && (
        <BankTransferModal
          open={!!bankTransferOrder}
          onOpenChange={(open) => {
            if (!open) {
              handleBankTransferComplete();
            }
          }}
          orderId={bankTransferOrder.orderId}
          orderNumber={bankTransferOrder.orderNumber}
          shopId={shopId}
          shopName={shop.name}
          amount={getTotal()}
          customerName={formData.name}
          customerPhone={formData.phone}
        />
      )}
    </div>
  );
}

export default function Checkout() {
  return (
    <CartProvider>
      <CheckoutContent />
    </CartProvider>
  );
}