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

interface EmailTemplate {
  notification_type: string;
  label: string;
  subject_template: string;
  main_message: string;
  footer_message: string;
  button_text: string;
  body_html: string | null;
  is_active: boolean;
}

// Parse error messages to provide clear feedback
const parseResendError = (error: any): string => {
  const message = error.message || error.toString();
  console.log("Parsing error:", message);
  
  if (message.includes("API key") || message.includes("unauthorized") || message.includes("401") || message.includes("Missing API key")) {
    return "API Key Error: Resend API Key tidak valid atau belum dikonfigurasi. Periksa kembali API Key di Secrets.";
  }
  if (message.includes("domain") || message.includes("verify") || message.includes("not allowed") || message.includes("You can only send")) {
    return "Domain Error: Domain email belum diverifikasi di Resend. Gunakan onboarding@resend.dev untuk testing atau verifikasi domain Anda di https://resend.com/domains";
  }
  if (message.includes("rate") || message.includes("limit") || message.includes("429")) {
    return "Rate Limited: Terlalu banyak email dikirim. Tunggu beberapa menit dan coba lagi.";
  }
  if (message.includes("invalid") && message.includes("email")) {
    return "Invalid Email: Format email penerima tidak valid.";
  }
  return `Error: ${message}`;
};

// Default subjects (fallback)
const getDefaultSubject = (type: string, name: string): string => {
  const firstName = name.split(" ")[0];
  switch (type) {
    case "task_assignment": return `Hi @${firstName} – ada Task baru buat lo nih 👀`;
    case "task_updated": return `Hi @${firstName} – Task lo ada update nih 📝`;
    case "task_completed": return `Hi @${firstName} – Task selesai nih ✅`;
    case "task_status_change": return `Hi @${firstName} – status task berubah nih 🔄`;
    case "task_overdue": return `Hi @${firstName} – Task lo udah lewat nih 😬`;
    case "task_mention": return `Hi @${firstName} – lo di-mention di task nih 👀`;
    case "project_assignment": return `Hi @${firstName} – lo join project baru nih 🚀`;
    case "shooting_assignment": return `Hi @${firstName} – lo dijadwalkan shooting nih 🎥`;
    case "shooting_status_update": return `Hi @${firstName} – ada update shooting nih 🎬`;
    case "event_assignment": return `Hi @${firstName} – lo dijadwalkan event nih 🎥`;
    case "meeting_invitation": return `Hi @${firstName} – lo diundang meeting nih 📅`;
    case "meeting_reminder": return `Hi @${firstName} – reminder meeting nih 📅`;
    case "announcement": return `📢 Pengumuman: Ada info penting nih buat lo!`;
    case "recruitment_pic_assigned": return `Hi @${firstName} – lo ditunjuk jadi PIC kandidat nih 📋`;
    case "ep_mention": return `Hi @${firstName} – lo di-mention di Editorial Plan nih 💬`;
    default: return `Hi @${firstName} – ada update buat lo nih 🚀`;
  }
};

const getSubject = (type: string, name: string, template?: EmailTemplate | null): string => {
  const firstName = name.split(" ")[0];
  if (template?.subject_template) {
    return template.subject_template.replace(/\{\{firstName\}\}/g, firstName);
  }
  return getDefaultSubject(type, name);
};

const getNotificationLabel = (type: string, template?: EmailTemplate | null): string => {
  if (template?.label) return template.label;
  switch (type) {
    case "task_assignment": case "task_updated": case "task_completed":
    case "task_status_change": case "task_overdue": case "task_mention": return "Task";
    case "project_assignment": return "Project";
    case "shooting_assignment": case "shooting_status_update": return "Shooting";
    case "event_assignment": return "Event";
    case "meeting_invitation": case "meeting_reminder": return "Meeting";
    case "announcement": return "Pengumuman";
    case "recruitment_pic_assigned": return "Recruitment";
    default: return "Notifikasi";
  }
};

const replaceVariables = (text: string, vars: Record<string, string>): string => {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
};

