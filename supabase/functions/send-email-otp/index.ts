import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildVerificationEmailHtml(otpCode: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:480px;margin:0 auto;padding:20px">
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="color:#16a34a;margin:0;font-size:28px">ShopAfrica</h1>
      </div>
      <h2 style="margin:0 0 12px;text-align:center">Verify your email</h2>
      <p style="margin:0 0 8px;text-align:center;color:#555">Welcome to ShopAfrica! Use the code below to verify your email address and activate your account:</p>
      <div style="margin:24px 0;text-align:center">
        <div style="display:inline-block;padding:16px 32px;background:#f3f4f6;border-radius:12px;font-size:36px;font-weight:bold;letter-spacing:8px;color:#16a34a">${otpCode}</div>
      </div>
      <p style="margin:12px 0;color:#555;text-align:center">This code expires in <strong>10 minutes</strong>.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
      <p style="margin:0;color:#999;font-size:13px;text-align:center">If you didn't create a ShopAfrica account, please ignore this email.</p>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return jsonResponse({ success: false, error: "Email is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM") || "ShopAfrica <noreply@shopafrica.online>";
    const resendReplyTo = Deno.env.get("RESEND_REPLY_TO") || "support@shopafrica.online";

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: "Server configuration error" }, 500);
    }

    if (!resendApiKey) {
      return jsonResponse({ success: false, error: "Email service not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing email OTPs for this email
    await supabase
      .from("otp_verifications")
      .delete()
      .eq("email", email.toLowerCase());

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("otp_verifications")
      .insert({
        email: email.toLowerCase(),
        phone: "",
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return jsonResponse({ success: false, error: "Failed to generate verification code" }, 500);
    }

    // Send OTP via Resend
    const html = buildVerificationEmailHtml(otpCode);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        reply_to: resendReplyTo,
        to: email,
        subject: "Your ShopAfrica verification code",
        html,
        text: `Your ShopAfrica verification code is: ${otpCode}. This code expires in 10 minutes.`,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error("Resend error:", errorBody);
      return jsonResponse({ success: false, error: "Failed to send verification email" }, 500);
    }

    console.log("Email OTP sent successfully to:", email);

    return jsonResponse({ success: true, message: "Verification code sent" });
  } catch (error: any) {
    console.error("send-email-otp error:", error);
    return jsonResponse({ success: false, error: error.message || "Unexpected error" }, 500);
  }
});
