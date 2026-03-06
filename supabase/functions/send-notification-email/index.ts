import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "test" | "notification" | "recruitment_pic_assigned";
  notification_type?: string;
  notificationType?: string;
  recipient_email?: string;
  recipientEmail?: string;
  recipientUserId?: string;
  recipient_name?: string;
  recipientName?: string;
  candidateName?: string;
  candidatePosition?: string;
  assignedBy?: string;
  data?: {
    title?: string;
    description?: string;
    content?: string;
    deadline?: string;
    creator_name?: string;
    creatorName?: string;
    link?: string;
    priority?: string;
    status?: string;
    participants?: string;
    location?: string;
    createdAt?: string;
    comment_content?: string;
    updated_at?: string;
  };
  related_id?: string;
  relatedId?: string;
}

interface ResendResponse {
  id?: string;
  error?: {
    message: string;
    name: string;
  };
}

// Parse error messages to provide clear feedback
const parseResendError = (error: any): string => {
  const message = error.message || error.toString();
  
  console.log("Parsing error:", message);
  
  // API key errors
  if (message.includes("API key") || message.includes("unauthorized") || message.includes("401") || message.includes("Missing API key")) {
    return "API Key Error: Resend API Key tidak valid atau belum dikonfigurasi. Periksa kembali API Key di Secrets.";
  }
  
  // Domain not verified
  if (message.includes("domain") || message.includes("verify") || message.includes("not allowed") || message.includes("You can only send")) {
    return "Domain Error: Domain email belum diverifikasi di Resend. Gunakan onboarding@resend.dev untuk testing atau verifikasi domain Anda di https://resend.com/domains";
  }
  
  // Rate limiting
  if (message.includes("rate") || message.includes("limit") || message.includes("429")) {
    return "Rate Limited: Terlalu banyak email dikirim. Tunggu beberapa menit dan coba lagi.";
  }
  
  // Invalid email
  if (message.includes("invalid") && message.includes("email")) {
    return "Invalid Email: Format email penerima tidak valid.";
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
    case "task_status_change":
      return `Hi @${firstName} – status task berubah nih 🔄`;
    case "task_overdue":
      return `Hi @${firstName} – Task lo udah lewat nih 😬`;
    case "task_mention":
      return `Hi @${firstName} – lo di-mention di task nih 👀`;
    case "project_assignment":
      return `Hi @${firstName} – lo join project baru nih 🚀`;
    case "shooting_assignment":
      return `Hi @${firstName} – lo dijadwalkan shooting nih 🎥`;
    case "shooting_status_update":
      return `Hi @${firstName} – ada update shooting nih 🎬`;
    case "event_assignment":
      return `Hi @${firstName} – lo dijadwalkan event nih 🎥`;
    case "meeting_invitation":
      return `Hi @${firstName} – lo diundang meeting nih 📅`;
    case "meeting_reminder":
      return `Hi @${firstName} – reminder meeting nih 📅`;
    case "announcement":
      return `📢 Pengumuman: Ada info penting nih buat lo!`;
    case "recruitment_pic_assigned":
      return `Hi @${firstName} – lo ditunjuk jadi PIC kandidat nih 📋`;
    default:
      return `Hi @${firstName} – ada update buat lo nih 🚀`;
  }
};

