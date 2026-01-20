// Report system constants and types

export const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: 'Instagram' },
  { value: 'facebook', label: 'Facebook', icon: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn', icon: 'Linkedin' },
  { value: 'youtube', label: 'YouTube', icon: 'Youtube' },
  { value: 'tiktok', label: 'TikTok', icon: 'Music2' },
  { value: 'google_business', label: 'Google Business', icon: 'MapPin' },
] as const;

export const ADS_PLATFORMS = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'instagram', label: 'Instagram Ads' },
  { value: 'facebook', label: 'Facebook Ads' },
  { value: 'linkedin', label: 'LinkedIn Ads' },
  { value: 'youtube', label: 'YouTube Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'google_ads', label: 'Google Ads' },
] as const;

export const ADS_OBJECTIVES = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'leads', label: 'Leads' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'video_views', label: 'Video Views' },
] as const;

export const LEAD_CATEGORIES = [
  { value: 'form_submission', label: 'Form Submission' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'email', label: 'Email' },
  { value: 'dm', label: 'Direct Message' },
  { value: 'website_click', label: 'Website Click' },
  { value: 'other', label: 'Lainnya' },
] as const;

export type LeadCategory = typeof LEAD_CATEGORIES[number]['value'];

export const MONTHS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
] as const;

// Platform-specific metrics configuration
export const PLATFORM_METRICS = {
  instagram: {
    label: 'Instagram',
    metrics: [
      { key: 'ig_reach', label: 'Reach' },
      { key: 'ig_impressions', label: 'Impressions' },
      { key: 'ig_profile_visits', label: 'Profile Visits' },
      { key: 'ig_website_clicks', label: 'Website Clicks' },
      { key: 'ig_content_interactions', label: 'Content Interactions' },
      { key: 'ig_followers', label: 'Followers' },
    ],
  },
  facebook: {
    label: 'Facebook',
    metrics: [
      { key: 'fb_reach', label: 'Reach' },
      { key: 'fb_impressions', label: 'Impressions' },
      { key: 'fb_content_interactions', label: 'Content Interactions' },
      { key: 'fb_page_views', label: 'Page Views' },
      { key: 'fb_followers', label: 'Followers' },
    ],
  },
  linkedin: {
    label: 'LinkedIn',
    metrics: [
      { key: 'li_impressions', label: 'Impressions' },
      { key: 'li_engagement_rate', label: 'Engagement Rate (%)' },
      { key: 'li_followers', label: 'Followers' },
      { key: 'li_page_views', label: 'Page Views' },
      { key: 'li_unique_visitors', label: 'Unique Visitors' },
    ],
  },
  youtube: {
    label: 'YouTube',
    metrics: [
      { key: 'yt_views', label: 'Views' },
      { key: 'yt_watch_time', label: 'Watch Time (hours)' },
      { key: 'yt_impressions', label: 'Impressions' },
      { key: 'yt_subscribers', label: 'Subscribers' },
    ],
  },
  tiktok: {
    label: 'TikTok',
    metrics: [
      { key: 'tt_video_views', label: 'Video Views' },
      { key: 'tt_profile_views', label: 'Profile Views' },
      { key: 'tt_likes', label: 'Likes' },
      { key: 'tt_comments', label: 'Comments' },
      { key: 'tt_shares', label: 'Shares' },
      { key: 'tt_followers', label: 'Followers' },
    ],
  },
  google_business: {
    label: 'Google Business',
    metrics: [
      { key: 'gb_profile_views', label: 'Profile Views' },
      { key: 'gb_profile_interactions', label: 'Profile Interactions' },
      { key: 'gb_direction_requests', label: 'Direction Requests' },
      { key: 'gb_phone_calls', label: 'Phone Calls' },
      { key: 'gb_positive_reviews', label: 'Positive Reviews' },
      { key: 'gb_negative_reviews', label: 'Negative Reviews' },
    ],
  },
} as const;

export type Platform = typeof PLATFORMS[number]['value'];
export type AdsPlatform = typeof ADS_PLATFORMS[number]['value'];
export type AdsObjective = typeof ADS_OBJECTIVES[number]['value'];

export interface PlatformAccount {
  id: string;
  client_id: string;
  platform: Platform;
  account_name: string;
  username_url: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  created_by: string;
  updated_at: string;
  clients?: {
    name: string;
  };
}

export interface MonthlyOrganicReport {
  id: string;
  platform_account_id: string;
  report_month: number;
  report_year: number;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string | null;
  platform_accounts?: PlatformAccount & {
    clients?: { name: string };
  };
  [key: string]: unknown;
}

export interface MonthlyAdsReport {
  id: string;
  client_id: string;
  platform: AdsPlatform;
  platform_account_id: string | null;
  report_month: number;
  report_year: number;
  total_spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
  objective: AdsObjective;
  lead_category: LeadCategory | null;
  cpm: number | null;
  cpc: number | null;
  cost_per_result: number | null;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string | null;
  clients?: { name: string };
  platform_accounts?: PlatformAccount;
}

export const formatCurrencyIDR = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('id-ID').format(num);
};

export const getMonthLabel = (month: number): string => {
  return MONTHS.find((m) => m.value === month)?.label || '';
};

export const getPlatformLabel = (platform: string): string => {
  return PLATFORMS.find((p) => p.value === platform)?.label || 
         ADS_PLATFORMS.find((p) => p.value === platform)?.label || 
         platform;
};

export const getLeadCategoryLabel = (category: string | null): string => {
  if (!category) return '-';
  return LEAD_CATEGORIES.find((c) => c.value === category)?.label || category;
};
