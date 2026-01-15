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
    const { message, shopId, customerPhone, conversationHistory } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch shop details
    const { data: shop } = await supabase
      .from('shops')
      .select('id, name, description, whatsapp_number')
      .eq('id', shopId)
      .single();

    // Fetch products for context
    const { data: products } = await supabase
      .from('products')
      .select('id, name, price, description, stock_quantity, is_available')
      .eq('shop_id', shopId)
      .eq('is_available', true)
      .limit(20);

    // Fetch categories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('shop_id', shopId);

    // Build product catalog for AI context
    const productCatalog = products?.map(p => 
      `- ${p.name}: ₦${p.price.toLocaleString()} ${p.stock_quantity && p.stock_quantity > 0 ? `(${p.stock_quantity} in stock)` : '(Out of stock)'} - ${p.description || 'No description'}`
    ).join('\n') || 'No products available';

    const categoryList = categories?.map(c => c.name).join(', ') || 'No categories';

    const systemPrompt = `You are a helpful and friendly AI sales assistant for "${shop?.name || 'our store'}". 

Shop Description: ${shop?.description || 'A great local shop'}

Available Product Categories: ${categoryList}

Product Catalog:
${productCatalog}

Your role:
1. Help customers find products and answer questions about them
2. Assist with placing orders - collect name, phone, and delivery address
3. Provide price information and check stock availability
4. Be friendly, professional, and helpful
5. Use Nigerian Naira (₦) for all prices
6. Keep responses concise but informative (max 3-4 sentences when possible)

When a customer wants to order:
1. Confirm the product and quantity
2. Ask for their full name
3. Ask for their delivery address
4. Provide order confirmation with total price

Important:
- Always be polite and use appropriate emojis sparingly
- If a product isn't in the catalog, politely say it's not available
- Encourage customers to ask questions about products
- Format prices with commas (e.g., ₦10,000)`;

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    console.log('Calling Lovable AI with message:', message);

    // Call Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          reply: "I'm currently experiencing high demand. Please try again in a moment. 🙏",
          error: 'rate_limited'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process your request. Please try again.";

    console.log('AI Reply:', reply);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in whatsapp-ai-chat:', error);
    return new Response(JSON.stringify({ 
      reply: "I'm having trouble right now. Please try again or contact the shop directly. 🙏",
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
