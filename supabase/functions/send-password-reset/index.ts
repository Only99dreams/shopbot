import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildOtpEmailHtml(otpCode: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:480px;margin:0 auto">
      <h2 style="margin:0 0 12px">Reset your ShopAfrica password</h2>
      <p style="margin:0 0 12px">We received a request to reset your password. Use the code below to verify your identity:</p>
      <div style="margin:20px 0;text-align:center">
        <div style="display:inline-block;padding:16px 32px;background:#f3f4f6;border-radius:8px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#16a34a">${otpCode}</div>
      </div>
      <p style="margin:12px 0;color:#555">This code expires in <strong>10 minutes</strong>.</p>
      <p style="margin:12px 0 0;color:#555">If you didn't request this, you can safely ignore this email.</p>
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
      return jsonResponse({ success: false, error: "Email is required" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM") || "ShopAfrica <noreply@shopafrica.online>";
    const resendReplyTo = Deno.env.get("RESEND_REPLY_TO") || "support@shopafrica.online";

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: "Supabase credentials not configured" });
    }

    if (!resendApiKey) {
      return jsonResponse({ success: false, error: "Resend API key not configured" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if the email exists in auth.users
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    const userExists = usersData?.users?.some(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (listError || !userExists) {
      // Return success even if user doesn't exist (security: don't reveal user existence)
      return jsonResponse({ success: true });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing OTPs for this email
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
      return jsonResponse({ success: false, error: "Failed to generate reset code" });
    }

    // Send OTP via email using Resend
    const html = buildOtpEmailHtml(otpCode);

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
        subject: "Your ShopAfrica password reset code",
        html,
        text: `Your ShopAfrica password reset code is: ${otpCode}. This code expires in 10 minutes.`,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error("Resend error:", errorBody);
      return jsonResponse({ success: false, error: "Failed to send email" });
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error("send-password-reset error:", error);
    return jsonResponse({ success: false, error: error.message || "Unexpected error" });
  }
});
