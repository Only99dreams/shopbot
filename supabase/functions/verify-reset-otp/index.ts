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
    const { email, otp, newPassword } = await req.json();

    if (!email || typeof email !== "string") {
      return jsonResponse({ success: false, error: "Email is required" }, 400);
    }

    if (!otp || typeof otp !== "string") {
      return jsonResponse({ success: false, error: "OTP code is required" }, 400);
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return jsonResponse({ success: false, error: "Password must be at least 6 characters" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ success: false, error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const normalizedEmail = email.toLowerCase();

    // Find the OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("otp_code", otp)
      .eq("verified", false)
      .single();

    if (fetchError || !otpRecord) {
      return jsonResponse({ success: false, error: "Invalid or expired OTP code" }, 400);
    }

    // Check if OTP is expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired OTP
      await supabase
        .from("otp_verifications")
        .delete()
        .eq("id", otpRecord.id);

      return jsonResponse({ success: false, error: "OTP has expired. Please request a new one." }, 400);
    }

    // OTP is valid — find the user by email
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error("Error listing users:", listError);
      return jsonResponse({ success: false, error: "Failed to find user" }, 500);
    }

    const targetUser = usersData?.users?.find(
      (u: any) => u.email?.toLowerCase() === normalizedEmail
    );

    if (!targetUser) {
      return jsonResponse({ success: false, error: "User not found" }, 404);
    }

    // Update the user's password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return jsonResponse({ success: false, error: "Failed to update password" }, 500);
    }

    // Mark OTP as verified and clean up
    await supabase
      .from("otp_verifications")
      .delete()
      .eq("id", otpRecord.id);

    return jsonResponse({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("verify-reset-otp error:", error);
    return jsonResponse({ success: false, error: error.message || "Unexpected error" }, 500);
  }
});
