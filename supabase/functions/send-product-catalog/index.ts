import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shop_id, customer_phone, product_ids } = await req.json();

    if (!shop_id || !customer_phone) {
      throw new Error('Shop ID and customer phone are required');
    }

    // Get environment variables
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Fetch shop info
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('name, whatsapp_number')
      .eq('id', shop_id)
      .single();

    if (shopError || !shop) {
      throw new Error('Shop not found');
    }

    // Fetch products
    let productsQuery = supabase
      .from('products')
      .select('*')
      .eq('shop_id', shop_id)
      .eq('is_available', true)
      .order('created_at', { ascending: false });

    if (product_ids && product_ids.length > 0) {
      productsQuery = productsQuery.in('id', product_ids);
    } else {
      productsQuery = productsQuery.limit(10); // Limit to 10 products by default
    }

    const { data: products, error: productsError } = await productsQuery;

    if (productsError) {
      throw new Error('Failed to fetch products');
    }

    if (!products || products.length === 0) {
      throw new Error('No products found');
    }

    // Format phone for WhatsApp
    const cleanPhone = customer_phone.replace(/[^0-9+]/g, '');
    const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

    // Twilio API URL
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Send header message
    const headerMessage = `🛍️ *${shop.name} Product Catalog*\n\nHere are our latest products:`;
    
    const headerFormData = new URLSearchParams();
    headerFormData.append('To', `whatsapp:${whatsappPhone}`);
    headerFormData.append('From', `whatsapp:${twilioWhatsAppNumber}`);
    headerFormData.append('Body', headerMessage);

    await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': twilioAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: headerFormData.toString(),
    });

    // Send each product as a separate message with image
    const sentMessages = [];
    
    for (const product of products) {
      const price = new Intl.NumberFormat('en-NG', { 
        style: 'currency', 
        currency: 'NGN' 
      }).format(product.price);

      const productMessage = `📦 *${product.name}*\n\n💰 ${price}${product.compare_at_price ? ` ~~${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(product.compare_at_price)}~~` : ''}\n\n${product.description || ''}\n\n📊 Stock: ${product.stock_quantity} available\n\n🛒 To order, reply with:\n_"Order ${product.name}"_`;

      const formData = new URLSearchParams();
      formData.append('To', `whatsapp:${whatsappPhone}`);
      formData.append('From', `whatsapp:${twilioWhatsAppNumber}`);
      formData.append('Body', productMessage);

      // Add image if available
      if (product.images && product.images.length > 0) {
        formData.append('MediaUrl', product.images[0]);
      }

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': twilioAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json();
      
      if (response.ok) {
        sentMessages.push({ productId: product.id, messageSid: data.sid });
      } else {
        console.error('Failed to send product message:', data);
      }

      // Add small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Send footer message
    const footerMessage = `📱 *Need help?*\n\nReply to this chat or call us at ${shop.whatsapp_number || 'our store number'}\n\n_Powered by ShopAfrica_`;
    
    const footerFormData = new URLSearchParams();
    footerFormData.append('To', `whatsapp:${whatsappPhone}`);
    footerFormData.append('From', `whatsapp:${twilioWhatsAppNumber}`);
    footerFormData.append('Body', footerMessage);

    await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': twilioAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: footerFormData.toString(),
    });

    console.log(`Sent ${sentMessages.length} product messages to ${whatsappPhone}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${sentMessages.length} products to customer`,
        sentMessages 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-product-catalog:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
