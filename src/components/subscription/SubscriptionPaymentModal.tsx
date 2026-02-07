import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  const handlePayWithFlutterwave = () => {
    // Open Flutterwave payment link in new tab
    window.open('https://flutterwave.com/pay/d1rzwyjp2xlr', '_blank');
    // Close the modal after opening payment link
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to {plan.name}</DialogTitle>
          <DialogDescription>
            Pay {formatCurrency(plan.price)}/month using Flutterwave
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold text-primary">{formatCurrency(plan.price)}</div>
                <div className="text-sm text-muted-foreground">per month</div>
                <div className="text-sm font-medium">{plan.name} Plan</div>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90"
                size="lg"
                onClick={handlePayWithFlutterwave}
              >
                Pay with Flutterwave
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                You will be redirected to Flutterwave's secure payment page
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
