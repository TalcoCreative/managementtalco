export type PaymentMethodType = "bank" | "qris" | "other";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  qris_image_url?: string;
  notes?: string;
  enabled: boolean;
}

export interface CompanyInfo {
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  tax_id?: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  entity_code: string;
  entity_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  company_info: CompanyInfo;
  payment_methods: PaymentMethod[];
  default_notes: string | null;
  default_terms: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled" | "overdue";

export interface Invoice {
  id: string;
  invoice_number: string;
  letter_id: string | null;
  template_id: string | null;
  template_snapshot: Partial<InvoiceTemplate>;
  custom_logo_url: string | null;
  client_id: string | null;
  project_id: string | null;
  bill_to_name: string;
  bill_to_company: string | null;
  bill_to_address: string | null;
  bill_to_email: string | null;
  bill_to_phone: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  terms: string | null;
  enabled_payment_method_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  paid: { label: "Paid", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", className: "bg-gray-500/15 text-gray-600 dark:text-gray-400" },
  overdue: { label: "Overdue", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

export const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
