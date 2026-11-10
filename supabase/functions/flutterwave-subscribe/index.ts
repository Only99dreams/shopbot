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
    const { shopId, planId, email, callbackUrl } = await req.json();

    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!flutterwaveSecretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    if (!shopId || !planId) {
      throw new Error('Shop and plan are required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Require an authenticated user who owns the shop (or is an admin).
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get shop details
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .maybeSingle();

    if (shopError || !shop) {
      throw new Error('Shop not found');
    }

    if (shop.owner_id !== user.id) {
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ success: false, error: 'You do not own this shop' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Derive the price from platform settings; never trust the client.
    const { data: setting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'subscription_plans')
      .maybeSingle();

    const plans = (setting?.value || {}) as Record<string, { name?: string; price?: number }>;
    const plan = plans[planId];

    if (!plan) {
      throw new Error('Invalid subscription plan');
    }

    const amount = Number(plan.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('This plan does not require payment');
    }

    const planName = plan.name || planId;

    // Generate unique transaction reference
    const txRef = `SHOPAF_SUB_${shopId}_${Date.now()}`;

    console.log('Initializing Flutterwave subscription payment:', { txRef, amount, planId });

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
          email: email || user.email || 'seller@shopafrica.com',
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
  } catch (error) {
    console.error('Error in flutterwave-subscribe:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize payment',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
