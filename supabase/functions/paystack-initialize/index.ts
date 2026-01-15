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
    
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
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

    // Generate unique reference
    const reference = `SHOPNAIJA_${orderId}_${Date.now()}`;
    
    // Amount in kobo (Paystack uses smallest currency unit)
    const amountInKobo = Math.round((amount || order.total) * 100);

    console.log('Initializing Paystack payment:', { reference, amount: amountInKobo, email });

    // Initialize Paystack transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        reference,
        callback_url: callbackUrl,
        metadata: {
          order_id: orderId,
          shop_id: order.shop_id,
          order_number: order.order_number,
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      console.error('Paystack initialization failed:', data);
      throw new Error(data.message || 'Failed to initialize payment');
    }

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        shop_id: order.shop_id,
        amount: order.total,
        paystack_reference: reference,
        status: 'pending',
        platform_fee: order.total * 0.05, // 5% platform fee
        seller_amount: order.total * 0.95, // 95% to seller
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
  } catch (error: any) {
    console.error('Error in paystack-initialize:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
