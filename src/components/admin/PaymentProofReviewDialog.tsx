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
      // Approval is performed atomically server-side: the proof is marked
      // approved, the order is settled (the redemption-code trigger runs),
      // the seller wallet is credited exactly once, and subscriptions are
      // activated with the correct billing period.
      const { error } = await supabase.rpc('approve_payment_proof', {
        p_proof_id: proof.id,
        p_admin_notes: adminNotes || null,
      });

      if (error) throw error;

      toast.success(
        proof.payment_type === 'subscription'
          ? "Subscription activated successfully"
          : "Payment approved and credited to seller"
      );

      onReviewComplete();
      onOpenChange(false);
    } catch (error) {
      console.error("Error approving payment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to approve payment");
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
