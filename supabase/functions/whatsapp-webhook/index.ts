import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Parse Twilio webhook payload (form data)
    const formData = await req.formData();
    const from = formData.get('From')?.toString() || '';
    const to = formData.get('To')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const numMedia = parseInt(formData.get('NumMedia')?.toString() || '0');

    // Extract phone number (remove 'whatsapp:' prefix)
    const customerPhone = from.replace('whatsapp:', '');
    const shopPhone = to.replace('whatsapp:', '');

    console.log(`Received message from ${customerPhone}: ${body}`);

    // Find the shop by WhatsApp number
    let { data: shop } = await supabase
      .from('shops')
      .select('id, name, owner_id')
      .eq('whatsapp_number', shopPhone.replace('+', ''))
      .eq('is_active', true)
      .single();

    if (!shop) {
      // Try to find any active shop for demo purposes
      const { data: anyShop } = await supabase
        .from('shops')
        .select('id, name, owner_id')
        .eq('is_active', true)
        .limit(1)
        .single();
      
      if (!anyShop) {
        return new Response('Shop not found or inactive subscription', { status: 200 });
      }
      shop = anyShop;
    }

    // Verify the shop has an active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('shop_id', shop.id)
      .single();

    if (!subscription || subscription.status !== 'active') {
      console.log(`Shop ${shop.id} has inactive subscription, ignoring message`);
      return new Response('Shop subscription not active', { status: 200 });
    }

    const shopId = shop.id;

    // Find or create conversation
    let { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('shop_id', shopId)
      .eq('customer_phone', customerPhone)
      .single();

    if (!conversation) {
      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('whatsapp_conversations')
        .insert({
          shop_id: shopId,
          customer_phone: customerPhone,
          customer_name: null,
          last_message: body,
          last_message_at: new Date().toISOString(),
          unread_count: 1,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating conversation:', createError);
        throw createError;
      }
      conversation = newConv;
    } else {
      // Update existing conversation
      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message: body,
          last_message_at: new Date().toISOString(),
          unread_count: (conversation.unread_count || 0) + 1,
        })
        .eq('id', conversation.id);
    }

    // Store the incoming message
    await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        content: body,
        direction: 'inbound',
        message_type: numMedia > 0 ? 'media' : 'text',
        status: 'received',
      });

    // Get recent conversation history for AI context
    const { data: recentMessages } = await supabase
      .from('whatsapp_messages')
      .select('content, direction, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Build conversation history for AI
    const conversationHistory = (recentMessages || [])
      .reverse()
      .slice(0, -1) // Exclude the current message
      .map(msg => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content || ''
      }));

    // Call AI chat function for response
    let autoReply = '';
    
    if (lovableApiKey) {
      try {
        console.log('Calling AI chat for response...');
        
        const aiResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: body,
            shopId: shopId,
            customerPhone: customerPhone,
            conversationHistory: conversationHistory
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          autoReply = aiData.reply || '';
          console.log('AI response:', autoReply);
        } else {
          console.error('AI chat error:', await aiResponse.text());
        }
      } catch (aiError) {
        console.error('Error calling AI chat:', aiError);
      }
    }

    // Fallback to simple responses if AI fails
    if (!autoReply) {
      const lowerBody = body.toLowerCase();
      
      if (lowerBody === 'catalog' || lowerBody === 'products' || lowerBody === 'menu') {
        autoReply = `📱 *Viewing your catalog request...*\n\nI'm preparing your product catalog. You'll receive it shortly!\n\n_Tip: Reply with "Order [product name]" to place an order._`;
        
        // Trigger catalog send (async)
        fetch(`${supabaseUrl}/functions/v1/send-product-catalog`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop_id: shopId,
            customer_phone: customerPhone,
          }),
        }).catch(console.error);
      } else if (lowerBody === 'help' || lowerBody === 'hi' || lowerBody === 'hello') {
        autoReply = `👋 *Welcome to ${shop.name}!*\n\nHere's how I can help:\n\n📝 "CATALOG" - View our products\n🛒 "Order [name]" - Place an order\n❓ "HELP" - See this menu\n💬 Or just ask anything!\n\n_I'm an AI assistant and I'll help you find what you need._`;
      }
    }

    // Send auto-reply if we have one
    if (autoReply && twilioAccountSid && twilioAuthToken && twilioWhatsAppNumber) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      
      const replyFormData = new URLSearchParams();
      replyFormData.append('To', `whatsapp:${customerPhone}`);
      replyFormData.append('From', `whatsapp:${twilioWhatsAppNumber}`);
      replyFormData.append('Body', autoReply);

      const replyResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: replyFormData.toString(),
      });

      if (replyResponse.ok) {
        // Store the outbound message
        await supabase
          .from('whatsapp_messages')
          .insert({
            conversation_id: conversation.id,
            content: autoReply,
            direction: 'outbound',
            message_type: 'text',
            status: 'sent',
          });
      }
    }

    // Return TwiML response (empty is fine for now)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/xml' 
        } 
      }
    );
  } catch (error: any) {
    console.error('Error in whatsapp-webhook:', error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
  }
});
