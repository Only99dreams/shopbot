import { 
  Bot, 
  ShoppingBag, 
  CreditCard, 
  BarChart3, 
  Users,
  ShieldCheck,
  MessageCircle,
  MapPin,
  Clock,
  Smartphone,
  Zap,
  Globe
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: MessageCircle,
    title: "Sell on WhatsApp",
    description: "Your customers order directly through WhatsApp — the app they already use every day. No need to download anything new!",
    color: "bg-green-500/10 text-green-600",
  },
  {
    icon: Smartphone,
    title: "Beautiful Online Shop",
    description: "Get a professional-looking shop page you can share anywhere. Your products displayed beautifully with photos and prices.",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: Bot,
    title: "AI Replies for You",
    description: "Our smart AI answers customer questions 24/7 — even when you're sleeping or busy. Never miss a sale!",
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    icon: CreditCard,
    title: "Easy Payment Collection",
    description: "Accept bank transfers, card payments, and track who has paid. No more confusion about orders!",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    icon: MapPin,
    title: "Reach Local Customers",
    description: "Customers in your area can find your shop on our marketplace. Get discovered by people looking to buy nearby.",
    color: "bg-red-500/10 text-red-600",
  },
  {
    icon: BarChart3,
    title: "Track Your Sales",
    description: "See your best-selling products, daily sales, and customer trends. Know exactly how your business is doing.",
    color: "bg-cyan-500/10 text-cyan-600",
  },
];

const testimonials = [
  {
    name: "Mama Chioma",
    business: "Food Vendor, Lagos",
    text: "I used to take orders on paper. Now I get orders on WhatsApp and know exactly who owes me. Sales doubled in 2 months!",
    avatar: "👩🏾‍🍳",
  },
  {
    name: "Adaeze",
    business: "Fashion Seller, Aba",
    text: "My customers love how easy it is to see all my clothes and order. I don't have to send pictures one by one again!",
    avatar: "👩🏽",
  },
  {
    name: "Blessing",
    business: "Hair Stylist, Abuja",
    text: "People book appointments through my shop link. The AI even answers common questions about my prices when I'm busy.",
    avatar: "💇🏾‍♀️",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">
            <Zap className="h-3 w-3 mr-1" />
            Powerful Features
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need to{" "}
            <span className="text-primary">Grow Your Business</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            We built ShopAfrica for everyday sellers like you. No complicated setup, no tech skills required — just sign up and start selling.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg hover:border-primary/20 transition-all duration-300 group"
            >
              <div className={`h-12 w-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-foreground mb-2">
              Sellers Like You Are Thriving
            </h3>
            <p className="text-muted-foreground">
              Join thousands of Nigerian sellers who've transformed their business
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-green-500/20 flex items-center justify-center text-2xl">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.business}</p>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm italic">"{testimonial.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
