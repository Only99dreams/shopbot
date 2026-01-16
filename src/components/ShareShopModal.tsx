import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Check,
  MessageCircle,
  Send,
  Mail,
  Share2,
} from "lucide-react";

// Custom social icons as SVG components
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className || "h-5 w-5"} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className || "h-5 w-5"} fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

interface ShareShopModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopLink: string;
  shopName: string;
}

export function ShareShopModal({ open, onOpenChange, shopLink, shopName }: ShareShopModalProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const shareMessage = `Check out ${shopName} on ShopAfrica! 🛒`;
  const encodedMessage = encodeURIComponent(shareMessage);
  const encodedLink = encodeURIComponent(shopLink);

  const copyToClipboard = async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shopLink);
      } else {
        // Fallback for mobile/non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = shopLink;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Shop link has been copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please manually copy the link.",
        variant: "destructive",
      });
    }
  };

  const shareOptions = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      color: "bg-[#25D366] hover:bg-[#20BD5A]",
      url: `https://wa.me/?text=${encodedMessage}%20${encodedLink}`,
    },
    {
      name: "Facebook",
      icon: FacebookIcon,
      color: "bg-[#1877F2] hover:bg-[#166FE5]",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}&quote=${encodedMessage}`,
    },
    {
      name: "Twitter",
      icon: TwitterIcon,
      color: "bg-[#1DA1F2] hover:bg-[#1A94DA]",
      url: `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedLink}`,
    },
    {
      name: "Telegram",
      icon: Send,
      color: "bg-[#0088CC] hover:bg-[#007AB8]",
      url: `https://t.me/share/url?url=${encodedLink}&text=${encodedMessage}`,
    },
    {
      name: "Email",
      icon: Mail,
      color: "bg-gray-600 hover:bg-gray-700",
      url: `mailto:?subject=${encodeURIComponent(`Check out ${shopName}`)}&body=${encodedMessage}%20${encodedLink}`,
    },
  ];

  const handleShare = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shopName,
          text: shareMessage,
          url: shopLink,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Your Shop
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Copy Link Section */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Shop Link</p>
            <div className="flex gap-2">
              <Input
                value={shopLink}
                readOnly
                className="flex-1 text-sm"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Native Share (Mobile) */}
          {typeof navigator !== "undefined" && navigator.share && (
            <Button
              onClick={handleNativeShare}
              className="w-full"
              variant="outline"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share via...
            </Button>
          )}

          {/* Social Share Options */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Share on Social Media</p>
            <div className="grid grid-cols-5 gap-2">
              {shareOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <Button
                    key={option.name}
                    onClick={() => handleShare(option.url)}
                    className={`${option.color} text-white p-2 h-auto flex-col gap-1`}
                    title={option.name}
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="text-[10px] font-normal hidden sm:block">{option.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* QR Code hint */}
          <p className="text-xs text-center text-muted-foreground pt-2">
            You can also share your shop QR code from the Settings page
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
