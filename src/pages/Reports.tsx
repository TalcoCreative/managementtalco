import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformAccountsTab } from "@/components/reports/PlatformAccountsTab";
import { OrganicReportsTab } from "@/components/reports/OrganicReportsTab";
import { AdsReportsTab } from "@/components/reports/AdsReportsTab";
import { ClientAnalyticsDashboard } from "@/components/reports/ClientAnalyticsDashboard";
import { AuditLogsTab } from "@/components/reports/AuditLogsTab";
import { MarketplaceReportsTab } from "@/components/reports/MarketplaceReportsTab";
import { Button } from "@/components/ui/button";
import {
  Users,
  FileText,
  DollarSign,
  History,
  Building2,
  ShoppingBag,
  FileCheck,
} from "lucide-react";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("client-analytics");
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="section-header !mb-0 flex-1" style={{ '--section-color': 'var(--section-reports)' } as React.CSSProperties}>
            <div className="section-icon">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="section-title">Reports</h1>
              <p className="section-subtitle">Multi-platform social media & marketplace reporting system</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/reports/published-content")}
            className="gap-2"
          >
            <FileCheck className="h-4 w-4" />
            Published Content
          </Button>
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
            <TabsTrigger value="marketplace" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Marketplace</span>
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

          <TabsContent value="marketplace" className="mt-4">
            <MarketplaceReportsTab />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditLogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
