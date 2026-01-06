import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SharedTask from "./SharedTask";
import SharedMeeting from "./SharedMeeting";

const SharedShortUrl = () => {
  const { token } = useParams<{ token: string }>();

  // Try to find if this token belongs to a task or meeting
  const { data: entityType, isLoading } = useQuery({
    queryKey: ["resolve-share-token", token],
    queryFn: async () => {
      if (!token) return null;

      // Check tasks first
      const { data: task } = await supabase
        .from("tasks")
        .select("id")
        .eq("share_token", token)
        .maybeSingle();

      if (task) return "task";

      // Check meetings
      const { data: meeting } = await supabase
        .from("meetings")
        .select("id")
        .eq("share_token", token)
        .maybeSingle();

      if (meeting) return "meeting";

      return null;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (entityType === "task") {
    return <SharedTask />;
  }

  if (entityType === "meeting") {
    return <SharedMeeting />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Link tidak ditemukan</p>
        <a href="/" className="text-primary underline hover:text-primary/80">
          Kembali ke Beranda
        </a>
      </div>
    </div>
  );
};

export default SharedShortUrl;
