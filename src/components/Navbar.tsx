import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu, X, Shield } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="WAShop" className="h-8 w-8 object-contain" />
            <span className="text-xl font-semibold text-foreground">WAShop</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Shield className="h-4 w-4" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Link to="/dashboard">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Dashboard
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link to="/auth?mode=register">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile Nav */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-4">
                {user ? (
                  <>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setIsOpen(false)}>
                        <Button variant="ghost" className="w-full gap-2">
                          <Shield className="h-4 w-4" />
                          Admin Panel
                        </Button>
                      </Link>
                    )}
                    <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        Dashboard
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                      <Button variant="ghost" className="w-full">Login</Button>
                    </Link>
                    <Link to="/auth?mode=register" onClick={() => setIsOpen(false)}>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        Get Started
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
