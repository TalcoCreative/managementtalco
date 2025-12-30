import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "test" | "notification";
  notification_type?: string;
  recipient_email?: string;
  recipient_name?: string;
  data?: {
    title?: string;
    description?: string;
    deadline?: string;
    creator_name?: string;
    link?: string;
    priority?: string;
    status?: string;
    participants?: string;
    location?: string;
  };
  related_id?: string;
}

// Parse error messages to provide clear feedback
const parseSmtpError = (error: Error): string => {
  const message = error.message || error.toString();
  const name = error.name || "";
  
  console.log("Parsing error:", { name, message });
  
  // Authentication errors
  if (message.includes("535") || message.includes("Authentication") || 
      message.includes("Username and Password not accepted") ||
      message.includes("Invalid credentials")) {
    return "Authentication Failed: Email atau App Password salah. Pastikan menggunakan App Password 16 digit dari Google Account Settings.";
  }
  
  // Connection errors
  if (message.includes("connection") || message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT") || message.includes("ENOTFOUND") ||
      name === "ConnectionRefused" || name === "ConnectionReset") {
    return "Connection Failed: Tidak bisa terhubung ke server Gmail. Periksa koneksi internet.";
  }
  
  // TLS/SSL errors
  if (message.includes("TLS") || message.includes("SSL") || 
      message.includes("certificate") || message.includes("handshake") ||
      message.includes("InvalidContentType") || message.includes("corrupt message")) {
    return "TLS/SSL Error: Gagal membuat koneksi aman ke Gmail. Coba lagi dalam beberapa saat.";
  }
  
  // Sender rejected
  if (message.includes("550") || message.includes("sender") || 
      message.includes("rejected") || message.includes("not allowed")) {
    return "Sender Rejected: Email pengirim ditolak oleh Gmail. Pastikan email yang digunakan valid.";
  }
  
  // SMTP blocked
  if (message.includes("blocked") || message.includes("554") ||
      message.includes("spam") || message.includes("denied")) {
    return "SMTP Blocked: Gmail memblokir pengiriman. Cek apakah Less Secure Apps diaktifkan atau gunakan App Password.";
  }
  
  // Rate limiting
  if (message.includes("rate") || message.includes("limit") || message.includes("too many")) {
    return "Rate Limited: Terlalu banyak percobaan. Tunggu beberapa menit dan coba lagi.";
  }
  
  // Invalid data errors
  if (name === "InvalidData") {
    return "Invalid Data: Format data tidak valid. Pastikan email dan password sudah benar.";
  }
  
  return `Error: ${message}`;
};

const getSubject = (type: string, name: string): string => {
  const firstName = name.split(" ")[0];
  switch (type) {
    case "task_assignment":
      return `Hi @${firstName} – ada Task baru buat lo nih 👀`;
    case "task_updated":
      return `Hi @${firstName} – Task lo ada update nih 📝`;
    case "task_completed":
      return `Hi @${firstName} – Task selesai nih ✅`;
    case "task_overdue":
      return `Hi @${firstName} – Task lo udah lewat nih 😬`;
    case "project_assignment":
      return `Hi @${firstName} – lo join project baru nih 🚀`;
    case "shooting_assignment":
      return `Hi @${firstName} – lo dijadwalkan produksi nih 🎥`;
    case "event_assignment":
      return `Hi @${firstName} – lo dijadwalkan event nih 🎥`;
    case "meeting_invitation":
      return `Hi @${firstName} – lo diundang meeting nih 📅`;
    case "meeting_reminder":
      return `Hi @${firstName} – reminder meeting nih 📅`;
    default:
      return `Hi @${firstName} – ada update buat lo nih 🚀`;
  }
};

const getNotificationLabel = (type: string): string => {
  switch (type) {
    case "task_assignment":
    case "task_updated":
    case "task_completed":
    case "task_overdue":
      return "Task";
    case "project_assignment":
      return "Project";
    case "shooting_assignment":
      return "Shooting";
    case "event_assignment":
      return "Event";
    case "meeting_invitation":
    case "meeting_reminder":
      return "Meeting";
    default:
      return "Notifikasi";
  }
};

