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

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
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

    // Generate unique reference
    const reference = `SHOPNAIJA_${orderId}_${Date.now()}`;

    // Amount in kobo (Paystack uses smallest currency unit)
    const amountInKobo = Math.round(orderTotal * 100);

    console.log('Initializing Paystack payment:', { reference, amount: amountInKobo });

    // Initialize Paystack transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || 'customer@shopafrica.com',
        amount: amountInKobo,
        reference,
        callback_url: callbackUrl,
        metadata: {
          order_id: orderId,
          shop_id: order.shop_id,
          order_number: order.order_number,
          payment_type: 'order',
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      console.error('Paystack initialization failed:', data);
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
        paystack_reference: reference,
        status: 'pending',
        platform_fee: sellerBase * 0.05, // 5% platform fee
        seller_amount: sellerBase * 0.95, // 95% to seller
      });

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
    }

    return new Response(JSON.stringify({
      success: true,
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
      access_code: data.data.access_code,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in paystack-initialize:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize payment',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
