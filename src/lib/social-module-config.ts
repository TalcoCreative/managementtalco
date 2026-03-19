// Social Media Module - Dual Database Configuration
// STRICT: dummy mode NEVER calls external APIs, live mode NEVER reads dummy_db

export type SocialModuleMode = "dummy" | "live";

export interface SocialModuleConfig {
  feature_enabled: boolean;
  mode: SocialModuleMode;
}

const STORAGE_KEY = "social_module_config";

const DEFAULT_CONFIG: SocialModuleConfig = {
  feature_enabled: true,
  mode: "dummy",
};

export function getSocialModuleConfig(): SocialModuleConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_CONFIG;
}

export function setSocialModuleConfig(config: Partial<SocialModuleConfig>): SocialModuleConfig {
  const current = getSocialModuleConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("social-module-config-change", { detail: updated }));
  return updated;
}

// Database table mapping based on mode
export function getTableNames(mode: SocialModuleMode) {
  if (mode === "dummy") {
    return {
      accounts: "sm_dummy_accounts" as const,
      posts: "sm_dummy_posts" as const,
      analytics: "sm_dummy_analytics" as const,
    };
  }
  return {
    accounts: "social_media_accounts" as const,
    posts: "social_media_posts" as const,
    analytics: "social_media_analytics" as const,
  };
}
