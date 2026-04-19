import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export type PermissionAction = "can_view" | "can_create" | "can_edit" | "can_delete" | "can_export" | "can_comment" | "can_mention";

export interface FeaturePermission {
  feature_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_comment: boolean;
  can_mention: boolean;
}

// All system features grouped by navigation category
export const FEATURE_GROUPS: { label: string; features: { key: string; label: string }[] }[] = [
  {
    label: "Navigation",
    features: [
      { key: "dashboard", label: "Dashboard" },
      { key: "clients", label: "Clients" },
      { key: "client_hub", label: "Client Hub" },
      { key: "projects", label: "Projects" },
      { key: "tasks", label: "Tasks" },
      { key: "schedule", label: "Schedule" },
      { key: "shooting", label: "Shooting" },
      { key: "meeting", label: "Meeting" },
      { key: "leave", label: "Leave" },
      { key: "reimburse", label: "Reimburse" },
      { key: "asset", label: "Asset" },
      { key: "event", label: "Event" },
      { key: "reports", label: "Reports" },
      { key: "form_builder", label: "Form Builder" },
      { key: "kol_database", label: "KOL Database" },
      { key: "kol_campaign", label: "KOL Campaign" },
      { key: "letters", label: "Surat" },
      { key: "invoices", label: "Invoices" },
    ],
  },
  {
    label: "Social Media",
    features: [
      { key: "social_media", label: "Social Media" },
      { key: "editorial_plan", label: "Editorial Plan" },
      { key: "content_builder", label: "Content Builder" },
    ],
  },
  {
    label: "HR",
    features: [
      { key: "team", label: "Team" },
      { key: "hr_dashboard", label: "HR Dashboard" },
      { key: "hr_analytics", label: "HR Analytics" },
      { key: "holiday_calendar", label: "Kalender Libur" },
      { key: "performance", label: "Performance" },
      { key: "recruitment", label: "Recruitment" },
      { key: "recruitment_dashboard", label: "Recruitment Dashboard" },
      { key: "recruitment_forms", label: "Recruitment Forms" },
    ],
  },
  {
    label: "Finance",
    features: [
      { key: "finance", label: "Finance Center" },
      { key: "ads_budget", label: "Ads Budget" },
      { key: "income_statement", label: "Laba Rugi" },
      { key: "balance_sheet", label: "Neraca" },
    ],
  },
  {
    label: "Sales",
    features: [
      { key: "prospects", label: "Prospects" },
      { key: "sales_analytics", label: "Sales Analytics" },
    ],
  },
  {
    label: "Executive",
    features: [
      { key: "ceo_dashboard", label: "CEO Dashboard" },
    ],
  },
  {
    label: "System",
    features: [
      { key: "email_settings", label: "Email Settings" },
      { key: "role_management", label: "Role & Access Control" },
      { key: "setting_location", label: "Location Settings" },
      { key: "invoice_templates", label: "Invoice Templates" },
      { key: "system_settings", label: "System Settings" },
    ],
  },
];

export const ALL_FEATURE_KEYS = FEATURE_GROUPS.flatMap(g => g.features.map(f => f.key));

// Map route paths to feature keys
export const ROUTE_FEATURE_MAP: Record<string, string> = {
  "/": "dashboard",
  "/clients": "clients",
  "/reports/published-content": "reports",
  "/projects": "projects",
  "/tasks": "tasks",
  "/schedule": "schedule",
  "/shooting": "shooting",
  "/meeting": "meeting",
  "/leave": "leave",
  "/my-reimbursement": "reimburse",
  "/asset": "asset",
  "/event": "event",
  "/reports": "reports",
  "/forms": "form_builder",
  "/kol-database": "kol_database",
  "/kol-campaign": "kol_campaign",
  "/letters": "letters",
  "/invoices": "invoices",
  "/settings/invoice-templates": "invoice_templates",
  "/social-media": "social_media",
  "/editorial-plan": "editorial_plan",
  "/content-builder": "content_builder",
  "/users": "team",
  "/hr-dashboard": "hr_dashboard",
  "/hr/analytics": "hr_analytics",
  "/hr/holiday": "holiday_calendar",
  "/performance": "performance",
  "/recruitment": "recruitment",
  "/recruitment/dashboard": "recruitment_dashboard",
  "/recruitment/forms": "recruitment_forms",
  "/finance": "finance",
  "/ads-budget": "ads_budget",
  "/finance/laporan-laba-rugi": "income_statement",
  "/finance/neraca": "balance_sheet",
  "/prospects": "prospects",
  "/prospects/history": "prospects",
  "/sales/dashboard": "sales_analytics",
  "/ceo-dashboard": "ceo_dashboard",
  "/system/email-settings": "email_settings",
  "/system/roles": "role_management",
  "/system/settings": "system_settings",
  "/setting-location": "setting_location",
};

// Map feature keys to sidebar nav URLs
export const FEATURE_ROUTE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_FEATURE_MAP).map(([k, v]) => [v, k])
);

interface PermissionCache {
  permissions: Record<string, FeaturePermission>;
  isSuperAdmin: boolean;
  roleName: string | null;
  roleId: string | null;
}

export function usePermissions() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  // Check if user is super_admin (via old user_roles table)
  const { data: oldRoles, isLoading: oldRolesLoading } = useQuery({
    queryKey: ["user-old-roles", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      return data?.map(r => r.role) || [];
    },
    enabled: !!userId,
  });

  const isSuperAdmin = oldRoles?.includes("super_admin") ?? false;

  // Get user's dynamic role
  const { data: dynamicRole, isLoading: dynamicRoleLoading } = useQuery({
    queryKey: ["user-dynamic-role", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("user_dynamic_roles")
        .select("role_id, dynamic_roles(id, name)")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  // Get permissions for this role
  const roleId = (dynamicRole as any)?.role_id;
  const roleName = (dynamicRole as any)?.dynamic_roles?.name ?? null;

  const { data: permissions, isLoading: permsLoading } = useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: async () => {
      if (!roleId) return {};
      const { data } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("role_id", roleId);
      
      const map: Record<string, FeaturePermission> = {};
      data?.forEach((p: any) => {
        map[p.feature_key] = p;
      });
      return map;
    },
    enabled: !!roleId,
  });

  const isLoading = !userId || oldRolesLoading || dynamicRoleLoading || (!!roleId && permsLoading);

  // Features accessible to ALL users without any permission check
  const ALWAYS_ACCESSIBLE = ["profile_settings", "personal_notes"];

  const can = (featureKey: string, action: PermissionAction = "can_view"): boolean => {
    // Always accessible features bypass all checks
    if (ALWAYS_ACCESSIBLE.includes(featureKey)) return true;
    // Super admin always has full access
    if (isSuperAdmin) return true;
    // If no dynamic role assigned, deny
    if (!permissions) return false;
    const fp = permissions[featureKey];
    if (!fp) return false;
    return fp[action] ?? false;
  };

  const canView = (featureKey: string) => can(featureKey, "can_view");
  const canCreate = (featureKey: string) => can(featureKey, "can_create");
  const canEdit = (featureKey: string) => can(featureKey, "can_edit");
  const canDelete = (featureKey: string) => can(featureKey, "can_delete");
  const canExport = (featureKey: string) => can(featureKey, "can_export");

  return {
    can,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    isSuperAdmin,
    roleName,
    roleId,
    permissions: permissions || {},
    isLoading,
    userId,
  };
}
