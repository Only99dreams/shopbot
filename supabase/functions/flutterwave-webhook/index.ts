import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
};

type SupabaseClient = ReturnType<typeof createClient>;

// Credit the seller exactly once, even when verify and webhook race each other.
async function creditSellerOnce(
  supabase: SupabaseClient,
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
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    const flutterwaveWebhookHash = Deno.env.get('FLUTTERWAVE_WEBHOOK_HASH');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!flutterwaveSecretKey) {
      console.error('FLUTTERWAVE_SECRET_KEY is not configured');
      return new Response('Server misconfigured', { status: 500 });
    }

    // Verify webhook hash if configured
    const verifHash = req.headers.get('verif-hash');
    if (flutterwaveWebhookHash && verifHash !== flutterwaveWebhookHash) {
      console.error('Invalid webhook hash');
      return new Response('Invalid hash', { status: 401 });
    }

    const body = await req.text();
    const event = JSON.parse(body);

    console.log('Flutterwave webhook event:', event.event);

    if (event.event !== 'charge.completed' || event.data?.status !== 'successful') {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const { tx_ref, id: transactionId, meta } = event.data;
    const paymentType = meta?.payment_type || 'order';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the transaction with Flutterwave API before processing
    const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      headers: { 'Authorization': `Bearer ${flutterwaveSecretKey}` },
    });
    const verifyData = await verifyResponse.json();

    if (verifyData.status !== 'success' || verifyData.data?.status !== 'successful') {
      console.error('Transaction verification failed:', verifyData);
      return new Response('Verification failed', { status: 400 });
    }

    // Always use the amount confirmed by Flutterwave, never the payload copy.
    const paidAmount = Number(verifyData.data.amount);

    // --- Handle ORDER payments ---
    if (paymentType === 'order') {
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('paystack_reference', tx_ref)
        .maybeSingle();

      if (!payment) {
        console.error('No payment record for tx_ref:', tx_ref);
        return new Response('OK', { status: 200 });
      }

      const orderId = payment.order_id || meta?.order_id;
      const expectedAmount = Number(payment.amount);

      if (!Number.isFinite(paidAmount) || !Number.isFinite(expectedAmount) ||
          Math.abs(paidAmount - expectedAmount) > 0.01) {
        console.error('Webhook amount mismatch:', { paidAmount, expectedAmount, tx_ref });
        return new Response('Amount mismatch', { status: 400 });
      }

      console.log('Processing successful order payment:', orderId);

      await supabase
        .from('payments')
        .update({
          status: 'success',
          paystack_transaction_id: transactionId?.toString(),
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
            payment_method: 'flutterwave',
          })
          .eq('id', orderId);
      }

      await creditSellerOnce(supabase, payment);

      console.log('Order payment processed successfully');
    }

    // --- Handle SUBSCRIPTION payments ---
    if (paymentType === 'subscription') {
      const shopId = meta?.shop_id;
      const planId = meta?.plan_id;

      if (!shopId) {
        console.error('No shop_id in meta for subscription');
        return new Response('OK', { status: 200 });
      }

      // Derive the expected price from platform settings.
      const { data: setting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'subscription_plans')
        .maybeSingle();

      const plans = (setting?.value || {}) as Record<string, { price?: number }>;
      const expectedPrice = planId ? Number(plans[planId]?.price) : NaN;

      if (!Number.isFinite(expectedPrice) || expectedPrice <= 0) {
        console.error('Invalid subscription plan on transaction:', planId);
        return new Response('Invalid plan', { status: 400 });
      }

      if (!Number.isFinite(paidAmount) || paidAmount < expectedPrice) {
        console.error('Subscription amount mismatch:', { paidAmount, expectedPrice, planId });
        return new Response('Amount mismatch', { status: 400 });
      }

      console.log('Processing subscription payment for shop:', shopId);

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle();

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      let subscriptionId = subscription?.id as string | undefined;

      if (subscription) {
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            plan: planId || subscription.plan,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .eq('id', subscription.id);
      } else {
        const { data: createdSub } = await supabase
          .from('subscriptions')
          .insert({
            shop_id: shopId,
            plan: planId || 'starter',
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .select('id')
          .maybeSingle();
        subscriptionId = createdSub?.id;
      }

      // Activate the shop
      await supabase
        .from('shops')
        .update({ is_active: true })
        .eq('id', shopId);

      // Record billing history exactly once per transaction.
      const billingNote = `Flutterwave transaction_id: ${transactionId}`;
      const { data: existingProof } = await supabase
        .from('payment_proofs')
        .select('id')
        .eq('shop_id', shopId)
        .eq('payment_type', 'subscription')
        .eq('admin_notes', billingNote)
        .maybeSingle();

      if (!existingProof) {
        const { error: proofError } = await supabase
          .from('payment_proofs')
          .insert({
            payment_type: 'subscription',
            reference_id: subscriptionId,
            shop_id: shopId,
            amount: expectedPrice,
            status: 'approved',
            admin_notes: billingNote,
          });

        if (proofError) {
          console.error('Error recording subscription payment proof:', proofError);
        }
      }

      console.log('Subscription activated for shop:', shopId);
    }

    return new Response('OK', {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Error in flutterwave-webhook:', error);
    return new Response('Error', { status: 500 });
  }
});
