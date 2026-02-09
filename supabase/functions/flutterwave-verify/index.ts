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
    const { transactionId, txRef } = await req.json();

    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!flutterwaveSecretKey) {
      throw new Error('Flutterwave secret key not configured');
    }

    console.log('Verifying Flutterwave payment:', { transactionId, txRef });

    // Verify transaction with Flutterwave
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      headers: {
        'Authorization': `Bearer ${flutterwaveSecretKey}`,
      },
    });

    const data = await response.json();

    if (data.status !== 'success') {
      console.error('Flutterwave verification failed:', data);
      return new Response(JSON.stringify({
        success: false,
        error: data.message || 'Verification failed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transaction = data.data;
    const isSuccessful = transaction.status === 'successful' && transaction.tx_ref === txRef;

    if (isSuccessful) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const meta = transaction.meta || {};
      const paymentType = meta.payment_type || 'order';

      // --- Handle ORDER payments ---
      if (paymentType === 'order') {
        const { data: payment } = await supabase
          .from('payments')
          .select('*')
          .eq('paystack_reference', txRef)
          .single();

        if (payment && payment.status !== 'success') {
          // Update payment
          await supabase
            .from('payments')
            .update({
              status: 'success',
              paystack_transaction_id: transactionId?.toString(),
            })
            .eq('id', payment.id);

          // Update order
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              payment_method: 'flutterwave',
            })
            .eq('id', payment.order_id);

          // Generate redemption code
          const { data: redemptionCode, error: codeError } = await supabase
            .rpc('generate_redemption_code');

          if (!codeError && redemptionCode) {
            const { data: codeRecord, error: insertError } = await supabase
              .from('redemption_codes')
              .insert({
                order_id: payment.order_id,
                shop_id: payment.shop_id,
                code: redemptionCode,
                status: 'active',
              })
              .select()
              .single();

            if (!insertError && codeRecord) {
              await supabase
                .from('orders')
                .update({ redemption_code_id: codeRecord.id })
                .eq('id', payment.order_id);
            }
          }

          // Credit seller wallet
          const { data: wallet } = await supabase
            .from('seller_wallets')
            .select('*')
            .eq('shop_id', payment.shop_id)
            .single();

          if (wallet) {
            await supabase
              .from('seller_wallets')
              .update({
                balance: wallet.balance + payment.seller_amount,
                total_earned: wallet.total_earned + payment.seller_amount,
              })
              .eq('id', wallet.id);
          } else {
            await supabase
              .from('seller_wallets')
              .insert({
                shop_id: payment.shop_id,
                balance: payment.seller_amount,
                total_earned: payment.seller_amount,
              });
          }

          await supabase
            .from('payments')
            .update({
              credited_to_seller: true,
              credited_at: new Date().toISOString(),
            })
            .eq('id', payment.id);
        }
      }

      // --- Handle SUBSCRIPTION payments ---
      if (paymentType === 'subscription') {
        const shopId = meta.shop_id;
        const planId = meta.plan_id;

        if (shopId) {
          // Get current subscription
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
      }
    }

    return new Response(JSON.stringify({
      success: isSuccessful,
      status: transaction.status,
      amount: transaction.amount,
      tx_ref: transaction.tx_ref,
      payment_type: transaction.meta?.payment_type || 'order',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in flutterwave-verify:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
