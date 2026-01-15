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
    const { phone } = await req.json();

    if (!phone) {
      throw new Error('Phone number is required');
    }

    // Get environment variables
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Clean phone number (remove any spaces or special chars)
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    // Delete any existing OTPs for this phone
    await supabase
      .from('otp_verifications')
      .delete()
      .eq('phone', cleanPhone);

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('otp_verifications')
      .insert({
        phone: cleanPhone,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      throw new Error('Failed to store OTP');
    }

    // Format phone for WhatsApp (ensure it has country code)
    const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

    // Send OTP via Twilio WhatsApp
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    const message = `🔐 *WAShop Verification*\n\nYour verification code is: *${otpCode}*\n\nThis code expires in 5 minutes.\n\nIf you didn't request this code, please ignore this message.`;

    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${whatsappPhone}`);
    formData.append('From', `whatsapp:${twilioWhatsAppNumber}`);
    formData.append('Body', message);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioData);
      throw new Error(twilioData.message || 'Failed to send WhatsApp message');
    }

    console.log('OTP sent successfully to:', whatsappPhone);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        messageSid: twilioData.sid 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-whatsapp-otp:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
