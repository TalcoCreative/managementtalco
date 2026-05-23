import {
  Home, Building2, Briefcase, CheckSquare, Calendar, Video, CalendarClock, PartyPopper,
  Users, ClipboardCheck, BarChart2, CalendarOff, Receipt, Package, TrendingUp,
  CalendarHeart, UserSearch, BarChart3, FileText, Share2, Sparkles, Star, Megaphone,
  UserPlus, Wallet, CircleDollarSign, PieChart, Scale, ReceiptText, Crown, User,
  Mail, MessageSquare, Shield, MapPin, Settings, StickyNote, LayoutGrid, Briefcase as Work,
  HeartHandshake,
} from "lucide-react";

export interface NavItemDef {
  title: string;
  url: string;
  icon: any;
  featureKey: string;
}

export interface NavCategory {
  key: string;
  label: string;
  icon: any;
  color: string; // hsl tuple value
  items: NavItemDef[];
}

const ALWAYS_VISIBLE = [
  "dashboard", "profile_settings", "personal_notes",
  "my_prospects", "my_sales_dashboard", "my_commission", "chat",
];

export const NAV_CATEGORIES: NavCategory[] = [
  {
    key: "home",
    label: "Home",
    icon: Home,
    color: "hsl(222,72%,52%)",
    items: [
      { title: "Dashboard", url: "/", icon: Home, featureKey: "dashboard" },
      { title: "Schedule", url: "/schedule", icon: Calendar, featureKey: "schedule" },
      { title: "Personal Notes", url: "/personal-notes", icon: StickyNote, featureKey: "personal_notes" },
    ],
  },
  {
    key: "chat",
    label: "Chat",
    icon: MessageSquare,
    color: "hsl(152,48%,46%)",
    items: [
      { title: "Chat", url: "/chat", icon: MessageSquare, featureKey: "chat" },
    ],
  },
  {
    key: "work",
    label: "Work",
    icon: Work,
    color: "hsl(280,60%,55%)",
    items: [
      { title: "Clients", url: "/clients", icon: Building2, featureKey: "clients" },
      { title: "Projects", url: "/projects", icon: Briefcase, featureKey: "projects" },
      { title: "Tasks", url: "/tasks", icon: CheckSquare, featureKey: "tasks" },
      { title: "Shooting", url: "/shooting", icon: Video, featureKey: "shooting" },
      { title: "Meeting", url: "/meeting", icon: CalendarClock, featureKey: "meeting" },
      { title: "Event", url: "/event", icon: PartyPopper, featureKey: "event" },
    ],
  },
  {
    key: "people",
    label: "People",
    icon: Users,
    color: "hsl(205,72%,52%)",
    items: [
      { title: "Employee", url: "/users", icon: Users, featureKey: "team" },
      { title: "HR Dashboard", url: "/hr-dashboard", icon: ClipboardCheck, featureKey: "hr_dashboard" },
      { title: "HR Analytics", url: "/hr/analytics", icon: BarChart2, featureKey: "hr_analytics" },
      { title: "Leave", url: "/leave", icon: CalendarOff, featureKey: "leave" },
      { title: "Reimburse", url: "/my-reimbursement", icon: Receipt, featureKey: "reimburse" },
      { title: "Asset", url: "/asset", icon: Package, featureKey: "asset" },
      { title: "Performance", url: "/performance", icon: TrendingUp, featureKey: "performance" },
      { title: "Holiday Calendar", url: "/hr/holiday", icon: CalendarHeart, featureKey: "holiday_calendar" },
      { title: "Recruitment", url: "/recruitment", icon: UserSearch, featureKey: "recruitment" },
      { title: "Recruitment Board", url: "/recruitment/dashboard", icon: BarChart3, featureKey: "recruitment_dashboard" },
      { title: "Recruitment Forms", url: "/recruitment/forms", icon: FileText, featureKey: "recruitment_forms" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: Sparkles,
    color: "hsl(330,60%,55%)",
    items: [
      { title: "Social Media", url: "/social-media", icon: Share2, featureKey: "social_media" },
      { title: "Editorial Plan", url: "/editorial-plan", icon: FileText, featureKey: "editorial_plan" },
      { title: "Content Builder", url: "/content-builder", icon: Sparkles, featureKey: "content_builder" },
      { title: "KOL Database", url: "/kol-database", icon: Star, featureKey: "kol_database" },
      { title: "KOL Campaign", url: "/kol-campaign", icon: Megaphone, featureKey: "kol_campaign" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    icon: TrendingUp,
    color: "hsl(152,48%,46%)",
    items: [
      { title: "Prospects", url: "/prospects", icon: UserPlus, featureKey: "prospects" },
      { title: "My Prospects", url: "/my-prospects", icon: UserPlus, featureKey: "my_prospects" },
      { title: "My Sales Dashboard", url: "/my-sales-dashboard", icon: TrendingUp, featureKey: "my_sales_dashboard" },
      { title: "Sales Analytics", url: "/sales/dashboard", icon: TrendingUp, featureKey: "sales_analytics" },
      { title: "My Commission", url: "/my-commission", icon: Wallet, featureKey: "my_commission" },
      { title: "Sales Admin", url: "/sales-admin", icon: CircleDollarSign, featureKey: "sales_admin" },
      { title: "Ads Budget", url: "/ads-budget", icon: CircleDollarSign, featureKey: "ads_budget" },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    icon: Wallet,
    color: "hsl(38,82%,52%)",
    items: [
      { title: "Finance", url: "/finance", icon: Wallet, featureKey: "finance" },
      { title: "Income Statement", url: "/finance/laporan-laba-rugi", icon: PieChart, featureKey: "income_statement" },
      { title: "Balance Sheet", url: "/finance/neraca", icon: Scale, featureKey: "balance_sheet" },
      { title: "Invoices", url: "/invoices", icon: ReceiptText, featureKey: "invoices" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    color: "hsl(205,72%,52%)",
    items: [
      { title: "Reports", url: "/reports", icon: BarChart3, featureKey: "reports" },
      { title: "Letters", url: "/letters", icon: FileText, featureKey: "letters" },
      { title: "Form Builder", url: "/forms", icon: FileText, featureKey: "form_builder" },
      { title: "CEO Dashboard", url: "/ceo-dashboard", icon: Crown, featureKey: "ceo_dashboard" },
    ],
  },
  {
    key: "culture",
    label: "Culture",
    icon: HeartHandshake,
    color: "hsl(152,48%,46%)",
    items: [
      { title: "Monthly Team Review", url: "/team-review", icon: HeartHandshake, featureKey: "team_review_access" },
      { title: "Team Review Settings", url: "/system/team-review-settings", icon: Settings, featureKey: "team_review_admin" },
    ],
  },
  {
    key: "system",
    label: "System",
    icon: Settings,
    color: "hsl(222,10%,48%)",
    items: [
      { title: "Profile Settings", url: "/profile-settings", icon: User, featureKey: "profile_settings" },
      { title: "Email Settings", url: "/system/email-settings", icon: Mail, featureKey: "email_settings" },
      { title: "WA Notification Log", url: "/notification-log", icon: MessageSquare, featureKey: "notification_log" },
      { title: "Role & Access", url: "/system/roles", icon: Shield, featureKey: "role_management" },
      { title: "Location Settings", url: "/setting-location", icon: MapPin, featureKey: "setting_location" },
      { title: "Invoice Templates", url: "/settings/invoice-templates", icon: ReceiptText, featureKey: "invoice_templates" },
      { title: "System Settings", url: "/system/settings", icon: Settings, featureKey: "system_settings" },
    ],
  },
];

export function filterCategoriesByPermission(canView: (k: string) => boolean) {
  return NAV_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((i) => ALWAYS_VISIBLE.includes(i.featureKey) || canView(i.featureKey)),
  })).filter((c) => c.items.length > 0);
}
