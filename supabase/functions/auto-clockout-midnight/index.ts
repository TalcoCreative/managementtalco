import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    console.log("Starting auto clock-out check at midnight...");

    // Get current date in Jakarta timezone (UTC+7)
    const now = new Date();
    const jakartaOffset = 7 * 60; // 7 hours in minutes
    const jakartaNow = new Date(now.getTime() + jakartaOffset * 60 * 1000);
    const todayStr = jakartaNow.toISOString().split("T")[0];
    
    // Get yesterday's date
    const yesterday = new Date(jakartaNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    console.log(`Today: ${todayStr}, Yesterday: ${yesterdayStr}`);

    // Find all attendance records from yesterday (or earlier) that have clock_in but no clock_out
    const { data: unclockedAttendance, error: fetchError } = await supabase
      .from("attendance")
      .select("id, user_id, date, clock_in, notes, profiles(full_name, email, user_id)")
      .lt("date", todayStr) // All dates before today
      .not("clock_in", "is", null)
      .is("clock_out", null);

    if (fetchError) {
      console.error("Error fetching unclocked attendance:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${unclockedAttendance?.length || 0} attendance records without clock-out`);

    const results: any[] = [];

    for (const record of unclockedAttendance || []) {
      try {
        // Calculate clock-out time as 23:59:59 of the attendance date
        const clockOutTime = `${record.date}T23:59:59`;
        const updatedNotes = (record.notes || "") + " [AUTO CLOCK-OUT - LUPA CLOCK OUT]";

        // Update the attendance record
        const { error: updateError } = await supabase
          .from("attendance")
          .update({
            clock_out: clockOutTime,
            notes: updatedNotes,
          })
          .eq("id", record.id);

        if (updateError) {
          console.error(`Failed to auto clock-out for ${record.id}:`, updateError);
          results.push({ id: record.id, status: "error", error: updateError.message });
          continue;
        }

        // Create a notification for the user
        await supabase.from("auto_clockout_notifications").insert({
          user_id: record.user_id,
          attendance_id: record.id,
          message: `Kamu lupa clock-out tanggal ${record.date}. Sistem otomatis clock-out jam 23:59. Jangan diulangi ya! 😅`,
          is_read: false,
        });

        console.log(`Auto clock-out successful for user ${record.user_id} on ${record.date}`);
        results.push({ 
          id: record.id, 
          user_id: record.user_id, 
          date: record.date,
          status: "success" 
        });
      } catch (err: any) {
        console.error(`Error processing record ${record.id}:`, err);
        results.push({ id: record.id, status: "error", error: err.message });
      }
    }

    console.log(`Auto clock-out completed. Processed ${results.length} records.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${results.length} auto clock-outs`,
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Auto clock-out error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
