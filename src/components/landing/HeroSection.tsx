import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, ShoppingCart, Star } from "lucide-react";

export function HeroSection() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI-Powered Commerce
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
              Your Complete Shop Inside{" "}
              <span className="text-primary">WhatsApp</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg">
              Create a full ecommerce experience for your customers without leaving WhatsApp. AI-powered responses, seamless payments, and powerful analytics.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link to="/auth?mode=register">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  See How it Works
                </Button>
              </a>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center"
                  >
                    <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Trusted by 2,000+ sellers</span>
            </div>
          </div>

          {/* Right content - WhatsApp Chat Mockup */}
          <div className="relative">
            <div className="absolute -top-4 -right-4 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full z-10">
              AI-Powered
            </div>
            
            <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden max-w-sm mx-auto lg:mx-0 lg:ml-auto">
              {/* Chat Header */}
              <div className="bg-primary px-4 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center p-1.5">
                  <img src="/logo.png" alt="WAShop" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="font-semibold text-primary-foreground text-sm">Fashion Store</p>
                  <p className="text-xs text-primary-foreground/80">Online now</p>
                </div>
              </div>

              {/* Chat Content */}
              <div className="p-4 space-y-4 bg-muted/30 min-h-[360px]">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                    <p className="text-sm">Hi! I want to see your products</p>
                  </div>
                </div>

                {/* Bot response with categories */}
                <div className="flex gap-2">
                  <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%]">
                    <p className="text-sm text-foreground mb-3">Welcome! Here are our categories:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {["Shirts", "Pants", "Shoes", "Accessories"].map((item) => (
                        <button
                          key={item}
                          className="bg-background text-foreground text-sm py-2 px-4 rounded-lg border border-border hover:bg-muted transition-colors"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                    <p className="text-sm">Show me Shirts</p>
                  </div>
                </div>

                {/* Bot response with product */}
                <div className="flex gap-2">
                  <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%]">
                    <p className="text-sm text-foreground mb-3">Here are our top picks:</p>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="h-16 w-16 mx-auto mb-2 bg-background rounded-lg flex items-center justify-center">
                        <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Classic White Tee</p>
                      <p className="text-sm text-primary font-semibold">$29.99</p>
                      <Button size="sm" className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8">
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