const getNotificationLabel = (type: string): string => {
  switch (type) {
    case "task_assignment":
    case "task_updated":
    case "task_completed":
    case "task_status_change":
    case "task_overdue":
    case "task_mention":
      return "Task";
    case "project_assignment":
      return "Project";
    case "shooting_assignment":
    case "shooting_status_update":
      return "Shooting";
    case "event_assignment":
      return "Event";
    case "meeting_invitation":
    case "meeting_reminder":
      return "Meeting";
    case "announcement":
      return "Pengumuman";
    case "recruitment_pic_assigned":
      return "Recruitment";
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
  let mainMessage = "Ada update baru buat lo nih:";
  
  // Custom messages for different notification types
  if (notificationType === "task_mention") {
    mainMessage = "Lo baru aja di-mention di sebuah task:";
    if (data?.comment_content) {
      additionalInfo += `
        <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 12px; margin: 12px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-style: italic; color: #0369a1;">"${data.comment_content}"</p>
        </div>
      `;
    }
  }
  
  if (notificationType === "task_status_change" || notificationType === "task_completed") {
    mainMessage = "Ada update status task:";
    if (data?.updated_at) {
      additionalInfo += `<p>📅 Waktu Update: <strong>${data.updated_at}</strong></p>`;
    }
  }
  
  if (notificationType === "task_overdue") {
    additionalInfo += `
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
        
        <p style="color: #555; font-size: 16px;">${mainMessage}</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 8px 0;"><strong>📌 Jenis:</strong> ${label}</p>
          <p style="margin: 8px 0;"><strong>📝 ${notificationType === "task_mention" ? "Task" : "Judul"}:</strong> ${data?.title || "-"}</p>
          ${data?.description && notificationType !== "task_mention" ? `<p style="margin: 8px 0;"><strong>ℹ️ Deskripsi:</strong> ${data.description}</p>` : ""}
          ${data?.deadline ? `<p style="margin: 8px 0;"><strong>📅 Tanggal / Deadline:</strong> ${data.deadline}</p>` : ""}
          ${data?.creator_name ? `<p style="margin: 8px 0;"><strong>👤 ${notificationType === "task_mention" ? "Di-mention oleh" : "Diupdate oleh"}:</strong> ${data.creator_name}</p>` : ""}
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

const buildTestEmailBody = (testEmail: string): string => {
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
          <h2 style="color: #16a34a; margin: 16px 0;">Resend Berhasil Terkoneksi!</h2>
          <p style="color: #555; font-size: 16px;">Email Service Connected & Ready 🎉</p>
          <p style="color: #555;">Sistem notifikasi email siap digunakan.</p>
        </div>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; color: #166534;"><strong>✓</strong> API Connection: OK</p>
          <p style="margin: 8px 0 0 0; color: #166534;"><strong>✓</strong> Authentication: OK</p>
          <p style="margin: 8px 0 0 0; color: #166534;"><strong>✓</strong> Email Sent To: ${testEmail}</p>
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

// Send email using Resend API directly
async function sendEmailWithResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<ResendResponse> {
  console.log(`Calling Resend API to send email from ${from} to ${to}`);
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json();
  console.log("Resend API response:", JSON.stringify(data, null, 2));
  
  if (!response.ok) {
    throw new Error(data.message || data.error?.message || `HTTP ${response.status}`);
  }
  
  return data;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Store request body for error logging
  let requestBody: EmailRequest | null = null;
  
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY tidak dikonfigurasi. Tambahkan API Key di Secrets.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    requestBody = await req.json();
    console.log("Email request received:", JSON.stringify(requestBody, null, 2));

    // Get email settings for sender info
    const { data: settings, error: settingsError } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError) {
      console.log("No email settings found, using defaults");
    }

    const senderName = settings?.sender_name || "Talco System";
    // Use onboarding@resend.dev for testing, or your verified domain
    const senderEmail = settings?.smtp_email || "onboarding@resend.dev";
    const fromAddress = `${senderName} <${senderEmail}>`;

    console.log("Using sender:", fromAddress);

    let recipientEmail: string;
    let recipientName: string;
    let subject: string;
    let htmlBody: string;
    
    const body = requestBody!;
    
    // Normalize camelCase to snake_case for compatibility
    const normalizedRecipientEmail = body.recipient_email || body.recipientEmail;
    const normalizedRecipientName = body.recipient_name || body.recipientName;
    const normalizedNotificationType = body.notification_type || body.notificationType;
    const normalizedRelatedId = body.related_id || body.relatedId;
    
    // Normalize data fields
    const normalizedData = body.data ? {
      ...body.data,
      description: body.data.description || body.data.content, // For announcements
      creator_name: body.data.creator_name || body.data.creatorName,
    } : undefined;

    if (body.type === "test") {
      // Test email - send to the configured email or a test email
      recipientEmail = settings?.smtp_email || "delivered@resend.dev";
      recipientName = "Admin";
      subject = "✅ Talco System - Test Email Berhasil!";
      htmlBody = buildTestEmailBody(recipientEmail);
    } else if (body.type === "recruitment_pic_assigned") {
      // Recruitment PIC assignment - resolve user email from ID
      if (!body.recipientUserId) {
        throw new Error("recipientUserId is required for recruitment_pic_assigned");
      }

      const { data: picProfile, error: picError } = await supabase
        .from("profiles")
        .select("full_name, user_id")
        .eq("id", body.recipientUserId)
        .single();

      if (picError || !picProfile) {
        throw new Error("PIC profile not found");
      }

      // Get user email from auth
      const { data: authUser } = await supabase.auth.admin.getUserById(body.recipientUserId);
      if (!authUser?.user?.email) {
        throw new Error("PIC email not found");
      }

      // Get assigner name
      let assignerName = "Admin";
      if (body.assignedBy) {
        const { data: assignerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", body.assignedBy)
          .single();
        assignerName = assignerProfile?.full_name || "Admin";
      }

      recipientEmail = authUser.user.email;
      recipientName = picProfile.full_name || "User";
      subject = getSubject("recruitment_pic_assigned", recipientName);
      htmlBody = buildEmailBody(
        recipientName,
        "recruitment_pic_assigned",
        {
          title: `${body.candidateName || "Kandidat"} - ${body.candidatePosition || "Posisi"}`,
          description: `Lo ditunjuk sebagai PIC untuk kandidat ${body.candidateName} yang melamar posisi ${body.candidatePosition}.`,
          creator_name: assignerName,
        }
      );
    } else {
      // Notification email
      if (!normalizedRecipientEmail) {
        throw new Error("Recipient email is required for notifications");
      }
      recipientEmail = normalizedRecipientEmail;
      recipientName = normalizedRecipientName || "User";
      subject = getSubject(normalizedNotificationType || "general", recipientName);
      htmlBody = buildEmailBody(
        recipientName,
        normalizedNotificationType || "general",
        normalizedData
      );
    }

    console.log(`Sending email to: ${recipientEmail}, Subject: ${subject}`);

    // Send email using Resend
    const emailResponse = await sendEmailWithResend(
      resendApiKey,
      fromAddress,
      recipientEmail,
      subject,
      htmlBody
    );

    console.log("Email sent successfully! ID:", emailResponse.id);

    // Log the email
    await supabase.from("email_logs").insert({
      recipient_email: recipientEmail,
      recipient_name: body.type === "test" ? "Admin (Test)" : recipientName,
      subject: subject,
      body: htmlBody,
      notification_type: normalizedNotificationType || (body.type === "test" ? "test" : "general"),
      related_id: normalizedRelatedId || null,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    // Update connection status
    if (settings?.id) {
      await supabase
        .from("email_settings")
        .update({
          is_connected: true,
          last_test_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Success — Email Service Connected & Ready 🎉",
        emailId: emailResponse.id
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    
    // Parse the error to provide clear feedback
    const errorMessage = parseResendError(error);
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
