import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface EmbedCodeDialogProps {
  formId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmbedCodeDialog({
  formId,
  open,
  onOpenChange,
}: EmbedCodeDialogProps) {
  const { data: form } = useQuery({
    queryKey: ["recruitment-form", formId],
    queryFn: async () => {
      if (!formId) return null;
      const { data, error } = await supabase
        .from("recruitment_forms")
        .select("*")
        .eq("id", formId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });

  if (!form) return null;

  const shortDomain = "https://ms.talco.id";
  const publicUrl = `${shortDomain}/apply/${form.slug}`;
  const baseUrl = window.location.origin;
  
  const iframeCode = `<iframe 
  src="${publicUrl}"
  width="100%" 
  height="800" 
  frameborder="0" 
  style="border: none; min-height: 600px;">
</iframe>`;

  const scriptCode = `<div id="talco-recruitment-form" data-form="${form.slug}"></div>
<script src="${baseUrl}/embed.js" async></script>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Embed Form: {form.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">Direct Link</TabsTrigger>
            <TabsTrigger value="iframe">Iframe</TabsTrigger>
            <TabsTrigger value="script">Script</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Bagikan link ini langsung ke pelamar:
              </p>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-muted rounded-md text-sm break-all">
                  {publicUrl}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(publicUrl, "Link")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(publicUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="iframe" className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Embed form menggunakan iframe. Cocok untuk kebanyakan website.
              </p>
              <div className="relative">
                <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto">
                  {iframeCode}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(iframeCode, "Iframe code")}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="script" className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Embed dengan script untuk integrasi yang lebih fleksibel.
              </p>
              <div className="relative">
                <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto">
                  {scriptCode}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(scriptCode, "Script code")}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
