import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r) => r.role === "super_admin")) {
      throw new Error("Only super admins can create users");
    }

    const body = await req.json();
    const { email, password, fullName, role } = body;
    if (!email || !password || !fullName || !role) throw new Error("Missing required fields");

    console.log("Creating user:", { email, fullName, role });

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError) throw createError;

    const userId = newUser.user.id;
    console.log("User created:", userId);

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles").insert({ user_id: userId, role });
    if (roleError) {
      console.error("Role error:", roleError);
      throw roleError;
    }

    // Update profile with additional data
    const profileUpdate: Record<string, unknown> = {};
    if (body.phone) profileUpdate.phone = body.phone;
    if (body.address) profileUpdate.address = body.address;
    if (body.birthDate) profileUpdate.birth_date = body.birthDate;
    if (body.ktpNumber) profileUpdate.ktp_number = body.ktpNumber;
    if (body.emergencyContact) profileUpdate.emergency_contact = body.emergencyContact;
    if (body.contractStart) profileUpdate.contract_start = body.contractStart;
    if (body.contractEnd) profileUpdate.contract_end = body.contractEnd;
    if (body.bankAccountNumber) profileUpdate.bank_account_number = body.bankAccountNumber;
    if (body.bankAccountName) profileUpdate.bank_account_name = body.bankAccountName;
    if (body.email) profileUpdate.email = body.email;
    profileUpdate.gaji_pokok = body.gajiPokok ?? 0;
    profileUpdate.tj_transport = body.tjTransport ?? 0;
    profileUpdate.tj_internet = body.tjInternet ?? 0;
    profileUpdate.tj_kpi = body.tjKpi ?? 0;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles").update(profileUpdate).eq("id", userId);
      if (profileError) {
        console.error("Profile update error:", profileError);
        // Non-fatal - user is already created
      }
    }

    // Send welcome email
    await sendWelcomeEmail(supabaseAdmin, supabaseUrl, email, fullName, role, password);

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

async function sendWelcomeEmail(
  supabase: any, supabaseUrl: string,
  email: string, fullName: string, role: string, password: string
) {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) { console.log("No RESEND_API_KEY, skipping email"); return; }

    const { data: settings } = await supabase
      .from("email_settings").select("sender_name, smtp_email").limit(1).single();

    const senderName = settings?.sender_name || "Talco System";
    const senderEmail = settings?.smtp_email || "onboarding@resend.dev";
    const firstName = fullName.split(" ")[0];
    const roleLabel = role.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;">
<div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
<div style="text-align:center;margin-bottom:24px;"><h1 style="color:#2563eb;margin:0;font-size:24px;">Talco System</h1></div>
<div style="text-align:center;margin-bottom:24px;"><p style="font-size:48px;margin:0;">🎉</p><h2 style="color:#16a34a;margin:16px 0;">Welcome to the Team!</h2></div>
<p style="font-size:18px;color:#333;">Halo @${firstName} 👋</p>
<p style="color:#555;font-size:16px;">Selamat datang di Talco! Akun lo udah siap. Ini detail loginnya:</p>
<div style="background:#f8fafc;border-left:4px solid #2563eb;padding:16px;margin:20px 0;border-radius:0 8px 8px 0;">
<p style="margin:8px 0;"><strong>📧 Email:</strong> ${email}</p>
<p style="margin:8px 0;"><strong>🔑 Password:</strong> ${password}</p>
<p style="margin:8px 0;"><strong>👤 Role:</strong> ${roleLabel}</p></div>
<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px;margin:16px 0;">
<p style="margin:0;color:#92400e;font-size:14px;">⚠️ <strong>Penting:</strong> Segera ganti password setelah login pertama!</p></div>
<div style="text-align:center;margin:24px 0;">
<a href="https://managementtalco.lovable.app/auth" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;">🚀 Login Sekarang</a></div>
<p style="color:#555;">Kalau ada pertanyaan, hubungi admin atau HR ya!</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
<div style="text-align:center;"><p style="color:#2563eb;font-weight:bold;margin:0;">— Talco System</p>
<p style="color:#888;font-size:14px;margin:8px 0 0 0;">Biar kerjaan rapi & tim makin enak kerjanya ✨</p></div>
</div></body></html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [email],
        subject: `🎉 Selamat datang di Talco, @${firstName}!`,
        html: htmlBody,
      }),
    });

    const data = await response.json();
    await supabase.from("email_logs").insert({
      recipient_email: email, recipient_name: fullName,
      subject: `🎉 Selamat datang di Talco, @${firstName}!`,
      body: htmlBody, notification_type: "welcome",
      status: response.ok ? "sent" : "failed",
      sent_at: response.ok ? new Date().toISOString() : null,
      error_message: response.ok ? null : (data.message || "Failed"),
    });

    console.log(response.ok ? "Welcome email sent" : "Email failed:", data);
  } catch (error) {
    console.error("Email error:", error);
  }
}
