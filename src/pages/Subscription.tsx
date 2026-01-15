import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Building2, Clock, Receipt, Loader2 } from "lucide-react";
import { useShop } from "@/hooks/useShop";
import { usePaymentProofs } from "@/hooks/usePaymentProofs";
import { useSubscriptionPlans } from "@/hooks/usePlatformSettings";
import { cn } from "@/lib/utils";
import { SubscriptionPaymentModal } from "@/components/subscription/SubscriptionPaymentModal";
import { format } from "date-fns";

const planFeatures = {
  starter: {
    description: "Perfect for getting started",
    icon: Zap,
    features: [
      "Up to 50 products",
      "Basic analytics",
      "WhatsApp integration",
      "Email support",
      "1 admin user",
    ],
  },
  pro: {
    description: "For growing businesses",
    icon: Crown,
    features: [
      "Unlimited products",
      "Advanced analytics",
      "Priority WhatsApp support",
      "AI chatbot responses",
      "Up to 5 admin users",
      "Custom domain",
      "Remove branding",
    ],
    popular: true,
  },
  business: {
    description: "For large operations",
    icon: Building2,
    features: [
      "Everything in Pro",
      "API access",
      "Dedicated account manager",
      "Custom integrations",
      "Unlimited admin users",
      "SLA guarantee",
      "White-label solution",
    ],
  },
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function Subscription() {
  const { subscription, shop } = useShop();
  const { data: paymentProofs } = usePaymentProofs();
  const { data: subscriptionPlans, isLoading: loadingPlans } = useSubscriptionPlans();
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; name: string; price: number } | null>(null);

  const currentPlan = subscription?.plan || "starter";
  const isInactive = subscription?.status === "inactive";

  // Build plans array from platform settings
  const plans = subscriptionPlans ? [
    { id: 'starter', name: subscriptionPlans.starter.name, price: subscriptionPlans.starter.price, ...planFeatures.starter },
    { id: 'pro', name: subscriptionPlans.pro.name, price: subscriptionPlans.pro.price, ...planFeatures.pro },
    { id: 'business', name: subscriptionPlans.business.name, price: subscriptionPlans.business.price, ...planFeatures.business },
  ] : [];

  // Get pending payment proofs for subscriptions
  const pendingProofs = paymentProofs?.filter(
    p => p.payment_type === 'subscription' && p.status === 'pending'
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loadingPlans) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription plan</p>
        </div>

        {/* Pending Payment Notice */}
        {pendingProofs.length > 0 && (
          <Card className="shadow-card border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-yellow-500/10">
                  <Receipt className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Payment Pending Review</h3>
                  <p className="text-muted-foreground">
                    Your payment proof has been submitted and is awaiting admin approval.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan Status */}
        {isInactive && pendingProofs.length === 0 && (
          <Card className="shadow-card border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Subscription Required</h3>
                    <p className="text-muted-foreground">
                      Pay ₦1,000/month to activate your shop and start selling
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan && subscription?.status === 'active';
            const hasPendingPayment = pendingProofs.some(p => true);
            const PlanIcon = plan.icon;
            const isPopular = 'popular' in plan && plan.popular;
            
            return (
              <Card 
                key={plan.id} 
                className={cn(
                  "shadow-card relative overflow-hidden transition-all hover:shadow-lg",
                  isPopular && "border-primary",
                  isCurrentPlan && "ring-2 ring-primary"
                )}
              >
                {isPopular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                
                <CardHeader className="pb-2">
                  <div className={cn(
                    "inline-flex p-3 rounded-lg mb-2 w-fit",
                    isPopular ? "bg-primary/10" : "bg-muted"
                  )}>
                    <PlanIcon className={cn(
                      "h-6 w-6",
                      isPopular ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-muted-foreground text-sm">{plan.description}</p>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{formatCurrency(plan.price)}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className="w-full" 
                    variant={isCurrentPlan ? "outline" : isPopular ? "default" : "outline"}
                    disabled={isCurrentPlan || hasPendingPayment}
                    onClick={() => !isCurrentPlan && !hasPendingPayment && setSelectedPlan({ id: plan.id, name: plan.name, price: plan.price })}
                  >
                    {isCurrentPlan ? "Current Plan" : hasPendingPayment ? "Payment Pending" : "Subscribe"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Payment History */}
        {paymentProofs && paymentProofs.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentProofs.filter(p => p.payment_type === 'subscription').map((proof) => (
                  <div key={proof.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Subscription Payment</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(proof.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₦{proof.amount.toLocaleString()}</p>
                      {getStatusBadge(proof.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing History */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No billing history yet</p>
              <p className="text-sm">Transactions will appear here after your first payment</p>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { q: "How do I pay for a subscription?", a: "Click on the plan you want, make a bank transfer to our account, and upload your receipt. We'll activate your subscription within 24 hours." },
              { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period." },
              { q: "What payment methods do you accept?", a: "We accept bank transfers. Simply transfer to our account and upload your receipt for verification." },
              { q: "Can I switch plans?", a: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately." },
            ].map((faq) => (
              <div key={faq.q} className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-1">{faq.q}</h4>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Subscription Payment Modal */}
      <SubscriptionPaymentModal
        open={!!selectedPlan}
        onOpenChange={(open) => !open && setSelectedPlan(null)}
        plan={selectedPlan || { id: '', name: '', price: 0 }}
      />
    </DashboardLayout>
  );
}
