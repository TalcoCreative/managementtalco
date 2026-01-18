import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  PlatformAccount, 
  MonthlyOrganicReport, 
  MonthlyAdsReport,
  Platform,
  AdsPlatform,
  AdsObjective,
  LeadCategory 
} from "@/lib/report-constants";

// Platform Accounts
export const usePlatformAccounts = (clientId?: string) => {
  return useQuery({
    queryKey: ["platform-accounts", clientId],
    queryFn: async () => {
      let query = (supabase
        .from("platform_accounts") as any)
        .select("*, clients(name)")
        .order("created_at", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PlatformAccount[];
    },
  });
};

export const useCreatePlatformAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (account: {
      client_id: string;
      platform: Platform;
      account_name: string;
      username_url?: string;
      status?: "active" | "inactive";
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await (supabase
        .from("platform_accounts") as any)
        .insert({
          ...account,
          created_by: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-accounts"] });
      toast.success("Platform account created");
    },
    onError: (error) => {
      toast.error("Failed to create platform account: " + error.message);
    },
  });
};

export const useUpdatePlatformAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<PlatformAccount> & { id: string }) => {
      const { data, error } = await (supabase
        .from("platform_accounts") as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-accounts"] });
      toast.success("Platform account updated");
    },
    onError: (error) => {
      toast.error("Failed to update platform account: " + error.message);
    },
  });
};

export const useDeletePlatformAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("platform_accounts") as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-accounts"] });
      toast.success("Platform account deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete platform account: " + error.message);
    },
  });
};

// Monthly Organic Reports
export const useOrganicReports = (filters?: {
  clientId?: string;
  platform?: string;
  year?: number;
  month?: number;
}) => {
  return useQuery({
    queryKey: ["organic-reports", filters],
    queryFn: async () => {
      let query = (supabase
        .from("monthly_organic_reports") as any)
        .select("*, platform_accounts(*, clients(name))")
        .order("report_year", { ascending: false })
        .order("report_month", { ascending: false });

      if (filters?.year) {
        query = query.eq("report_year", filters.year);
      }
      if (filters?.month) {
        query = query.eq("report_month", filters.month);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data as MonthlyOrganicReport[];

      if (filters?.clientId) {
        filtered = filtered.filter(
          (r) => r.platform_accounts?.client_id === filters.clientId
        );
      }
      if (filters?.platform) {
        filtered = filtered.filter(
          (r) => r.platform_accounts?.platform === filters.platform
        );
      }

      return filtered;
    },
  });
};

export const useCreateOrganicReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: Record<string, unknown>) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await (supabase
        .from("monthly_organic_reports") as any)
        .insert({
          ...report,
          created_by: user.user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Report already exists for this period");
        }
        throw error;
      }

      // Log audit
      await (supabase.from("report_audit_logs") as any).insert({
        report_type: "organic",
        report_id: data.id,
        action: "create",
        new_values: report,
        performed_by: user.user.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organic-reports"] });
      toast.success("Organic report created");
    },
    onError: (error) => {
      toast.error("Failed to create report: " + error.message);
    },
  });
};

export const useUpdateOrganicReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      previousValues,
      ...updates
    }: Record<string, unknown> & { id: string; previousValues?: Record<string, unknown> }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await (supabase
        .from("monthly_organic_reports") as any)
        .update({ ...updates, updated_by: user.user.id })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Log audit
      await (supabase.from("report_audit_logs") as any).insert({
        report_type: "organic",
        report_id: id,
        action: "update",
        previous_values: previousValues,
        new_values: updates,
        performed_by: user.user.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organic-reports"] });
      toast.success("Report updated");
    },
    onError: (error) => {
      toast.error("Failed to update report: " + error.message);
    },
  });
};

export const useDeleteOrganicReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, previousValues }: { id: string; previousValues: Record<string, unknown> }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Log audit before delete
      await (supabase.from("report_audit_logs") as any).insert({
        report_type: "organic",
        report_id: id,
        action: "delete",
        previous_values: previousValues,
        performed_by: user.user.id,
      });

      const { error } = await (supabase
        .from("monthly_organic_reports") as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organic-reports"] });
      toast.success("Report deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete report: " + error.message);
    },
  });
};

