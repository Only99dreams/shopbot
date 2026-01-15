import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    price: "₦1,000",
    period: "/month",
    features: [
      "Up to 50 products",
      "Basic analytics",
      "WhatsApp integration",
      "Email support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Business",
    price: "₦5,000",
    period: "/month",
    features: [
      "Unlimited products",
      "Advanced analytics",
      "AI smart replies",
      "Priority support",
      "Referral system",
      "Custom shop link",
    ],
    cta: "Get Started",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "₦20,000",
    period: "/month",
    features: [
      "Everything in Business",
      "Multiple team members",
      "API access",
      "Dedicated support",
      "Custom integrations",
      "White-label options",
    ],
    cta: "Get Started",
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-muted-foreground">
            Choose the plan that works best for your business.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 ${
                plan.popular
                  ? "bg-primary text-primary-foreground shadow-lg ring-2 ring-primary"
                  : "bg-card border border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className={`text-lg font-semibold ${plan.popular ? "" : "text-foreground"}`}>
                  {plan.name}
                </h3>
                <div className="mt-2">
                  <span className={`text-3xl font-bold ${plan.popular ? "" : "text-foreground"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {plan.period}
                  </span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className={`h-4 w-4 flex-shrink-0 ${plan.popular ? "" : "text-primary"}`} />
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
                  className={`w-full ${plan.popular ? "" : "border-border"}`}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
