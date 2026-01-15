import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Copy, Check, Loader2, Building2 } from "lucide-react";
import { useBankDetails, useCreatePaymentProof, uploadPaymentProof } from "@/hooks/usePaymentProofs";
import { toast } from "sonner";
import { ThankYouModal } from "./ThankYouModal";

interface BankTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  amount: number;
  customerName: string;
  customerPhone: string;
}

export function BankTransferModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  shopId,
  shopName,
  amount,
  customerName,
  customerPhone,
}: BankTransferModalProps) {
  const { data: bankDetails, isLoading: loadingBank } = useBankDetails();
  const createPaymentProof = useCreatePaymentProof();
  
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Please upload your payment receipt");
      return;
    }

    try {
      setUploading(true);
      const proofUrl = await uploadPaymentProof(file);

      await createPaymentProof.mutateAsync({
        payment_type: 'order',
        reference_id: orderId,
        shop_id: shopId,
        amount: amount,
        proof_image_url: proofUrl,
        customer_name: customerName,
        customer_phone: customerPhone,
      });

      setSubmitted(true);
      setShowThankYou(true);
    } catch (error) {
      console.error("Error submitting payment proof:", error);
      toast.error("Failed to submit payment proof");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFile(null);
    setSubmitted(false);
    setShowThankYou(false);
  };

  if (loadingBank) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show Thank You Modal after successful submission
  if (showThankYou) {
    return (
      <ThankYouModal
        open={open}
        onOpenChange={handleClose}
        orderNumber={orderNumber}
        shopName={shopName}
        shopId={shopId}
      />
    );
  }

  const hasBankDetails = bankDetails?.bank_name && bankDetails?.account_number;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Order #{orderNumber} - Transfer to the account below and upload your receipt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasBankDetails ? (
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Building2 className="h-5 w-5" />
                  <span className="font-semibold">Bank Account Details</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Bank Name</p>
                      <p className="font-medium">{bankDetails.bank_name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(bankDetails.bank_name, 'bank')}
                    >
                      {copied === 'bank' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Account Number</p>
                      <p className="font-medium font-mono">{bankDetails.account_number}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(bankDetails.account_number, 'account')}
                    >
                      {copied === 'account' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Account Name</p>
                      <p className="font-medium">{bankDetails.account_name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(bankDetails.account_name, 'name')}
                    >
                      {copied === 'name' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount to Pay</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(amount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="p-4">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Bank account details not configured. Please contact the seller.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="receipt">Upload Payment Receipt</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
              <Input
                id="receipt"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <label htmlFor="receipt" className="cursor-pointer">
                {file ? (
                  <div className="space-y-2">
                    <Check className="h-8 w-8 mx-auto text-green-500" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload receipt (max 5MB)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              className={`flex-1 ${file && !uploading && hasBankDetails ? 'bg-green-600 hover:bg-green-700' : ''}`}
              onClick={handleSubmit}
              disabled={!file || uploading || !hasBankDetails}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : file ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Submit Payment
                </>
              ) : (
                "Upload Receipt First"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
