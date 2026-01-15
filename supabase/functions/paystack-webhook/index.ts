import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

// HMAC-SHA512 using Web Crypto API
async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hashArray = Array.from(new Uint8Array(sig));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex === signature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    // Verify webhook signature
    if (signature) {
      const isValid = await verifySignature(paystackSecretKey, body, signature);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    const event = JSON.parse(body);
    console.log('Paystack webhook event:', event.event);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (event.event === 'charge.success') {
      const { reference, metadata } = event.data;
      const orderId = metadata?.order_id;
      const shopId = metadata?.shop_id;

      if (!orderId) {
        console.error('No order_id in metadata');
        return new Response('OK', { status: 200 });
      }

      console.log('Processing successful payment for order:', orderId);

      // Update payment record
      const { data: payment, error: paymentUpdateError } = await supabase
        .from('payments')
        .update({
          status: 'success',
          paystack_transaction_id: event.data.id?.toString(),
        })
        .eq('paystack_reference', reference)
        .select()
        .single();

      if (paymentUpdateError) {
        console.error('Error updating payment:', paymentUpdateError);
      }

      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'paystack',
        })
        .eq('id', orderId);

      if (orderError) {
        console.error('Error updating order:', orderError);
      }

      // Credit seller wallet (admin will manually transfer later)
      if (payment) {
        // Get or create seller wallet
        const { data: wallet, error: walletError } = await supabase
          .from('seller_wallets')
          .select('*')
          .eq('shop_id', shopId)
          .single();

        if (walletError && walletError.code === 'PGRST116') {
          // Create wallet if doesn't exist
          await supabase
            .from('seller_wallets')
            .insert({
              shop_id: shopId,
              balance: payment.seller_amount,
              total_earned: payment.seller_amount,
            });
        } else if (wallet) {
          // Update existing wallet
          await supabase
            .from('seller_wallets')
            .update({
              balance: wallet.balance + payment.seller_amount,
              total_earned: wallet.total_earned + payment.seller_amount,
            })
            .eq('id', wallet.id);
        }

        // Mark payment as credited
        await supabase
          .from('payments')
          .update({
            credited_to_seller: true,
            credited_at: new Date().toISOString(),
          })
          .eq('id', payment.id);
      }

      console.log('Payment processed successfully');
    }

    return new Response('OK', { 
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error('Error in paystack-webhook:', error);
    return new Response('Error', { status: 500 });
  }
});
