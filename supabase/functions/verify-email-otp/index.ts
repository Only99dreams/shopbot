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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return jsonResponse({ success: false, error: "Email and verification code are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("otp_code", otp)
      .eq("verified", false)
      .single();

    if (fetchError || !otpRecord) {
      console.log("OTP not found or already used for:", email);
      return jsonResponse({ success: false, error: "Invalid verification code" }, 400);
    }

    // Check if OTP is expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired OTP
      await supabase
        .from("otp_verifications")
        .delete()
        .eq("id", otpRecord.id);

      return jsonResponse({ success: false, error: "Code has expired. Please request a new one." }, 400);
    }

    // Mark OTP as verified
    await supabase
      .from("otp_verifications")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Find the user by email and confirm their email using admin API.
    // listUsers is paginated, so walk every page.
    let user: { id: string } | null = null;
    for (let page = 1; ; page += 1) {
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (listError) {
        console.error("Error listing users:", listError);
        return jsonResponse({ success: false, error: "Failed to verify user" }, 500);
      }

      const users = usersData?.users ?? [];
      user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;

      if (user || users.length < 1000) break;
    }

    if (!user) {
      return jsonResponse({ success: false, error: "User not found" }, 400);
    }

    // Confirm the user's email via admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    if (updateError) {
      console.error("Error confirming user email:", updateError);
      return jsonResponse({ success: false, error: "Failed to confirm email" }, 500);
    }

    // Clean up - delete used OTP
    await supabase
      .from("otp_verifications")
      .delete()
      .eq("id", otpRecord.id);

    console.log("Email verified successfully for:", email);

    return jsonResponse({ success: true, message: "Email verified successfully" });
  } catch (error: any) {
    console.error("verify-email-otp error:", error);
    return jsonResponse({ success: false, error: error.message || "Unexpected error" }, 500);
  }
});
