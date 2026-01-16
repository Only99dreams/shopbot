import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Gift, Store, Share2, Copy, Sparkles, ArrowRight } from 'lucide-react';
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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Success Header */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 text-center text-white">
          <div className="w-20 h-20 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-4">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            Thank You! 🎉
          </h2>
          <p className="text-white/90">
            Order #{orderNumber} has been placed
          </p>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-center text-muted-foreground">
            Once your payment is verified, you'll receive a confirmation from the seller.
          </p>

          {/* Start Your Own Shop Section */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-5 space-y-4 border border-primary/10">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-bold text-foreground">
                Want to Earn Money Too?
              </h3>
            </div>
            
            <p className="text-sm text-center text-muted-foreground">
              Start your own online shop with ShopAfrica and earn from sales!
            </p>

            {referralEarnings && (
              <div className="bg-background rounded-xl p-4 space-y-2 border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Signup Bonus:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(referralEarnings.signup_bonus)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Referral Earnings:</span>
                  <span className="font-bold text-green-600">
                    {referralEarnings.subscription_percentage}% on subscriptions
                  </span>
                </div>
              </div>
            )}

            <Button 
              className="w-full rounded-full h-11 font-semibold shadow-lg shadow-primary/25" 
              onClick={() => window.location.href = '/auth'}
            >
              <Store className="w-4 h-4 mr-2" />
              Start Your Own Shop
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Share Shop Section */}
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Loved shopping here? Share this shop!
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 rounded-full"
                onClick={handleCopyLink}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 rounded-full"
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
            className="w-full rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Continue Shopping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
