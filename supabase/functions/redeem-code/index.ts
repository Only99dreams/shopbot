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
    const { code, action, orderId } = await req.json();

    console.log('Redeem code request:', { code, action, orderId });

    if (!action) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Action is required',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'confirm_receipt' && orderId) {
      console.log('Confirm receipt action with orderId:', orderId);

      // Check if this is an anonymous confirmation (from marketplace tracking)
      const isAnonymous = code === 'DIRECT_CONFIRM';
      console.log('Is anonymous confirmation:', isAnonymous);

      if (!isAnonymous) {
        // Authenticated confirmation (original logic)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication required',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }

        // Verify the user
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication failed',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }

        // Get the order and verify ownership
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .eq('customer_id', user.id)
          .eq('payment_status', 'paid')
          .eq('redemption_confirmed', false)
          .single();

        if (orderError || !order) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Order not found or already confirmed',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
        }
      } else {
        // Anonymous confirmation (from marketplace tracking)
        console.log('Anonymous confirmation for orderId:', orderId);

        // Get the order by ID only (no customer verification needed)
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .eq('payment_status', 'paid')
          .eq('redemption_confirmed', false)
          .single();

        console.log('Order query result:', { order, orderError });

        if (orderError || !order) {
          console.log('Order not found or already confirmed:', { orderError, order });
          return new Response(JSON.stringify({
            success: false,
            error: 'Order not found or already confirmed',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
        }
      }

      // Update order (works for both authenticated and anonymous)
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          redemption_confirmed: true,
        })
        .eq('id', orderId);

      // Get payment and credit seller if not already credited
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (payment && !payment.credited_to_seller) {
        const { data: wallet } = await supabase
          .from('seller_wallets')
          .select('*')
          .eq('shop_id', order.shop_id)
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

      return new Response(JSON.stringify({
        success: true,
        message: 'Receipt confirmed successfully',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!code) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Code is required',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Find the redemption code
    console.log('Looking up redemption code:', code.toUpperCase());
    const { data: redemptionCode, error: codeError } = await supabase
      .from('redemption_codes')
      .select(`
        *,
        orders (
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
        shops (
          id,
          name,
          owner_id
        )
      `)
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single();

    console.log('Code lookup result:', { redemptionCode, codeError });

    if (codeError || !redemptionCode) {
      console.log('Code not found or error:', { codeError, redemptionCode });
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired redemption code',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    if (action === 'view') {
      console.log('View action for code:', code);
      console.log('Redemption code data:', redemptionCode);
      // Return order details for viewing
      return new Response(JSON.stringify({
        success: true,
        order: redemptionCode.orders,
        shop: redemptionCode.shops,
        code: redemptionCode.code,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'confirm_delivery') {
      // Shop owner confirming delivery
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Authentication required',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      // Verify the user is the shop owner
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user || user.id !== redemptionCode.shops.owner_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized to confirm delivery for this order',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      // Mark code as redeemed
      await supabase
        .from('redemption_codes')
        .update({
          status: 'redeemed',
          redeemed_by: user.id,
          redeemed_at: new Date().toISOString(),
        })
        .eq('id', redemptionCode.id);

      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          redemption_confirmed: true,
        })
        .eq('id', redemptionCode.orders.id);

      return new Response(JSON.stringify({
        success: true,
        message: 'Delivery confirmed successfully',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'confirm_receipt') {
      // Customer confirming receipt
      // Mark code as redeemed and credit seller
      await supabase
        .from('redemption_codes')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
        })
        .eq('id', redemptionCode.id);

      // Update order
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          redemption_confirmed: true,
        })
        .eq('id', redemptionCode.orders.id);

      // Get payment and credit seller if not already credited
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', redemptionCode.orders.id)
        .single();

      if (payment && !payment.credited_to_seller) {
        const { data: wallet } = await supabase
          .from('seller_wallets')
          .select('*')
          .eq('shop_id', redemptionCode.shop_id)
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

      return new Response(JSON.stringify({
        success: true,
        message: 'Receipt confirmed successfully',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });

  } catch (error: any) {
    console.error('Error in redeem-code function:', error);
    console.error('Request details:', { code, action, orderId });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});