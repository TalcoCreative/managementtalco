-- Create enum for account types
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'hpp', 'expense');

-- Create Chart of Accounts table
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type account_type NOT NULL,
  parent_id UUID REFERENCES public.chart_of_accounts(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Policies for chart_of_accounts
CREATE POLICY "Authenticated users can view chart of accounts"
ON public.chart_of_accounts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Finance/Accounting/Admin can manage chart of accounts"
ON public.chart_of_accounts
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'finance') OR
  public.has_role(auth.uid(), 'accounting')
);

-- Create account mapping table for ledger entries
CREATE TABLE public.ledger_account_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ledger_entry_id UUID REFERENCES public.ledger_entries(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.chart_of_accounts(id) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  is_debit BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ledger_account_mappings ENABLE ROW LEVEL SECURITY;

-- Policies for ledger_account_mappings
CREATE POLICY "Authenticated users can view ledger account mappings"
ON public.ledger_account_mappings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Finance/Accounting/Admin can manage ledger account mappings"
ON public.ledger_account_mappings
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'finance') OR
  public.has_role(auth.uid(), 'accounting')
);

-- Create balance sheet items table for manual adjustments
CREATE TABLE public.balance_sheet_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.chart_of_accounts(id) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  as_of_date DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.balance_sheet_items ENABLE ROW LEVEL SECURITY;

-- Policies for balance_sheet_items
CREATE POLICY "Authenticated users can view balance sheet items"
ON public.balance_sheet_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Finance/Accounting/Admin can manage balance sheet items"
ON public.balance_sheet_items
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'finance') OR
  public.has_role(auth.uid(), 'accounting')
);

-- Add account_id to ledger_entries for direct mapping
ALTER TABLE public.ledger_entries ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.chart_of_accounts(id);

-- Create triggers for updated_at
CREATE TRIGGER set_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_balance_sheet_items_updated_at
  BEFORE UPDATE ON public.balance_sheet_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Insert default Chart of Accounts (Indonesian standard)
INSERT INTO public.chart_of_accounts (code, name, type, description) VALUES
-- ASSET (1xxx)
('1000', 'Aset', 'asset', 'Akun induk aset'),
('1100', 'Aset Lancar', 'asset', 'Current assets'),
('1110', 'Kas & Bank', 'asset', 'Cash and bank accounts'),
('1120', 'Piutang Usaha', 'asset', 'Accounts receivable'),
('1130', 'Piutang Karyawan', 'asset', 'Employee receivables'),
('1140', 'Uang Muka', 'asset', 'Prepaid expenses'),
('1200', 'Aset Tetap', 'asset', 'Fixed assets'),
('1210', 'Peralatan Kantor', 'asset', 'Office equipment'),
('1220', 'Kendaraan', 'asset', 'Vehicles'),
('1230', 'Akumulasi Penyusutan', 'asset', 'Accumulated depreciation'),

-- LIABILITY (2xxx)
('2000', 'Kewajiban', 'liability', 'Akun induk kewajiban'),
('2100', 'Kewajiban Lancar', 'liability', 'Current liabilities'),
('2110', 'Hutang Usaha', 'liability', 'Accounts payable'),
('2120', 'Hutang Gaji', 'liability', 'Salary payable'),
('2130', 'Hutang Pajak', 'liability', 'Tax payable'),
('2140', 'Hutang BPJS', 'liability', 'BPJS payable'),
('2200', 'Kewajiban Jangka Panjang', 'liability', 'Long-term liabilities'),

-- EQUITY (3xxx)
('3000', 'Modal', 'equity', 'Akun induk modal'),
('3100', 'Modal Disetor', 'equity', 'Paid-in capital'),
('3200', 'Laba Ditahan', 'equity', 'Retained earnings'),
('3300', 'Laba Tahun Berjalan', 'equity', 'Current year profit'),

-- REVENUE (4xxx)
('4000', 'Pendapatan', 'revenue', 'Akun induk pendapatan'),
('4100', 'Pendapatan Utama', 'revenue', 'Main revenue'),
('4110', 'Pendapatan Jasa Retainer', 'revenue', 'Retainer service revenue'),
('4120', 'Pendapatan Jasa Project', 'revenue', 'Project service revenue'),
('4130', 'Pendapatan Event', 'revenue', 'Event revenue'),
('4200', 'Pendapatan Lain-lain', 'revenue', 'Other revenue'),

-- HPP / COGS (5xxx)
('5000', 'Harga Pokok Penjualan', 'hpp', 'Cost of goods sold'),
('5100', 'Biaya Talent/Freelancer', 'hpp', 'Talent/Freelancer costs'),
('5200', 'Biaya Produksi', 'hpp', 'Production costs'),
('5300', 'Biaya Vendor', 'hpp', 'Vendor costs'),
('5400', 'Biaya Transport Project', 'hpp', 'Project transport costs'),
('5500', 'Biaya Konsumsi Project', 'hpp', 'Project meal costs'),

-- EXPENSE (6xxx)
('6000', 'Beban Operasional', 'expense', 'Operating expenses'),
('6100', 'Beban SDM', 'expense', 'HR expenses'),
('6110', 'Gaji & Upah', 'expense', 'Salaries and wages'),
('6120', 'Tunjangan', 'expense', 'Allowances'),
('6130', 'BPJS', 'expense', 'BPJS contributions'),
('6140', 'THR & Bonus', 'expense', 'THR and bonuses'),
('6200', 'Beban Marketing', 'expense', 'Marketing expenses'),
('6210', 'Biaya Iklan', 'expense', 'Advertising costs'),
('6220', 'Biaya KOL', 'expense', 'KOL costs'),
('6300', 'Beban IT & Tools', 'expense', 'IT and tools expenses'),
('6310', 'SaaS & Subscription', 'expense', 'SaaS subscriptions'),
('6320', 'Domain & Hosting', 'expense', 'Domain and hosting'),
('6400', 'Beban Administrasi', 'expense', 'Administrative expenses'),
('6410', 'ATK', 'expense', 'Office supplies'),
('6420', 'Listrik & Air', 'expense', 'Utilities'),
('6430', 'Internet & Telepon', 'expense', 'Internet and phone'),
('6440', 'Kebersihan', 'expense', 'Cleaning'),
('6500', 'Beban Transport', 'expense', 'Transport expenses'),
('6600', 'Beban Legalitas', 'expense', 'Legal expenses'),
('6700', 'Beban Keuangan', 'expense', 'Financial expenses'),
('6710', 'Biaya Admin Bank', 'expense', 'Bank admin fees'),
('6720', 'Biaya Transfer', 'expense', 'Transfer fees');