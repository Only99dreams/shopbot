import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, MapPin, TrendingDown, Search, CheckCircle2, Store, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

const comparisonExample = {
  product: "Bag of Rice (50kg)",
  sellers: [
    { name: "Mama Titi Store", area: "Ikeja, Lagos", price: 78000, distance: "0.5km" },
    { name: "Iya Basira Foods", area: "Ikeja, Lagos", price: 75500, distance: "1.2km" },
    { name: "Chidi Provisions", area: "Ikeja, Lagos", price: 79000, distance: "0.8km" },
  ]
};

const benefits = [
  {
    icon: MapPin,
    title: "Area-Specific Search",
    description: "Find sellers in your exact area — Ikeja, Surulere, Wuse, or wherever you are. No more driving across town!",
  },
  {
    icon: TrendingDown,
    title: "See the Lowest Prices",
    description: "Compare prices from multiple sellers instantly. Know who has the best deal before you buy.",
  },
  {
    icon: Store,
    title: "Support Local Sellers",
    description: "Buy from sellers in your community. Build relationships with trusted local businesses.",
  },
  {
    icon: ShoppingBag,
    title: "Get Value for Money",
    description: "Stop overpaying! See what others charge and make sure you're getting a fair price.",
  },
];

export function PriceComparisonSection() {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 border-green-500/30 text-green-600">
            <TrendingDown className="h-3 w-3 mr-1" />
            Price Comparison
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Compare Prices in{" "}
            <span className="text-primary">Your Area</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Why pay more? ShopAfrica lets you compare prices from sellers near you. 
            Find the best deals without leaving your neighborhood!
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Demo Card */}
          <div className="order-2 lg:order-1">
            <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-5 w-5" />
                  <span className="font-medium">Price Comparison</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">Searching in: <strong>Ikeja, Lagos</strong></span>
                </div>
              </div>
              
              <CardContent className="p-4">
                <h3 className="font-bold text-lg mb-4">{comparisonExample.product}</h3>
                
                <div className="space-y-3">
                  {comparisonExample.sellers.map((seller, index) => (
                    <div 
                      key={seller.name}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        index === 1 
                          ? 'bg-green-50 dark:bg-green-500/10 border-2 border-green-500/30' 
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          index === 1 ? 'bg-green-500 text-white' : 'bg-muted'
                        }`}>
                          {index === 1 ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Store className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{seller.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {seller.distance} away
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${index === 1 ? 'text-green-600 text-lg' : ''}`}>
                          ₦{seller.price.toLocaleString()}
                        </p>
                        {index === 1 && (
                          <Badge className="bg-green-500 text-white text-xs">Best Price!</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-green-50 dark:bg-green-500/10 rounded-xl text-center">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    💰 You save <strong>₦3,500</strong> buying from Iya Basira Foods!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Benefits */}
          <div className="order-1 lg:order-2 space-y-6">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}

            <Link to="/marketplace" className="inline-block mt-4">
              <Button size="lg" className="gap-2">
                <Search className="h-4 w-4" />
                Start Comparing Prices
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
