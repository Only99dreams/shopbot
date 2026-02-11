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

    if (!transactionId && !txRef) {
      throw new Error('Missing transactionId or txRef for verification');
    }

    const verifyUrl = transactionId
      ? `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;

    // Verify transaction with Flutterwave
    const response = await fetch(verifyUrl, {
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
    // Be a bit more lenient with tx_ref - if it's successful and we have a match, it's good
    const isSuccessful = transaction.status === 'successful' || transaction.status === 'completed';
    
    if (isSuccessful) {
      console.log('Transaction verified as successful:', transactionId);
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const meta = transaction.meta || {};
      const paymentType = meta.payment_type || 'order';
      const actualTxRef = transaction.tx_ref;

      // --- Handle ORDER payments ---
      if (paymentType === 'order') {
        const orderId = meta.order_id || txRef?.split('_')[1] || actualTxRef?.split('_')[1];
        console.log('Processing successful order payment for orderId:', orderId);

        // Try to find payment by txRef first, then by actualTxRef, then by orderId
        let { data: payment } = await supabase
          .from('payments')
          .select('*')
          .or(`paystack_reference.eq."${txRef}",paystack_reference.eq."${actualTxRef}",order_id.eq."${orderId}"`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const ensureRedemptionCode = async (orderId: string, shopId?: string | null) => {
          if (!orderId) return;

          // Check if order already has redemption_code_id
          const { data: orderRow } = await supabase
            .from('orders')
            .select('id, redemption_code_id, shop_id')
            .eq('id', orderId)
            .maybeSingle();

          if (orderRow?.redemption_code_id) return;

          // Check if a redemption code already exists for this order
          const { data: existingCode } = await supabase
            .from('redemption_codes')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle();

          if (existingCode?.id) {
            await supabase
              .from('orders')
              .update({ redemption_code_id: existingCode.id })
              .eq('id', orderId);
            return;
          }

          const { data: redemptionCode, error: codeError } = await supabase
            .rpc('generate_redemption_code');

          if (!codeError && redemptionCode) {
            const { data: codeRecord, error: insertError } = await supabase
              .from('redemption_codes')
              .insert({
                order_id: orderId,
                shop_id: shopId || orderRow?.shop_id,
                code: redemptionCode,
                status: 'active',
              })
              .select()
              .single();

            if (!insertError && codeRecord) {
              await supabase
                .from('orders')
                .update({ redemption_code_id: codeRecord.id })
                .eq('id', orderId);
              console.log('Generated and linked redemption code:', redemptionCode);
            }
          }
        };

        if (payment) {
          console.log('Found payment record:', payment.id, 'status:', payment.status);
          if (payment.status !== 'success') {
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
                status: 'processing' // Move from pending to processing
              })
              .eq('id', payment.order_id);

            console.log('Updated payment and order status');

          }

          // Ensure redemption code exists even if payment was already success
          await ensureRedemptionCode(payment.order_id, payment.shop_id);

          // Credit seller wallet (idempotent)
          if (!payment.credited_to_seller) {
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
        } else {
          console.warn('No payment record found for transaction, but transaction is successful.');
          // If no payment record, but order exists, we should still update the order
           if (orderId) {
             await supabase
              .from('orders')
              .update({
                payment_status: 'paid',
                payment_method: 'flutterwave',
                status: 'processing'
              })
              .eq('id', orderId);
             console.log('Directly updated order status for orderId:', orderId);
             await ensureRedemptionCode(orderId, null);
          }
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

          // Record payment proof for billing history
          if (transaction.amount) {
            const { error: proofError } = await supabase
              .from('payment_proofs')
              .insert({
                payment_type: 'subscription',
                reference_id: subscription?.id || (await supabase.from('subscriptions').select('id').eq('shop_id', shopId).maybeSingle()).data?.id,
                shop_id: shopId,
                amount: transaction.amount,
                status: 'approved',
                admin_notes: `Flutterwave transaction_id: ${transactionId}`,
              });
            
            if (proofError) {
              console.error('Error recording subscription payment proof:', proofError);
            }
          }

          console.log('Subscription activated for shop:', shopId);
        }
      }
    }

    return new Response(JSON.stringify({
      success: isSuccessful,
      status: transaction.status,
      amount: transaction.amount,
      tx_ref: transaction.tx_ref,
      order_id: transaction.meta?.order_id || txRef?.split('_')[1],
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
