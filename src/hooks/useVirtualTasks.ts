import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPast, parseISO, parse, isAfter } from "date-fns";

export interface VirtualTask {
  id: string;
  title: string;
  type: 'task' | 'shooting' | 'meeting';
  status: string;
  deadline: string | null;
  project_id: string | null;
  project_title: string | null;
  client_name: string | null;
  assigned_to: string[];
  created_by: string;
  created_at: string;
  priority?: string;
  description?: string;
  isOverdue: boolean;
  originalData: any;
}

export function useVirtualTasks(userId?: string) {
  // Fetch regular tasks
  const { data: tasks } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          projects(id, title, clients(name)),
          profiles:profiles!fk_tasks_assigned_to_profiles(id, full_name),
          task_assignees(user_id, profiles(id, full_name))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch shootings with crew
  const { data: shootings } = useQuery({
    queryKey: ["shootings-for-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select(`
          *,
          clients(name),
          projects(id, title),
          shooting_crew(user_id, profiles(id, full_name)),
          requested_by_profile:profiles!fk_shooting_requested_by_profiles(id, full_name),
          director_profile:profiles!fk_shooting_director_profiles(id, full_name),
          runner_profile:profiles!fk_shooting_runner_profiles(id, full_name)
        `);
      if (error) throw error;
      return data;
    },
  });

  // Fetch meetings with participants
  const { data: meetings } = useQuery({
    queryKey: ["meetings-for-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          clients(name),
          projects(id, title),
          meeting_participants(user_id, profiles(id, full_name)),
          creator:profiles!fk_meetings_created_by(id, full_name)
        `);
      if (error) throw error;
      return data;
    },
  });

  // Transform tasks into virtual tasks
  const virtualTasks: VirtualTask[] = [];

  // Add regular tasks
  tasks?.forEach(task => {
    const assignees: string[] = [];
    if (task.assigned_to) assignees.push(task.assigned_to);
    task.task_assignees?.forEach((ta: any) => {
      if (ta.user_id && !assignees.includes(ta.user_id)) {
        assignees.push(ta.user_id);
      }
    });

    const isOverdue = task.deadline && 
      task.status !== 'completed' && 
      task.status !== 'done' && 
      isPast(parseISO(task.deadline));

    virtualTasks.push({
      id: task.id,
      title: task.title,
      type: 'task',
      status: task.status,
      deadline: task.deadline,
      project_id: task.project_id,
      project_title: task.projects?.title || null,
      client_name: task.projects?.clients?.name || null,
      assigned_to: assignees,
      created_by: task.created_by,
      created_at: task.created_at,
      priority: task.priority,
      description: task.description,
      isOverdue: !!isOverdue,
      originalData: task,
    });
  });

  // Add shootings as virtual tasks
  shootings?.forEach(shooting => {
    const assignees: string[] = [];
    // Add requester
    if (shooting.requested_by) assignees.push(shooting.requested_by);
    // Add director
    if (shooting.director && !assignees.includes(shooting.director)) assignees.push(shooting.director);
    // Add runner
    if (shooting.runner && !assignees.includes(shooting.runner)) assignees.push(shooting.runner);
    // Add crew
    shooting.shooting_crew?.forEach((crew: any) => {
      if (crew.user_id && !assignees.includes(crew.user_id)) {
        assignees.push(crew.user_id);
      }
    });

    // Auto-complete status if past shooting date AND time
    const now = new Date();
    let shootingDateTime: Date | null = null;
    
    if (shooting.scheduled_date) {
      const dateStr = shooting.scheduled_date;
      if (shooting.scheduled_time) {
        // Combine date and time
        shootingDateTime = parse(
          `${dateStr} ${shooting.scheduled_time}`,
          'yyyy-MM-dd HH:mm:ss',
          new Date()
        );
      } else {
        // Just use date at end of day
        shootingDateTime = parseISO(`${dateStr}T23:59:59`);
      }
    }
    
    let status = shooting.status;
    if (shootingDateTime && isAfter(now, shootingDateTime) && status !== 'cancelled' && status !== 'rejected') {
      status = 'completed';
    }

    virtualTasks.push({
      id: `shooting-${shooting.id}`,
      title: `[Shooting] ${shooting.title}`,
      type: 'shooting',
      status: status,
      deadline: shooting.scheduled_date,
      project_id: shooting.project_id,
      project_title: shooting.projects?.title || null,
      client_name: shooting.clients?.name || null,
      assigned_to: assignees,
      created_by: shooting.requested_by,
      created_at: shooting.created_at,
      priority: 'high',
      description: shooting.notes,
      isOverdue: false,
      originalData: shooting,
    });
  });

  // Add meetings as virtual tasks
  meetings?.forEach(meeting => {
    const assignees: string[] = [];
    // Add creator
    if (meeting.created_by) assignees.push(meeting.created_by);
    // Add participants
    meeting.meeting_participants?.forEach((p: any) => {
      if (p.user_id && !assignees.includes(p.user_id)) {
        assignees.push(p.user_id);
      }
    });

    // Check meeting status
    const meetingDate = meeting.meeting_date ? parseISO(meeting.meeting_date) : null;
    let status = meeting.status;
    if (meetingDate && isPast(meetingDate) && status !== 'completed' && status !== 'cancelled') {
      status = 'no_update'; // No update/tidak ada keterangan
    }

    virtualTasks.push({
      id: `meeting-${meeting.id}`,
      title: `[Meeting] ${meeting.title}`,
      type: 'meeting',
      status: status,
      deadline: meeting.meeting_date,
      project_id: meeting.project_id,
      project_title: meeting.projects?.title || null,
      client_name: meeting.clients?.name || null,
      assigned_to: assignees,
      created_by: meeting.created_by,
      created_at: meeting.created_at,
      priority: 'medium',
      description: meeting.notes,
      isOverdue: false,
      originalData: meeting,
    });
  });

  // Filter by user if specified
  const userTasks = userId 
    ? virtualTasks.filter(vt => 
        vt.assigned_to.includes(userId) || vt.created_by === userId
      )
    : virtualTasks;

  const assignedToUser = userId
    ? virtualTasks.filter(vt => vt.assigned_to.includes(userId))
    : [];

  const createdByUser = userId
    ? virtualTasks.filter(vt => vt.created_by === userId)
    : [];

  // Get overdue tasks by project
  const overdueByProject = new Map<string, VirtualTask[]>();
  virtualTasks.filter(vt => vt.isOverdue && vt.project_id).forEach(vt => {
    const projectId = vt.project_id!;
    if (!overdueByProject.has(projectId)) {
      overdueByProject.set(projectId, []);
    }
    overdueByProject.get(projectId)!.push(vt);
  });

  return {
    virtualTasks,
    userTasks,
    assignedToUser,
    createdByUser,
    overdueByProject,
    isLoading: !tasks && !shootings && !meetings,
  };
}
