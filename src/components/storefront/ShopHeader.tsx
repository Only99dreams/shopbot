import { MessageCircle, Clock, Star, Share2, Heart, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { toast } from 'sonner';

interface ShopHeaderProps {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  whatsappNumber?: string | null;
  coverImage?: string | null;
  rating?: number;
  totalProducts?: number;
  state?: string | null;
  city?: string | null;
}

export function ShopHeader({ 
  name, 
  description, 
  logoUrl, 
  whatsappNumber,
  coverImage,
  rating = 4.8,
  totalProducts = 0,
  state,
  city
}: ShopHeaderProps) {
  const [isLiked, setIsLiked] = useState(false);

  const handleWhatsAppClick = () => {
    if (whatsappNumber) {
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanNumber}?text=Hi, I'm interested in your products!`, '_blank');
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: name,
          text: description || `Check out ${name} on ShopAfrica!`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      // User cancelled or error
    }
  };

  return (
    <header className="relative">
      {/* Cover Image / Gradient Background */}
      <div className="relative h-48 sm:h-64 md:h-72 overflow-hidden">
        {coverImage ? (
          <img 
            src={coverImage} 
            alt={`${name} cover`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary via-primary/80 to-primary/60">
            {/* Decorative elements */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white blur-3xl" />
              <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-white blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white blur-3xl" />
            </div>
            {/* Pattern overlay */}
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>
        )}
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Action buttons on cover */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="h-10 w-10 rounded-full bg-white/90 hover:bg-white shadow-lg"
            onClick={() => setIsLiked(!isLiked)}
          >
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-10 w-10 rounded-full bg-white/90 hover:bg-white shadow-lg"
            onClick={handleShare}
          >
            <Share2 className="h-5 w-5 text-gray-600" />
          </Button>
        </div>
      </div>

      {/* Shop Info Card - overlapping the cover */}
      <div className="container mx-auto px-4">
        <div className="relative -mt-20 sm:-mt-24 bg-background rounded-2xl shadow-xl border p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            {/* Logo */}
            <div className="relative -mt-16 sm:-mt-20">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={name} 
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover border-4 border-background shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-4xl sm:text-5xl font-bold text-white border-4 border-background shadow-lg">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Online indicator */}
              <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
            </div>

            {/* Shop Details */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">{name}</h1>
                <Badge variant="secondary" className="self-center sm:self-auto">
                  <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
                  {rating}
                </Badge>
              </div>
              
              {description && (
                <p className="text-muted-foreground mb-3 line-clamp-2 max-w-2xl">{description}</p>
              )}

              {/* Stats & Info */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground mb-4">
                {(state || city) && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{city ? `${city}, ` : ''}{state}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Usually responds in 1 hour</span>
                </div>
                {totalProducts > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-foreground">{totalProducts}</span>
                    <span>Products</span>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              {whatsappNumber && (
                <Button 
                  onClick={handleWhatsAppClick}
                  className="bg-green-500 hover:bg-green-600 text-white gap-2 rounded-full px-6 shadow-lg shadow-green-500/25"
                  size="lg"
                >
                  <MessageCircle className="h-5 w-5" />
                  Chat on WhatsApp
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
