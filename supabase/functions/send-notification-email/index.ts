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
          <h2 style="color: #16a34a; margin: 16px 0;">Koneksi Email Berhasil!</h2>
          <p style="color: #555;">SMTP settings sudah terkonfigurasi dengan benar.</p>
          <p style="color: #555;">Sistem notifikasi email siap digunakan.</p>
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: EmailRequest = await req.json();
    console.log("Email request received:", JSON.stringify(body, null, 2));

    // Get email settings
    const { data: settings, error: settingsError } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error("Failed to fetch email settings:", settingsError);
      throw new Error("Email settings not configured");
    }

    if (!settings.smtp_email || !settings.smtp_password) {
      throw new Error("SMTP credentials not configured");
    }

    console.log("Using SMTP email:", settings.smtp_email);

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: settings.smtp_host || "smtp.gmail.com",
        port: settings.smtp_port || 587,
        tls: true,
        auth: {
          username: settings.smtp_email,
          password: settings.smtp_password,
        },
      },
    });

    let recipientEmail: string;
    let subject: string;
    let htmlBody: string;

    if (body.type === "test") {
      // Test email - send to the configured SMTP email
      recipientEmail = settings.smtp_email;
      subject = "✅ Talco System - Test Email Berhasil!";
      htmlBody = buildTestEmailBody();
    } else {
      // Notification email
      if (!body.recipient_email) {
        throw new Error("Recipient email is required for notifications");
      }
      recipientEmail = body.recipient_email;
      subject = getSubject(body.notification_type || "general", body.recipient_name || "User");
      htmlBody = buildEmailBody(
        body.recipient_name || "User",
        body.notification_type || "general",
        body.data
      );
    }

    console.log(`Sending email to: ${recipientEmail}, Subject: ${subject}`);

    // Send email
    await client.send({
      from: `${settings.sender_name || "Talco System"} <${settings.smtp_email}>`,
      to: recipientEmail,
      subject: subject,
      content: "Please view this email in an HTML-compatible email client.",
      html: htmlBody,
    });

    await client.close();

    console.log("Email sent successfully");

    // Log the email
    if (body.type !== "test") {
      await supabase.from("email_logs").insert({
        recipient_email: recipientEmail,
        recipient_name: body.recipient_name,
        subject: subject,
        body: htmlBody,
        notification_type: body.notification_type || "general",
        related_id: body.related_id || null,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }

    // Update connection status for test emails
    if (body.type === "test") {
      await supabase
        .from("email_settings")
        .update({
          is_connected: true,
          last_test_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);

    // Try to log the error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const body: EmailRequest = await req.clone().json().catch(() => ({}));
      
      if (body.type !== "test" && body.recipient_email) {
        await supabase.from("email_logs").insert({
          recipient_email: body.recipient_email || "unknown",
          recipient_name: body.recipient_name,
          subject: "Failed to send",
          notification_type: body.notification_type || "general",
          related_id: body.related_id || null,
          status: "failed",
          error_message: error.message,
        });
      }

      // Update connection status to false on error
      if (body.type === "test") {
        await supabase
          .from("email_settings")
          .update({ is_connected: false })
          .neq("id", "00000000-0000-0000-0000-000000000000");
      }
    } catch (logError) {
      console.error("Failed to log email error:", logError);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
