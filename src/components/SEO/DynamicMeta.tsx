import { Helmet } from 'react-helmet-async';

interface DynamicMetaProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
}

// Generate OG image URL using a free service or fallback to default
function generateOgImageUrl(title: string, description?: string, logoUrl?: string): string {
  // Use og.tailgraph.com (free OG image generator) or similar service
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description || '');
  
  // If there's a logo URL, use it directly
  if (logoUrl && logoUrl.startsWith('http')) {
    return logoUrl;
  }
  
  // Generate dynamic OG image using free service
  // You can replace this with your own OG image generator service
  const ogImageUrl = `https://og.tailgraph.com/og?` + 
    `fontFamily=Inter&` +
    `title=${encodedTitle}&` +
    `titleTailwind=text-white%20font-bold%20text-5xl&` +
    `text=${encodedDesc}&` +
    `textTailwind=text-white%20text-xl%20mt-4&` +
    `logoUrl=${encodeURIComponent(window.location.origin + '/logo.png')}&` +
    `logoTailwind=w-20%20h-20&` +
    `bgUrl=${encodeURIComponent('https://images.unsplash.com/photo-1557683316-973673baf926?w=1200')}&` +
    `bgTailwind=bg-gradient-to-br%20from-green-600%20to-green-800&` +
    `footer=ShopAfrica&` +
    `footerTailwind=text-white%20text-lg`;
  
  return ogImageUrl;
}

export function DynamicMeta({ 
  title, 
  description, 
  image,
  url,
  type = 'website'
}: DynamicMetaProps) {
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  
  // Use provided image, or generate one, or use default
  let imageUrl: string;
  if (image && image.startsWith('http')) {
    imageUrl = image;
  } else if (image && !image.startsWith('/')) {
    imageUrl = image;
  } else {
    // Generate dynamic OG image
    imageUrl = generateOgImageUrl(title, description, image);
  }
  
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
}
