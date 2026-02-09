import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";

interface SubscriptionPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: {
    id: string;
    name: string;
    price: number;
  };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
};

export function SubscriptionPaymentModal({ open, onOpenChange, plan }: SubscriptionPaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { shop } = useShop();

  const handlePayWithFlutterwave = async () => {
    if (!shop?.id) {
      toast.error("Shop not found. Please try again.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || `${shop.id}@seller.shopnaija.com`;

      const callbackUrl = `${window.location.origin}/dashboard/subscription`;

      const { data, error } = await supabase.functions.invoke('flutterwave-subscribe', {
        body: {
          shopId: shop.id,
          planId: plan.id,
          planName: plan.name,
          amount: plan.price,
          email,
          callbackUrl,
        },
      });

      if (error) throw error;

      if (data.success && data.payment_link) {
        window.location.href = data.payment_link;
      } else {
        throw new Error(data.error || 'Failed to initialize payment');
      }
    } catch (error: any) {
      console.error('Flutterwave subscription error:', error);
      toast.error(error.message || 'Payment initialization failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to {plan.name}</DialogTitle>
          <DialogDescription>
            Pay {formatCurrency(plan.price)}/month securely with Flutterwave
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 space-y-4">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">{formatCurrency(plan.price)}</div>
                <div className="text-sm text-muted-foreground">per month</div>
                <div className="text-sm font-medium">{plan.name} Plan</div>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 h-12 text-base font-semibold"
                size="lg"
                onClick={handlePayWithFlutterwave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Initializing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" />
                    Pay with Flutterwave
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                You will be redirected to Flutterwave's secure payment page. Your subscription will be activated automatically after payment.
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
