import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    const flutterwaveWebhookHash = Deno.env.get('FLUTTERWAVE_WEBHOOK_HASH');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const { tx_ref, id: transactionId, amount, meta } = event.data;
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

    // --- Handle ORDER payments ---
    if (paymentType === 'order') {
      const orderId = meta?.order_id;
      const shopId = meta?.shop_id;

      if (!orderId) {
        console.error('No order_id in meta');
        return new Response('OK', { status: 200 });
      }

      console.log('Processing successful order payment:', orderId);

      // Update payment record
      const { data: payment, error: paymentUpdateError } = await supabase
        .from('payments')
        .update({
          status: 'success',
          paystack_transaction_id: transactionId?.toString(),
        })
        .eq('paystack_reference', tx_ref)
        .select()
        .single();

      if (paymentUpdateError) {
        console.error('Error updating payment:', paymentUpdateError);
      }

      // Update order status
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'flutterwave',
        })
        .eq('id', orderId);

      // Generate redemption code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_redemption_code');

      if (!codeError && codeData) {
        const { error: insertError } = await supabase
          .from('redemption_codes')
          .insert({
            order_id: orderId,
            shop_id: shopId,
            code: codeData,
          });

        if (insertError) {
          console.error('Error inserting redemption code:', insertError);
        }
      }

      // Credit seller wallet
      if (payment) {
        const { data: wallet, error: walletError } = await supabase
          .from('seller_wallets')
          .select('*')
          .eq('shop_id', shopId)
          .single();

        if (walletError && walletError.code === 'PGRST116') {
          await supabase
            .from('seller_wallets')
            .insert({
              shop_id: shopId,
              balance: payment.seller_amount,
              total_earned: payment.seller_amount,
            });
        } else if (wallet) {
          await supabase
            .from('seller_wallets')
            .update({
              balance: wallet.balance + payment.seller_amount,
              total_earned: wallet.total_earned + payment.seller_amount,
            })
            .eq('id', wallet.id);
        }

        await supabase
          .from('payments')
          .update({
            credited_to_seller: true,
            credited_at: new Date().toISOString(),
          })
          .eq('id', payment.id);
      }

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

      console.log('Processing subscription payment for shop:', shopId);

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle();

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

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
        await supabase
          .from('subscriptions')
          .insert({
            shop_id: shopId,
            plan: planId || 'starter',
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          });
      }

      // Activate the shop
      await supabase
        .from('shops')
        .update({ is_active: true })
        .eq('id', shopId);

      console.log('Subscription activated for shop:', shopId);
    }

    return new Response('OK', {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error('Error in flutterwave-webhook:', error);
    return new Response('Error', { status: 500 });
  }
});
