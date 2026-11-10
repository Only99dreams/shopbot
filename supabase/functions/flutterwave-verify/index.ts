import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const isSuccessful = transaction.status === 'successful' || transaction.status === 'completed';

    if (!isSuccessful) {
      return new Response(JSON.stringify({
        success: false,
        status: transaction.status,
        error: 'Payment was not successful',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Transaction verified as successful:', transactionId || txRef);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const meta = transaction.meta || {};
    const paymentType = meta.payment_type || 'order';
    const actualTxRef: string | undefined = transaction.tx_ref || txRef;
    const paidAmount = Number(transaction.amount);

    // --- Handle ORDER payments ---
    if (paymentType === 'order') {
      const orderId = meta.order_id || txRef?.split('_')[1] || actualTxRef?.split('_')[1];
      console.log('Processing successful order payment for orderId:', orderId);

      // Prefer the exact payment reference; never trust an arbitrary order match.
      let payment: Record<string, unknown> | null = null;

      if (actualTxRef) {
        const { data: byRef } = await supabase
          .from('payments')
          .select('*')
          .eq('paystack_reference', actualTxRef)
          .maybeSingle();
        payment = byRef;
      }

      if (!payment && orderId) {
        const { data: byOrder } = await supabase
          .from('payments')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        payment = byOrder;
      }

      // Resolve the order and the authoritative amount it should have cost.
      const { data: orderRow } = orderId
        ? await supabase
            .from('orders')
            .select('id, shop_id, total, subtotal, payment_status, redemption_code_id')
            .eq('id', orderId)
            .maybeSingle()
        : { data: null };

      const expectedAmount = payment
        ? Number(payment.amount)
        : orderRow
          ? Number(orderRow.total)
          : NaN;

      if (!Number.isFinite(paidAmount) || !Number.isFinite(expectedAmount) ||
          Math.abs(paidAmount - expectedAmount) > 0.01) {
        console.error('Amount mismatch:', { paidAmount, expectedAmount, actualTxRef, orderId });
        return new Response(JSON.stringify({
          success: false,
          error: 'Paid amount does not match the order total',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (payment) {
        await supabase
          .from('payments')
          .update({
            status: 'success',
            paystack_transaction_id: transactionId?.toString() || transaction.id?.toString(),
          })
          .eq('id', payment.id as string);
      } else if (orderRow) {
        // No payment row (e.g. webhook/verify ordering) — create one so the
        // seller can be credited and the transaction is auditable.
        const orderSubtotal = Number(orderRow.subtotal);
        const sellerBase = Number.isFinite(orderSubtotal) && orderSubtotal > 0
          ? orderSubtotal
          : expectedAmount;

        const { data: created } = await supabase
          .from('payments')
          .insert({
            order_id: orderRow.id,
            shop_id: orderRow.shop_id,
            amount: expectedAmount,
            paystack_reference: actualTxRef || `SHOPAF_${orderRow.id}_${Date.now()}`,
            paystack_transaction_id: transactionId?.toString() || transaction.id?.toString(),
            status: 'success',
            platform_fee: sellerBase * 0.05,
            seller_amount: sellerBase * 0.95,
          })
          .select()
          .maybeSingle();
        payment = created;
      }

      if (orderRow) {
        // Updating to paid fires ensure_redemption_code_on_paid, which creates
        // and links the redemption code. Only update when not already paid.
        if (orderRow.payment_status !== 'paid') {
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              payment_method: 'flutterwave',
              status: 'processing',
            })
            .eq('id', orderRow.id);
        }

        // Safety net for legacy rows: link an existing code if the trigger
        // did not (it never creates a second code for the same order).
        const { data: freshOrder } = await supabase
          .from('orders')
          .select('id, shop_id, redemption_code_id')
          .eq('id', orderRow.id)
          .maybeSingle();

        if (freshOrder && !freshOrder.redemption_code_id) {
          const { data: existingCode } = await supabase
            .from('redemption_codes')
            .select('id')
            .eq('order_id', orderRow.id)
            .limit(1)
            .maybeSingle();

          if (existingCode?.id) {
            await supabase
              .from('orders')
              .update({ redemption_code_id: existingCode.id })
              .eq('id', orderRow.id);
          } else {
            const { data: newCode } = await supabase.rpc('generate_redemption_code');
            if (newCode) {
              const { data: codeRecord } = await supabase
                .from('redemption_codes')
                .insert({
                  order_id: orderRow.id,
                  shop_id: freshOrder.shop_id || orderRow.shop_id,
                  code: newCode,
                  status: 'active',
                })
                .select('id')
                .maybeSingle();

              if (codeRecord?.id) {
                await supabase
                  .from('orders')
                  .update({ redemption_code_id: codeRecord.id })
                  .eq('id', orderRow.id);
              }
            }
          }
        }
      }

      if (payment) {
        await creditSellerOnce(supabase, {
          id: payment.id as string,
          shop_id: payment.shop_id as string,
          seller_amount: payment.seller_amount as number | string,
        });
      }
    }

    // --- Handle SUBSCRIPTION payments ---
    if (paymentType === 'subscription') {
      const shopId = meta.shop_id;
      const planId = meta.plan_id;

      if (!shopId) {
        console.error('No shop_id in meta for subscription');
        return new Response(JSON.stringify({
          success: false,
          error: 'Missing shop for subscription payment',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid subscription plan',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!Number.isFinite(paidAmount) || paidAmount < expectedPrice) {
        console.error('Subscription amount mismatch:', { paidAmount, expectedPrice, planId });
        return new Response(JSON.stringify({
          success: false,
          error: 'Paid amount does not match the plan price',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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
      const billingNote = `Flutterwave transaction_id: ${transactionId || transaction.id || actualTxRef}`;
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

    return new Response(JSON.stringify({
      success: true,
      status: transaction.status,
      amount: transaction.amount,
      tx_ref: transaction.tx_ref,
      order_id: transaction.meta?.order_id || txRef?.split('_')[1],
      payment_type: transaction.meta?.payment_type || 'order',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in flutterwave-verify:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
