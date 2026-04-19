import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building2, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { TemplateEditorDialog } from "@/components/invoices/TemplateEditorDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { InvoiceTemplate } from "@/lib/invoice-types";
import { usePermissions } from "@/hooks/usePermissions";

export default function InvoiceTemplates() {
  const qc = useQueryClient();
  const { isSuperAdmin, canView, canCreate, canEdit, canDelete } = usePermissions();
  const [editing, setEditing] = useState<InvoiceTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceTemplate | null>(null);

  const allowed = isSuperAdmin || canView("invoice_templates");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["invoice-templates-admin"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_templates")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as InvoiceTemplate[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["invoice-templates-admin"] });
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!allowed) {
    return <AppLayout><div className="text-center py-20 text-muted-foreground">No access.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoice Templates</h1>
            <p className="text-sm text-muted-foreground">Manage branding for each entity (TS / TW / TCI).</p>
          </div>
          {(isSuperAdmin || canCreate("invoice_templates")) && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New Template
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <div className="h-16 w-full" style={{ background: `linear-gradient(135deg, ${t.primary_color}, ${t.secondary_color})` }} />
                <CardContent className="pt-0">
                  <div className="-mt-8 flex items-start gap-3">
                    <div className="h-16 w-16 rounded-xl bg-card border border-border/60 flex items-center justify-center overflow-hidden shrink-0">
                      {t.logo_url ? (
                        <img src={t.logo_url} alt={t.entity_name} className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 mt-8">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{t.entity_code}</Badge>
                        {t.is_default && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Star className="h-2.5 w-2.5 mr-0.5" /> Default
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <h3 className="font-semibold text-base mt-2">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.entity_name}</p>
                  <div className="text-xs text-muted-foreground mt-2">
                    {(t.payment_methods || []).filter((m) => m.enabled).length} payment method(s)
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
                    {(isSuperAdmin || canEdit("invoice_templates")) && (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(t)}>
                        <Edit className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    )}
                    {(isSuperAdmin || canDelete("invoice_templates")) && !t.is_default && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <TemplateEditorDialog open={creating} onOpenChange={setCreating} template={null} />
        <TemplateEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} template={editing} />
        <DeleteConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          title="Delete template?"
          description={`"${deleteTarget?.name}" will be removed. Existing invoices keep their snapshot.`}
        />
      </div>
    </AppLayout>
  );
}
