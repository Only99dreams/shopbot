import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Trash2, CreditCard, Loader2, ShoppingBag, Shield, Lock, Minus, Plus, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { items, getTotal, clearCart, removeItem } = useCart();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  // Persist payment success in sessionStorage to survive remounts
  const [paymentSuccess, setPaymentSuccess] = useState(() => {
    const stored = sessionStorage.getItem(`checkout-success-${shopId}`);
    return stored === 'true';
  });
  const [completedOrderNumber, setCompletedOrderNumber] = useState<string | null>(() => {
    return sessionStorage.getItem(`checkout-order-${shopId}`);
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
          payment_method: 'flutterwave'
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

  const handleFlutterwaveCheckout = async (orderId: string) => {
    try {
      const callbackUrl = `${window.location.origin}/shop/${shopId}/checkout`;
      
      const { data, error } = await supabase.functions.invoke('flutterwave-initialize', {
        body: {
          orderId,
          email: formData.email || `${formData.phone}@customer.shopnaija.com`,
          amount: getTotal(),
          callbackUrl
        }
      });

      if (error) throw error;

      if (data.success && data.payment_link) {
        // Redirect to Flutterwave
        window.location.href = data.payment_link;
      } else {
        throw new Error(data.error || 'Failed to initialize payment');
      }
    } catch (error: any) {
      console.error('Flutterwave error:', error);
      toast.error('Payment initialization failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      checkoutSchema.parse(formData);
      setErrors({});
      setIsProcessing(true);

      const result = await createOrder.mutateAsync();
      await handleFlutterwaveCheckout(result.order.id);
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

  // Detect Flutterwave callback params synchronously (before first render)
  const callbackTransactionId = searchParams.get('transaction_id');
  const callbackTxRef = searchParams.get('tx_ref');
  const callbackStatus = searchParams.get('status');
  const isSuccessStatus = callbackStatus === 'successful' || callbackStatus === 'completed';
  const hasFlutterwaveCallback = !!(isSuccessStatus && (callbackTransactionId || callbackTxRef));
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verificationAttempted = useRef(false);

  // Handle Flutterwave payment callback
  useEffect(() => {
    if (!hasFlutterwaveCallback || verificationAttempted.current) return;
    verificationAttempted.current = true;
    setIsProcessing(true);

    supabase.functions.invoke('flutterwave-verify', {
      body: { transactionId: callbackTransactionId, txRef: callbackTxRef || '' },
    }).then(async ({ data, error }) => {
      if (error) {
        let message = 'Payment verification failed';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            message = body?.error || error.message || message;
          }
        } catch { /* ignore */ }
        console.error('Flutterwave verify error:', message);
        setVerifyError(message);
        toast.error(message);
      } else if (!data?.success) {
        const msg = data?.error || 'Payment could not be verified';
        setVerifyError(msg);
        toast.error(msg);
      } else {
        // Get the order number from tx_ref or meta (format: SHOPAF_{orderId}_{timestamp})
        const orderId = data.order_id || callbackTxRef?.split('_')[1];
        let orderNum = null;
        if (orderId) {
          const { data: orderData } = await supabase
            .from('orders')
            .select('order_number')
            .eq('id', orderId)
            .maybeSingle();
          if (orderData) orderNum = orderData.order_number;
        }
        
        console.log('Payment verified successfully, clearing cart and showing success screen');
        // Persist success state to sessionStorage to survive remounts
        sessionStorage.setItem(`checkout-success-${shopId}`, 'true');
        if (orderNum) sessionStorage.setItem(`checkout-order-${shopId}`, orderNum);
        setPaymentSuccess(true);
        setCompletedOrderNumber(orderNum);
        clearCart();
        toast.success('Payment successful! Your order has been confirmed.');
      }
      setIsProcessing(false);
      // Clear URL params after processing, but give UI time to show success
      setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 1000);
    });
  }, [hasFlutterwaveCallback, clearCart, setSearchParams, callbackTransactionId, callbackTxRef, shopId]);

  // Handle cancelled payment
  useEffect(() => {
    if (callbackStatus === 'cancelled') {
      toast.error('Payment was cancelled.');
      setSearchParams({}, { replace: true });
    }
  }, [callbackStatus, setSearchParams]);

  // Clear sessionStorage success state when navigating away
  const handleNavigateAway = () => {
    sessionStorage.removeItem(`checkout-success-${shopId}`);
    sessionStorage.removeItem(`checkout-order-${shopId}`);
  };

  // Payment success screen
  if (paymentSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-muted/30 to-background">
        <div className="text-center max-w-md px-4">
          <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          {completedOrderNumber && (
            <p className="text-sm font-mono bg-muted rounded-lg px-4 py-2 mb-4 inline-block">
              Order: {completedOrderNumber}
            </p>
          )}
          <p className="text-muted-foreground mb-6">
            Your order has been confirmed and the seller has been notified. You can track your order using the order number on the Marketplace page.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/marketplace" onClick={handleNavigateAway}>
              <Button size="lg" className="rounded-full px-8">Track Order</Button>
            </Link>
            <Link to={`/shop/${shopId}`} onClick={handleNavigateAway}>
              <Button size="lg" variant="outline" className="rounded-full px-8">Back to Shop</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Verifying payment screen (shown immediately when Flutterwave redirects back)
  if (hasFlutterwaveCallback || isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-muted/30 to-background">
        <div className="text-center max-w-md px-4">
          {verifyError ? (
            <>
              <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                <Shield className="h-12 w-12 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
              <p className="text-muted-foreground mb-6">
                {verifyError}. If you were debited, please contact support with your transaction details.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/marketplace">
                  <Button size="lg" className="rounded-full px-8">Track Order</Button>
                </Link>
                <Link to={`/shop/${shopId}`}>
                  <Button size="lg" variant="outline" className="rounded-full px-8">Back to Shop</Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="h-16 w-16 mx-auto mb-6 animate-spin text-primary" />
              <h1 className="text-2xl font-bold mb-2">Verifying Payment...</h1>
              <p className="text-muted-foreground">
                Please wait while we confirm your payment. Do not close this page.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Check if subscription is active - prevent checkout for inactive shops
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
            This shop is currently inactive and cannot accept orders. The seller needs to subscribe to activate the shop.
          </p>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-muted/30 to-background">
        <div className="text-center max-w-md px-4">
          <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">Add some products to proceed with checkout.</p>
          <Link to={`/shop/${shopId}`}>
            <Button size="lg" className="rounded-full px-8">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/shop/${shopId}`)} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="font-semibold">Checkout</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Cart Items - Left Side */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Order Summary</h2>
              <Badge variant="secondary" className="rounded-full">
                {items.reduce((sum, item) => sum + item.quantity, 0)} items
              </Badge>
            </div>
            
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 bg-card rounded-xl border">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm line-clamp-2">{item.name}</h3>
                    <p className="text-primary font-semibold mt-1">₦{item.price.toLocaleString()}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center bg-muted rounded-full">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-full"
                          onClick={() => {
                            if (item.quantity === 1) {
                              removeItem(item.id);
                            } else {
                              // Manually update quantity via cart
                            }
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-full"
                          onClick={() => {
                            // Manually update quantity via cart
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Total Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₦{getTotal().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="text-green-600">To be confirmed</span>
                  </div>
                  <div className="h-px bg-border my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">₦{getTotal().toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Checkout Form - Right Side */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Secure Checkout
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Personal Info */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Doe"
                        className="rounded-xl h-11"
                      />
                      {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="08012345678"
                        className="rounded-xl h-11"
                      />
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (for payment receipt)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      className="rounded-xl h-11"
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                </div>

                {/* Delivery Info */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Delivery Address</h3>
                  <div className="space-y-2">
                    <Label htmlFor="address">Full Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Enter your complete delivery address"
                      rows={3}
                      className="rounded-xl resize-none"
                    />
                    {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Order Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any special instructions"
                      rows={2}
                      className="rounded-xl resize-none"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Payment Method</h3>
                  <div className="flex items-center space-x-3 p-4 border-2 border-primary bg-primary/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold">Pay with Flutterwave</p>
                        <p className="text-sm text-muted-foreground">Cards, Bank Transfer, Mobile Money & more</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Badge */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span>Your payment information is secure and encrypted</span>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-full h-14 text-base font-semibold shadow-lg"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Pay ₦{getTotal().toLocaleString()}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
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

export default function Checkout() {
  return <CheckoutContent />;
}