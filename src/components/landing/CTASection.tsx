import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Transform Your WhatsApp Business?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of sellers who are growing their business with WhatsApp Shop Bot.
          </p>
          <Link to="/auth?mode=register">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
