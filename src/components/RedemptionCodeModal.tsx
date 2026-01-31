import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Package, CheckCircle, Eye, QrCode } from 'lucide-react';
import { toast } from 'sonner';

interface RedemptionCodeModalProps {
  trigger?: React.ReactNode;
  mode?: 'view' | 'confirm_delivery' | 'confirm_receipt';
  onSuccess?: () => void;
}

interface OrderDetails {
  id: string;
  order_number: string;
  total: number;
  status: string;
  payment_status: string;
  redemption_confirmed: boolean;
  customers: {
    name: string | null;
    phone: string | null;
  } | null;
  order_items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

interface ShopDetails {
  id: string;
  name: string;
  owner_id: string;
}

export function RedemptionCodeModal({ trigger, mode = 'view', onSuccess }: RedemptionCodeModalProps) {
  const [code, setCode] = useState('');
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [shopDetails, setShopDetails] = useState<ShopDetails | null>(null);
  const [step, setStep] = useState<'input' | 'details' | 'confirm'>('input');

  const redeemMutation = useMutation({
    mutationFn: async ({ code, action }: { code: string; action: string }) => {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { code, action },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        if (data.order) {
          setOrderDetails(data.order);
          setShopDetails(data.shop);
          setStep('details');
        } else {
          toast.success(data.message);
          onSuccess?.();
          setStep('input');
          setCode('');
          setOrderDetails(null);
          setShopDetails(null);
        }
      } else {
        toast.error(data.error || 'Failed to process code');
      }
    },
    onError: (error: any) => {
      console.error('Redeem code error:', error);
      toast.error(error.message || 'Failed to process code');
    },
  });

  const handleViewCode = () => {
    if (!code.trim()) {
      toast.error('Please enter a redemption code');
      return;
    }
    redeemMutation.mutate({ code: code.trim(), action: 'view' });
  };

  const handleConfirmDelivery = () => {
    if (!orderDetails) return;
    redeemMutation.mutate({ code, action: 'confirm_delivery' });
  };

  const handleConfirmReceipt = () => {
    if (!orderDetails) return;
    redeemMutation.mutate({ code, action: 'confirm_receipt' });
  };

  const resetModal = () => {
    setStep('input');
    setCode('');
    setOrderDetails(null);
    setShopDetails(null);
  };

  return (
    <Dialog onOpenChange={(open) => !open && resetModal()}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <QrCode className="h-4 w-4 mr-2" />
            Redeem Code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'input' && 'Enter Redemption Code'}
            {step === 'details' && 'Order Details'}
            {step === 'confirm' && 'Confirm Action'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' && 'Enter the redemption code to view order details or confirm delivery/receipt.'}
            {step === 'details' && 'Review the order details below.'}
            {step === 'confirm' && 'Confirm your action for this order.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">Redemption Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter 8-character code"
                maxLength={8}
                className="font-mono text-center text-lg tracking-wider"
              />
            </div>
            <Button
              onClick={handleViewCode}
              disabled={redeemMutation.isPending || code.length !== 8}
              className="w-full"
            >
              {redeemMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              View Order Details
            </Button>
          </div>
        )}

        {step === 'details' && orderDetails && shopDetails && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order {orderDetails.order_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Shop</Label>
                    <p className="text-sm text-muted-foreground">{shopDetails.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Customer</Label>
                    <p className="text-sm text-muted-foreground">
                      {orderDetails.customers?.name || 'N/A'} ({orderDetails.customers?.phone || 'N/A'})
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant={orderDetails.status === 'completed' ? 'default' : 'secondary'}>
                      {orderDetails.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Payment</Label>
                    <Badge variant={orderDetails.payment_status === 'paid' ? 'default' : 'destructive'}>
                      {orderDetails.payment_status}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-medium mb-2 block">Items</Label>
                  <div className="space-y-2">
                    {orderDetails.order_items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Qty: {item.quantity} × ₦{item.unit_price.toLocaleString()}
                          </p>
                        </div>
                        <p className="font-medium">₦{item.total_price.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span>₦{orderDetails.total.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('input')} className="flex-1">
                Back
              </Button>
              {mode === 'confirm_delivery' && !orderDetails.redemption_confirmed && (
                <Button
                  onClick={handleConfirmDelivery}
                  disabled={redeemMutation.isPending}
                  className="flex-1"
                >
                  {redeemMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirm Delivery
                </Button>
              )}
              {mode === 'confirm_receipt' && !orderDetails.redemption_confirmed && (
                <Button
                  onClick={handleConfirmReceipt}
                  disabled={redeemMutation.isPending}
                  className="flex-1"
                >
                  {redeemMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirm Receipt
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}