const buildEmailBody = (
  recipientName: string,
  notificationType: string,
  data: EmailRequest["data"],
  template?: EmailTemplate | null
): string => {
  const firstName = recipientName.split(" ")[0];
  const label = getNotificationLabel(notificationType, template);

  const vars: Record<string, string> = {
    firstName,
    label,
    title: data?.title || "-",
    description: data?.description || "",
    deadline: data?.deadline || "",
    creator_name: data?.creator_name || "",
    status: data?.status || "",
    priority: data?.priority || "",
    location: data?.location || "",
    participants: data?.participants || "",
    link: data?.link || "",
    comment_content: data?.comment_content || "",
    updated_at: data?.updated_at || "",
  };

  // If template has custom HTML, use it
  if (template?.body_html) {
    return replaceVariables(template.body_html, vars);
  }

  // Use template fields or defaults
  let mainMessage = template?.main_message || "Ada update baru buat lo nih:";
  const footerMessage = template?.footer_message || "Kalau ini penting, jangan di-skip ya 😎";
  const buttonText = template?.button_text || "🔗 Cek detailnya di sini";

  // Custom messages per type (defaults)
  if (!template?.main_message) {
    if (notificationType === "task_mention") mainMessage = "Lo baru aja di-mention di sebuah task:";
    if (notificationType === "task_status_change" || notificationType === "task_completed") mainMessage = "Ada update status task:";
  }

  let additionalInfo = "";

  if (notificationType === "task_mention" && data?.comment_content) {
    additionalInfo += `
      <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 12px; margin: 12px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-style: italic; color: #0369a1;">"${data.comment_content}"</p>
      </div>
    `;
  }

  if ((notificationType === "task_status_change" || notificationType === "task_completed") && data?.updated_at) {
    additionalInfo += `<p>📅 Waktu Update: <strong>${data.updated_at}</strong></p>`;
  }

  if (notificationType === "task_overdue") {
    additionalInfo += `
      <p style="color: #e74c3c; font-weight: bold;">⚠️ Status: Overdue</p>
      <p>Segera cek & update ya 🙏</p>
    `;
  }

  if (data?.priority) additionalInfo += `<p>🔥 Prioritas: <strong>${data.priority}</strong></p>`;
  if (data?.status) additionalInfo += `<p>📊 Status: <strong>${data.status}</strong></p>`;
  if (data?.participants) additionalInfo += `<p>👥 Peserta: ${data.participants}</p>`;
  if (data?.location) additionalInfo += `<p>📍 Lokasi: ${data.location}</p>`;

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
            <a href="${data.link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">${buttonText}</a>
          </div>
        ` : ""}
        
        <p style="color: #555; font-style: italic;">${footerMessage}</p>
        
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

// Load email templates from DB
async function loadTemplates(supabase: any): Promise<Map<string, EmailTemplate>> {
  const map = new Map<string, EmailTemplate>();
  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("is_active", true);
    
    if (!error && data) {
      for (const t of data) {
        map.set(t.notification_type, t as EmailTemplate);
      }
    }
  } catch (e) {
    console.log("Failed to load email templates, using defaults:", e);
  }
  return map;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Load settings and templates in parallel
    const [settingsResult, templates] = await Promise.all([
      supabase.from("email_settings").select("*").limit(1).single(),
      loadTemplates(supabase),
    ]);

    const settings = settingsResult.data;
    if (settingsResult.error) {
      console.log("No email settings found, using defaults");
    }

    const senderName = settings?.sender_name || "Talco System";
    const senderEmail = settings?.smtp_email || "onboarding@resend.dev";
    const fromAddress = `${senderName} <${senderEmail}>`;

    console.log("Using sender:", fromAddress);
    console.log("Loaded templates:", templates.size);

    let recipientEmail: string;
    let recipientName: string;
    let subject: string;
    let htmlBody: string;
    
    const body = requestBody!;
    
    const normalizedRecipientEmail = body.recipient_email || body.recipientEmail;
    const normalizedRecipientName = body.recipient_name || body.recipientName;
    const normalizedNotificationType = body.notification_type || body.notificationType;
    const normalizedRelatedId = body.related_id || body.relatedId;
    
    const normalizedData = body.data ? {
      ...body.data,
      description: body.data.description || body.data.content,
      creator_name: body.data.creator_name || body.data.creatorName,
    } : undefined;

    if (body.type === "test") {
      recipientEmail = settings?.smtp_email || "delivered@resend.dev";
      recipientName = "Admin";
      subject = "✅ Talco System - Test Email Berhasil!";
      htmlBody = buildTestEmailBody(recipientEmail);
    } else if (body.type === "recruitment_pic_assigned") {
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

      const { data: authUser } = await supabase.auth.admin.getUserById(body.recipientUserId);
      if (!authUser?.user?.email) {
        throw new Error("PIC email not found");
      }

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
      const tmpl = templates.get("recruitment_pic_assigned");
      subject = getSubject("recruitment_pic_assigned", recipientName, tmpl);
      htmlBody = buildEmailBody(
        recipientName,
        "recruitment_pic_assigned",
        {
          title: `${body.candidateName || "Kandidat"} - ${body.candidatePosition || "Posisi"}`,
          description: `Lo ditunjuk sebagai PIC untuk kandidat ${body.candidateName} yang melamar posisi ${body.candidatePosition}.`,
          creator_name: assignerName,
        },
        tmpl
      );
    } else {
      if (!normalizedRecipientEmail) {
        throw new Error("Recipient email is required for notifications");
      }
      recipientEmail = normalizedRecipientEmail;
      recipientName = normalizedRecipientName || "User";
      
      const tmpl = templates.get(normalizedNotificationType || "general");
      
      // Check if template is active (if template exists but is_active is false, skip)
      if (tmpl && !tmpl.is_active) {
        console.log(`Template ${normalizedNotificationType} is inactive, skipping email`);
        return new Response(
          JSON.stringify({ success: true, message: "Template inactive, email skipped" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      subject = getSubject(normalizedNotificationType || "general", recipientName, tmpl);
      htmlBody = buildEmailBody(
        recipientName,
        normalizedNotificationType || "general",
        normalizedData,
        tmpl
      );
    }

    console.log(`Sending email to: ${recipientEmail}, Subject: ${subject}`);

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
    
    const errorMessage = parseResendError(error);
    console.log("Parsed error message:", errorMessage);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
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
