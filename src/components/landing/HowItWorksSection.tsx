import { UserPlus, Package, Share2, MessageCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const steps = [
  {
    step: "01",
    icon: UserPlus,
    title: "Sign Up Free",
    description: "Create your account in 2 minutes. Just your name, phone number, and WhatsApp. That's it!",
    color: "bg-blue-500",
  },
  {
    step: "02",
    icon: Package,
    title: "Add Your Products",
    description: "Upload photos of what you sell, add prices and descriptions. We make it super easy — even from your phone!",
    color: "bg-purple-500",
  },
  {
    step: "03",
    icon: Share2,
    title: "Share & Start Selling",
    description: "Share your shop link on WhatsApp status, Facebook, Instagram — anywhere! Customers click, browse, and order.",
    color: "bg-green-500",
  },
];

const benefits = [
  "No website needed",
  "Works on any phone",
  "Get paid directly",
  "Support in Pidgin, English & more",
  "Free to start",
  "Cancel anytime",
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-72 h-72 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2" />
      
      <div className="container mx-auto px-4 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Start Selling in{" "}
            <span className="text-primary">3 Simple Steps</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            No tech skills? No problem! If you can use WhatsApp, you can use ShopAfrica.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-border to-border via-primary/30" />
              )}
              
              <div className="text-center relative z-10">
                <div className="relative inline-block mb-6">
                  <div className="h-24 w-24 rounded-2xl bg-card shadow-lg border border-border flex items-center justify-center mx-auto">
                    <step.icon className="h-10 w-10 text-primary" />
                  </div>
                  <div className={`absolute -top-2 -right-2 h-8 w-8 rounded-full ${step.color} flex items-center justify-center shadow-lg`}>
                    <span className="text-white text-xs font-bold">{step.step}</span>
                  </div>
                </div>
                <h3 className="font-bold text-xl text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Benefits & CTA */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-green-500/10 rounded-3xl p-8 md:p-12 border border-primary/10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Why Sellers Love ShopAfrica
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {benefits.map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-center md:text-right">
                <div className="inline-block bg-card rounded-2xl p-6 shadow-lg border">
                  <div className="text-4xl mb-2">🎉</div>
                  <p className="text-lg font-bold text-foreground mb-1">Ready to Start?</p>
                  <p className="text-sm text-muted-foreground mb-4">Join 5,000+ sellers today</p>
                  <Link to="/auth?mode=register">
                    <Button className="w-full bg-primary hover:bg-primary/90 gap-2">
                      Create My Shop
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
