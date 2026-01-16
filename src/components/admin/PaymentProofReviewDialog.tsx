import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { PaymentProof, useReviewPaymentProof } from "@/hooks/usePaymentProofs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface PaymentProofReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proof: PaymentProof | null;
  onReviewComplete: () => void;
}

export function PaymentProofReviewDialog({
  open,
  onOpenChange,
  proof,
  onReviewComplete,
}: PaymentProofReviewDialogProps) {
  const { user } = useAuth();
  const reviewPaymentProof = useReviewPaymentProof();
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  if (!proof) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleApprove = async () => {
    if (!user) return;

    setProcessing(true);
    try {
      // Update the payment proof status
      await reviewPaymentProof.mutateAsync({
        proofId: proof.id,
        status: 'approved',
        adminNotes,
        reviewedBy: user.id,
      });

      if (proof.payment_type === 'subscription') {
        // Update subscription status
        const { error: subError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', proof.reference_id);

        if (subError) throw subError;

        // Also activate the shop so it becomes visible to buyers
        const { error: shopError } = await supabase
          .from('shops')
          .update({ is_active: true })
          .eq('id', proof.shop_id);

        if (shopError) {
          console.error('Error activating shop:', shopError);
        }

        toast.success("Subscription activated successfully");
      } else if (proof.payment_type === 'order') {
        // Update order payment status
        const { error: orderError } = await supabase
          .from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', proof.reference_id);

        if (orderError) throw orderError;

        // Credit seller wallet
        const { data: wallet } = await supabase
          .from('seller_wallets')
          .select('*')
          .eq('shop_id', proof.shop_id)
          .single();

        const platformFee = proof.amount * 0.05; // 5% platform fee
        const sellerAmount = proof.amount - platformFee;

        if (wallet) {
          await supabase
            .from('seller_wallets')
            .update({
              balance: wallet.balance + sellerAmount,
              total_earned: wallet.total_earned + sellerAmount,
            })
            .eq('id', wallet.id);
        } else {
          await supabase
            .from('seller_wallets')
            .insert({
              shop_id: proof.shop_id,
              balance: sellerAmount,
              total_earned: sellerAmount,
            });
        }

        // Create payment record
        await supabase
          .from('payments')
          .insert({
            order_id: proof.reference_id,
            shop_id: proof.shop_id,
            amount: proof.amount,
            platform_fee: platformFee,
            seller_amount: sellerAmount,
            status: 'success',
            paystack_reference: `BANK-${proof.id.substring(0, 8)}`,
            credited_to_seller: true,
            credited_at: new Date().toISOString(),
          });

        toast.success("Payment approved and credited to seller");
      }

      onReviewComplete();
      onOpenChange(false);
    } catch (error) {
      console.error("Error approving payment:", error);
      toast.error("Failed to approve payment");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!user) return;

    setProcessing(true);
    try {
      await reviewPaymentProof.mutateAsync({
        proofId: proof.id,
        status: 'rejected',
        adminNotes,
        reviewedBy: user.id,
      });

      toast.success("Payment rejected");
      onReviewComplete();
      onOpenChange(false);
    } catch (error) {
      console.error("Error rejecting payment:", error);
      toast.error("Failed to reject payment");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Payment Proof</DialogTitle>
          <DialogDescription>
            Verify the payment details and receipt before approving
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <Badge variant={proof.payment_type === 'subscription' ? 'default' : 'secondary'}>
                  {proof.payment_type === 'subscription' ? 'Subscription' : 'Order Payment'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-semibold">{formatCurrency(proof.amount)}</span>
              </div>

              {proof.customer_name && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Customer</span>
                  <span>{proof.customer_name}</span>
                </div>
              )}

              {proof.customer_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <span>{proof.customer_phone}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Submitted</span>
                <span>{format(new Date(proof.created_at), 'MMM d, yyyy h:mm a')}</span>
              </div>
            </CardContent>
          </Card>

          {proof.proof_image_url && (
            <div className="space-y-2">
              <Label>Payment Receipt</Label>
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={proof.proof_image_url}
                  alt="Payment receipt"
                  className="w-full max-h-64 object-contain bg-muted"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open(proof.proof_image_url!, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Full Image
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Admin Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this payment..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
