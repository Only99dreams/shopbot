import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShopHeaderProps {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  whatsappNumber?: string | null;
}

export function ShopHeader({ name, description, logoUrl, whatsappNumber }: ShopHeaderProps) {
  const handleWhatsAppClick = () => {
    if (whatsappNumber) {
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanNumber}?text=Hi, I'm interested in your products!`, '_blank');
    }
  };

  return (
    <header className="bg-gradient-to-r from-green-600 to-green-500 text-white">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={name} 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-white/20 flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 flex items-center justify-center text-2xl sm:text-3xl font-bold flex-shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{name}</h1>
            {description && (
              <p className="text-white/80 mt-1 max-w-xl text-sm sm:text-base line-clamp-2">{description}</p>
            )}
          </div>
          {whatsappNumber && (
            <Button 
              onClick={handleWhatsAppClick}
              className="bg-white text-green-600 hover:bg-white/90 w-full sm:w-auto flex-shrink-0"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Chat with Us
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
