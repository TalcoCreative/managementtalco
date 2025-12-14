import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error("Unauthorized user:", userError);
      throw new Error("Unauthorized");
    }

    // Check if requesting user is super_admin or hr
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isSuperAdmin = roles?.some((r) => r.role === "super_admin");
    const isHR = roles?.some((r) => r.role === "hr");
    
    if (!isSuperAdmin && !isHR) {
      console.error("User does not have permission to delete users");
      throw new Error("Only super admins and HR can delete users");
    }

    const { userId } = await req.json();

    if (!userId) {
      throw new Error("Missing user ID");
    }

    // Prevent self-deletion
    if (userId === user.id) {
      throw new Error("You cannot delete your own account");
    }

    console.log("Deleting user:", userId);

    // First, clean up related records that have foreign key constraints
    // Transfer ownership of clients to the requesting user
    const { error: clientsError } = await supabaseAdmin
      .from("clients")
      .update({ created_by: user.id })
      .eq("created_by", userId);
    
    if (clientsError) {
      console.error("Error updating clients ownership:", clientsError);
    }

    // Delete user roles
    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    
    if (rolesError) {
      console.error("Error deleting user roles:", rolesError);
    }

    // Delete shooting notifications
    const { error: shootingNotifError } = await supabaseAdmin
      .from("shooting_notifications")
      .delete()
      .eq("user_id", userId);
    
    if (shootingNotifError) {
      console.error("Error deleting shooting notifications:", shootingNotifError);
    }

    // Delete attendance records
    const { error: attendanceError } = await supabaseAdmin
      .from("attendance")
      .delete()
      .eq("user_id", userId);
    
    if (attendanceError) {
      console.error("Error deleting attendance:", attendanceError);
    }

    // Delete leave requests
    const { error: leaveError } = await supabaseAdmin
      .from("leave_requests")
      .delete()
      .eq("user_id", userId);
    
    if (leaveError) {
      console.error("Error deleting leave requests:", leaveError);
    }

    // Delete task activities
    const { error: taskActivitiesError } = await supabaseAdmin
      .from("task_activities")
      .delete()
      .eq("user_id", userId);
    
    if (taskActivitiesError) {
      console.error("Error deleting task activities:", taskActivitiesError);
    }

    // Update tasks - transfer to requesting user
    const { error: tasksCreatedError } = await supabaseAdmin
      .from("tasks")
      .update({ created_by: user.id })
      .eq("created_by", userId);
    
    if (tasksCreatedError) {
      console.error("Error updating tasks created_by:", tasksCreatedError);
    }

    // Unassign tasks assigned to the deleted user
    const { error: tasksAssignedError } = await supabaseAdmin
      .from("tasks")
      .update({ assigned_to: null })
      .eq("assigned_to", userId);
    
    if (tasksAssignedError) {
      console.error("Error updating tasks assigned_to:", tasksAssignedError);
    }

    // Update comments - transfer to requesting user
    const { error: commentsError } = await supabaseAdmin
      .from("comments")
      .update({ author_id: user.id })
      .eq("author_id", userId);
    
    if (commentsError) {
      console.error("Error updating comments:", commentsError);
    }

    // Update scheduled posts - transfer to requesting user
    const { error: scheduledPostsError } = await supabaseAdmin
      .from("scheduled_posts")
      .update({ created_by: user.id })
      .eq("created_by", userId);
    
    if (scheduledPostsError) {
      console.error("Error updating scheduled posts:", scheduledPostsError);
    }

    // Update shooting schedules - transfer to requesting user
    const { error: shootingCreatedError } = await supabaseAdmin
      .from("shooting_schedules")
      .update({ requested_by: user.id })
      .eq("requested_by", userId);
    
    if (shootingCreatedError) {
      console.error("Error updating shooting schedules requested_by:", shootingCreatedError);
    }

    // Unassign shooting schedules
    const { error: shootingDirectorError } = await supabaseAdmin
      .from("shooting_schedules")
      .update({ director: null })
      .eq("director", userId);
    
    if (shootingDirectorError) {
      console.error("Error updating shooting schedules director:", shootingDirectorError);
    }

    const { error: shootingRunnerError } = await supabaseAdmin
      .from("shooting_schedules")
      .update({ runner: null })
      .eq("runner", userId);
    
    if (shootingRunnerError) {
      console.error("Error updating shooting schedules runner:", shootingRunnerError);
    }

    // Delete shooting crew
    const { error: shootingCrewError } = await supabaseAdmin
      .from("shooting_crew")
      .delete()
      .eq("user_id", userId);
    
    if (shootingCrewError) {
      console.error("Error deleting shooting crew:", shootingCrewError);
    }

    // Update projects - unassign
    const { error: projectsError } = await supabaseAdmin
      .from("projects")
      .update({ assigned_to: null })
      .eq("assigned_to", userId);
    
    if (projectsError) {
      console.error("Error updating projects:", projectsError);
    }

    // Delete task attachments uploaded by user
    const { error: attachmentsError } = await supabaseAdmin
      .from("task_attachments")
      .delete()
      .eq("uploaded_by", userId);
    
    if (attachmentsError) {
      console.error("Error deleting task attachments:", attachmentsError);
    }

    // Update deletion logs
    const { error: deletionLogsError } = await supabaseAdmin
      .from("deletion_logs")
      .update({ deleted_by: user.id })
      .eq("deleted_by", userId);
    
    if (deletionLogsError) {
      console.error("Error updating deletion logs:", deletionLogsError);
    }

    // Delete profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);
    
    if (profileError) {
      console.error("Error deleting profile:", profileError);
    }

    // Finally, delete user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user from auth:", deleteError);
      throw deleteError;
    }

    console.log("User deleted successfully:", userId);

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in delete-user function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
