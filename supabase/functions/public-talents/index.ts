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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "Token wajib" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: link } = await supabase
      .from("talent_share_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!link || !link.is_active) {
      return new Response(JSON.stringify({ error: "Link tidak ditemukan atau sudah dinonaktifkan" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("talents")
      .select("id,name,category,city,gender,instagram,portfolio_url,photo_url,photos,height_cm,weight_kg,shoe_size,shirt_size,pants_size,chest_cm,waist_cm,rate,phone")
      .eq("status", "active")
      .order("name");

    if (link.category) query = query.eq("category", link.category);

    const { data: talents, error } = await query;
    if (error) throw error;

    const sanitized = (talents || []).map((t: any) => ({
      ...t,
      rate: link.show_rate ? t.rate : null,
      phone: link.show_contact ? t.phone : null,
    }));

    return new Response(
      JSON.stringify({
        link: { title: link.title, category: link.category, show_rate: link.show_rate, show_contact: link.show_contact },
        talents: sanitized,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
