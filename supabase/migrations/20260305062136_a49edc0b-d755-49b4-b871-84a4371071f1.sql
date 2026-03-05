-- =============================================
-- BATCH 2: FINANCE (income, expenses, ledger, payroll, recurring, balance_sheet)
-- =============================================

-- INCOME
DROP POLICY IF EXISTS "Finance roles can view income" ON public.income;
CREATE POLICY "Authorized users can view income" ON public.income
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_view')
  );

DROP POLICY IF EXISTS "Finance can manage income" ON public.income;
CREATE POLICY "Authorized users can manage income" ON public.income
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_edit')
  );

DROP POLICY IF EXISTS "Finance roles can delete income" ON public.income;
CREATE POLICY "Authorized users can delete income" ON public.income
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_delete')
  );

-- EXPENSES
DROP POLICY IF EXISTS "Finance roles can view expenses" ON public.expenses;
CREATE POLICY "Authorized users can view expenses" ON public.expenses
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_view')
  );

DROP POLICY IF EXISTS "Finance roles can manage expenses" ON public.expenses;
CREATE POLICY "Authorized users can manage expenses" ON public.expenses
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_edit')
  );

DROP POLICY IF EXISTS "Finance roles can delete expenses" ON public.expenses;
CREATE POLICY "Authorized users can delete expenses" ON public.expenses
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_delete')
  );

-- LEDGER_ENTRIES
DROP POLICY IF EXISTS "Finance roles can view ledger" ON public.ledger_entries;
CREATE POLICY "Authorized users can view ledger" ON public.ledger_entries
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_view')
  );

DROP POLICY IF EXISTS "Finance roles can create ledger entries" ON public.ledger_entries;
CREATE POLICY "Authorized users can create ledger entries" ON public.ledger_entries
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_create')
  );

DROP POLICY IF EXISTS "Finance roles can update ledger entries" ON public.ledger_entries;
CREATE POLICY "Authorized users can update ledger entries" ON public.ledger_entries
  FOR UPDATE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_edit')
  );

DROP POLICY IF EXISTS "Finance roles can delete ledger entries" ON public.ledger_entries;
CREATE POLICY "Authorized users can delete ledger entries" ON public.ledger_entries
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_delete')
  );

-- PAYROLL
DROP POLICY IF EXISTS "HR and finance can view payroll" ON public.payroll;
CREATE POLICY "Authorized users can view payroll" ON public.payroll
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_view')
  );

DROP POLICY IF EXISTS "HR can manage payroll" ON public.payroll;
CREATE POLICY "Authorized users can manage payroll" ON public.payroll
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_edit')
  );

DROP POLICY IF EXISTS "Finance can update payroll status" ON public.payroll;
CREATE POLICY "Finance can update payroll status" ON public.payroll
  FOR UPDATE USING (
    has_role(auth.uid(), 'finance'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_edit')
  );

DROP POLICY IF EXISTS "Finance roles can delete payroll" ON public.payroll;
CREATE POLICY "Authorized users can delete payroll" ON public.payroll
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'hr'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_delete')
  );

-- RECURRING_BUDGET
DROP POLICY IF EXISTS "Finance roles can view recurring budget" ON public.recurring_budget;
CREATE POLICY "Authorized users can view recurring budget" ON public.recurring_budget
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_view')
  );

DROP POLICY IF EXISTS "Finance roles can manage recurring budget" ON public.recurring_budget;
CREATE POLICY "Authorized users can manage recurring budget" ON public.recurring_budget
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_edit')
  );

DROP POLICY IF EXISTS "Finance roles can delete recurring budget" ON public.recurring_budget;
CREATE POLICY "Authorized users can delete recurring budget" ON public.recurring_budget
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_delete')
  );

-- BALANCE_SHEET_ITEMS
DROP POLICY IF EXISTS "Finance/Accounting/Admin can manage balance sheet items" ON public.balance_sheet_items;
CREATE POLICY "Authorized users can manage balance sheet items" ON public.balance_sheet_items
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_dynamic_perm(auth.uid(), 'balance_sheet', 'can_edit') OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_edit')
  );

-- CHART_OF_ACCOUNTS
DROP POLICY IF EXISTS "Finance/Accounting/Admin can manage chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Authorized users can manage chart of accounts" ON public.chart_of_accounts
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_edit')
  );

-- LEDGER_ACCOUNT_MAPPINGS
DROP POLICY IF EXISTS "Finance/Accounting/Admin can manage ledger account mappings" ON public.ledger_account_mappings;
CREATE POLICY "Authorized users can manage ledger account mappings" ON public.ledger_account_mappings
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'finance'::app_role) OR
    has_role(auth.uid(), 'accounting'::app_role) OR
    has_dynamic_perm(auth.uid(), 'finance', 'can_edit')
  );