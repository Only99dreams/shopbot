import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Star, Store, Users, ShoppingBag, Sparkles, CheckCircle2, MapPin, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const sellerTypes = [
  { emoji: "👩‍🍳", label: "Food Vendors" },
  { emoji: "👗", label: "Fashion Sellers" },
  { emoji: "💅", label: "Beauty & Hair" },
  { emoji: "🛠️", label: "Service Providers" },
  { emoji: "📱", label: "WhatsApp Vendors" },
  { emoji: "🏪", label: "Market Women" },
];

const stats = [
  { value: "5,000+", label: "Active Sellers" },
  { value: "₦50M+", label: "Monthly Sales" },
  { value: "200+", label: "Areas Covered" },
];

export function HeroSection() {
  return (
    <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-green-500/5" />
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-green-500/10 to-transparent rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                <MessageCircle className="h-3 w-3" />
                WhatsApp Powered
              </Badge>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1">
                <TrendingDown className="h-3 w-3" />
                Compare Prices
              </Badge>
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                <MapPin className="h-3 w-3" />
                Shop Local
              </Badge>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
              Turn Your{" "}
              <span className="text-primary relative">
                Hustle
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 10C50 2 150 2 198 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary/30" />
                </svg>
              </span>
              {" "}into a{" "}
              <span className="text-green-500">Thriving Business</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
              Whether you sell food, fashion, beauty products or offer services — ShopAfrica gives you a professional online shop that works right inside WhatsApp. No tech skills needed!
            </p>

            {/* Seller Types */}
            <div className="flex flex-wrap gap-2 py-2">
              {sellerTypes.map((type) => (
                <span 
                  key={type.label}
                  className="inline-flex items-center gap-1.5 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-full text-sm transition-colors cursor-default"
                >
                  <span>{type.emoji}</span>
                  <span className="text-muted-foreground">{type.label}</span>
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link to="/auth?mode=register">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 gap-2">
                  Start Selling Today — It's Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
                  <Store className="h-4 w-4" />
                  Explore Marketplace
                </Button>
              </Link>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 border-t border-border">
              <div className="flex -space-x-3">
                {["👩🏾", "👨🏽", "👩🏻", "👨🏿", "👩🏼"].map((emoji, i) => (
                  <div
                    key={i}
                    className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-green-500/20 border-2 border-background flex items-center justify-center text-lg"
                  >
                    {emoji}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="text-sm font-medium ml-1">4.9/5</span>
                </div>
                <span className="text-sm text-muted-foreground">Join 5,000+ sellers across Nigeria</span>
              </div>
            </div>
          </div>

          {/* Right content - Visual showcase */}
          <div className="relative">
            {/* Main Card - Shop Preview */}
            <div className="relative bg-card rounded-3xl shadow-2xl border border-border overflow-hidden max-w-md mx-auto lg:mx-0 lg:ml-auto">
              {/* Shop Header */}
              <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">
                    👩🏾‍🍳
                  </div>
                  <div className="text-white">
                    <h3 className="font-bold text-lg">Mama Nkechi's Kitchen</h3>
                    <p className="text-white/80 text-sm flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                      Open • Lagos, Nigeria
                    </p>
                  </div>
                </div>
              </div>

              {/* Products Grid */}
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: "Jollof Rice Special", price: "₦2,500", emoji: "🍚" },
                    { name: "Pepper Soup", price: "₦3,000", emoji: "🍲" },
                    { name: "Fried Plantain", price: "₦500", emoji: "🍌" },
                    { name: "Moin Moin", price: "₦800", emoji: "🫘" },
                  ].map((product) => (
                    <div key={product.name} className="bg-muted/50 rounded-xl p-3 hover:bg-muted transition-colors">
                      <div className="text-3xl mb-2">{product.emoji}</div>
                      <p className="font-medium text-sm text-foreground truncate">{product.name}</p>
                      <p className="text-primary font-bold">{product.price}</p>
                    </div>
                  ))}
                </div>

                {/* WhatsApp Order Button */}
                <Button className="w-full bg-green-500 hover:bg-green-600 text-white gap-2 h-12 rounded-xl">
                  <MessageCircle className="h-5 w-5" />
                  Order via WhatsApp
                </Button>
              </div>

              {/* Floating Stats */}
              <div className="absolute -right-4 top-1/3 bg-card rounded-xl shadow-lg border p-3 animate-bounce-slow">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">New Order!</p>
                    <p className="text-sm font-semibold">₦5,500</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -left-4 bottom-1/4 bg-card rounded-xl shadow-lg border p-3 hidden lg:block">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">This week</p>
                  <p className="text-sm font-bold text-foreground">+127 customers</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
