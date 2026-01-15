import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Gift, Store, Share2, Copy } from 'lucide-react';
import { useReferralEarnings } from '@/hooks/usePlatformSettings';
import { toast } from 'sonner';

interface ThankYouModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  shopName: string;
  shopId: string;
}

export function ThankYouModal({ 
  open, 
  onOpenChange, 
  orderNumber, 
  shopName,
  shopId 
}: ThankYouModalProps) {
  const { data: referralEarnings } = useReferralEarnings();
  
  const shopUrl = `${window.location.origin}/shop/${shopId}`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shopUrl);
    toast.success('Shop link copied!');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Shop at ${shopName}`,
          text: `Check out amazing products at ${shopName}!`,
          url: shopUrl,
        });
      } catch (err) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          {/* Success Icon */}
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          {/* Thank You Message */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Thank You for Your Order! 🎉
            </h2>
            <p className="text-muted-foreground">
              Order #{orderNumber} has been placed successfully.
            </p>
            <p className="text-sm text-muted-foreground">
              Once your payment is verified, you'll receive a confirmation.
            </p>
          </div>

          {/* Divider */}
          <div className="w-full border-t border-border my-4" />

          {/* Start Your Own Shop Section */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 w-full space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">
                Want to Earn Money Too?
              </h3>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Start your own online shop with ShopNaija and earn from sales!
            </p>

            {referralEarnings && (
              <div className="bg-background/80 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Signup Bonus:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(referralEarnings.signup_bonus)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Referral Earnings:</span>
                  <span className="font-semibold text-green-600">
                    {referralEarnings.subscription_percentage}% on subscriptions
                  </span>
                </div>
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/auth'}
            >
              <Store className="w-4 h-4 mr-2" />
              Start Your Own Shop
            </Button>
          </div>

          {/* Share Shop Section */}
          <div className="w-full space-y-2">
            <p className="text-sm text-muted-foreground">
              Loved shopping here? Share this shop!
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleCopyLink}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleShare}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          {/* Close Button */}
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Continue Shopping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
