import { Helmet } from 'react-helmet-async';

interface ProductSchema {
  name: string;
  description?: string;
  image?: string;
  price?: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  category?: string;
  brand?: string;
  sku?: string;
  ratingValue?: number;
  ratingCount?: number;
}

interface LocalBusinessSchema {
  name: string;
  description?: string;
  image?: string;
  url?: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
  telephone?: string;
  ratingValue?: number;
  ratingCount?: number;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface DynamicMetaProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
  product?: ProductSchema;
  localBusiness?: LocalBusinessSchema;
  breadcrumbs?: BreadcrumbItem[];
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
  type = 'website',
  product,
  localBusiness,
  breadcrumbs,
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

  // Build JSON-LD structured data
  const jsonLdScripts: object[] = [];

  // Breadcrumb schema
  if (breadcrumbs && breadcrumbs.length > 0) {
    jsonLdScripts.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  // Product schema
  if (product) {
    const productSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description || description,
      image: product.image || imageUrl,
      ...(product.sku && { sku: product.sku }),
      ...(product.brand && { brand: { '@type': 'Brand', name: product.brand } }),
      ...(product.category && { category: product.category }),
      offers: {
        '@type': 'Offer',
        price: product.price ?? 0,
        priceCurrency: product.currency || 'NGN',
        availability: `https://schema.org/${product.availability || 'InStock'}`,
        url: currentUrl,
      },
    };
    if (product.ratingValue && product.ratingCount) {
      productSchema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: product.ratingValue,
        reviewCount: product.ratingCount,
      };
    }
    jsonLdScripts.push(productSchema);
  }

  // LocalBusiness schema (for shop pages)
  if (localBusiness) {
    const bizSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: localBusiness.name,
      description: localBusiness.description || description,
      image: localBusiness.image || imageUrl,
      url: localBusiness.url || currentUrl,
      ...(localBusiness.telephone && { telephone: localBusiness.telephone }),
    };
    if (localBusiness.address) {
      bizSchema.address = {
        '@type': 'PostalAddress',
        addressLocality: localBusiness.address.city,
        addressRegion: localBusiness.address.state,
        addressCountry: localBusiness.address.country || 'NG',
      };
    }
    if (localBusiness.ratingValue && localBusiness.ratingCount) {
      bizSchema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: localBusiness.ratingValue,
        reviewCount: localBusiness.ratingCount,
      };
    }
    jsonLdScripts.push(bizSchema);
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

      {/* JSON-LD Structured Data */}
      {jsonLdScripts.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
