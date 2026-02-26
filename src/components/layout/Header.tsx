import { useEffect, useState } from "react";
import { LogOut, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreateAnnouncementDialog } from "@/components/announcements/CreateAnnouncementDialog";
import { ManageAnnouncementsDialog } from "@/components/announcements/ManageAnnouncementsDialog";
import { HeaderNotifications } from "@/components/layout/HeaderNotifications";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const [manageAnnouncementsOpen, setManageAnnouncementsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      return session.session.user;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id);
      return data?.map((r) => r.role) || [];
    },
    enabled: !!currentUser,
  });

  const canManageAnnouncements = userRoles?.includes("hr") || userRoles?.includes("super_admin");

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel('task-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
        const newTask = payload.new as any;
        if (newTask.assigned_to === currentUser.id) {
          toast.info(`New task assigned to you: ${newTask.title}`, { duration: 5000 });
        } else {
          toast.info(`New task created: ${newTask.title}`, { duration: 3000 });
        }
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["active-tasks"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser, queryClient]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <header className="flex h-12 sm:h-14 items-center justify-between border-b border-border/40 bg-card/80 backdrop-blur-xl px-3 sm:px-5 gap-2 sticky top-0 z-40">
      {!isMobile && <SidebarTrigger className="flex-shrink-0" />}
      {isMobile && <h1 className="text-sm font-semibold truncate">Talco</h1>}
      
      <div className="flex items-center gap-1">
        {canManageAnnouncements && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Pengumuman" className="h-8 w-8">
                <Megaphone className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCreateAnnouncementOpen(true)}>
                Buat Pengumuman
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setManageAnnouncementsOpen(true)}>
                Kelola Pengumuman
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        <HeaderNotifications onTaskClick={(taskId) => setSelectedTaskId(taskId)} />

        <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <CreateAnnouncementDialog open={createAnnouncementOpen} onOpenChange={setCreateAnnouncementOpen} />
      <ManageAnnouncementsDialog open={manageAnnouncementsOpen} onOpenChange={setManageAnnouncementsOpen} />
      {selectedTaskId && (
        <TaskDetailDialog
          taskId={selectedTaskId}
          open={!!selectedTaskId}
          onOpenChange={(open) => !open && setSelectedTaskId(null)}
        />
      )}
    </header>
  );
}
