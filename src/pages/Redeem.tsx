import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, CheckCircle, Loader2, QrCode } from 'lucide-react';
import { RedemptionCodeModal } from '@/components/RedemptionCodeModal';
import { toast } from 'sonner';

export default function Redeem() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Shop
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Redeem Your Order</h1>
            <p className="text-muted-foreground">
              Enter your redemption code to confirm receipt of your order and complete the transaction.
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  1
                </div>
                <div>
                  <p className="font-medium">Make Payment</p>
                  <p className="text-sm text-muted-foreground">
                    Complete your payment and receive a unique redemption code.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  2
                </div>
                <div>
                  <p className="font-medium">Visit Shop</p>
                  <p className="text-sm text-muted-foreground">
                    Go to the shop with your redemption code.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  3
                </div>
                <div>
                  <p className="font-medium">Shop Confirms Delivery</p>
                  <p className="text-sm text-muted-foreground">
                    The shop owner scans or enters your code to verify the order.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  4
                </div>
                <div>
                  <p className="font-medium">Confirm Receipt</p>
                  <p className="text-sm text-muted-foreground">
                    Enter your code here to confirm you received your goods and release payment to the seller.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enter Redemption Code</CardTitle>
            </CardHeader>
            <CardContent>
              <RedemptionCodeModal
                mode="confirm_receipt"
                onSuccess={() => {
                  toast.success('Receipt confirmed! Payment has been released to the seller.');
                  navigate('/');
                }}
                trigger={
                  <Button className="w-full" size="lg">
                    <QrCode className="h-5 w-5 mr-2" />
                    Enter Redemption Code
                  </Button>
                }
              />
            </CardContent>
          </Card>

          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              Don't have a redemption code yet?{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => navigate('/marketplace')}
              >
                Browse shops
              </Button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}