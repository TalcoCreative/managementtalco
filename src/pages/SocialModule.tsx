import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Share2, Users, PenSquare, BarChart3, Settings } from "lucide-react";
import { useSocialModuleConfig } from "@/hooks/useSocialModule";
import { SocialAccountsTab } from "@/components/social-module/SocialAccountsTab";
import { SocialCreatePostTab } from "@/components/social-module/SocialCreatePostTab";
import { SocialAnalyticsTab } from "@/components/social-module/SocialAnalyticsTab";
import { useNavigate } from "react-router-dom";

export default function SocialModule() {
  const [activeTab, setActiveTab] = useState("accounts");
  const { config, updateConfig } = useSocialModuleConfig();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div
            className="section-header !mb-0 flex-1"
            style={{ "--section-color": "var(--section-social)" } as React.CSSProperties}
          >
            <div className="section-icon">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="section-title">Social Media Management</h1>
              <p className="section-subtitle">
                Connect accounts, create posts, and track analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl px-4 py-2.5">
              <Label htmlFor="mode-toggle" className="text-xs font-medium text-muted-foreground">
                Mode
              </Label>
              <Badge
                variant={config.mode === "dummy" ? "secondary" : "default"}
                className={
                  config.mode === "dummy"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                }
              >
                {config.mode === "dummy" ? "Demo" : "Live"}
              </Badge>
              <Switch
                id="mode-toggle"
                checked={config.mode === "live"}
                onCheckedChange={(checked) =>
                  updateConfig({ mode: checked ? "live" : "dummy" })
                }
              />
            </div>

            <Button variant="outline" onClick={() => navigate("/social-media/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="create-post" className="flex items-center gap-2">
              <PenSquare className="h-4 w-4" />
              Create Post
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="mt-6">
            <SocialAccountsTab />
          </TabsContent>

          <TabsContent value="create-post" className="mt-6">
            <SocialCreatePostTab onPostCreated={() => setActiveTab("analytics")} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <SocialAnalyticsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
