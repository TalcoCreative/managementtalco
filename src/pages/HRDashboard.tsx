import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, UserCheck, Briefcase, TrendingUp } from "lucide-react";
import { format, differenceInHours, parseISO } from "date-fns";

export default function HRDashboard() {
  // Fetch all users with their attendance
  const { data: attendance } = useQuery({
    queryKey: ["hr-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, profiles(full_name)")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch all tasks with user info
  const { data: tasks } = useQuery({
    queryKey: ["hr-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          profiles!tasks_assigned_to_fkey(full_name),
          projects(title)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Calculate statistics
  const stats = {
    totalUsers: new Set(attendance?.map(a => a.user_id)).size || 0,
    todayAttendance: attendance?.filter(a => a.date === format(new Date(), 'yyyy-MM-dd')).length || 0,
    activeTasks: tasks?.filter(t => t.status !== 'done').length || 0,
    completedTasks: tasks?.filter(t => t.status === 'done').length || 0,
  };

  const calculateWorkHours = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn) return "Not clocked in";
    if (!clockOut) return "Still working";
    
    const hours = differenceInHours(parseISO(clockOut), parseISO(clockIn));
    return `${hours}h`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">HR Dashboard</h1>
          <p className="text-muted-foreground">Monitor employee attendance and productivity</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayAttendance}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTasks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedTasks}</div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Work Hours</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance?.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.profiles?.full_name}
                      </TableCell>
                      <TableCell>{format(new Date(record.date), 'PPP')}</TableCell>
                      <TableCell>
                        {record.clock_in ? format(new Date(record.clock_in), 'HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        {record.clock_out ? format(new Date(record.clock_out), 'HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {calculateWorkHours(record.clock_in, record.clock_out)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Task Overview by User */}
        <Card>
          <CardHeader>
            <CardTitle>Task Overview by Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks?.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.profiles?.full_name || 'Unassigned'}</TableCell>
                      <TableCell>{task.projects?.title}</TableCell>
                      <TableCell>
                        <Badge variant={
                          task.status === 'done' ? 'default' :
                          task.status === 'in_progress' ? 'secondary' : 'outline'
                        }>
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          task.priority === 'high' ? 'destructive' :
                          task.priority === 'medium' ? 'default' : 'outline'
                        }>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {task.requested_at ? format(new Date(task.requested_at), 'PPp') : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {task.deadline ? format(new Date(task.deadline), 'PPP') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
