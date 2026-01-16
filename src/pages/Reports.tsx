import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformAccountsTab } from "@/components/reports/PlatformAccountsTab";
import { OrganicReportsTab } from "@/components/reports/OrganicReportsTab";
import { AdsReportsTab } from "@/components/reports/AdsReportsTab";
import { ClientAnalyticsDashboard } from "@/components/reports/ClientAnalyticsDashboard";
import { AuditLogsTab } from "@/components/reports/AuditLogsTab";
import {
  BarChart3,
  Users,
  FileText,
  DollarSign,
  History,
  Building2,
} from "lucide-react";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("client-analytics");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Multi-platform social media reporting system
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="client-analytics" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Client Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="organic" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Organic</span>
            </TabsTrigger>
            <TabsTrigger value="ads" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Ads</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client-analytics" className="mt-4">
            <ClientAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="accounts" className="mt-4">
            <PlatformAccountsTab />
          </TabsContent>

          <TabsContent value="organic" className="mt-4">
            <OrganicReportsTab />
          </TabsContent>

          <TabsContent value="ads" className="mt-4">
            <AdsReportsTab />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditLogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
