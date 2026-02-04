import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Store, Users, Sparkles } from "lucide-react";

const sellerCategories = [
  { emoji: "🍲", label: "Food Vendors" },
  { emoji: "👗", label: "Fashion Sellers" },
  { emoji: "💄", label: "Beauty Products" },
  { emoji: "💇🏾‍♀️", label: "Hair Stylists" },
  { emoji: "🛠️", label: "Artisans" },
  { emoji: "📱", label: "Phone Accessories" },
  { emoji: "🏠", label: "Home Items" },
  { emoji: "👶", label: "Baby Products" },
  { emoji: "🎨", label: "Art & Crafts" },
  { emoji: "🥗", label: "Healthy Foods" },
  { emoji: "👜", label: "Bags & Shoes" },
  { emoji: "🧴", label: "Skincare" },
];

export function CTASection() {
  return (
    <section className="py-20 lg:py-28 bg-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-green-500/5" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative">
        {/* Seller Categories Showcase */}
        <div className="text-center mb-12">
          <p className="text-sm text-muted-foreground mb-4">ShopAfrica is for everyone who sells</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
            {sellerCategories.map((cat) => (
              <span 
                key={cat.label}
                className="inline-flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-full text-sm hover:border-primary/30 transition-colors"
              >
                <span>{cat.emoji}</span>
                <span className="text-muted-foreground">{cat.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Main CTA */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-primary via-primary to-primary/90 rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-3xl" />
            
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full mb-6">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Join 5,000+ Sellers</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Your Business Deserves<br />
                to Be Online
              </h2>
              
              <p className="text-white/80 text-lg max-w-xl mx-auto mb-8">
                Don't let your competitors get ahead. Start selling online today — it's easier than you think!
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/auth?mode=register">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto bg-white text-primary hover:bg-white/90 gap-2 h-14 px-8 text-lg font-semibold shadow-lg">
                    <Store className="h-5 w-5" />
                    Create My Free Shop
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>

              <div className="mt-8 pt-8 border-t border-white/20 grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div>
                  <p className="text-2xl font-bold">Free</p>
                  <p className="text-white/70 text-sm">To Start</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">2 min</p>
                  <p className="text-white/70 text-sm">Setup Time</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">24/7</p>
                  <p className="text-white/70 text-sm">Support</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Teaser */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Have questions? Check our{" "}
            <a href="#" className="text-primary hover:underline font-medium">FAQ</a>
            {" "}or contact our support team.
          </p>
        </div>
      </div>
    </section>
  );
}
