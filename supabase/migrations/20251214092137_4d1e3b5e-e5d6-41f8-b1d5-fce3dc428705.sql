-- Create ledger_entries table (central ledger for all transactions)
CREATE TABLE public.ledger_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  sub_type TEXT NOT NULL CHECK (sub_type IN ('payroll', 'reimburse', 'operational', 'project', 'other')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('payroll', 'reimburse', 'recurring', 'manual', 'income')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('payroll', 'reimburse', 'operational', 'project', 'other')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  ledger_entry_id UUID REFERENCES public.ledger_entries(id) ON DELETE SET NULL
);

-- Create recurring_budget table
CREATE TABLE public.recurring_budget (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly', 'custom')),
  custom_days INTEGER,
  start_date DATE NOT NULL,
  end_date DATE,
  due_day INTEGER,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create payroll table
CREATE TABLE public.payroll (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC NOT NULL,
  pay_date DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'paid')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  ledger_entry_id UUID REFERENCES public.ledger_entries(id) ON DELETE SET NULL,
  UNIQUE(employee_id, month)
);

-- Create reimbursements table
CREATE TABLE public.reimbursements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  request_from TEXT NOT NULL CHECK (request_from IN ('event', 'meeting', 'production', 'operational', 'other')),
  receipt_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ledger_entry_id UUID REFERENCES public.ledger_entries(id) ON DELETE SET NULL
);

-- Create income table
CREATE TABLE public.income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  recurring_id UUID REFERENCES public.recurring_budget(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'expected' CHECK (status IN ('expected', 'received')),
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  ledger_entry_id UUID REFERENCES public.ledger_entries(id) ON DELETE SET NULL
);

-- Enable RLS on all tables
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

-- Ledger entries policies (Finance, Accounting, HR, Super Admin can view)
CREATE POLICY "Finance roles can view ledger" ON public.ledger_entries
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance') OR 
    has_role(auth.uid(), 'accounting') OR 
    has_role(auth.uid(), 'hr')
  );

CREATE POLICY "Finance roles can create ledger entries" ON public.ledger_entries
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance') OR 
    has_role(auth.uid(), 'accounting')
  );

-- Expenses policies
CREATE POLICY "Finance roles can view expenses" ON public.expenses
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance') OR 
    has_role(auth.uid(), 'accounting') OR 
    has_role(auth.uid(), 'hr')
  );

CREATE POLICY "Finance roles can manage expenses" ON public.expenses
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance') OR 
    has_role(auth.uid(), 'accounting') OR 
    has_role(auth.uid(), 'hr')
  );

-- Recurring budget policies
CREATE POLICY "Finance roles can view recurring budget" ON public.recurring_budget
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance') OR 
    has_role(auth.uid(), 'accounting')
  );

CREATE POLICY "Finance roles can manage recurring budget" ON public.recurring_budget
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance')
  );

-- Payroll policies
CREATE POLICY "HR and finance can view payroll" ON public.payroll
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance') OR 
    has_role(auth.uid(), 'hr')
  );

CREATE POLICY "HR can manage payroll" ON public.payroll
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'hr')
  );

CREATE POLICY "Finance can update payroll status" ON public.payroll
  FOR UPDATE USING (has_role(auth.uid(), 'finance'));

-- Reimbursements policies
CREATE POLICY "Users can view their own reimbursements" ON public.reimbursements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Approvers can view all reimbursements" ON public.reimbursements
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance') OR 
    has_role(auth.uid(), 'hr')
  );

CREATE POLICY "Users can create reimbursements" ON public.reimbursements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Approvers can update reimbursements" ON public.reimbursements
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance') OR 
    has_role(auth.uid(), 'hr')
  );

-- Income policies
CREATE POLICY "Finance roles can view income" ON public.income
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance') OR 
    has_role(auth.uid(), 'accounting')
  );

CREATE POLICY "Finance can manage income" ON public.income
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'finance')
  );