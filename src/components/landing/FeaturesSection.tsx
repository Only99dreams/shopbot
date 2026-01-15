import { 
  Bot, 
  ShoppingBag, 
  CreditCard, 
  BarChart3, 
  Users,
  ShieldCheck
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI-Powered Bot",
    description: "Smart auto-replies answer customer FAQs instantly using advanced AI technology.",
  },
  {
    icon: ShoppingBag,
    title: "Full Shop Experience",
    description: "Customers browse products, add to cart, and checkout - all inside WhatsApp.",
  },
  {
    icon: CreditCard,
    title: "Easy Payments",
    description: "Integrated Paystack payment processing with automatic verification.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track sales, orders, and customer behavior with real-time insights.",
  },
  {
    icon: Users,
    title: "Referral System",
    description: "Grow your network with built-in referral tracking and rewards.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Transactions",
    description: "Optional escrow protection ensures safe transactions for everyone.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need to Sell on WhatsApp
          </h2>
          <p className="text-muted-foreground">
            Powerful features designed to help you grow your business and delight customers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-xl p-6 border border-border hover:shadow-md transition-shadow"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
