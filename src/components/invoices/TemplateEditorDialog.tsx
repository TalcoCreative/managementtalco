import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceTemplate, PaymentMethod } from "@/lib/invoice-types";
import { Plus, Trash2, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: InvoiceTemplate | null; // null = create new
}

const ENTITY_OPTIONS = [
  { code: "TS", name: "Talco Studio" },
  { code: "TW", name: "TalcoWorld" },
  { code: "TCI", name: "Talco Creative Indonesia" },
];

const newMethod = (type: "bank" | "qris" | "other"): PaymentMethod => ({
  id: crypto.randomUUID(),
  type,
  label: type === "bank" ? "Bank Transfer" : type === "qris" ? "QRIS" : "Other",
  enabled: true,
  bank_name: "",
  account_name: "",
  account_number: "",
  qris_image_url: "",
  notes: "",
});

export function TemplateEditorDialog({ open, onOpenChange, template }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [entityCode, setEntityCode] = useState("TS");
  const [entityName, setEntityName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [taxId, setTaxId] = useState("");
  const [defaultNotes, setDefaultNotes] = useState("");
  const [defaultTerms, setDefaultTerms] = useState("");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setEntityCode(template.entity_code);
      setEntityName(template.entity_name);
      setLogoUrl(template.logo_url);
      setPrimaryColor(template.primary_color);
      setSecondaryColor(template.secondary_color);
      const ci = template.company_info || {};
      setAddress(ci.address || "");
      setEmail(ci.email || "");
      setPhone(ci.phone || "");
      setWebsite(ci.website || "");
      setTaxId(ci.tax_id || "");
      setDefaultNotes(template.default_notes || "");
      setDefaultTerms(template.default_terms || "");
      setMethods(template.payment_methods || []);
      setIsDefault(template.is_default);
    } else {
      setName("");
      setEntityCode("TS");
      setEntityName("");
      setLogoUrl(null);
      setPrimaryColor("#0ea5e9");
      setSecondaryColor("#0f172a");
      setAddress("");
      setEmail("");
      setPhone("");
      setWebsite("");
      setTaxId("");
      setDefaultNotes("");
      setDefaultTerms("");
      setMethods([newMethod("bank")]);
      setIsDefault(false);
    }
  }, [template, open]);

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `template-logos/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("invoice-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("invoice-assets").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const updateMethod = (id: string, patch: Partial<PaymentMethod>) =>
    setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMethod = (id: string) => setMethods((prev) => prev.filter((m) => m.id !== id));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !entityName.trim()) throw new Error("Name and entity name are required");
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        name,
        entity_code: entityCode,
        entity_name: entityName,
        logo_url: logoUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        company_info: { address, email, phone, website, tax_id: taxId },
        payment_methods: methods as any,
        default_notes: defaultNotes || null,
        default_terms: defaultTerms || null,
        is_default: isDefault,
        is_active: true,
      };

      if (template) {
        const { error } = await supabase.from("invoice_templates").update(payload).eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoice_templates").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }

      // If marking default, clear other defaults
      if (isDefault) {
        await supabase
          .from("invoice_templates")
          .update({ is_default: false })
          .neq("id", template?.id || "00000000-0000-0000-0000-000000000000")
          .eq("is_default", true);
      }
    },
    onSuccess: () => {
      toast.success(template ? "Template updated" : "Template created");
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
      qc.invalidateQueries({ queryKey: ["invoice-templates-admin"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "Create Template"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="branding" className="mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="company">Company Info</TabsTrigger>
            <TabsTrigger value="payment">Payment & Defaults</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Template Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Entity Code *</Label>
                <Select value={entityCode} onValueChange={(v) => {
                  setEntityCode(v);
                  const opt = ENTITY_OPTIONS.find((o) => o.code === v);
                  if (opt && !entityName) setEntityName(opt.name);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_OPTIONS.map((o) => (
                      <SelectItem key={o.code} value={o.code}>{o.code} — {o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Entity Name *</Label>
                <Input value={entityName} onChange={(e) => setEntityName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div className="h-20 w-20 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="logo" className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex gap-2">
                  <label>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                      <span>
                        {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                        Upload logo
                      </span>
                    </Button>
                  </label>
                  {logoUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Logo is rendered in a fixed container with object-contain to prevent distortion.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-16 p-1 h-11" />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-16 p-1 h-11" />
                  <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label>Default template</Label>
                <p className="text-xs text-muted-foreground">Pre-selected when creating new invoices.</p>
              </div>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          </TabsContent>

          <TabsContent value="company" className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tax ID (NPWP)</Label>
                <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payment" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Payment Methods</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMethods([...methods, newMethod("bank")])}>
                    <Plus className="h-3 w-3 mr-1" /> Bank
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setMethods([...methods, newMethod("qris")])}>
                    <Plus className="h-3 w-3 mr-1" /> QRIS
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setMethods([...methods, newMethod("other")])}>
                    <Plus className="h-3 w-3 mr-1" /> Other
                  </Button>
                </div>
              </div>

              {methods.map((m) => (
                <div key={m.id} className="rounded-xl border border-border/60 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="outline" className="text-[10px]">{m.type}</Badge>
                      <Input
                        placeholder="Label (e.g. BCA Main)"
                        value={m.label}
                        onChange={(e) => updateMethod(m.id, { label: e.target.value })}
                      />
                    </div>
                    <Switch checked={m.enabled} onCheckedChange={(c) => updateMethod(m.id, { enabled: c })} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeMethod(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {m.type === "bank" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input placeholder="Bank name" value={m.bank_name || ""} onChange={(e) => updateMethod(m.id, { bank_name: e.target.value })} />
                      <Input placeholder="Account number" value={m.account_number || ""} onChange={(e) => updateMethod(m.id, { account_number: e.target.value })} />
                      <Input placeholder="Account name" value={m.account_name || ""} onChange={(e) => updateMethod(m.id, { account_name: e.target.value })} />
                    </div>
                  )}
                  {m.type !== "bank" && (
                    <Textarea rows={2} placeholder="Notes / instructions" value={m.notes || ""} onChange={(e) => updateMethod(m.id, { notes: e.target.value })} />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Default Notes</Label>
              <Textarea rows={2} value={defaultNotes} onChange={(e) => setDefaultNotes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Default Terms</Label>
              <Textarea rows={2} value={defaultTerms} onChange={(e) => setDefaultTerms(e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-4 border-t border-border/40">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {template ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