const buildEmailBody = (
  recipientName: string,
  notificationType: string,
  data: EmailRequest["data"]
): string => {
  const firstName = recipientName.split(" ")[0];
  const label = getNotificationLabel(notificationType);
  
  let additionalInfo = "";
  
  if (notificationType === "task_overdue") {
    additionalInfo = `
      <p style="color: #e74c3c; font-weight: bold;">⚠️ Status: Overdue</p>
      <p>Segera cek & update ya 🙏</p>
    `;
  }
  
  if (data?.priority) {
    additionalInfo += `<p>🔥 Prioritas: <strong>${data.priority}</strong></p>`;
  }
  
  if (data?.status) {
    additionalInfo += `<p>📊 Status: <strong>${data.status}</strong></p>`;
  }
  
  if (data?.participants) {
    additionalInfo += `<p>👥 Peserta: ${data.participants}</p>`;
  }
  
  if (data?.location) {
    additionalInfo += `<p>📍 Lokasi: ${data.location}</p>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Talco System Notification</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Talco System</h1>
        </div>
        
        <p style="font-size: 18px; color: #333;">Halo @${firstName} 👋</p>
        
        <p style="color: #555; font-size: 16px;">Ada update baru buat lo nih:</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 8px 0;"><strong>📌 Jenis:</strong> ${label}</p>
          <p style="margin: 8px 0;"><strong>📝 Judul:</strong> ${data?.title || "-"}</p>
          ${data?.description ? `<p style="margin: 8px 0;"><strong>ℹ️ Deskripsi:</strong> ${data.description}</p>` : ""}
          ${data?.deadline ? `<p style="margin: 8px 0;"><strong>📅 Tanggal / Deadline:</strong> ${data.deadline}</p>` : ""}
          ${data?.creator_name ? `<p style="margin: 8px 0;"><strong>👤 Dibuat oleh:</strong> ${data.creator_name}</p>` : ""}
          ${additionalInfo}
        </div>
        
        ${data?.link ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">🔗 Cek detailnya di sini</a>
          </div>
        ` : ""}
        
        <p style="color: #555; font-style: italic;">Kalau ini penting, jangan di-skip ya 😎</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        
        <div style="text-align: center;">
          <p style="color: #2563eb; font-weight: bold; margin: 0;">— Talco System</p>
          <p style="color: #888; font-size: 14px; margin: 8px 0 0 0;">Biar kerjaan rapi & tim makin enak kerjanya ✨</p>
        </div>
        
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 24px;">
          Email ini dikirim otomatis dari Talco System.<br>
          Kalau merasa tidak terkait, hubungi admin ya.
        </p>
      </div>
    </body>
    </html>
  `;
};

const buildTestEmailBody = (): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Talco System - Test Email</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Talco System</h1>
        </div>
        
        <div style="text-align: center;">
          <p style="font-size: 48px; margin: 0;">✅</p>
          <h2 style="color: #16a34a; margin: 16px 0;">SMTP Berhasil Terkoneksi!</h2>
          <p style="color: #555; font-size: 16px;">SMTP Gmail Connected & Ready 🎉</p>
          <p style="color: #555;">Sistem notifikasi email siap digunakan.</p>
        </div>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; color: #166534;"><strong>✓</strong> Koneksi SMTP: OK</p>
          <p style="margin: 8px 0 0 0; color: #166534;"><strong>✓</strong> Autentikasi: OK</p>
          <p style="margin: 8px 0 0 0; color: #166534;"><strong>✓</strong> Pengiriman: OK</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        
        <div style="text-align: center;">
          <p style="color: #2563eb; font-weight: bold; margin: 0;">— Talco System</p>
          <p style="color: #888; font-size: 14px; margin: 8px 0 0 0;">Biar kerjaan rapi & tim makin enak kerjanya ✨</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Store request body for error logging
  let requestBody: EmailRequest | null = null;
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    requestBody = await req.json();
    console.log("Email request received:", JSON.stringify(requestBody, null, 2));

    // Get email settings
    const { data: settings, error: settingsError } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error("Failed to fetch email settings:", settingsError);
      throw new Error("Email settings not configured. Buka Email Settings untuk konfigurasi SMTP.");
    }

    if (!settings.smtp_email || !settings.smtp_password) {
      throw new Error("SMTP credentials not configured. Masukkan Email dan App Password di Email Settings.");
    }

    // Remove spaces from password (App Passwords often have spaces)
    const cleanPassword = settings.smtp_password.replace(/\s/g, '');
    
    console.log("Using SMTP email:", settings.smtp_email);
    console.log("SMTP Host:", settings.smtp_host || "smtp.gmail.com");
    console.log("SMTP Port:", settings.smtp_port || 587);

    // Create SMTP client with STARTTLS configuration for Gmail
    // Gmail port 587 requires STARTTLS, not direct TLS
    const client = new SMTPClient({
      connection: {
        hostname: settings.smtp_host || "smtp.gmail.com",
        port: settings.smtp_port || 587,
        tls: false, // Start without TLS
        auth: {
          username: settings.smtp_email,
          password: cleanPassword,
        },
      },
    });

    let recipientEmail: string;
    let recipientName: string;
    let subject: string;
    let htmlBody: string;
    
    const body = requestBody!;

    if (body.type === "test") {
      // Test email - send to the configured SMTP email
      recipientEmail = settings.smtp_email;
      recipientName = "Admin";
      subject = "✅ Talco System - Test Email Berhasil!";
      htmlBody = buildTestEmailBody();
    } else {
      // Notification email
      if (!body.recipient_email) {
        throw new Error("Recipient email is required for notifications");
      }
      recipientEmail = body.recipient_email;
      recipientName = body.recipient_name || "User";
      subject = getSubject(body.notification_type || "general", recipientName);
      htmlBody = buildEmailBody(
        recipientName,
        body.notification_type || "general",
        body.data
      );
    }

    console.log(`Sending email to: ${recipientEmail}, Subject: ${subject}`);

    // Send email with STARTTLS
    try {
      await client.send({
        from: `${settings.sender_name || "Talco System"} <${settings.smtp_email}>`,
        to: recipientEmail,
        subject: subject,
        content: "Please view this email in an HTML-compatible email client.",
        html: htmlBody,
      });
    } finally {
      // Always close the client
      try {
        await client.close();
      } catch (closeError) {
        console.log("Error closing SMTP client (non-fatal):", closeError);
      }
    }

    console.log("Email sent successfully!");

    // Log the email
    if (body.type === "notification") {
      await supabase.from("email_logs").insert({
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject: subject,
        body: htmlBody,
        notification_type: body.notification_type || "general",
        related_id: body.related_id || null,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    } else {
      // Log test emails too
      await supabase.from("email_logs").insert({
        recipient_email: recipientEmail,
        recipient_name: "Admin (Test)",
        subject: subject,
        notification_type: "test",
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }

    // Update connection status
    await supabase
      .from("email_settings")
      .update({
        is_connected: true,
        last_test_at: new Date().toISOString(),
      })
      .eq("id", settings.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Success — SMTP Gmail Connected & Ready 🎉" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    
    // Parse the error to provide clear feedback
    const errorMessage = parseSmtpError(error);
    console.log("Parsed error message:", errorMessage);

    // Try to log the error and update status
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Log failed attempt
      if (requestBody) {
        await supabase.from("email_logs").insert({
          recipient_email: requestBody.recipient_email || "unknown",
          recipient_name: requestBody.recipient_name || (requestBody.type === "test" ? "Admin (Test)" : null),
          subject: "Failed to send",
          notification_type: requestBody.notification_type || (requestBody.type === "test" ? "test" : "general"),
          related_id: requestBody.related_id || null,
          status: "failed",
          error_message: errorMessage,
        });
      }

      // Update connection status to false on error
      await supabase
        .from("email_settings")
        .update({ is_connected: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");
    } catch (logError) {
      console.error("Failed to log email error:", logError);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
