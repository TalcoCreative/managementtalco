// Hierarchical category structure for finance transactions

export interface SubCategory {
  value: string;
  label: string;
}

export interface MainCategory {
  value: string;
  label: string;
  subCategories: SubCategory[];
}

export const FINANCE_CATEGORIES: MainCategory[] = [
  {
    value: "operasional",
    label: "Operasional",
    subCategories: [
      { value: "transport", label: "Transport" },
      { value: "konsumsi_meeting", label: "Konsumsi / Meeting" },
      { value: "atk", label: "ATK" },
      { value: "maintenance", label: "Maintenance" },
      { value: "logistik", label: "Logistik" },
      { value: "internet_komunikasi", label: "Internet & Komunikasi" },
      { value: "office_supplies", label: "Office Supplies" },
    ],
  },
  {
    value: "project",
    label: "Project",
    subCategories: [
      { value: "honor_talent", label: "Honor Talent / Freelancer" },
      { value: "produksi_konten", label: "Produksi Konten" },
      { value: "sewa_lokasi", label: "Sewa Lokasi" },
      { value: "equipment", label: "Equipment" },
      { value: "vendor_project", label: "Vendor Project" },
      { value: "transport_project", label: "Transport Project" },
      { value: "konsumsi_project", label: "Konsumsi Project" },
    ],
  },
  {
    value: "sdm_hr",
    label: "SDM / HR",
    subCategories: [
      { value: "gaji_upah", label: "Gaji & Upah" },
      { value: "freelance_parttimer", label: "Freelance / Part Timer" },
      { value: "bpjs", label: "BPJS" },
      { value: "thr_bonus", label: "THR & Bonus" },
      { value: "rekrutmen", label: "Rekrutmen" },
      { value: "training_sertifikasi", label: "Training & Sertifikasi" },
      { value: "kesehatan_karyawan", label: "Kesehatan Karyawan" },
      { value: "reimburse_karyawan", label: "Reimburse Karyawan" },
    ],
  },
  {
    value: "marketing_growth",
    label: "Marketing & Growth",
    subCategories: [
      { value: "ads", label: "Ads (Meta / Google / TikTok)" },
      { value: "kol_influencer", label: "KOL / Influencer" },
      { value: "event_aktivasi", label: "Event & Aktivasi" },
      { value: "produksi_marketing", label: "Produksi Konten Marketing" },
      { value: "tools_marketing", label: "Tools Marketing" },
      { value: "sponsorship", label: "Sponsorship" },
    ],
  },
  {
    value: "it_tools",
    label: "IT & Tools",
    subCategories: [
      { value: "saas_subscription", label: "SaaS Subscription" },
      { value: "domain_hosting", label: "Domain & Hosting" },
      { value: "software_license", label: "Software License" },
      { value: "hardware", label: "Hardware" },
      { value: "maintenance_it", label: "Maintenance IT" },
      { value: "cloud_service", label: "Cloud Service" },
    ],
  },
  {
    value: "administrasi_legal",
    label: "Administrasi & Legal",
    subCategories: [
      { value: "legalitas", label: "Legalitas" },
      { value: "perizinan", label: "Perizinan" },
      { value: "pajak", label: "Pajak" },
      { value: "notaris", label: "Notaris" },
      { value: "konsultan", label: "Konsultan" },
      { value: "administrasi_bank", label: "Administrasi Bank" },
    ],
  },
  {
    value: "finance",
    label: "Finance",
    subCategories: [
      { value: "biaya_transfer", label: "Biaya Transfer" },
      { value: "biaya_admin_bank", label: "Biaya Admin Bank" },
      { value: "bunga_denda", label: "Bunga / Denda" },
      { value: "pajak_dibayar", label: "Pajak Dibayar" },
      { value: "audit", label: "Audit" },
    ],
  },
  {
    value: "reimburse",
    label: "Reimburse & Request",
    subCategories: [
      { value: "reimburse_event", label: "Reimburse - Event" },
      { value: "reimburse_meeting", label: "Reimburse - Meeting" },
      { value: "reimburse_production", label: "Reimburse - Production" },
      { value: "reimburse_operational", label: "Reimburse - Operational" },
      { value: "reimburse_other", label: "Reimburse - Lainnya" },
      { value: "request_training", label: "Request - Training" },
      { value: "request_equipment", label: "Request - Equipment" },
      { value: "request_software", label: "Request - Software" },
      { value: "request_transport", label: "Request - Transport" },
      { value: "request_event", label: "Request - Event" },
      { value: "request_other", label: "Request - Lainnya" },
    ],
  },
  {
    value: "lainnya",
    label: "Lain-lain",
    subCategories: [
      { value: "donasi", label: "Donasi" },
      { value: "csr", label: "CSR" },
      { value: "pengeluaran_insidental", label: "Pengeluaran Insidental" },
      { value: "tidak_terklasifikasi", label: "Tidak Terklasifikasi" },
    ],
  },
];

// Mapping for reimbursement request_from to categories
export const REIMBURSE_CATEGORY_MAPPING: Record<string, { category: string; subCategory: string }> = {
  // Reimbursement types
  event: { category: "reimburse", subCategory: "reimburse_event" },
  meeting: { category: "reimburse", subCategory: "reimburse_meeting" },
  production: { category: "reimburse", subCategory: "reimburse_production" },
  operational: { category: "reimburse", subCategory: "reimburse_operational" },
  other: { category: "reimburse", subCategory: "reimburse_other" },
  // Request types
  training: { category: "reimburse", subCategory: "request_training" },
  equipment: { category: "reimburse", subCategory: "request_equipment" },
  software: { category: "reimburse", subCategory: "request_software" },
  transport: { category: "reimburse", subCategory: "request_transport" },
};

// Helper functions
export function getMainCategoryLabel(value: string): string {
  const category = FINANCE_CATEGORIES.find((c) => c.value === value);
  return category?.label || value;
}

export function getSubCategoryLabel(mainCategory: string, subCategory: string): string {
  const category = FINANCE_CATEGORIES.find((c) => c.value === mainCategory);
  const sub = category?.subCategories.find((s) => s.value === subCategory);
  return sub?.label || subCategory;
}

export function getSubCategories(mainCategory: string): SubCategory[] {
  const category = FINANCE_CATEGORIES.find((c) => c.value === mainCategory);
  return category?.subCategories || [];
}

export function getAllSubCategories(): SubCategory[] {
  return FINANCE_CATEGORIES.flatMap((c) => c.subCategories);
}

export function findCategoryBySubCategory(subCategory: string): MainCategory | undefined {
  return FINANCE_CATEGORIES.find((c) => 
    c.subCategories.some((s) => s.value === subCategory)
  );
}
