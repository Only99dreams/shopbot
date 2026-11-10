import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { reference } = await req.json();

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    if (!reference) {
      throw new Error('Payment reference is required');
    }

    console.log('Verifying Paystack payment:', reference);

    // Verify transaction with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
      },
    });

    const data = await response.json();

    if (!data.status) {
      console.error('Paystack verification failed:', data);
      return new Response(JSON.stringify({
        success: false,
        error: data.message || 'Verification failed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transaction = data.data;
    const isSuccessful = transaction.status === 'success';

    if (!isSuccessful) {
      return new Response(JSON.stringify({
        success: false,
        status: transaction.status,
        error: 'Payment was not successful',
        reference: transaction.reference,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (!payment) {
      console.error('No payment record found for reference:', reference);
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment record not found',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The amount actually paid must match the order total we stored.
    const paidKobo = Number(transaction.amount);
    const expectedKobo = Math.round(Number(payment.amount) * 100);

    if (!Number.isFinite(paidKobo) || paidKobo !== expectedKobo) {
      console.error('Amount mismatch:', { paidKobo, expectedKobo, reference });
      return new Response(JSON.stringify({
        success: false,
        error: 'Paid amount does not match the order total',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark payment successful (idempotent)
    await supabase
      .from('payments')
      .update({
        status: 'success',
        paystack_transaction_id: transaction.id?.toString(),
      })
      .eq('id', payment.id);

    // Mark the order paid. The ensure_redemption_code_on_paid trigger creates
    // and links the redemption code for us.
    const { data: order } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('id', payment.order_id)
      .maybeSingle();

    if (order && order.payment_status !== 'paid') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: 'paystack',
        })
        .eq('id', payment.order_id);
    }

    await creditSellerOnce(supabase, payment);

    return new Response(JSON.stringify({
      success: true,
      status: transaction.status,
      amount: transaction.amount / 100, // Convert from kobo
      reference: transaction.reference,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in paystack-verify:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
