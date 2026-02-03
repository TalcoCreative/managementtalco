import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, AlertCircle, Calendar, Building2 } from "lucide-react";
import { format } from "date-fns";

interface EditorialPlanItem {
  id: string;
  title: string;
  slug: string;
  period: string | null;
  created_at: string;
  slideStats: {
    total: number;
    approved: number;
  };
}

interface ClientData {
  id: string;
  name: string;
  company: string | null;
  dashboard_slug: string;
}

export default function PublicEditorialPlanList() {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const navigate = useNavigate();

  // Fetch client by dashboard_slug
  const { data: client, isLoading: clientLoading, error: clientError } = useQuery({
    queryKey: ["public-client-for-ep", clientSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, dashboard_slug")
        .eq("dashboard_slug", clientSlug)
        .eq("status", "active")
        .single();

      if (error) throw error;
      return data as ClientData;
    },
    enabled: !!clientSlug,
  });

  // Fetch editorial plans for this client
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["public-editorial-plans-list", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];

      const { data: eps, error } = await supabase
        .from("editorial_plans")
        .select("id, title, slug, period, created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get slide stats for each EP
      const plansWithStats = await Promise.all(
        eps.map(async (ep) => {
          const { data: slides } = await supabase
            .from("editorial_slides")
            .select("status")
            .eq("ep_id", ep.id);

          const total = slides?.length || 0;
          const approved = slides?.filter(s => s.status === "approved" || s.status === "published").length || 0;

          return {
            ...ep,
            slideStats: { total, approved },
          };
        })
      );

      return plansWithStats as EditorialPlanItem[];
    },
    enabled: !!client?.id,
  });

  if (clientLoading || plansLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (clientError || !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Client Tidak Ditemukan</h1>
          <p className="text-muted-foreground">Link tidak valid atau client sudah tidak aktif.</p>
        </div>
      </div>
    );
  }

  const getClientSlugForEP = () => {
    return client.name.toLowerCase().replace(/\s+/g, "-");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-purple-500 p-3">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Editorial Plans</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{client.name}</span>
                {client.company && <span>• {client.company}</span>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {plans && plans.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 group"
                onClick={() => navigate(`/ep/${getClientSlugForEP()}/${plan.slug}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg mb-2">{plan.title}</CardTitle>
                      {plan.period && (
                        <Badge variant="secondary">{plan.period}</Badge>
                      )}
                    </div>
                    <Badge
                      variant={plan.slideStats.approved === plan.slideStats.total && plan.slideStats.total > 0 ? "default" : "outline"}
                      className={plan.slideStats.approved === plan.slideStats.total && plan.slideStats.total > 0 ? "bg-green-500" : ""}
                    >
                      {plan.slideStats.approved}/{plan.slideStats.total}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(plan.created_at), "d MMM yyyy")}</span>
                  </div>
                  <Button variant="ghost" className="p-0 h-auto text-primary group-hover:translate-x-1 transition-transform">
                    Lihat Content <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Belum ada Editorial Plan
              </p>
              <p className="text-sm text-muted-foreground">
                Content plan akan muncul di sini setelah dibuat
              </p>
            </CardContent>
          </Card>
        )}

        {/* Back to Hub */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => navigate(`/hub/${clientSlug}`)}
          >
            Kembali ke Client Hub
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Powered by Talco Management System</p>
        </div>
      </main>
    </div>
  );
}
