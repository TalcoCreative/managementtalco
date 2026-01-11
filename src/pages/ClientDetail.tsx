import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ArrowLeft, Building2, ChevronDown, FileText, CreditCard, 
  Package, Lock, FolderOpen, Activity, Calendar, Users, CheckCircle2, Share2
} from "lucide-react";
import { ClientOverviewSection } from "@/components/clients/sections/ClientOverviewSection";
import { ClientContractSection } from "@/components/clients/sections/ClientContractSection";
import { ClientPaymentSection } from "@/components/clients/sections/ClientPaymentSection";
import { ClientQuotaSection } from "@/components/clients/sections/ClientQuotaSection";
import { ClientAccountSection } from "@/components/clients/sections/ClientAccountSection";
import { ClientDocumentSection } from "@/components/clients/sections/ClientDocumentSection";
import { ClientProjectTaskSection } from "@/components/clients/sections/ClientProjectTaskSection";
import { ClientActivitySection } from "@/components/clients/sections/ClientActivitySection";
import { ClientSocialMediaSection } from "@/components/clients/sections/ClientSocialMediaSection";

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
    contract: true,
    payment: true,
    quota: true,
    accounts: false,
    documents: true,
    projects: true,
    activity: false,
  });

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: userRole, isLoading: loadingRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id)
        .single();
      
      return data?.role;
    },
  });

  const isSuperAdmin = userRole === "super_admin";
  const canEditSensitive = isSuperAdmin;
  const canView = isSuperAdmin;

  // Only super_admin can access client detail
  if (!loadingRole && !isSuperAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Anda tidak memiliki akses ke halaman ini</p>
          <Button variant="link" onClick={() => navigate("/")}>
            Kembali ke dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Client tidak ditemukan</p>
          <Button variant="link" onClick={() => navigate("/clients")}>
            Kembali ke daftar client
          </Button>
        </div>
      </AppLayout>
    );
  }

  const sections = [
    { id: "overview", title: "Overview", icon: Building2, component: ClientOverviewSection, superAdminOnly: false },
    { id: "contract", title: "Kontrak", icon: FileText, component: ClientContractSection, superAdminOnly: true },
    { id: "payment", title: "Pembayaran", icon: CreditCard, component: ClientPaymentSection, superAdminOnly: true },
    { id: "quota", title: "Kuota & Pemakaian", icon: Package, component: ClientQuotaSection, superAdminOnly: false },
    { id: "accounts", title: "Data Akun Client", icon: Lock, component: ClientAccountSection, sensitive: true, superAdminOnly: true },
    { id: "documents", title: "Dokumen", icon: FolderOpen, component: ClientDocumentSection, superAdminOnly: true },
    { id: "projects", title: "Project & Task", icon: CheckCircle2, component: ClientProjectTaskSection, superAdminOnly: false },
    { id: "socialmedia", title: "Social Media Activity", icon: Share2, component: ClientSocialMediaSection, superAdminOnly: false },
    { id: "activity", title: "Activity Log", icon: Activity, component: ClientActivitySection },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b pb-4 -mx-6 px-6 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-primary p-2">
                  <Building2 className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{client.name}</h1>
                  {client.company && (
                    <p className="text-sm text-muted-foreground">{client.company}</p>
                  )}
                </div>
              </div>
            </div>
            <Badge 
              variant={client.status === "active" ? "default" : "secondary"}
              className="text-sm px-3 py-1"
            >
              {client.status}
            </Badge>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map(({ id, title, icon: Icon, component: Component, sensitive, superAdminOnly }) => {
            // Skip sections based on permissions
            if (sensitive && !canEditSensitive) return null;
            if (superAdminOnly && !isSuperAdmin) return null;

            return (
              <Collapsible
                key={id}
                open={openSections[id]}
                onOpenChange={() => toggleSection(id)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{title}</CardTitle>
                          {sensitive && (
                            <Badge variant="outline" className="text-xs">
                              Confidential
                            </Badge>
                          )}
                        </div>
                        <ChevronDown 
                          className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                            openSections[id] ? "rotate-180" : ""
                          }`} 
                        />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <Component 
                        clientId={clientId!} 
                        client={client}
                        canEdit={sensitive ? canEditSensitive : true}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
