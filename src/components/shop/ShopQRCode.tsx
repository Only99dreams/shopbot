import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRef } from 'react';

interface ShopQRCodeProps {
  shopId: string;
  shopName: string;
  size?: number;
  showActions?: boolean;
  className?: string;
}

export function ShopQRCode({ 
  shopId, 
  shopName, 
  size = 200, 
  showActions = true,
  className = ''
}: ShopQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const shopUrl = `${window.location.origin}/shop/${shopId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shopUrl);
    toast.success('Shop link copied to clipboard!');
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    canvas.width = size * 2;
    canvas.height = size * 2;
    
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `${shopName.replace(/\s+/g, '-')}-QR-Code.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        toast.success('QR Code downloaded!');
      }
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Shop at ${shopName}`,
          text: `Check out amazing products at ${shopName} on ShopAfrica!`,
          url: shopUrl,
        });
      } catch (err) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className={className}>
      <div 
        ref={qrRef} 
        className="bg-white p-4 rounded-lg inline-block"
      >
        <QRCodeSVG
          value={shopUrl}
          size={size}
          level="H"
          includeMargin={true}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      
      {showActions && (
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadQR}>
            <Download className="w-4 h-4 mr-2" />
            Download QR
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      )}
    </div>
  );
}

export function ShopQRCodeCard({ shopId, shopName }: { shopId: string; shopName: string }) {
  const shopUrl = `${window.location.origin}/shop/${shopId}`;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="w-5 h-5" />
          Share Your Shop
        </CardTitle>
        <CardDescription>
          Share your shop with customers using QR code or link
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center">
          <ShopQRCode 
            shopId={shopId} 
            shopName={shopName}
            size={180}
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Your Shop URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={shopUrl}
              readOnly
              className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-input"
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(shopUrl);
                toast.success('Link copied!');
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
