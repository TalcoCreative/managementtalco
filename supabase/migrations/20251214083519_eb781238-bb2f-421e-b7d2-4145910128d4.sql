-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  leave_type TEXT NOT NULL, -- 'izin', 'sakit', 'cuti'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own leave requests
CREATE POLICY "Users can view their own leave requests"
ON public.leave_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own leave requests
CREATE POLICY "Users can create their own leave requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- HR and super admin can view all leave requests
CREATE POLICY "HR and super admin can view all leave requests"
ON public.leave_requests
FOR SELECT
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

-- HR and super admin can update leave requests (approve/reject)
CREATE POLICY "HR and super admin can update leave requests"
ON public.leave_requests
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));

-- Add foreign key constraints
ALTER TABLE public.leave_requests 
ADD CONSTRAINT fk_leave_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.leave_requests 
ADD CONSTRAINT fk_leave_approver FOREIGN KEY (approved_by) REFERENCES public.profiles(id);