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
    const { orderId, email, callbackUrl } = await req.json();

    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!flutterwaveSecretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    if (!orderId) {
      throw new Error('Order id is required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, shops(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (order.payment_status === 'paid') {
      throw new Error('This order has already been paid');
    }

    // Never trust a client-supplied amount: always charge the stored order total.
    const orderTotal = Number(order.total);
    if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
      throw new Error('Order total is invalid');
    }

    // Generate unique transaction reference
    const txRef = `SHOPAF_${orderId}_${Date.now()}`;

    console.log('Initializing Flutterwave payment:', { txRef, amount: orderTotal });

    // Initialize Flutterwave Standard payment
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: orderTotal,
        currency: 'NGN',
        redirect_url: callbackUrl,
        customer: {
          email: email || 'customer@shopafrica.com',
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

    // The seller is paid on the goods subtotal only. The delivery fee is
    // reserved for the delivery agent and the platform.
    const orderSubtotal = Number(order.subtotal);
    const sellerBase = Number.isFinite(orderSubtotal) && orderSubtotal > 0
      ? orderSubtotal
      : orderTotal;

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        shop_id: order.shop_id,
        amount: orderTotal,
        paystack_reference: txRef, // reusing column for flutterwave tx_ref
        status: 'pending',
        platform_fee: sellerBase * 0.05,
        seller_amount: sellerBase * 0.95,
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
  } catch (error) {
    console.error('Error in flutterwave-initialize:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize payment',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
