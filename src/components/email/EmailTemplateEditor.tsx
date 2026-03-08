import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Eye, Code, Mail, Info, RefreshCw } from "lucide-react";

interface EmailTemplate {
  id: string;
  notification_type: string;
  label: string;
  subject_template: string;
  main_message: string;
  footer_message: string;
  button_text: string;
  body_html: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const VARIABLE_HINTS = [
  { var: "{{firstName}}", desc: "Nama depan penerima" },
  { var: "{{label}}", desc: "Jenis notifikasi (Task, Meeting, dll)" },
  { var: "{{title}}", desc: "Judul item" },
  { var: "{{description}}", desc: "Deskripsi" },
  { var: "{{deadline}}", desc: "Tanggal / Deadline" },
  { var: "{{creator_name}}", desc: "Nama pengirim / pembuat" },
  { var: "{{status}}", desc: "Status saat ini" },
  { var: "{{priority}}", desc: "Level prioritas" },
  { var: "{{location}}", desc: "Lokasi" },
  { var: "{{participants}}", desc: "Daftar peserta" },
  { var: "{{link}}", desc: "URL tombol aksi" },
  { var: "{{comment_content}}", desc: "Isi komentar (untuk mention)" },
  { var: "{{updated_at}}", desc: "Waktu update" },
];

const CATEGORY_COLORS: Record<string, string> = {
  task: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  project: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  shooting: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  event: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  meeting: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  announcement: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  recruitment: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

const getCategory = (type: string): string => {
  if (type.startsWith("task")) return "task";
  if (type.startsWith("project")) return "project";
  if (type.startsWith("shooting")) return "shooting";
  if (type.startsWith("event")) return "event";
  if (type.startsWith("meeting")) return "meeting";
  if (type.startsWith("announcement")) return "announcement";
  if (type.startsWith("recruitment")) return "recruitment";
  return "task";
};

const buildPreviewHtml = (template: EmailTemplate): string => {
  if (template.body_html) {
    return template.body_html
      .replace(/\{\{firstName\}\}/g, "John")
      .replace(/\{\{label\}\}/g, template.label)
      .replace(/\{\{title\}\}/g, "Contoh Judul Item")
      .replace(/\{\{description\}\}/g, "Ini adalah deskripsi contoh.")
      .replace(/\{\{deadline\}\}/g, "15 Maret 2026 14:00")
      .replace(/\{\{creator_name\}\}/g, "Admin Talco")
      .replace(/\{\{status\}\}/g, "In Progress")
      .replace(/\{\{priority\}\}/g, "High")
      .replace(/\{\{location\}\}/g, "Kantor Talco")
      .replace(/\{\{participants\}\}/g, "John, Jane, Admin")
      .replace(/\{\{link\}\}/g, "#")
      .replace(/\{\{comment_content\}\}/g, "Ini komentar contoh")
      .replace(/\{\{updated_at\}\}/g, "8 Maret 2026 10:00");
  }

  const subject = template.subject_template.replace(/\{\{firstName\}\}/g, "John");
  const mainMsg = template.main_message.replace(/\{\{firstName\}\}/g, "John");
  const footer = template.footer_message.replace(/\{\{firstName\}\}/g, "John");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Talco System</h1>
    </div>
    <p style="font-size: 18px; color: #333;">Halo @John 👋</p>
    <p style="color: #555; font-size: 16px;">${mainMsg}</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 8px 0;"><strong>📌 Jenis:</strong> ${template.label}</p>
      <p style="margin: 8px 0;"><strong>📝 Judul:</strong> Contoh Judul Item</p>
      <p style="margin: 8px 0;"><strong>📅 Deadline:</strong> 15 Maret 2026 14:00</p>
      <p style="margin: 8px 0;"><strong>👤 Dari:</strong> Admin Talco</p>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <a href="#" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">${template.button_text}</a>
    </div>
    <p style="color: #555; font-style: italic;">${footer}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <div style="text-align: center;">
      <p style="color: #2563eb; font-weight: bold; margin: 0;">— Talco System</p>
      <p style="color: #888; font-size: 14px; margin: 8px 0 0 0;">Biar kerjaan rapi & tim makin enak kerjanya ✨</p>
    </div>
  </div>
</body></html>`;
};

const EmailTemplateEditor = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [editTab, setEditTab] = useState("basic");
  const [showCustomHtml, setShowCustomHtml] = useState(false);

  // Form states
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [mainMessage, setMainMessage] = useState("");
  const [footerMessage, setFooterMessage] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("notification_type");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const openEditor = (template: EmailTemplate) => {
    setEditTemplate(template);
    setSubjectTemplate(template.subject_template);
    setMainMessage(template.main_message);
    setFooterMessage(template.footer_message);
    setButtonText(template.button_text);
    setBodyHtml(template.body_html || "");
    setIsActive(template.is_active);
    setShowCustomHtml(!!template.body_html);
    setEditTab("basic");
  };

  const handleSave = async () => {
    if (!editTemplate) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject_template: subjectTemplate,
          main_message: mainMessage,
          footer_message: footerMessage,
          button_text: buttonText,
          body_html: showCustomHtml && bodyHtml.trim() ? bodyHtml.trim() : null,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editTemplate.id);

      if (error) throw error;

      toast({ title: "Berhasil", description: `Template "${editTemplate.label}" berhasil disimpan` });
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      setEditTemplate(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currentPreview = editTemplate
    ? buildPreviewHtml({
        ...editTemplate,
        subject_template: subjectTemplate,
        main_message: mainMessage,
        footer_message: footerMessage,
        button_text: buttonText,
        body_html: showCustomHtml && bodyHtml.trim() ? bodyHtml.trim() : null,
        is_active: isActive,
      })
    : "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Variable hints */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Variabel yang Tersedia
          </CardTitle>
          <CardDescription>Gunakan variabel berikut di subject & pesan. Akan otomatis diganti saat email dikirim.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {VARIABLE_HINTS.map((v) => (
              <Badge key={v.var} variant="outline" className="font-mono text-xs cursor-help" title={v.desc}>
                {v.var}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates?.map((template) => {
          const cat = getCategory(template.notification_type);
          return (
            <Card
              key={template.id}
              className={`cursor-pointer hover:shadow-md transition-all ${!template.is_active ? "opacity-50" : ""}`}
              onClick={() => openEditor(template)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Badge className={CATEGORY_COLORS[cat] || ""}>{template.label}</Badge>
                    {template.body_html && (
                      <Badge variant="outline" className="ml-1 text-[10px]">Custom HTML</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!template.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium truncate">{template.subject_template}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.main_message}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={(open) => !open && setEditTemplate(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Edit Template: {editTemplate?.label}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={editTab} onValueChange={setEditTab}>
            <TabsList className="w-full">
              <TabsTrigger value="basic" className="flex-1">✏️ Edit Konten</TabsTrigger>
              <TabsTrigger value="html" className="flex-1">🧑‍💻 Custom HTML</TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">👁️ Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>Status Aktif</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="space-y-2">
                <Label>Subject Email</Label>
                <Input
                  value={subjectTemplate}
                  onChange={(e) => setSubjectTemplate(e.target.value)}
                  placeholder="Hi @{{firstName}} – ..."
                />
                <p className="text-xs text-muted-foreground">Gunakan {"{{firstName}}"} untuk nama depan penerima</p>
              </div>

              <div className="space-y-2">
                <Label>Pesan Utama</Label>
                <Textarea
                  value={mainMessage}
                  onChange={(e) => setMainMessage(e.target.value)}
                  placeholder="Ada update baru buat lo nih:"
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">Teks pembuka sebelum detail item ditampilkan</p>
              </div>

              <div className="space-y-2">
                <Label>Teks Tombol</Label>
                <Input
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="🔗 Cek detailnya di sini"
                />
              </div>

              <div className="space-y-2">
                <Label>Footer Message</Label>
                <Textarea
                  value={footerMessage}
                  onChange={(e) => setFooterMessage(e.target.value)}
                  placeholder="Kalau ini penting, jangan di-skip ya 😎"
                  className="min-h-[60px]"
                />
              </div>
            </TabsContent>

            <TabsContent value="html" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Gunakan Custom HTML</Label>
                  <p className="text-xs text-muted-foreground">Override seluruh template email dengan HTML kustom</p>
                </div>
                <Switch checked={showCustomHtml} onCheckedChange={setShowCustomHtml} />
              </div>

              {showCustomHtml && (
                <div className="space-y-2">
                  <Label>HTML Email Body</Label>
                  <Textarea
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    placeholder="<!DOCTYPE html><html>..."
                    className="min-h-[400px] font-mono text-xs"
                    style={{ resize: "vertical" }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLE_HINTS.map((v) => (
                      <button
                        key={v.var}
                        type="button"
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted hover:bg-muted/80 border"
                        onClick={() => setBodyHtml((prev) => prev + v.var)}
                        title={v.desc}
                      >
                        {v.var}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!showCustomHtml && (
                <div className="p-8 text-center text-muted-foreground border rounded-lg">
                  <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Custom HTML dinonaktifkan.</p>
                  <p className="text-sm">Template menggunakan layout standar dengan konten dari tab "Edit Konten".</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <div className="p-3 border-b bg-muted/50 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm font-medium">Preview Email</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    Subject: {subjectTemplate.replace(/\{\{firstName\}\}/g, "John")}
                  </Badge>
                </div>
                <iframe
                  srcDoc={currentPreview}
                  className="w-full border-0"
                  style={{ height: 600 }}
                  title="Email Preview"
                  sandbox=""
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplateEditor;
