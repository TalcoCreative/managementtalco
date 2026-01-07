-- Create table for storing mentions in comments
CREATE TABLE public.comment_mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_id, mentioned_user_id)
);

-- Enable Row Level Security
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

-- Create policies for comment_mentions
CREATE POLICY "Users can view their own mentions"
ON public.comment_mentions
FOR SELECT
USING (mentioned_user_id = auth.uid());

CREATE POLICY "Authenticated users can create mentions"
ON public.comment_mentions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own mention read status"
ON public.comment_mentions
FOR UPDATE
USING (mentioned_user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_comment_mentions_user ON public.comment_mentions(mentioned_user_id);
CREATE INDEX idx_comment_mentions_task ON public.comment_mentions(task_id);
CREATE INDEX idx_comment_mentions_unread ON public.comment_mentions(mentioned_user_id, is_read) WHERE is_read = FALSE;