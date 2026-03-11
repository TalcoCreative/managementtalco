
-- Create DB triggers for push notifications as reliable backup
-- These fire whenever a notification/mention/candidate record is inserted

CREATE TRIGGER trigger_push_on_task_notification
AFTER INSERT ON public.task_notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_on_task_notification();

CREATE TRIGGER trigger_push_on_mention
AFTER INSERT ON public.comment_mentions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_on_mention();

CREATE TRIGGER trigger_push_on_candidate_notification
AFTER INSERT ON public.candidate_notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_on_candidate_notification();
