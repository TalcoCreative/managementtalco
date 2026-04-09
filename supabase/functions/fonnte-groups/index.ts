import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API key from company_settings first, fallback to env
    let FONNTE_API_KEY: string | null = null;
    const { data: keyData } = await supabase
      .from("company_settings")
      .select("setting_value")
      .eq("setting_key", "fonnte_api_key")
      .single();
    FONNTE_API_KEY = keyData?.setting_value || Deno.env.get("FONNTE_API_KEY") || null;

    if (!FONNTE_API_KEY) {
      throw new Error("Fonnte API Key belum dikonfigurasi. Masukkan di Settings.");
    }

    const body = await req.json();
    const action = body.action || "get"; // "get" or "refresh"

    // Step 1: If refresh, call fetch-group first to update the list on Fonnte's side
    if (action === "refresh") {
      console.log("[FonnteGroups] Refreshing group list on Fonnte...");
      const refreshRes = await fetch("https://api.fonnte.com/fetch-group", {
        method: "POST",
        headers: { Authorization: FONNTE_API_KEY },
      });
      const refreshData = await refreshRes.json();
      console.log("[FonnteGroups] Refresh response:", JSON.stringify(refreshData));
    }

    // Step 2: Get the group list
    console.log("[FonnteGroups] Fetching group list...");
    const res = await fetch("https://api.fonnte.com/get-whatsapp-group", {
      method: "POST",
      headers: { Authorization: FONNTE_API_KEY },
    });
    const data = await res.json();
    console.log("[FonnteGroups] Response:", JSON.stringify(data));

    if (!data.status || !data.data) {
      return new Response(
        JSON.stringify({ success: false, detail: data.detail || "Failed to get groups", groups: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Upsert groups into wa_groups table
    const groups = data.data.map((g: any) => ({
      id: g.id,
      name: g.name,
      synced_at: new Date().toISOString(),
    }));

    if (groups.length > 0) {
      const { error: upsertError } = await supabase
        .from("wa_groups")
        .upsert(groups, { onConflict: "id" });
      if (upsertError) {
        console.error("[FonnteGroups] Upsert error:", upsertError);
      }

      // Remove groups that no longer exist
      const currentIds = groups.map((g: any) => g.id);
      await supabase.from("wa_groups").delete().not("id", "in", `(${currentIds.map((id: string) => `"${id}"`).join(",")})`);
    }

    return new Response(
      JSON.stringify({ success: true, groups }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fonnte-groups error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
