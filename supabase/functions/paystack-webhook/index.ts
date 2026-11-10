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

// Credit the seller exactly once, even when verify and webhook race each other.
async function creditSellerOnce(
  supabase: ReturnType<typeof createClient>,
  payment: { id: string; shop_id: string; seller_amount: number | string },
) {
  const { data: claimed } = await supabase
    .from('payments')
    .update({ credited_to_seller: true, credited_at: new Date().toISOString() })
    .eq('id', payment.id)
    .eq('credited_to_seller', false)
    .select('id')
    .maybeSingle();

  if (!claimed) return;

  const amount = Number(payment.seller_amount);
  if (!Number.isFinite(amount) || amount <= 0) return;

  const { data: wallet } = await supabase
    .from('seller_wallets')
    .select('*')
    .eq('shop_id', payment.shop_id)
    .maybeSingle();

  if (wallet) {
    await supabase
      .from('seller_wallets')
      .update({
        balance: Number(wallet.balance) + amount,
        total_earned: Number(wallet.total_earned) + amount,
      })
      .eq('id', wallet.id);
  } else {
    const { error: walletError } = await supabase
      .from('seller_wallets')
      .insert({
        shop_id: payment.shop_id,
        balance: amount,
        total_earned: amount,
      });
    if (walletError) {
      console.error('Error creating seller wallet:', walletError);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY is not configured');
      return new Response('Server misconfigured', { status: 500 });
    }

    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    // A webhook without a signature is never trusted.
    if (!signature) {
      console.error('Missing Paystack signature header');
      return new Response('Missing signature', { status: 401 });
    }

    const isValid = await verifySignature(paystackSecretKey, body, signature);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);
    console.log('Paystack webhook event:', event.event);

    if (event.event !== 'charge.success') {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { reference } = event.data;
    const metadataOrderId = event.data.metadata?.order_id;

    if (!reference) {
      console.error('No reference in webhook payload');
      return new Response('OK', { status: 200 });
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (!payment) {
      console.error('No payment record for reference:', reference);
      return new Response('OK', { status: 200 });
    }

    const orderId = payment.order_id || metadataOrderId;

    // Verify the paid amount matches what we expected to charge.
    const paidKobo = Number(event.data.amount);
    const expectedKobo = Math.round(Number(payment.amount) * 100);

    if (!Number.isFinite(paidKobo) || paidKobo !== expectedKobo) {
      console.error('Webhook amount mismatch:', { paidKobo, expectedKobo, reference });
      return new Response('Amount mismatch', { status: 400 });
    }

    console.log('Processing successful payment for order:', orderId);

    await supabase
      .from('payments')
      .update({
        status: 'success',
        paystack_transaction_id: event.data.id?.toString(),
      })
      .eq('id', payment.id);

    // Updating the order to paid triggers redemption-code creation.
    const { data: order } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('id', orderId)
      .maybeSingle();

    if (order && order.payment_status !== 'paid') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'paystack',
        })
        .eq('id', orderId);
    }

    await creditSellerOnce(supabase, payment);

    console.log('Payment processed successfully');

    return new Response('OK', {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Error in paystack-webhook:', error);
    return new Response('Error', { status: 500 });
  }
});
