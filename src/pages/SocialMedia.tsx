import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SocialMediaPostForm } from "@/components/social-media/SocialMediaPostForm";
import { SocialMediaDashboard } from "@/components/social-media/SocialMediaDashboard";
import { SocialMediaAccounts } from "@/components/social-media/SocialMediaAccounts";
import { SocialMediaAnalytics } from "@/components/social-media/SocialMediaAnalytics";
import { Share2, Settings } from "lucide-react";

export default function SocialMedia() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Share2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Social Media Management</h1>
              <p className="text-muted-foreground">
                Post, schedule, dan monitor konten social media
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/social-media/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="post">Buat Post</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="accounts">Akun Terhubung</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <SocialMediaDashboard onCreatePost={() => setActiveTab("post")} />
          </TabsContent>

          <TabsContent value="post" className="mt-6">
            <SocialMediaPostForm />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <SocialMediaAnalytics />
          </TabsContent>

          <TabsContent value="accounts" className="mt-6">
            <SocialMediaAccounts />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