// Monthly Ads Reports
export const useAdsReports = (filters?: {
  clientId?: string;
  platform?: string;
  year?: number;
  month?: number;
}) => {
  return useQuery({
    queryKey: ["ads-reports", filters],
    queryFn: async () => {
      let query = (supabase
        .from("monthly_ads_reports") as any)
        .select("*, clients(name), platform_accounts(*)")
        .order("report_year", { ascending: false })
        .order("report_month", { ascending: false });

      if (filters?.clientId) {
        query = query.eq("client_id", filters.clientId);
      }
      if (filters?.platform) {
        query = query.eq("platform", filters.platform);
      }
      if (filters?.year) {
        query = query.eq("report_year", filters.year);
      }
      if (filters?.month) {
        query = query.eq("report_month", filters.month);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MonthlyAdsReport[];
    },
  });
};

export const useCreateAdsReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: {
      client_id: string;
      platform: AdsPlatform;
      platform_account_id?: string;
      report_month: number;
      report_year: number;
      total_spend: number;
      impressions: number;
      reach: number;
      clicks: number;
      results: number;
      objective: AdsObjective;
      lead_category?: LeadCategory;
      cpm?: number;
      cpc?: number;
      cost_per_result?: number;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Calculate metrics if not provided
      const cpm = report.cpm ?? (report.impressions > 0 ? (report.total_spend / report.impressions) * 1000 : 0);
      const cpc = report.cpc ?? (report.clicks > 0 ? report.total_spend / report.clicks : 0);
      const cost_per_result = report.cost_per_result ?? (report.results > 0 ? report.total_spend / report.results : 0);

      const { data, error } = await (supabase
        .from("monthly_ads_reports") as any)
        .insert({
          ...report,
          cpm,
          cpc,
          cost_per_result,
          created_by: user.user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Ads report already exists for this period");
        }
        throw error;
      }

      // Log audit
      await (supabase.from("report_audit_logs") as any).insert({
        report_type: "ads",
        report_id: data.id,
        action: "create",
        new_values: report,
        performed_by: user.user.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-reports"] });
      toast.success("Ads report created");
    },
    onError: (error) => {
      toast.error("Failed to create ads report: " + error.message);
    },
  });
};

export const useUpdateAdsReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      previousValues,
      ...updates
    }: Partial<MonthlyAdsReport> & { id: string; previousValues?: Record<string, unknown> }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await (supabase
        .from("monthly_ads_reports") as any)
        .update({ ...updates, updated_by: user.user.id })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Log audit
      await (supabase.from("report_audit_logs") as any).insert({
        report_type: "ads",
        report_id: id,
        action: "update",
        previous_values: previousValues,
        new_values: updates,
        performed_by: user.user.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-reports"] });
      toast.success("Ads report updated");
    },
    onError: (error) => {
      toast.error("Failed to update ads report: " + error.message);
    },
  });
};

export const useDeleteAdsReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, previousValues }: { id: string; previousValues: Record<string, unknown> }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Log audit before delete
      await (supabase.from("report_audit_logs") as any).insert({
        report_type: "ads",
        report_id: id,
        action: "delete",
        previous_values: previousValues,
        performed_by: user.user.id,
      });

      const { error } = await (supabase
        .from("monthly_ads_reports") as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-reports"] });
      toast.success("Ads report deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete ads report: " + error.message);
    },
  });
};

// Report Audit Logs
export const useReportAuditLogs = (reportId?: string, reportType?: "organic" | "ads") => {
  return useQuery({
    queryKey: ["report-audit-logs", reportId, reportType],
    queryFn: async () => {
      let query = (supabase
        .from("report_audit_logs") as any)
        .select("*")
        .order("performed_at", { ascending: false });

      if (reportId) {
        query = query.eq("report_id", reportId);
      }
      if (reportType) {
        query = query.eq("report_type", reportType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!reportId || !!reportType,
  });
};

// Lock/Unlock Reports
export const useLockReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      reportType,
      lock,
    }: {
      id: string;
      reportType: "organic" | "ads";
      lock: boolean;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const table =
        reportType === "organic"
          ? "monthly_organic_reports"
          : "monthly_ads_reports";

      const { data, error } = await (supabase
        .from(table) as any)
        .update({
          is_locked: lock,
          locked_at: lock ? new Date().toISOString() : null,
          locked_by: lock ? user.user.id : null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Log audit
      await (supabase.from("report_audit_logs") as any).insert({
        report_type: reportType,
        report_id: id,
        action: lock ? "lock" : "unlock",
        performed_by: user.user.id,
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          variables.reportType === "organic" ? "organic-reports" : "ads-reports",
        ],
      });
      toast.success(
        variables.lock ? "Report locked" : "Report unlocked"
      );
    },
    onError: (error) => {
      toast.error("Failed to update lock status: " + error.message);
    },
  });
};
