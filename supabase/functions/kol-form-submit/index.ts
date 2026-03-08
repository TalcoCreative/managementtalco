import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { form_id, answers, questions } = body;

    if (!form_id || !answers || !questions) {
      return new Response(JSON.stringify({ error: "Missing data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify form is KOL template
    const { data: form } = await supabase
      .from("forms")
      .select("form_template, created_by")
      .eq("id", form_id)
      .single();

    if (!form || form.form_template !== "kol") {
      return new Response(JSON.stringify({ error: "Not a KOL form" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const getAnswer = (labelKey: string) => {
      const q = questions.find((q: any) => q.label.toLowerCase().includes(labelKey.toLowerCase()));
      return q ? (answers[q.id] || "").trim() : "";
    };
    const getNum = (labelKey: string) => {
      const val = getAnswer(labelKey);
      return val ? parseInt(val, 10) || null : null;
    };

    const kolName = getAnswer("nama lengkap");
    const kolUsername = getAnswer("username");

    if (!kolName || !kolUsername) {
      return new Response(JSON.stringify({ error: "Name and username required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kolData = {
      name: kolName,
      username: kolUsername.replace(/^@/, ""),
      industry: getAnswer("industry") || null,
      instagram_url: getAnswer("link instagram") || null,
      ig_followers: getNum("followers instagram"),
      tiktok_url: getAnswer("link tiktok") || null,
      tiktok_followers: getNum("followers tiktok"),
      twitter_url: getAnswer("link twitter") || null,
      twitter_followers: getNum("followers twitter"),
      youtube_url: getAnswer("link youtube") || null,
      youtube_followers: getNum("subscribers youtube"),
      linkedin_url: getAnswer("link linkedin") || null,
      linkedin_followers: getNum("followers linkedin"),
      threads_url: getAnswer("link threads") || null,
      threads_followers: getNum("followers threads"),
      rate_ig_story: getNum("rate ig story"),
      rate_ig_feed: getNum("rate ig feed"),
      rate_ig_reels: getNum("rate ig reels"),
      rate_tiktok_video: getNum("rate tiktok"),
      rate_youtube_video: getNum("rate youtube"),
      notes: getAnswer("catatan") || null,
      created_by: form.created_by,
      updated_by: form.created_by,
    };

    const { error } = await supabase.from("kol_database").insert(kolData);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
