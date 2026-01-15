// Utility functions for accounting and financial reports

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatPercentage = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

// Mapping from expense categories to account codes
export const CATEGORY_TO_ACCOUNT_MAP: Record<string, string> = {
  // Payroll
  payroll: "6110",
  
  // HPP / Project costs
  honor_talent: "5100",
  produksi_konten: "5200",
  vendor_project: "5300",
  transport_project: "5400",
  konsumsi_project: "5500",
  
  // SDM/HR
  gaji_upah: "6110",
  freelance_parttimer: "6110",
  bpjs: "6130",
  thr_bonus: "6140",
  rekrutmen: "6100",
  training_sertifikasi: "6100",
  kesehatan_karyawan: "6100",
  reimburse_karyawan: "6100",
  
  // Marketing
  ads: "6210",
  kol_influencer: "6220",
  event_aktivasi: "6200",
  produksi_marketing: "6200",
  tools_marketing: "6200",
  sponsorship: "6200",
  
  // IT & Tools
  saas_subscription: "6310",
  domain_hosting: "6320",
  software_license: "6300",
  hardware: "6300",
  maintenance_it: "6300",
  cloud_service: "6300",
  
  // Administrasi
  atk: "6410",
  listrik_air: "6420",
  internet_komunikasi: "6430",
  kebersihan: "6440",
  
  // Operasional
  transport: "6500",
  transport_online: "6500",
  konsumsi_meeting: "6400",
  maintenance: "6400",
  service_ac: "6400",
  logistik: "6400",
  office_supplies: "6410",
  iuran: "6400",
  parkir: "6500",
  
  // Legal
  legalitas: "6600",
  perizinan: "6600",
  pajak: "6600",
  notaris: "6600",
  konsultan: "6600",
  
  // Finance
  biaya_transfer: "6720",
  biaya_admin_bank: "6710",
  bunga_denda: "6700",
  pajak_dibayar: "6700",
  audit: "6700",
  administrasi_bank: "6710",
};

// Mapping from income types to account codes
export const INCOME_TYPE_TO_ACCOUNT_MAP: Record<string, string> = {
  retainer: "4110",
  project: "4120",
  event: "4130",
  other: "4200",
  refund: "4200",
  interest: "4200",
};

// Get account code from expense category
export const getAccountCodeFromCategory = (category: string, subCategory?: string | null): string => {
  if (subCategory && CATEGORY_TO_ACCOUNT_MAP[subCategory]) {
    return CATEGORY_TO_ACCOUNT_MAP[subCategory];
  }
  if (CATEGORY_TO_ACCOUNT_MAP[category]) {
    return CATEGORY_TO_ACCOUNT_MAP[category];
  }
  return "6000"; // Default to operating expenses
};

// Get account code from income type
export const getAccountCodeFromIncomeType = (type: string): string => {
  return INCOME_TYPE_TO_ACCOUNT_MAP[type] || "4200";
};

// Check if a category is HPP (Cost of Goods Sold)
export const isHPPCategory = (category: string, subCategory?: string | null): boolean => {
  const hppSubCategories = [
    "honor_talent",
    "produksi_konten",
    "vendor_project",
    "transport_project",
    "konsumsi_project",
    "sewa_lokasi",
    "equipment",
  ];
  
  if (category === "project") {
    return true;
  }
  
  return subCategory ? hppSubCategories.includes(subCategory) : false;
};

// Determine expense group for income statement
export type ExpenseGroup = "hpp" | "sdm" | "marketing" | "it" | "administrasi" | "other";

export const getExpenseGroup = (category: string, subCategory?: string | null): ExpenseGroup => {
  // Check for HPP first
  if (isHPPCategory(category, subCategory)) {
    return "hpp";
  }
  
  // Map categories to groups
  const categoryGroupMap: Record<string, ExpenseGroup> = {
    sdm_hr: "sdm",
    payroll: "sdm",
    marketing_growth: "marketing",
    it_tools: "it",
    administrasi_legal: "administrasi",
    operasional: "administrasi",
    finance: "administrasi",
    reimburse: "other",
    lainnya: "other",
  };
  
  return categoryGroupMap[category] || "other";
};

// Calculate cash runway in months
export const calculateCashRunway = (
  cashBalance: number,
  monthlyExpenses: number
): number => {
  if (monthlyExpenses <= 0) return 0;
  return Math.round((cashBalance / monthlyExpenses) * 10) / 10;
};

// Calculate margin percentage
export const calculateMargin = (revenue: number, cost: number): number => {
  if (revenue <= 0) return 0;
  return ((revenue - cost) / revenue) * 100;
};

// Calculate year-over-year or month-over-month change
export const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Get month name in Indonesian
export const getMonthNameID = (month: number): string => {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return months[month - 1] || "";
};

// Format date range for display
export const formatDateRange = (startDate: Date, endDate: Date): string => {
  const startMonth = getMonthNameID(startDate.getMonth() + 1);
  const endMonth = getMonthNameID(endDate.getMonth() + 1);
  
  if (startDate.getFullYear() === endDate.getFullYear()) {
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startMonth} ${startDate.getFullYear()}`;
    }
    return `${startMonth} - ${endMonth} ${startDate.getFullYear()}`;
  }
  
  return `${startMonth} ${startDate.getFullYear()} - ${endMonth} ${endDate.getFullYear()}`;
};
