import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, User, Edit, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { AddUserRoleDialog } from "@/components/users/AddUserRoleDialog";
import { EmployeeDetailDialog } from "@/components/users/EmployeeDetailDialog";
import { DeleteUserDialog } from "@/components/users/DeleteUserDialog";
import { format } from "date-fns";

export default function Users() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      
      if (rolesError) throw rolesError;

      return profiles?.map(profile => ({
        ...profile,
        user_roles: roles?.filter(r => r.user_id === profile.id) || []
      }));
    },
  });

  // Fetch today's attendance for all users
  const { data: todayAttendance } = useQuery({
    queryKey: ["today-attendance", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("user_id, clock_in, clock_out")
        .eq("date", today);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch approved leaves for today
  const { data: todayLeaves } = useQuery({
    queryKey: ["today-leaves", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("user_id, leave_type")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id)
        .single();
      
      return data?.role;
    },
  });

  const isSuperAdmin = userRole === "super_admin";
  const isHR = userRole === "hr";
  const canManageUsers = isSuperAdmin || isHR;

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-primary";
      case "hr":
        return "bg-blue-500";
      case "socmed_admin":
        return "bg-yellow-500";
      case "graphic_designer":
        return "bg-purple-500";
      case "copywriter":
        return "bg-green-500";
      case "video_editor":
        return "bg-red-500";
      case "finance":
        return "bg-emerald-500";
      case "accounting":
        return "bg-cyan-500";
      case "marketing":
        return "bg-orange-500";
      case "photographer":
        return "bg-pink-500";
      case "director":
        return "bg-indigo-500";
      case "project_manager":
        return "bg-teal-500";
      default:
        return "bg-muted";
    }
  };

  const getAttendanceStatus = (userId: string) => {
    // Check for approved leave first
    const leave = todayLeaves?.find(l => l.user_id === userId);
    if (leave) {
      const leaveLabel = leave.leave_type === 'sakit' ? 'Sakit' : 
                        leave.leave_type === 'cuti' ? 'Cuti' : 'Izin';
      return { status: "on_leave", label: leaveLabel, icon: XCircle, color: "text-blue-500" };
    }

    const attendance = todayAttendance?.find(a => a.user_id === userId);
    if (!attendance) {
      return { status: "not_clocked", label: "Belum Absen", icon: XCircle, color: "text-muted-foreground" };
    }
    if (attendance.clock_in && attendance.clock_out) {
      return { status: "complete", label: "Sudah Pulang", icon: CheckCircle, color: "text-green-500" };
    }
    if (attendance.clock_in) {
      return { status: "clocked_in", label: "Hadir", icon: Clock, color: "text-blue-500" };
    }
    return { status: "not_clocked", label: "Belum Absen", icon: XCircle, color: "text-muted-foreground" };
  };

  const handleCardClick = (user: any) => {
    setSelectedUser(user);
    setDetailDialogOpen(true);
  };

  const handleEditRole = (e: React.MouseEvent, user: any) => {
    e.stopPropagation();
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const handleDeleteUser = (e: React.MouseEvent, user: any) => {
    e.stopPropagation();
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Team Members</h1>
          {isSuperAdmin && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-32 bg-muted" />
              </Card>
            ))}
          </div>
        ) : users && users.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => {
              const attendanceInfo = getAttendanceStatus(user.id);
              const AttendanceIcon = attendanceInfo.icon;

              return (
                <Card 
                  key={user.id} 
                  className={`hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02] ${user.status === 'non_active' ? 'opacity-60' : ''}`}
                  onClick={() => handleCardClick(user)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                          {user.full_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{user.full_name}</CardTitle>
                          {user.status === 'non_active' && (
                            <Badge variant="secondary" className="text-xs">Non-Active</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email || user.user_id}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Attendance Status */}
                    <div className={`flex items-center gap-2 ${attendanceInfo.color}`}>
                      <AttendanceIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">{attendanceInfo.label}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {user.user_roles?.map((ur: any, index: number) => (
                          <Badge key={index} className={getRoleColor(ur.role)}>
                            {ur.role.replace(/_/g, " ")}
                          </Badge>
                        ))}
                        {(!user.user_roles || user.user_roles.length === 0) && (
                          <Badge variant="secondary">No role assigned</Badge>
                        )}
                      </div>
                      {canManageUsers && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleEditRole(e, user)}
                            title="Manage Roles"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteUser(e, user)}
                            title="Delete User"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {user.phone && (
                      <p className="text-xs text-muted-foreground">{user.phone}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No users yet</p>
            </CardContent>
          </Card>
        )}
      </div>

      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      
      {selectedUser && (
        <>
          <AddUserRoleDialog
            open={roleDialogOpen}
            onOpenChange={setRoleDialogOpen}
            userId={selectedUser.id}
            userName={selectedUser.full_name}
            currentRoles={selectedUser.user_roles?.map((ur: any) => ur.role) || []}
          />
          <EmployeeDetailDialog
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            employee={selectedUser}
            canEdit={canManageUsers}
          />
          <DeleteUserDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            userId={selectedUser.id}
            userName={selectedUser.full_name}
          />
        </>
      )}
    </AppLayout>
  );
}
