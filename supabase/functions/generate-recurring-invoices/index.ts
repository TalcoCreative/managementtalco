import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function advanceDate(d: Date, unit: string, count: number): Date {
  const n = new Date(d);
  if (unit === "weekly") n.setDate(n.getDate() + 7 * count);
  else if (unit === "monthly") n.setMonth(n.getMonth() + count);
  else if (unit === "yearly") n.setFullYear(n.getFullYear() + count);
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().slice(0, 10);
    const { data: rules, error: rulesErr } = await supabase
      .from("invoice_recurring_rules")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_date", today);
    if (rulesErr) throw rulesErr;

    const generated: any[] = [];

    for (const rule of rules || []) {
      try {
        // Check end conditions
        if (rule.end_date && new Date(rule.end_date) < new Date(rule.next_run_date)) {
          await supabase.from("invoice_recurring_rules").update({ is_active: false }).eq("id", rule.id);
          continue;
        }
        if (rule.max_occurrences && rule.occurrences_generated >= rule.max_occurrences) {
          await supabase.from("invoice_recurring_rules").update({ is_active: false }).eq("id", rule.id);
          continue;
        }

        // Load source invoice
        const { data: src } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", rule.source_invoice_id)
          .single();
        if (!src) continue;

        // Compute new invoice number via letter sequence
        const issueDate = rule.next_run_date;
        const d = new Date(issueDate);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const entityCode = src.template_snapshot?.entity_code || "TLC";
        const { data: nextNumber } = await supabase.rpc("get_next_letter_number", {
          p_entity_code: entityCode,
          p_category_code: "FIN",
          p_year: year,
          p_month: month,
        });
        const monthStr = String(month).padStart(2, "0");
        const runStr = String(nextNumber).padStart(3, "0");
        const invoiceNumber = `${entityCode}/FIN/INVOICE/${monthStr}/${year}/${runStr}`;

        // Create letter
        const { data: letter } = await supabase
          .from("letters")
          .insert({
            letter_number: invoiceNumber,
            entity_code: entityCode,
            entity_name: src.template_snapshot?.entity_name || "Talco",
            category_code: "FIN",
            category_name: "Finance",
            project_label: "INVOICE",
            project_id: src.project_id || null,
            recipient_name: src.bill_to_name,
            recipient_company: src.bill_to_company,
            notes: `Recurring invoice (rule ${rule.id})`,
            created_by: rule.created_by,
            running_number: nextNumber,
            year,
            month,
            status: "draft",
            is_confidential: false,
          })
          .select()
          .single();

        // Clone invoice as draft
        const { data: newInv, error: insErr } = await supabase
          .from("invoices")
          .insert({
            invoice_number: invoiceNumber,
            letter_id: letter?.id || null,
            template_id: src.template_id,
            template_snapshot: src.template_snapshot,
            custom_logo_url: src.custom_logo_url,
            client_id: src.client_id,
            project_id: src.project_id,
            bill_to_name: src.bill_to_name,
            bill_to_company: src.bill_to_company,
            bill_to_address: src.bill_to_address,
            bill_to_email: src.bill_to_email,
            bill_to_phone: src.bill_to_phone,
            items: src.items,
            subtotal: src.subtotal,
            tax_percent: src.tax_percent,
            tax_amount: src.tax_amount,
            discount_amount: src.discount_amount,
            total: src.total,
            currency: src.currency,
            status: "draft",
            issue_date: issueDate,
            due_date: src.due_date,
            notes: src.notes,
            terms: src.terms,
            enabled_payment_method_ids: src.enabled_payment_method_ids,
            recurring_rule_id: rule.id,
            created_by: rule.created_by,
          })
          .select()
          .single();
        if (insErr) throw insErr;

        // Advance rule
        const newNext = advanceDate(new Date(issueDate), rule.interval_unit, rule.interval_count)
          .toISOString().slice(0, 10);
        const newCount = (rule.occurrences_generated || 0) + 1;
        const shouldDeactivate =
          (rule.end_date && new Date(rule.end_date) < new Date(newNext)) ||
          (rule.max_occurrences && newCount >= rule.max_occurrences);

        await supabase.from("invoice_recurring_rules").update({
          next_run_date: newNext,
          occurrences_generated: newCount,
          last_generated_at: new Date().toISOString(),
          is_active: !shouldDeactivate,
        }).eq("id", rule.id);

        generated.push({ rule_id: rule.id, invoice_id: newInv?.id, invoice_number: invoiceNumber });
      } catch (e) {
        console.error("Failed rule", rule.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
