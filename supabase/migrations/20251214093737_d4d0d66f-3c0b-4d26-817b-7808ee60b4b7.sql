-- Add sub_category column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS sub_category text;

-- Add sub_category column to ledger_entries table  
ALTER TABLE public.ledger_entries 
ADD COLUMN IF NOT EXISTS sub_category text;

-- Update existing expenses to have sub_category based on category
UPDATE public.expenses 
SET sub_category = 
  CASE category
    WHEN 'operational' THEN 'transport'
    WHEN 'project' THEN 'produksi_konten'
    WHEN 'payroll' THEN 'gaji_upah'
    WHEN 'reimburse' THEN 'reimburse_karyawan'
    ELSE 'tidak_terklasifikasi'
  END
WHERE sub_category IS NULL;

-- Update existing ledger entries to have sub_category based on sub_type
UPDATE public.ledger_entries 
SET sub_category = 
  CASE sub_type
    WHEN 'operational' THEN 'transport'
    WHEN 'project' THEN 'produksi_konten'
    WHEN 'payroll' THEN 'gaji_upah'
    WHEN 'reimburse' THEN 'reimburse_karyawan'
    ELSE 'tidak_terklasifikasi'
  END
WHERE sub_category IS NULL;