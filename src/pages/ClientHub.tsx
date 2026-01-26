import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, BarChart3, Camera, Users, Building2, ArrowRight } from "lucide-react";

const ClientHub = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialClientId = searchParams.get("client") || "";
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId);

  // Fetch all active clients
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients-for-hub"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, status")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  const navigationCards = [
    {
      title: "Dashboard",
      description: "Lihat overview project, task, dan progress client",
      icon: LayoutDashboard,
      color: "bg-blue-500",
      route: "/dashboard",
      queryParam: "client",
    },
    {
      title: "Reports",
      description: "Lihat laporan analytics dan performa social media",
      icon: BarChart3,
      color: "bg-green-500",
      route: "/reports",
      queryParam: "client",
    },
    {
      title: "Shooting",
      description: "Kelola jadwal shooting dan produksi konten",
      icon: Camera,
      color: "bg-orange-500",
      route: "/shooting",
      queryParam: "client",
    },
    {
      title: "Meeting",
      description: "Kelola jadwal meeting dan koordinasi",
      icon: Users,
      color: "bg-purple-500",
      route: "/meeting",
      queryParam: "client",
    },
  ];

  const handleNavigate = (route: string, queryParam: string) => {
    if (!selectedClientId) return;
    navigate(`${route}?${queryParam}=${selectedClientId}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Client Hub</h1>
            <p className="text-muted-foreground">
              Akses cepat ke modul-modul berdasarkan client
            </p>
          </div>
        </div>

        {/* Client Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Pilih Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Pilih client..." />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} {client.company && `- ${client.company}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClient && (
              <p className="mt-2 text-sm text-muted-foreground">
                Client terpilih: <span className="font-medium text-foreground">{selectedClient.name}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Navigation Cards */}
        {selectedClientId ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {navigationCards.map((card) => (
              <Card
                key={card.title}
                className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
                onClick={() => handleNavigate(card.route, card.queryParam)}
              >
                <CardHeader className="pb-3">
                  <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {card.description}
                  </p>
                  <Button variant="ghost" className="p-0 h-auto text-primary">
                    Buka <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Pilih client terlebih dahulu
              </p>
              <p className="text-sm text-muted-foreground">
                Untuk mengakses modul-modul yang tersedia
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default ClientHub;
