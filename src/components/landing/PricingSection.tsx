import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown, Rocket } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Starter",
    subtitle: "Perfect for trying out",
    price: "₦1,000",
    period: "/month",
    icon: Sparkles,
    features: [
      "Up to 30 products",
      "Basic shop page",
      "WhatsApp integration",
      "Order notifications",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
    color: "bg-blue-500",
  },
  {
    name: "Business",
    subtitle: "Most popular for sellers",
    price: "₦3,500",
    period: "/month",
    icon: Crown,
    features: [
      "Unlimited products",
      "AI smart replies",
      "Payment collection",
      "Sales analytics",
      "Priority support",
      "Custom shop link",
      "Marketplace listing",
    ],
    cta: "Start Free Trial",
    popular: true,
    color: "bg-primary",
  },
  {
    name: "Pro",
    subtitle: "For serious sellers",
    price: "₦10,000",
    period: "/month",
    icon: Rocket,
    features: [
      "Everything in Business",
      "Multiple shop staff",
      "Advanced analytics",
      "Bulk product upload",
      "Dedicated support",
      "Featured in marketplace",
      "Custom branding",
    ],
    cta: "Start Free Trial",
    popular: false,
    color: "bg-purple-500",
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">
            Simple Pricing
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Affordable Plans for{" "}
            <span className="text-primary">Every Seller</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free, upgrade when you're ready. No hidden fees, cancel anytime. 
            Prices everyone can afford!
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl p-6 transition-all duration-300 hover:scale-[1.02] ${
                plan.popular
                  ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/25 ring-2 ring-primary"
                  : "bg-card border border-border hover:border-primary/30 hover:shadow-lg"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-foreground text-background px-4 py-1 text-sm font-semibold shadow-lg">
                    🔥 Most Popular
                  </Badge>
                </div>
              )}

              <div className="mb-6 pt-2">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${plan.popular ? 'bg-white/20' : plan.color + '/10'} mb-4`}>
                  <plan.icon className={`h-6 w-6 ${plan.popular ? 'text-white' : plan.color.replace('bg-', 'text-')}`} />
                </div>
                <h3 className={`text-xl font-bold ${plan.popular ? "" : "text-foreground"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {plan.subtitle}
                </p>
                <div className="mt-4">
                  <span className={`text-4xl font-bold ${plan.popular ? "" : "text-foreground"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {plan.period}
                  </span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-0.5 ${plan.popular ? 'bg-white/20' : 'bg-green-500/10'}`}>
                      <Check className={`h-4 w-4 flex-shrink-0 ${plan.popular ? "text-white" : "text-green-600"}`} />
                    </div>
                    <span className={`text-sm ${plan.popular ? "" : "text-muted-foreground"}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link to="/auth?mode=register">
                <Button
                  variant={plan.popular ? "secondary" : "outline"}
                  size="lg"
                  className={`w-full rounded-xl h-12 font-semibold ${
                    plan.popular 
                      ? "bg-white text-primary hover:bg-white/90" 
                      : "border-border hover:bg-primary hover:text-primary-foreground"
                  }`}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">Trusted payment methods</p>
          <div className="flex items-center justify-center gap-6 opacity-60">
            <span className="font-semibold">Paystack</span>
            <span className="font-semibold">Bank Transfer</span>
            <span className="font-semibold">USSD</span>
          </div>
        </div>
      </div>
    </section>
  );
}
