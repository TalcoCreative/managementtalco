import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, FileText, Loader2, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";
import { Invoice, INVOICE_STATUS_META, formatIDR, InvoiceTemplate } from "@/lib/invoice-types";
import { generateInvoicePDF } from "@/lib/invoice-pdf";
import { usePermissions } from "@/hooks/usePermissions";
import { Link } from "react-router-dom";

export default function Invoices() {
  const qc = useQueryClient();
  const { canCreate, canView, isSuperAdmin } = usePermissions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  const allowed = isSuperAdmin || canView("invoices");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_templates(name, entity_code, primary_color, secondary_color, logo_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["invoice-templates-filter"],
    enabled: allowed,
    queryFn: async () => {
      const { data } = await supabase.from("invoice_templates").select("id, name, entity_code");
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDownload = async (inv: any) => {
    setDownloading(inv.id);
    try {
      const snap = inv.template_snapshot && Object.keys(inv.template_snapshot).length > 0
        ? inv.template_snapshot
        : inv.invoice_templates;
      const tpl: Partial<InvoiceTemplate> = {
        ...snap,
        primary_color: snap?.primary_color || "#0f172a",
        secondary_color: snap?.secondary_color || "#64748b",
      };
      await generateInvoicePDF(inv as Invoice, tpl as InvoiceTemplate);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate PDF");
    } finally {
      setDownloading(null);
    }
  };

  const filtered = invoices.filter((i: any) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (templateFilter !== "all" && i.template_id !== templateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        i.invoice_number.toLowerCase().includes(q) ||
        i.bill_to_name.toLowerCase().includes(q) ||
        (i.bill_to_company || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!allowed) {
    return (
      <AppLayout>
        <div className="text-center py-20 text-muted-foreground">You don't have access to invoices.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
            <p className="text-sm text-muted-foreground">Multi-brand invoicing connected to Letters numbering.</p>
          </div>
          <div className="flex gap-2">
            {(isSuperAdmin || canView("invoice_templates")) && (
              <Button variant="outline" asChild>
                <Link to="/settings/invoice-templates"><FileText className="h-4 w-4 mr-1.5" /> Templates</Link>
              </Button>
            )}
            {(isSuperAdmin || canCreate("invoices")) && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Create Invoice
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by number, name or company..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All templates</SelectItem>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.entity_code} — {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(INVOICE_STATUS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No invoices yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Bill To</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv: any) => {
                      const meta = INVOICE_STATUS_META[inv.status as keyof typeof INVOICE_STATUS_META];
                      const tpl = inv.invoice_templates;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{inv.bill_to_name}</div>
                            {inv.bill_to_company && <div className="text-xs text-muted-foreground">{inv.bill_to_company}</div>}
                          </TableCell>
                          <TableCell>
                            {tpl ? (
                              <div className="flex items-center gap-2">
                                <div className="h-5 w-5 rounded" style={{ background: `linear-gradient(135deg, ${tpl.primary_color}, ${tpl.secondary_color})` }} />
                                <span className="text-xs">{tpl.entity_code}</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs">{format(new Date(inv.issue_date), "dd MMM yyyy")}</TableCell>
                          <TableCell className="text-xs">{inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "—"}</TableCell>
                          <TableCell className="text-right font-medium text-sm">{formatIDR(inv.total)}</TableCell>
                          <TableCell>
                            <Select value={inv.status} onValueChange={(v) => updateStatus.mutate({ id: inv.id, status: v })}>
                              <SelectTrigger className="h-7 w-[110px] text-xs">
                                <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(INVOICE_STATUS_META).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleDownload(inv)} disabled={downloading === inv.id}>
                              {downloading === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <CreateInvoiceDialog open={open} onOpenChange={setOpen} onSuccess={() => setOpen(false)} />
      </div>
    </AppLayout>
  );
}
