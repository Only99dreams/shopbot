import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Building2, Clock, Loader2, CheckCircle } from "lucide-react";
import { useShop } from "@/hooks/useShop";
import { useSubscriptionPlans } from "@/hooks/usePlatformSettings";
import { cn } from "@/lib/utils";
import { SubscriptionPaymentModal } from "@/components/subscription/SubscriptionPaymentModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const planFeatures = {
  starter: {
    description: "Perfect for getting started",
    icon: Zap,
    features: [
      "Up to 50 products",
      "Basic analytics",
      "Order notifications",
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
      "Priority support",
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
  const { subscription, shop, refetch: refetchShop } = useShop();
  const { data: subscriptionPlans, isLoading: loadingPlans } = useSubscriptionPlans();
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; name: string; price: number } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const queryClient = useQueryClient();
  const verificationAttempted = useRef(false);

  const currentPlan = subscription?.plan || "starter";
  const isInactive = subscription?.status !== "active";

  const currentPlanAmount = selectedPlan?.price
    ?? (subscriptionPlans && (subscriptionPlans as any)[currentPlan]?.price)
    ?? 0;

  // Detect Flutterwave callback params on mount
  const transactionId = searchParams.get('transaction_id');
  const flwStatus = searchParams.get('status');
  const hasFlutterwaveCallback = !!(transactionId && flwStatus === 'successful');
  
  console.log('Subscription page params:', { transactionId, flwStatus, hasFlutterwaveCallback });

  const loadBillingHistory = async () => {
    if (!shop?.id) return;
    setBillingLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_proofs')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('payment_type', 'subscription')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBillingHistory(data || []);
    } catch (error) {
      console.error('Error loading billing history:', error);
    } finally {
      setBillingLoading(false);
    }
  };

  // Handle Flutterwave payment callback - activate subscription directly
  useEffect(() => {
    console.log('Activation effect deps:', { hasFlutterwaveCallback, shopId: shop?.id, verificationAttempted: verificationAttempted.current });
    
    if (!hasFlutterwaveCallback || verificationAttempted.current) {
      return;
    }

    // Don't proceed if shop data isn't loaded yet
    if (!shop?.id) {
      console.log('Waiting for shop data...');
      return;
    }

    verificationAttempted.current = true;
    setVerifying(true);
    
    const activateSubscription = async () => {
      try {
        const shopId = shop.id;
        const planId = selectedPlan?.id || currentPlan || 'starter';
        console.log('Flutterwave callback detected - Activating subscription for shop:', shopId, 'plan:', planId);

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        // Check if subscription exists
        const { data: existingSub, error: fetchError } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('shop_id', shopId)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching subscription:', fetchError);
          throw fetchError;
        }

        // Update or insert subscription
        let subscriptionId: string | null = null;

        if (existingSub) {
          console.log('Updating existing subscription:', existingSub.id);
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              plan: planId,
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            })
            .eq('id', existingSub.id);

          if (updateError) {
            console.error('Error updating subscription:', updateError);
            throw updateError;
          }

          subscriptionId = existingSub.id;
        } else {
          console.log('Creating new subscription');
          const { data: insertedSub, error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              shop_id: shopId,
              plan: planId,
              status: 'active',
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            })
            .select('id')
            .maybeSingle();

          if (insertError) {
            console.error('Error inserting subscription:', insertError);
            throw insertError;
          }

          subscriptionId = insertedSub?.id ?? null;
        }

        // Activate the shop
        console.log('Activating shop');
        const { error: shopError } = await supabase
          .from('shops')
          .update({ is_active: true })
          .eq('id', shopId);

        if (shopError) {
          console.error('Error activating shop:', shopError);
          throw shopError;
        }

        // Record billing history (auto-approved)
        if (subscriptionId && currentPlanAmount > 0) {
          const { error: proofError } = await supabase
            .from('payment_proofs')
            .insert({
              payment_type: 'subscription',
              reference_id: subscriptionId,
              shop_id: shopId,
              amount: currentPlanAmount,
              status: 'approved',
              admin_notes: transactionId ? `Flutterwave transaction_id: ${transactionId}` : null,
            });

          if (proofError) {
            console.error('Error recording payment proof:', proofError);
          }
        }

        console.log('Subscription activated successfully! Refreshing shop state...');
        setPaymentSuccess(true);
        toast.success('Payment successful! Your subscription is now active.');
        
        // Refresh shop & subscription state and WAIT for it
        await refetchShop();
        await loadBillingHistory();
        console.log('Shop state refreshed');
      } catch (err) {
        console.error('Activation error:', err);
        toast.error('Activation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setVerifying(false);
        // Clear URL params after a short delay to ensure state update completes
        setTimeout(() => {
          setSearchParams({}, { replace: true });
        }, 500);
      }
    };

    activateSubscription();
  }, [hasFlutterwaveCallback, shop?.id, selectedPlan?.id, currentPlan]);

  useEffect(() => {
    loadBillingHistory();
  }, [shop?.id]);

  // Handle cancelled payment
  useEffect(() => {
    if (flwStatus === 'cancelled') {
      toast.error('Payment was cancelled.');
      setSearchParams({}, { replace: true });
    }
  }, [flwStatus]);

  // Build plans array from platform settings
  const plans = subscriptionPlans ? [
    { id: 'starter', name: subscriptionPlans.starter.name, price: subscriptionPlans.starter.price, ...planFeatures.starter },
    { id: 'pro', name: subscriptionPlans.pro.name, price: subscriptionPlans.pro.price, ...planFeatures.pro },
    { id: 'business', name: subscriptionPlans.business.name, price: subscriptionPlans.business.price, ...planFeatures.business },
  ] : [];

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

        {/* Verifying Payment */}
        {verifying && (
          <Card className="shadow-card border-blue-500/50 bg-blue-500/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <div>
                  <h3 className="font-semibold text-lg">Verifying Payment...</h3>
                  <p className="text-muted-foreground">
                    Please wait while we confirm your payment with Flutterwave.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Success */}
        {paymentSuccess && (
          <Card className="shadow-card border-green-500/50 bg-green-500/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Subscription Activated!</h3>
                  <p className="text-muted-foreground">
                    Your payment was successful and your shop is now active.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan Status */}
        {isInactive && !verifying && !paymentSuccess && (
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
                      Subscribe to activate your shop and start selling
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
                    disabled={isCurrentPlan}
                    onClick={() => !isCurrentPlan && setSelectedPlan({ id: plan.id, name: plan.name, price: plan.price })}
                  >
                    {isCurrentPlan ? "Current Plan" : "Subscribe"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Billing History */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            {billingLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading billing history...</p>
              </div>
            ) : billingHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No billing history yet</p>
                <p className="text-sm">Transactions will appear here after your first payment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {billingHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4"
                  >
                    <div>
                      <p className="font-medium">Subscription payment</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(item.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(Number(item.amount || 0))}</p>
                      <Badge variant={item.status === 'approved' ? 'default' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { q: "How do I pay for a subscription?", a: "Click on the plan you want and pay securely through Flutterwave. Your subscription will be activated immediately after payment." },
              { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period." },
              { q: "What payment methods do you accept?", a: "We accept all payment methods supported by Flutterwave including cards, bank transfers, mobile money, and digital wallets." },
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
