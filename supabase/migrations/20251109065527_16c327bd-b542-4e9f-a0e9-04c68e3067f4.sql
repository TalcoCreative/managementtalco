-- Add photo stamp columns and task activity to attendance
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS photo_clock_in TEXT,
ADD COLUMN IF NOT EXISTS photo_clock_out TEXT,
ADD COLUMN IF NOT EXISTS tasks_completed TEXT[];

-- Create a task_activities table to track all task-related work
CREATE TABLE IF NOT EXISTS task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  activity_type TEXT NOT NULL, -- 'created', 'updated', 'completed'
  task_id UUID REFERENCES tasks(id),
  task_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_activities
CREATE POLICY "Users can view their own activities"
ON task_activities
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activities"
ON task_activities
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "HR and super admin can view all activities"
ON task_activities
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'hr'));