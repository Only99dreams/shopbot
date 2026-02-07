import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const sellerProfiles = [
  {
    emoji: "👩🏾‍🍳",
    title: "Food Vendors",
    description: "Mama put, small chops sellers, home cooks — show your menu and take orders easily",
    benefits: ["Menu with photos", "Order tracking", "Delivery scheduling"],
    color: "from-orange-500/20 to-red-500/20",
    borderColor: "border-orange-500/30",
  },
  {
    emoji: "👗",
    title: "Fashion Sellers",
    description: "Ankara, thrift, ready-to-wear — display your pieces beautifully",
    benefits: ["Product gallery", "Size options", "Price comparison"],
    color: "from-pink-500/20 to-purple-500/20",
    borderColor: "border-pink-500/30",
  },
  {
    emoji: "💅",
    title: "Beauty & Hair",
    description: "Makeup artists, hair stylists, skincare sellers — book appointments and sell products",
    benefits: ["Service menu", "Booking system", "Product catalog"],
    color: "from-purple-500/20 to-indigo-500/20",
    borderColor: "border-purple-500/30",
  },
  {
    emoji: "🏪",
    title: "Market Women",
    description: "Foodstuff, provisions, household items — your market stall, now online",
    benefits: ["Bulk pricing", "Regular customers", "Easy reorders"],
    color: "from-green-500/20 to-emerald-500/20",
    borderColor: "border-green-500/30",
  },
  {
    emoji: "🛠️",
    title: "Service Providers",
    description: "Plumbers, electricians, tailors, mechanics — get found and booked",
    benefits: ["Service listing", "Work gallery", "Customer reviews"],
    color: "from-blue-500/20 to-cyan-500/20",
    borderColor: "border-blue-500/30",
  },
  {
    emoji: "📱",
    title: "Online Sellers",
    description: "Already selling on social media? Upgrade with a professional shop page",
    benefits: ["Shop link", "Auto-replies", "Payment tracking"],
    color: "from-green-500/20 to-teal-500/20",
    borderColor: "border-green-500/30",
  },
];

export function WhoItsForSection() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">
            Built for You
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            ShopAfrica is for{" "}
            <span className="text-primary">Every Seller</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Whether you cook, sew, style hair, or sell anything else — ShopAfrica helps you reach more customers and make more sales.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {sellerProfiles.map((profile) => (
            <div
              key={profile.title}
              className={`relative bg-gradient-to-br ${profile.color} rounded-2xl p-6 border ${profile.borderColor} hover:shadow-lg transition-all duration-300 group`}
            >
              <div className="text-5xl mb-4">{profile.emoji}</div>
              <h3 className="font-bold text-xl text-foreground mb-2">{profile.title}</h3>
              <p className="text-muted-foreground mb-4">{profile.description}</p>
              
              <ul className="space-y-2">
                {profile.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-muted-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Don't see your business type? No problem! ShopAfrica works for <strong>any</strong> kind of seller.
          </p>
          <Link to="/auth?mode=register">
            <Button className="gap-2">
              Create Your Shop Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
