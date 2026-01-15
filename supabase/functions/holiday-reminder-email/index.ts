import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting holiday reminder email job...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tomorrow's date in YYYY-MM-DD format
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    console.log(`Checking for holidays starting on: ${tomorrowStr}`);

    // Find active holidays that start tomorrow
    const { data: holidays, error: holidaysError } = await supabase
      .from("holidays")
      .select("*")
      .eq("is_active", true)
      .eq("start_date", tomorrowStr);

    if (holidaysError) {
      console.error("Error fetching holidays:", holidaysError);
      throw holidaysError;
    }

    if (!holidays || holidays.length === 0) {
      console.log("No holidays starting tomorrow. Skipping email send.");
      return new Response(
        JSON.stringify({ message: "No holidays tomorrow", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${holidays.length} holiday(s) starting tomorrow:`, holidays.map(h => h.name));

    // Get all active team members with emails
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_id")
      .eq("is_active", true);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      console.log("No active team members found.");
      return new Response(
        JSON.stringify({ message: "No team members to notify", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${profiles.length} active team member(s)`);

    let sentCount = 0;
    const errors: string[] = [];

    // Send email for each holiday to each team member
    for (const holiday of holidays) {
      const holidayTypeLabel = 
        holiday.holiday_type === 'national' ? 'Libur Nasional' :
        holiday.holiday_type === 'office' ? 'Libur Kantor' : 
        holiday.holiday_type === 'wfh' ? 'WFH (Work From Home)' : 'Libur Khusus';

      const startDate = new Date(holiday.start_date);
      const endDate = new Date(holiday.end_date);
      const dateRange = startDate.getTime() === endDate.getTime()
        ? startDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : `${startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} - ${endDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;

      for (const profile of profiles) {
        // Get email - prioritize email column, fallback to user_id if it's an email
        const recipientEmail = profile.email || 
          (profile.user_id && profile.user_id.includes('@') ? profile.user_id : null);

        if (!recipientEmail) {
          console.log(`Skipping ${profile.full_name} - no email address`);
          continue;
        }

        const recipientName = profile.full_name || 'Team Member';

        try {
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Pengingat Libur</h1>
              </div>
              
              <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                  Hi ${recipientName} 👋
                </p>
                
                <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                  Pengingat bahwa <strong>besok</strong> adalah hari libur:
                </p>
                
                <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                  <h2 style="color: #c2410c; margin: 0 0 10px 0; font-size: 20px;">${holiday.name}</h2>
                  <p style="color: #9a3412; margin: 5px 0; font-size: 14px;">
                    <strong>Tipe:</strong> ${holidayTypeLabel}
                  </p>
                  <p style="color: #9a3412; margin: 5px 0; font-size: 14px;">
                    <strong>Tanggal:</strong> ${dateRange}
                  </p>
                  ${holiday.description ? `<p style="color: #78350f; margin: 10px 0 0 0; font-size: 14px;">${holiday.description}</p>` : ''}
                </div>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
                  Selamat menikmati hari libur! 🌴
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                  Email ini dikirim otomatis oleh sistem Talco Management
                </p>
              </div>
            </div>
          `;

          const { error: emailError } = await resend.emails.send({
            from: "Talco HR <onboarding@resend.dev>",
            to: [recipientEmail],
            subject: `🎉 Pengingat: Besok Libur - ${holiday.name}`,
            html: emailHtml,
          });

          if (emailError) {
            console.error(`Failed to send to ${recipientEmail}:`, emailError);
            errors.push(`${recipientEmail}: ${emailError.message}`);
          } else {
            console.log(`✓ Sent holiday reminder to ${recipientEmail}`);
            sentCount++;
          }

          // Log to email_logs table
          await supabase.from("email_logs").insert({
            notification_type: "holiday_reminder",
            recipient_email: recipientEmail,
            recipient_name: recipientName,
            subject: `Pengingat: Besok Libur - ${holiday.name}`,
            body: emailHtml,
            status: emailError ? "failed" : "sent",
            error_message: emailError?.message || null,
            sent_at: emailError ? null : new Date().toISOString(),
            related_id: holiday.id,
          });

        } catch (sendError: any) {
          console.error(`Error sending to ${recipientEmail}:`, sendError);
          errors.push(`${recipientEmail}: ${sendError.message}`);
        }
      }
    }

    console.log(`Holiday reminder job completed. Sent: ${sentCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        message: "Holiday reminder emails processed",
        sent: sentCount,
        errors: errors.length > 0 ? errors : undefined,
        holidays: holidays.map(h => h.name),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in holiday-reminder-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
