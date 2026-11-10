import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Always return 200 so supabase.functions.invoke() never sees a non-2xx.
// The frontend reads data.success / data.error from the body instead.
function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let code: string | undefined;
  let action: string | undefined;
  let orderId: string | undefined;
  let orderNumber: string | undefined;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return jsonResponse({ success: false, error: 'Invalid request body' });
    }

    code = body?.code;
    action = body?.action;
    orderId = body?.orderId;
    orderNumber = body?.orderNumber;

    console.log('Redeem code request:', { code, action, orderId });

    if (!action) {
      return jsonResponse({ success: false, error: 'Action is required' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'confirm_receipt' && orderId) {
      console.log('Confirm receipt action with orderId:', orderId);

      // Load the order plus the linked buyer account (if any).
      const { data: existingOrder, error: checkError } = await supabase
        .from('orders')
        .select(`
          *,
          customers ( user_id )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (checkError) {
        console.error('Order check error:', checkError);
        return jsonResponse({ success: false, error: 'Failed to look up order' });
      }

      if (!existingOrder) {
        return jsonResponse({ success: false, error: 'Order not found' });
      }

      if (existingOrder.redemption_confirmed) {
        return jsonResponse({ success: true, message: 'This order has already been confirmed.' });
      }

      if (existingOrder.payment_status !== 'paid') {
        return jsonResponse({ success: false, error: 'Order is not paid yet' });
      }

      const order = existingOrder;

      // Authorization: a logged-in buyer may confirm only their own order.
      // Guests may confirm a guest order by proving they know its order number.
      const customerRel = Array.isArray(order.customers) ? order.customers[0] : order.customers;
      const ownerUserId: string | null = customerRel?.user_id ?? null;

      let user: { id: string } | null = null;
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: authData } = await supabase.auth.getUser(token);
        user = authData?.user ?? null;
      }

      const isOwner = !!user && !!ownerUserId && ownerUserId === user.id;

      if (!isOwner) {
        const suppliedOrderNumber = (orderNumber || '').trim().toUpperCase();
        const actualOrderNumber = String(order.order_number || '').trim().toUpperCase();
        const knowsOrderNumber = suppliedOrderNumber.length > 0 && suppliedOrderNumber === actualOrderNumber;

        if (!knowsOrderNumber) {
          return jsonResponse({
            success: false,
            error: 'You are not allowed to confirm this order',
          });
        }
      }

      // Update order (works for both authenticated and anonymous)
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          redemption_confirmed: true,
        })
        .eq('id', orderId);

      if (updateOrderError) {
        console.error('Failed to update order:', updateOrderError);
        return jsonResponse({ success: false, error: 'Failed to update order' });
      }

      if (!order) {
        return jsonResponse({ success: false, error: 'Order not found' });
      }

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (paymentError) {
        console.error('Payment query error:', paymentError);
        // Non-fatal: order is already confirmed, just log
      }

      if (payment && !payment.credited_to_seller) {
        const { data: wallet, error: walletError } = await supabase
          .from('seller_wallets')
          .select('*')
          .eq('shop_id', order.shop_id)
          .maybeSingle();

        if (walletError) {
          console.error('Wallet query error:', walletError);
        }

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
              shop_id: order.shop_id,
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

      return jsonResponse({ success: true, message: 'Receipt confirmed successfully' });
    }

    if (!code) {
      return jsonResponse({ success: false, error: 'Code is required' });
    }

    // Find the redemption code
    console.log('Looking up redemption code:', code.toUpperCase());
    const { data: redemptionCode, error: codeError } = await supabase
      .from('redemption_codes')
      .select(`
        *,
        orders!order_id (
          id,
          order_number,
          total,
          status,
          payment_status,
          redemption_confirmed,
          customers (
            name,
            phone
          ),
          order_items (
            product_name,
            quantity,
            unit_price,
            total_price
          )
        ),
        shops!shop_id (
          id,
          name,
          owner_id
        )
      `)
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .maybeSingle();

    console.log('Code lookup result:', { redemptionCode, codeError });

    if (codeError) {
      console.error('Code lookup error:', codeError);
      return jsonResponse({ 
        success: false, 
        error: `Failed to look up redemption code: ${codeError.message}` 
      });
    }

    if (!redemptionCode) {
      return jsonResponse({ success: false, error: 'Invalid or expired redemption code. Please check the code and try again.' });
    }

    // Ensure objects are not returned as arrays of 1 element
    const orderObj = Array.isArray(redemptionCode.orders) ? redemptionCode.orders[0] : redemptionCode.orders;
    const shopObj = Array.isArray(redemptionCode.shops) ? redemptionCode.shops[0] : redemptionCode.shops;

    if (action === 'view') {
      console.log('View action for code:', code);
      return jsonResponse({
        success: true,
        order: orderObj,
        shop: shopObj,
        code: redemptionCode.code,
      });
    }

    if (action === 'confirm_delivery') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return jsonResponse({ success: false, error: 'Authentication required' });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return jsonResponse({ success: false, error: 'Authentication failed' });
      }

      if (!shopObj || user.id !== shopObj.owner_id) {
        return jsonResponse({ success: false, error: 'Unauthorized to confirm delivery for this order' });
      }

      if (!orderObj) {
        return jsonResponse({ success: false, error: 'Order not found for this code' });
      }

      const { error: codeUpdateError } = await supabase
        .from('redemption_codes')
        .update({
          status: 'redeemed',
          redeemed_by: user.id,
          redeemed_at: new Date().toISOString(),
        })
        .eq('id', redemptionCode.id);

      if (codeUpdateError) {
        console.error('Error updating code status:', codeUpdateError);
        return jsonResponse({ success: false, error: 'Failed to update code status' });
      }

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          redemption_confirmed: true,
        })
        .eq('id', orderObj.id);

      if (orderUpdateError) {
        console.error('Error updating order status:', orderUpdateError);
        return jsonResponse({ success: false, error: 'Failed to update order status' });
      }

      return jsonResponse({ success: true, message: 'Delivery confirmed successfully' });
    }

    if (action === 'confirm_receipt') {
      if (!orderObj) {
        return jsonResponse({ success: false, error: 'Order not found for this code' });
      }

      if (orderObj.redemption_confirmed) {
        return jsonResponse({ success: true, message: 'This order has already been confirmed.' });
      }

      await supabase
        .from('redemption_codes')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
        })
        .eq('id', redemptionCode.id);

      await supabase
        .from('orders')
        .update({
          status: 'completed',
          redemption_confirmed: true,
        })
        .eq('id', orderObj.id);

      // Get payment and credit seller if not already credited
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderObj.id)
        .maybeSingle();

      if (paymentError) {
        console.error('Error fetching payment for code confirm_receipt:', paymentError);
      }

      if (payment && !payment.credited_to_seller) {
        const sellerAmount = Number(payment.seller_amount) || 0;

        if (sellerAmount > 0) {
          // Claim the credit atomically so a concurrent verify/webhook call
          // can never credit the same payment twice.
          const { data: claimed } = await supabase
            .from('payments')
            .update({
              credited_to_seller: true,
              credited_at: new Date().toISOString(),
            })
            .eq('id', payment.id)
            .eq('credited_to_seller', false)
            .select('id')
            .maybeSingle();

          if (claimed) {
            const { data: wallet, error: walletError } = await supabase
              .from('seller_wallets')
              .select('*')
              .eq('shop_id', redemptionCode.shop_id)
              .maybeSingle();

            if (walletError) {
              console.error('Error fetching wallet for code confirm_receipt:', walletError);
            }

            if (wallet) {
              await supabase
                .from('seller_wallets')
                .update({
                  balance: Number(wallet.balance) + sellerAmount,
                  total_earned: Number(wallet.total_earned) + sellerAmount,
                })
                .eq('id', wallet.id);
            } else {
              // Create wallet if it doesn't exist
              await supabase
                .from('seller_wallets')
                .insert({
                  shop_id: redemptionCode.shop_id,
                  balance: sellerAmount,
                  total_earned: sellerAmount,
                });
            }
          }
        }
      }

      return jsonResponse({ success: true, message: 'Receipt confirmed successfully' });
    }

    return jsonResponse({ success: false, error: 'Invalid action' });

  } catch (error: any) {
    console.error('Error in redeem-code function:', error);
    console.error('Request details:', { code, action, orderId });
    return jsonResponse({ success: false, error: error.message || 'Internal server error' });
  }
});