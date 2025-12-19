-- Add rejection_reason column to meeting_participants
ALTER TABLE public.meeting_participants 
ADD COLUMN rejection_reason TEXT;