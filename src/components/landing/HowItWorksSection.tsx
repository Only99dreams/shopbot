import { UserPlus, Package, Share2 } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: UserPlus,
    title: "Register Your Shop",
    description: "Sign up with your WhatsApp business number and create your store profile.",
  },
  {
    step: "02",
    icon: Package,
    title: "Add Products",
    description: "Upload your products with images, prices, and descriptions through our dashboard.",
  },
  {
    step: "03",
    icon: Share2,
    title: "Share & Sell",
    description: "Share your unique shop link - customers shop directly in WhatsApp.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Get Started in 3 Simple Steps
          </h2>
          <p className="text-muted-foreground">
            Launch your WhatsApp shop in minutes, not days.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.step} className="text-center">
              <div className="relative inline-block mb-6">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <div className="absolute -top-2 -left-2 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-xs font-bold">{step.step}</span>
                </div>
              </div>
              <h3 className="font-semibold text-xl text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
