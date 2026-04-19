import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InvoiceTemplate } from "@/lib/invoice-types";

export function useInvoiceTemplates() {
  return useQuery({
    queryKey: ["invoice-templates"],
    queryFn: async (): Promise<InvoiceTemplate[]> => {
      const { data, error } = await supabase
        .from("invoice_templates")
        .select("*")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as InvoiceTemplate[];
    },
  });
}

export function useInvoiceTemplate(id: string | null | undefined) {
  return useQuery({
    queryKey: ["invoice-template", id],
    enabled: !!id,
    queryFn: async (): Promise<InvoiceTemplate | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("invoice_templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as InvoiceTemplate) || null;
    },
  });
}
