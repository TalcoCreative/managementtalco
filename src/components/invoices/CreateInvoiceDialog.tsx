import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TemplateSelector } from "./TemplateSelector";
import { useInvoiceTemplates } from "@/hooks/useInvoiceTemplates";
import { InvoiceTemplate, InvoiceItem, formatIDR, PaymentMethod } from "@/lib/invoice-types";
import { Plus, Trash2, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}

const emptyItem = (): InvoiceItem => ({ description: "", quantity: 1, unit_price: 0, amount: 0 });

export function CreateInvoiceDialog({ open, onOpenChange, onSuccess }: Props) {
  const qc = useQueryClient();
  const { data: templates = [] } = useInvoiceTemplates();
  const [tab, setTab] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);

  // Custom branding overrides (Custom Template mode)
  const [useCustom, setUseCustom] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Form fields
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [billToName, setBillToName] = useState("");
  const [billToCompany, setBillToCompany] = useState("");
  const [billToAddress, setBillToAddress] = useState("");
  const [billToEmail, setBillToEmail] = useState("");
  const [billToPhone, setBillToPhone] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [enabledMethodIds, setEnabledMethodIds] = useState<string[]>([]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-invoice"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, company, email, phone").order("name");
      return data || [];
    },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-invoice"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, title").order("title");
      return data || [];
    },
  });

  // When template selected, pre-fill defaults
  useEffect(() => {
    if (!selectedTemplate) return;
    setNotes(selectedTemplate.default_notes || "");
    setTerms(selectedTemplate.default_terms || "");
    const enabled = (selectedTemplate.payment_methods || []).filter((m) => m.enabled).map((m) => m.id);
    setEnabledMethodIds(enabled);
  }, [selectedTemplate]);

  // Auto-fill bill-to when client selected
  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x: any) => x.id === clientId);
    if (c) {
      if (!billToName) setBillToName(c.name || "");
      if (!billToCompany && c.company) setBillToCompany(c.company);
      if (!billToEmail && c.email) setBillToEmail(c.email);
      if (!billToPhone && c.phone) setBillToPhone(c.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0),
    [items]
  );
  const taxAmount = useMemo(
    () => Math.round(((subtotal - (Number(discount) || 0)) * (Number(taxPercent) || 0)) / 100),
    [subtotal, discount, taxPercent]
  );
  const total = subtotal - (Number(discount) || 0) + taxAmount;

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      next[idx].amount = (Number(next[idx].quantity) || 0) * (Number(next[idx].unit_price) || 0);
      return next;
    });
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const path = `invoice-logos/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("invoice-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("invoice-assets").getPublicUrl(path);
      setCustomLogo(data.publicUrl);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const reset = () => {
    setSelectedTemplate(null);
    setUseCustom(false);
    setCustomLogo(null);
    setClientId("");
    setProjectId("");
    setBillToName("");
    setBillToCompany("");
    setBillToAddress("");
    setBillToEmail("");
    setBillToPhone("");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setItems([emptyItem()]);
    setTaxPercent(0);
    setDiscount(0);
    setNotes("");
    setTerms("");
    setEnabledMethodIds([]);
    setTab("template");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error("Select a template");
      if (!billToName.trim()) throw new Error("Bill To name is required");
      if (items.length === 0 || items.every((i) => !i.description.trim())) throw new Error("Add at least one item");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const now = new Date(issueDate);
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      // Get next number from letters numbering
      const { data: nextNumber, error: numErr } = await supabase.rpc("get_next_letter_number", {
        p_entity_code: selectedTemplate.entity_code,
        p_category_code: "FIN",
        p_year: year,
        p_month: month,
      });
      if (numErr) throw numErr;

      const monthStr = month.toString().padStart(2, "0");
      const runStr = String(nextNumber).padStart(3, "0");
      const invoiceNumber = `${selectedTemplate.entity_code}/FIN/INVOICE/${monthStr}/${year}/${runStr}`;

      // Create letter record (so it appears in Letters too)
      const { data: letter, error: letterErr } = await supabase
        .from("letters")
        .insert({
          letter_number: invoiceNumber,
          entity_code: selectedTemplate.entity_code,
          entity_name: selectedTemplate.entity_name,
          category_code: "FIN",
          category_name: "Finance",
          project_label: "INVOICE",
          project_id: projectId || null,
          recipient_name: billToName,
          recipient_company: billToCompany || null,
          notes: `Invoice - ${formatIDR(total)}`,
          created_by: user.id,
          running_number: nextNumber,
          year,
          month,
          status: "draft",
          is_confidential: false,
        })
        .select()
        .single();
      if (letterErr) throw letterErr;

      const snapshot = useCustom ? { ...selectedTemplate, logo_url: customLogo || selectedTemplate.logo_url } : selectedTemplate;

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          letter_id: letter.id,
          template_id: selectedTemplate.id,
          template_snapshot: snapshot as any,
          custom_logo_url: useCustom ? customLogo : null,
          client_id: clientId || null,
          project_id: projectId || null,
          bill_to_name: billToName,
          bill_to_company: billToCompany || null,
          bill_to_address: billToAddress || null,
          bill_to_email: billToEmail || null,
          bill_to_phone: billToPhone || null,
          items: items.filter((i) => i.description.trim()) as any,
          subtotal,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
          discount_amount: discount,
          total,
          status: "draft",
          issue_date: issueDate,
          due_date: dueDate || null,
          notes: notes || null,
          terms: terms || null,
          enabled_payment_method_ids: enabledMethodIds as any,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("invoice_activity_logs").insert({
        invoice_id: invoice.id,
        action: "created",
        description: `Invoice ${invoiceNumber} created`,
        changed_by: user.id,
      });

      return invoice;
    },
    onSuccess: () => {
      toast.success("Invoice created");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["letters"] });
      reset();
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Failed to create invoice"),
  });

  const activeMethods: PaymentMethod[] = (selectedTemplate?.payment_methods || []).filter((m) => m.enabled);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="template">1. Template</TabsTrigger>
            <TabsTrigger value="details" disabled={!selectedTemplate}>2. Invoice Details</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm">Select branding template *</Label>
              <p className="text-xs text-muted-foreground mb-3">
                The template controls logo, colors, company info, and default payment methods.
              </p>
              <TemplateSelector
                templates={templates}
                selectedId={selectedTemplate?.id || null}
                onSelect={(t) => setSelectedTemplate(t)}
              />
            </div>

            {selectedTemplate && (
              <div className="rounded-xl border border-border/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Custom branding</Label>
                    <p className="text-xs text-muted-foreground">Override the logo for this invoice only.</p>
                  </div>
                  <Checkbox checked={useCustom} onCheckedChange={(c) => setUseCustom(!!c)} />
                </div>

                {useCustom && (
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden">
                      {customLogo ? (
                        <img src={customLogo} alt="Logo" className="h-full w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                        />
                        <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} asChild>
                          <span>
                            {uploadingLogo ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                            Upload logo
                          </span>
                        </Button>
                      </label>
                      {customLogo && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setCustomLogo(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setTab("details")} disabled={!selectedTemplate}>
                Continue →
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-5 mt-4">
            {/* Client / Project */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client (optional)</Label>
                <SearchableSelect
                  options={(clients as any[]).map((c) => ({ value: c.id, label: c.name }))}
                  value={clientId || "none"}
                  onValueChange={(v) => setClientId(v === "none" ? "" : v)}
                  placeholder="Select client"
                  searchPlaceholder="Search clients..."
                  defaultOption={{ value: "none", label: "No client" }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Project (optional)</Label>
                <SearchableSelect
                  options={(projects as any[]).map((p) => ({ value: p.id, label: p.title }))}
                  value={projectId || "none"}
                  onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
                  placeholder="Select project"
                  searchPlaceholder="Search projects..."
                  defaultOption={{ value: "none", label: "No project" }}
                />
              </div>
            </div>

            {/* Bill To */}
            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <h4 className="text-sm font-semibold">Bill To</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={billToName} onChange={(e) => setBillToName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Input value={billToCompany} onChange={(e) => setBillToCompany(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={billToEmail} onChange={(e) => setBillToEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={billToPhone} onChange={(e) => setBillToPhone(e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Address</Label>
                  <Textarea rows={2} value={billToAddress} onChange={(e) => setBillToAddress(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issue Date *</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            {/* Items */}
            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Line Items</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, emptyItem()])}>
                  <Plus className="h-3 w-3 mr-1" /> Add item
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                    <Input
                      className="col-span-12 sm:col-span-6"
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                    />
                    <Input
                      className="col-span-3 sm:col-span-1"
                      type="number"
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    />
                    <Input
                      className="col-span-4 sm:col-span-2"
                      type="number"
                      placeholder="Unit Price"
                      value={it.unit_price}
                      onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                    />
                    <div className="col-span-4 sm:col-span-2 text-sm font-medium pt-2.5 text-right">
                      {formatIDR(it.amount)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="col-span-1"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/40">
                <div className="space-y-1.5">
                  <Label>Discount (IDR)</Label>
                  <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tax (%)</Label>
                  <Input type="number" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} />
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>- {formatIDR(discount)}</span></div>}
                {taxPercent > 0 && <div className="flex justify-between text-muted-foreground"><span>Tax ({taxPercent}%)</span><span>{formatIDR(taxAmount)}</span></div>}
                <div className="flex justify-between font-semibold pt-1 border-t border-border/40"><span>Total</span><span>{formatIDR(total)}</span></div>
              </div>
            </div>

            {/* Payment methods */}
            {activeMethods.length > 0 && (
              <div className="rounded-xl border border-border/60 p-4 space-y-3">
                <h4 className="text-sm font-semibold">Payment Methods</h4>
                <p className="text-xs text-muted-foreground">Toggle which methods appear on this invoice.</p>
                {activeMethods.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/40">
                    <Checkbox
                      checked={enabledMethodIds.includes(m.id)}
                      onCheckedChange={(c) =>
                        setEnabledMethodIds(c ? [...enabledMethodIds, m.id] : enabledMethodIds.filter((x) => x !== m.id))
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{m.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{m.type}</Badge>
                      </div>
                      {m.type === "bank" && (
                        <p className="text-xs text-muted-foreground">
                          {[m.bank_name, m.account_number, m.account_name].filter(Boolean).join(" • ") || "—"}
                        </p>
                      )}
                      {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Terms & Conditions</Label>
                <Textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-4 border-t border-border/40">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !selectedTemplate}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
