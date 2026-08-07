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

    const { form_id, answers, questions } = await req.json();
    if (!form_id || !answers || !questions) {
      return new Response(JSON.stringify({ error: "Missing data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: form } = await supabase
      .from("forms")
      .select("form_template, created_by")
      .eq("id", form_id)
      .single();

    if (!form || form.form_template !== "talent") {
      return new Response(JSON.stringify({ error: "Not a talent form" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const find = (key: string) =>
      (questions as any[]).find((q) => (q.label || "").toLowerCase().includes(key.toLowerCase()));

    const raw = (key: string) => {
      const q = find(key);
      if (!q) return "";
      const val = answers[q.id];
      if (val == null) return "";
      if (Array.isArray(val)) return val.join(", ");
      return String(val).trim();
    };
    const num = (key: string) => {
      const v = raw(key).replace(/[^0-9.]/g, "");
      return v ? Number(v) || null : null;
    };
    const files = (key: string) => {
      const q = find(key);
      if (!q) return [] as string[];
      const val = answers[q.id];
      if (Array.isArray(val)) return val.filter((v) => typeof v === "string" && /^https?:\/\//.test(v));
      if (typeof val === "string" && /^https?:\/\//.test(val)) return [val];
      return [] as string[];
    };

    const name = raw("nama");
    if (!name) {
      return new Response(JSON.stringify({ error: "Nama wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const photos = [...files("foto"), ...files("photo")];
    const genderRaw = raw("gender").toLowerCase();
    const gender = genderRaw.includes("pria") || genderRaw.includes("male") || genderRaw.includes("laki")
      ? "male"
      : genderRaw.includes("wanita") || genderRaw.includes("female") || genderRaw.includes("perempuan")
        ? "female"
        : genderRaw ? "other" : null;

    const talentData = {
      name,
      phone: raw("nomor") || raw("hp") || raw("whatsapp") || null,
      email: raw("email") || null,
      city: raw("kota") || raw("domisili") || null,
      gender,
      birth_date: /^\d{4}-\d{2}-\d{2}/.test(raw("tanggal lahir")) ? raw("tanggal lahir").slice(0, 10) : null,
      instagram: raw("instagram") || null,
      portfolio_url: raw("portfolio") || raw("porto") || null,
      photo_url: photos[0] || null,
      photos,
      height_cm: num("tinggi"),
      weight_kg: num("berat"),
      shoe_size: raw("ukuran sepatu") || null,
      shirt_size: raw("ukuran baju") || null,
      pants_size: raw("ukuran celana") || null,
      chest_cm: num("lingkar dada"),
      waist_cm: num("lingkar pinggang"),
      category: raw("kategori") || null,
      rate: num("rate") ?? num("harga"),
      notes: raw("catatan") || null,
      status: "active",
      source: "form",
      created_by: form.created_by,
      updated_by: form.created_by,
    };

    const { error } = await supabase.from("talents").insert(talentData);
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
