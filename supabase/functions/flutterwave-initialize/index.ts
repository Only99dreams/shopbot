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
    const { orderId, email, amount, callbackUrl } = await req.json();

    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!flutterwaveSecretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, shops(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Generate unique transaction reference
    const txRef = `SHOPAF_${orderId}_${Date.now()}`;

    console.log('Initializing Flutterwave payment:', { txRef, amount, email });

    // Initialize Flutterwave Standard payment
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amount || order.total,
        currency: 'NGN',
        redirect_url: callbackUrl,
        customer: {
          email: email || 'customer@shopnaija.com',
        },
        meta: {
          order_id: orderId,
          shop_id: order.shop_id,
          order_number: order.order_number,
          payment_type: 'order',
        },
        customizations: {
          title: `Payment for Order #${order.order_number}`,
          logo: 'https://shopafrica.com/logo.png',
        },
      }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      console.error('Flutterwave initialization failed:', data);
      throw new Error(data.message || 'Failed to initialize payment');
    }

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        shop_id: order.shop_id,
        amount: order.total,
        paystack_reference: txRef, // reusing column for flutterwave tx_ref
        status: 'pending',
        platform_fee: order.total * 0.05,
        seller_amount: order.total * 0.95,
      });

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
    }

    return new Response(JSON.stringify({
      success: true,
      payment_link: data.data.link,
      tx_ref: txRef,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in flutterwave-initialize:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
