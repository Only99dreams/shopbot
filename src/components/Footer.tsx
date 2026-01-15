import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-muted/50 border-t border-border py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="WAShop" className="h-6 w-6 object-contain" />
            <span className="text-sm font-medium text-foreground">WAShop</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link to="/auth" className="hover:text-foreground transition-colors">Login</Link>
          </div>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} WAShop. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
