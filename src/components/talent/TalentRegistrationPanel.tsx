import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, ListChecks } from "lucide-react";
import { toast } from "sonner";

const PUBLIC_BASE = "https://ms.talco.id";

export function TalentRegistrationPanel() {
  const { data: forms, isLoading } = useQuery({
    queryKey: ["talent-registration-forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, name, slug, is_public, status, description")
        .eq("form_template", "talent")
        .neq("status", "archived")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link disalin");
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  if (!forms?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada form pendaftaran talent. Buat form baru di menu Forms dengan template "Talent Database".
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Bagikan link di bawah ini. Siapa pun bisa mengisi tanpa login — data diri, ukuran badan, foto, dan rate card
        akan otomatis masuk ke database talent.
      </p>
      {forms.map((f: any) => {
        const url = `${PUBLIC_BASE}/f/${f.slug}`;
        return (
          <div key={f.id} className="rounded-2xl border bg-card/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{f.name}</span>
              <Badge variant={f.is_public ? "default" : "secondary"}>
                {f.is_public ? "Publik" : "Private"}
              </Badge>
            </div>
            {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={url} className="font-mono text-xs" />
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => copy(url)} title="Copy link">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild title="Buka form">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="secondary" size="sm" asChild>
                  <a href={`/forms/${f.id}/responses`}>
                    <ListChecks className="mr-2 h-4 w-4" /> Responses
                  </a>
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
