import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getSocialModuleConfig,
  setSocialModuleConfig,
  SocialModuleConfig,
  SocialModuleMode,
} from "@/lib/social-module-config";
import { toast } from "sonner";

export function useSocialModuleConfig() {
  const [config, setConfig] = useState<SocialModuleConfig>(getSocialModuleConfig);

  useEffect(() => {
    const handler = (e: Event) => setConfig((e as CustomEvent).detail);
    window.addEventListener("social-module-config-change", handler);
    return () => window.removeEventListener("social-module-config-change", handler);
  }, []);

  const updateConfig = useCallback((updates: Partial<SocialModuleConfig>) => {
    const updated = setSocialModuleConfig(updates);
    setConfig(updated);
  }, []);

  return { config, updateConfig };
}

// ─── Accounts ────────────────────────────────────────────
export function useSocialAccounts() {
  const { config } = useSocialModuleConfig();
  const qc = useQueryClient();
  const table = config.mode === "dummy" ? "sm_dummy_accounts" : "social_media_accounts";

  const query = useQuery({
    queryKey: ["social-accounts", config.mode],
    queryFn: async () => {
      if (config.mode === "dummy") {
        const { data, error } = await supabase
          .from("sm_dummy_accounts")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("social_media_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const connectAccount = useMutation({
    mutationFn: async (params: { platform: string; accountName: string }) => {
      if (config.mode === "live") {
        // Placeholder for real OAuth - would redirect to Meta OAuth
        toast.info("Live mode: OAuth integration pending. Please configure Meta Graph API.");
        return null;
      }
      // Dummy mode: instant connect
      const { data, error } = await supabase.from("sm_dummy_accounts").insert({
        platform: params.platform,
        account_name: params.accountName,
        page_id: `page_${Date.now()}`,
        ig_user_id: params.platform === "instagram" ? `ig_${Date.now()}` : null,
        access_token: `dummy_token_${Date.now()}`,
        status: "connected",
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(params.accountName)}&background=${params.platform === "instagram" ? "E1306C" : "1877F2"}&color=fff`,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-accounts"] });
      toast.success("Account connected successfully!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectAccount = useMutation({
    mutationFn: async (id: string) => {
      if (config.mode === "dummy") {
        const { error } = await supabase.from("sm_dummy_accounts").update({ status: "disconnected" }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("social_media_accounts").update({ is_connected: false }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-accounts"] });
      toast.success("Account disconnected");
    },
  });

  return { ...query, connectAccount, disconnectAccount };
}

// ─── Posts ────────────────────────────────────────────────
export function useSocialPosts() {
  const { config } = useSocialModuleConfig();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["social-posts", config.mode],
    queryFn: async () => {
      if (config.mode === "dummy") {
        const { data, error } = await supabase
          .from("sm_dummy_posts")
          .select("*, sm_dummy_accounts(account_name, platform, avatar_url)")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("social_media_posts")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createPost = useMutation({
    mutationFn: async (params: {
      accountId: string;
      caption: string;
      imageUrl: string;
      scheduledTime?: string;
      platform: string;
    }) => {
      if (config.mode === "live") {
        toast.info("Live mode: Post creation via Meta Graph API pending configuration.");
        return null;
      }
      const isImmediate = !params.scheduledTime || new Date(params.scheduledTime) <= new Date();
      const { data, error } = await supabase.from("sm_dummy_posts").insert({
        account_id: params.accountId,
        caption: params.caption,
        image_url: params.imageUrl,
        scheduled_time: params.scheduledTime || new Date().toISOString(),
        status: isImmediate ? "published" : "scheduled",
        platform: params.platform,
      }).select().single();
      if (error) throw error;

      // Auto-generate analytics for published posts
      if (isImmediate && data) {
        await supabase.from("sm_dummy_analytics").insert({
          account_id: params.accountId,
          post_id: data.id,
          impressions: Math.floor(Math.random() * 9500) + 500,
          reach: Math.floor(Math.random() * 4800) + 200,
          engagement: Math.floor(Math.random() * 950) + 50,
          likes: Math.floor(Math.random() * 700) + 30,
          comments: Math.floor(Math.random() * 150) + 5,
          shares: Math.floor(Math.random() * 100) + 3,
        });
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-posts"] });
      qc.invalidateQueries({ queryKey: ["social-analytics"] });
      toast.success("Post created successfully!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, createPost };
}

// ─── Analytics ───────────────────────────────────────────
export function useSocialAnalytics(accountFilter?: string) {
  const { config } = useSocialModuleConfig();

  return useQuery({
    queryKey: ["social-analytics", config.mode, accountFilter],
    queryFn: async () => {
      if (config.mode === "dummy") {
        let q = supabase
          .from("sm_dummy_analytics")
          .select("*, sm_dummy_posts(caption, image_url, status, platform, created_at), sm_dummy_accounts(account_name, platform)")
          .order("date", { ascending: false });
        if (accountFilter && accountFilter !== "all") {
          q = q.eq("account_id", accountFilter);
        }
        const { data, error } = await q;
        if (error) throw error;
        return data;
      }
      let q = supabase
        .from("social_media_analytics")
        .select("*, social_media_posts(caption, status, platform, created_at)")
        .order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
