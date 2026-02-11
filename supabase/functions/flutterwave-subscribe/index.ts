import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shopId, planId, planName, amount, email, callbackUrl } = await req.json();

    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!flutterwaveSecretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get shop details
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .single();

    if (shopError || !shop) {
      throw new Error('Shop not found');
    }

    // Generate unique transaction reference
    const txRef = `SHOPAF_SUB_${shopId}_${Date.now()}`;

    console.log('Initializing Flutterwave subscription payment:', { txRef, amount, email, planId });

    // Initialize Flutterwave Standard payment
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency: 'NGN',
        redirect_url: callbackUrl,
        customer: {
          email: email || 'seller@shopafrica.com',
        },
        meta: {
          shop_id: shopId,
          plan_id: planId,
          plan_name: planName,
          payment_type: 'subscription',
        },
        customizations: {
          title: `${planName} Plan Subscription - ShopAfrica`,
          description: `Monthly subscription for ${shop.name}`,
          logo: 'https://shopafrica.com/logo.png',
        },
      }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      console.error('Flutterwave subscription initialization failed:', data);
      throw new Error(data.message || 'Failed to initialize payment');
    }

    return new Response(JSON.stringify({
      success: true,
      payment_link: data.data.link,
      tx_ref: txRef,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in flutterwave-subscribe:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
