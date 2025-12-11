import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, User, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { EditUserRoleDialog } from "@/components/users/EditUserRoleDialog";
import { EmployeeDetailDialog } from "@/components/users/EmployeeDetailDialog";

export default function Users() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

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
      default:
        return "bg-muted";
    }
  };

  const handleCardClick = (user: any) => {
    if (canManageUsers) {
      setSelectedUser(user);
      setDetailDialogOpen(true);
    }
  };

  const handleEditRole = (e: React.MouseEvent, user: any) => {
    e.stopPropagation();
    setSelectedUser(user);
    setEditDialogOpen(true);
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
            {users.map((user) => (
              <Card 
                key={user.id} 
                className={`hover:shadow-lg transition-all ${canManageUsers ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
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
                      <CardTitle className="text-lg">{user.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{user.email || user.user_id}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleEditRole(e, user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {user.phone && (
                    <p className="text-xs text-muted-foreground mt-2">{user.phone}</p>
                  )}
                </CardContent>
              </Card>
            ))}
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
          <EditUserRoleDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            userId={selectedUser.id}
            userName={selectedUser.full_name}
            currentRole={selectedUser.user_roles?.[0]?.role}
          />
          <EmployeeDetailDialog
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            employee={selectedUser}
            canEdit={canManageUsers}
          />
        </>
      )}
    </AppLayout>
  );
}