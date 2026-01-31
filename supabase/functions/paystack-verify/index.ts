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
    const { reference } = await req.json();
    
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
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

    if (isSuccessful) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Update payment and order if not already done by webhook
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('paystack_reference', reference)
        .single();

      if (payment && payment.status !== 'success') {
        // Update payment
        await supabase
          .from('payments')
          .update({
            status: 'success',
            paystack_transaction_id: transaction.id?.toString(),
          })
          .eq('id', payment.id);

        // Update order
        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            payment_method: 'paystack',
          })
          .eq('id', payment.order_id);

        // Generate redemption code for the order
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
            // Update order with redemption code reference
            await supabase
              .from('orders')
              .update({
                redemption_code_id: codeRecord.id,
              })
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

          await supabase
            .from('payments')
            .update({
              credited_to_seller: true,
              credited_at: new Date().toISOString(),
            })
            .eq('id', payment.id);
        }
      }
    }

    return new Response(JSON.stringify({
      success: isSuccessful,
      status: transaction.status,
      amount: transaction.amount / 100, // Convert from kobo
      reference: transaction.reference,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in paystack-verify:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
