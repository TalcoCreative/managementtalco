-- Drop existing restrictive policies for kol_database
DROP POLICY IF EXISTS "Authorized roles can view KOL database" ON public.kol_database;
DROP POLICY IF EXISTS "Authorized roles can manage KOL database" ON public.kol_database;

-- Drop existing restrictive policies for kol_campaigns
DROP POLICY IF EXISTS "Authorized roles can view KOL campaigns" ON public.kol_campaigns;
DROP POLICY IF EXISTS "Authorized roles can manage KOL campaigns" ON public.kol_campaigns;

-- Create new policies for kol_database - all authenticated users can access
CREATE POLICY "All authenticated users can view KOL database"
ON public.kol_database
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can manage KOL database"
ON public.kol_database
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create new policies for kol_campaigns - all authenticated users can access
CREATE POLICY "All authenticated users can view KOL campaigns"
ON public.kol_campaigns
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can manage KOL campaigns"
ON public.kol_campaigns
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);