import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeletionNotifications } from "@/components/hr/DeletionNotifications";
import { LeaveApprovalDialog } from "@/components/leave/LeaveApprovalDialog";
import { Clock, UserCheck, Briefcase, TrendingUp, Calendar, ChevronRight, ArrowUpFromLine, ArrowDownToLine, Video, Building2, CalendarOff, CheckCircle, XCircle } from "lucide-react";
import { format, differenceInHours, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
  revise: "Revise",
  todo: "To Do",
  done: "Done",
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
    case "done":
      return "bg-green-500";
    case "in_progress":
      return "bg-blue-500";
    case "pending":
    case "todo":
      return "bg-yellow-500";
    case "on_hold":
      return "bg-gray-500";
    case "revise":
      return "bg-red-500";
    default:
      return "bg-muted";
  }
};

export default function HRDashboard() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch all profiles
  const { data: profiles } = useQuery({
    queryKey: ["hr-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

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

  // Fetch all tasks within date range
  const { data: tasks } = useQuery({
    queryKey: ["hr-tasks", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          assigned_profile:profiles!fk_tasks_assigned_to_profiles(full_name),
          created_by_profile:profiles!fk_tasks_created_by_profiles(full_name),
          projects(title, clients(name))
        `)
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch shooting schedules
  const { data: shootings } = useQuery({
    queryKey: ["hr-shootings", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select(`
          *,
          clients(name),
          projects(title),
          requested_by_profile:profiles!fk_shooting_requested_by_profiles(full_name),
          tasks(status)
        `)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch pending leave requests
  const { data: pendingLeaveRequests } = useQuery({
    queryKey: ["hr-pending-leave-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          *,
          profiles:user_id (full_name, avatar_url)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all leave requests
  const { data: allLeaveRequests } = useQuery({
    queryKey: ["hr-all-leave-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          *,
          profiles:user_id (full_name, avatar_url),
          approver:approved_by (full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
  // Fetch tasks for selected user detail view
  const { data: userTasks } = useQuery({
    queryKey: ["hr-user-tasks", selectedUser?.id, startDate, endDate],
    queryFn: async () => {
      if (!selectedUser?.id) return { assignedToUser: [], createdByUser: [] };

      const [assignedRes, createdRes] = await Promise.all([
        supabase
          .from("tasks")
          .select(`*, projects(title, clients(name)), created_by_profile:profiles!fk_tasks_created_by_profiles(full_name)`)
          .eq("assigned_to", selectedUser.id)
          .gte("created_at", `${startDate}T00:00:00`)
          .lte("created_at", `${endDate}T23:59:59`)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select(`*, projects(title, clients(name)), assigned_profile:profiles!fk_tasks_assigned_to_profiles(full_name)`)
          .eq("created_by", selectedUser.id)
          .gte("created_at", `${startDate}T00:00:00`)
          .lte("created_at", `${endDate}T23:59:59`)
          .order("created_at", { ascending: false }),
      ]);

      return {
        assignedToUser: assignedRes.data || [],
        createdByUser: createdRes.data || [],
      };
    },
    enabled: !!selectedUser?.id,
  });

  // Calculate per-user task statistics
  const userTaskStats = profiles?.map(profile => {
    const tasksCreated = tasks?.filter(t => t.created_by === profile.id) || [];
    const tasksAssigned = tasks?.filter(t => t.assigned_to === profile.id) || [];
    
    return {
      ...profile,
      tasksCreatedCount: tasksCreated.length,
      tasksAssignedCount: tasksAssigned.length,
      completedCount: tasksAssigned.filter(t => t.status === 'done' || t.status === 'completed').length,
      inProgressCount: tasksAssigned.filter(t => t.status === 'in_progress').length,
    };
  }) || [];

  // Calculate statistics
  const stats = {
    totalUsers: profiles?.length || 0,
    todayAttendance: attendance?.filter(a => a.date === format(new Date(), 'yyyy-MM-dd')).length || 0,
    activeTasks: tasks?.filter(t => t.status !== 'done' && t.status !== 'completed').length || 0,
    completedTasks: tasks?.filter(t => t.status === 'done' || t.status === 'completed').length || 0,
  };

  const calculateWorkHours = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn) return "Not clocked in";
    if (!clockOut) return "Still working";
    
    const hours = differenceInHours(parseISO(clockOut), parseISO(clockIn));
    return `${hours}h`;
  };

  const openUserDetail = (user: any) => {
    setSelectedUser(user);
    setDetailDialogOpen(true);
  };

  const handleLeaveApprovalClick = (request: any) => {
    setSelectedLeaveRequest(request);
    setApprovalDialogOpen(true);
  };

  const getLeaveTypeBadge = (type: string) => {
    switch (type) {
      case "sakit":
        return <Badge className="bg-red-500">Sakit</Badge>;
      case "cuti":
        return <Badge className="bg-blue-500">Cuti</Badge>;
      case "izin":
        return <Badge className="bg-yellow-500">Izin</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getLeaveStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">HR Dashboard</h1>
          <p className="text-muted-foreground">Monitor employee attendance and productivity</p>
        </div>

        {/* Date Range Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filter Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                  }}
                >
                  This Month
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate(format(new Date(), 'yyyy-MM-dd'));
                    setEndDate(format(new Date(), 'yyyy-MM-dd'));
                  }}
                >
                  Today
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <CardTitle className="text-sm font-medium">Active Tasks (Period)</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTasks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed (Period)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedTasks}</div>
            </CardContent>
          </Card>
        </div>

        {/* Deletion Notifications */}
        <DeletionNotifications />

        <Tabs defaultValue="leave-approval" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leave-approval" className="relative">
              <CalendarOff className="h-4 w-4 mr-2" />
              Leave Approval
              {pendingLeaveRequests && pendingLeaveRequests.length > 0 && (
                <span className="ml-2 bg-destructive text-destructive-foreground text-xs rounded-full px-2">
                  {pendingLeaveRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="overview">Task Overview per Person</TabsTrigger>
            <TabsTrigger value="shootings">Shooting Schedules</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="all-tasks">All Tasks</TabsTrigger>
          </TabsList>

          {/* Leave Approval Tab */}
          <TabsContent value="leave-approval" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarOff className="h-5 w-5" />
                  Pending Leave Requests ({pendingLeaveRequests?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingLeaveRequests && pendingLeaveRequests.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {pendingLeaveRequests.map((request: any) => (
                      <Card key={request.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <p className="font-medium">{request.profiles?.full_name}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {getLeaveTypeBadge(request.leave_type)}
                                {getLeaveStatusBadge(request.status)}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {format(new Date(request.start_date), "dd MMM yyyy", { locale: idLocale })}
                                  {request.start_date !== request.end_date && (
                                    <> - {format(new Date(request.end_date), "dd MMM yyyy", { locale: idLocale })}</>
                                  )}
                                </span>
                              </div>
                              {request.reason && (
                                <p className="text-sm text-muted-foreground">{request.reason}</p>
                              )}
                            </div>
                            <Button size="sm" onClick={() => handleLeaveApprovalClick(request)}>
                              Review
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                    <p className="text-muted-foreground">No pending leave requests</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leave History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Processed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allLeaveRequests?.map((request: any) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.profiles?.full_name}</TableCell>
                          <TableCell>{getLeaveTypeBadge(request.leave_type)}</TableCell>
                          <TableCell>
                            {format(new Date(request.start_date), "dd MMM yyyy", { locale: idLocale })}
                            {request.start_date !== request.end_date && (
                              <> - {format(new Date(request.end_date), "dd MMM yyyy", { locale: idLocale })}</>
                            )}
                          </TableCell>
                          <TableCell>{getLeaveStatusBadge(request.status)}</TableCell>
                          <TableCell>{request.approver?.full_name || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Task Overview per Person */}
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Task Statistics per Employee ({format(new Date(startDate), 'dd MMM yyyy')} - {format(new Date(endDate), 'dd MMM yyyy')})</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-center">Tasks Created</TableHead>
                        <TableHead className="text-center">Tasks Assigned</TableHead>
                        <TableHead className="text-center">In Progress</TableHead>
                        <TableHead className="text-center">Completed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userTaskStats.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-primary/10">
                              <ArrowUpFromLine className="h-3 w-3 mr-1" />
                              {user.tasksCreatedCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-secondary/50">
                              <ArrowDownToLine className="h-3 w-3 mr-1" />
                              {user.tasksAssignedCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-500">{user.inProgressCount}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-500">{user.completedCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openUserDetail(user)}
                            >
                              Detail
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shooting Schedules Tab */}
          <TabsContent value="shootings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Shooting Schedules ({shootings?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Client / Project</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Task Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shootings?.map((shooting) => (
                        <TableRow key={shooting.id}>
                          <TableCell className="font-medium">{shooting.title}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-primary">{shooting.clients?.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{shooting.projects?.title}</span>
                          </TableCell>
                          <TableCell>
                            {format(new Date(shooting.scheduled_date), 'dd MMM yyyy')}
                            <br />
                            <span className="text-xs text-muted-foreground">{shooting.scheduled_time}</span>
                          </TableCell>
                          <TableCell>{shooting.requested_by_profile?.full_name}</TableCell>
                          <TableCell>
                            <Badge className={
                              shooting.status === 'approved' ? 'bg-green-500' :
                              shooting.status === 'rejected' ? 'bg-red-500' :
                              shooting.status === 'cancelled' ? 'bg-gray-500' :
                              'bg-yellow-500'
                            }>
                              {shooting.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {shooting.tasks ? (
                              <Badge className={getStatusColor(shooting.tasks.status)}>
                                {statusLabels[shooting.tasks.status] || shooting.tasks.status}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Recent Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
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
          </TabsContent>

          {/* All Tasks Tab */}
          <TabsContent value="all-tasks">
            <Card>
              <CardHeader>
                <CardTitle>All Tasks in Period</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Created By</TableHead>
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
                          <TableCell>{task.created_by_profile?.full_name || '-'}</TableCell>
                          <TableCell>{task.assigned_profile?.full_name || 'Unassigned'}</TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{task.projects?.clients?.name}</span>
                            <br />
                            {task.projects?.title}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(task.status)}>
                              {statusLabels[task.status] || task.status}
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
                            {task.requested_at ? format(new Date(task.requested_at), 'dd MMM yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {task.deadline ? format(new Date(task.deadline), 'dd MMM yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* User Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Task Detail: {selectedUser?.full_name}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({format(new Date(startDate), 'dd MMM yyyy')} - {format(new Date(endDate), 'dd MMM yyyy')})
                </span>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="assigned-to" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="assigned-to">
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  Tasks Assigned to {selectedUser?.full_name} ({userTasks?.assignedToUser.length || 0})
                </TabsTrigger>
                <TabsTrigger value="created-by">
                  <ArrowUpFromLine className="h-4 w-4 mr-2" />
                  Tasks Created by {selectedUser?.full_name} ({userTasks?.createdByUser.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="assigned-to" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {userTasks?.assignedToUser.length ? (
                    <div className="space-y-3">
                      {userTasks.assignedToUser.map((task: any) => (
                        <div key={task.id} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium">{task.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {task.projects?.clients?.name} - {task.projects?.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                From: {task.created_by_profile?.full_name || "Unknown"}
                              </p>
                            </div>
                            <Badge className={getStatusColor(task.status)}>
                              {statusLabels[task.status] || task.status}
                            </Badge>
                          </div>
                          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Requested: {task.requested_at ? format(new Date(task.requested_at), 'dd MMM yyyy') : '-'}</span>
                            <span>Deadline: {task.deadline ? format(new Date(task.deadline), 'dd MMM yyyy') : '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No tasks assigned to this user in this period</p>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="created-by" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {userTasks?.createdByUser.length ? (
                    <div className="space-y-3">
                      {userTasks.createdByUser.map((task: any) => (
                        <div key={task.id} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium">{task.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {task.projects?.clients?.name} - {task.projects?.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Assigned to: {task.assigned_profile?.full_name || "Unassigned"}
                              </p>
                            </div>
                            <Badge className={getStatusColor(task.status)}>
                              {statusLabels[task.status] || task.status}
                            </Badge>
                          </div>
                          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Requested: {task.requested_at ? format(new Date(task.requested_at), 'dd MMM yyyy') : '-'}</span>
                            <span>Deadline: {task.deadline ? format(new Date(task.deadline), 'dd MMM yyyy') : '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No tasks created by this user in this period</p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {selectedLeaveRequest && (
          <LeaveApprovalDialog
            open={approvalDialogOpen}
            onOpenChange={setApprovalDialogOpen}
            request={selectedLeaveRequest}
          />
        )}
      </div>
    </AppLayout>
  );
}