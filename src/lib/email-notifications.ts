import { supabase } from "@/integrations/supabase/client";

interface EmailNotificationData {
  title?: string;
  description?: string;
  deadline?: string;
  creator_name?: string;
  link?: string;
  priority?: string;
  status?: string;
  participants?: string;
  location?: string;
}

interface SendEmailParams {
  recipientEmail: string;
  recipientName: string;
  notificationType: string;
  data: EmailNotificationData;
  relatedId?: string;
}

export const sendEmailNotification = async ({
  recipientEmail,
  recipientName,
  notificationType,
  data,
  relatedId,
}: SendEmailParams): Promise<boolean> => {
  // Skip if no email
  if (!recipientEmail) {
    console.log("No email provided, skipping email notification");
    return false;
  }

  try {
    const { data: result, error } = await supabase.functions.invoke(
      "send-notification-email",
      {
        body: {
          type: "notification",
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          notification_type: notificationType,
          data,
          related_id: relatedId,
        },
      }
    );

    if (error) {
      console.error("Error sending email notification:", error);
      return false;
    }

    if (!result?.success) {
      console.error("Email notification failed:", result?.error);
      return false;
    }

    console.log("Email notification sent successfully to:", recipientEmail);
    return true;
  } catch (error) {
    console.error("Failed to send email notification:", error);
    return false;
  }
};

// Helper to get user email by profile ID
export const getUserEmailById = async (profileId: string): Promise<{ email: string | null; name: string }> => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", profileId)
      .single();

    if (error || !data) {
      return { email: null, name: "" };
    }

    return { email: data.email, name: data.full_name };
  } catch {
    return { email: null, name: "" };
  }
};

// Send email to multiple users
export const sendEmailToMultipleUsers = async (
  userIds: string[],
  notificationType: string,
  data: EmailNotificationData,
  relatedId?: string
): Promise<void> => {
  for (const userId of userIds) {
    const { email, name } = await getUserEmailById(userId);
    if (email) {
      await sendEmailNotification({
        recipientEmail: email,
        recipientName: name,
        notificationType,
        data,
        relatedId,
      });
    }
  }
};

// Task-specific email notifications
export const sendTaskAssignmentEmail = async (
  assigneeId: string,
  taskData: {
    id: string;
    title: string;
    description?: string;
    deadline?: string;
    priority?: string;
    creatorName: string;
  }
): Promise<void> => {
  const { email, name } = await getUserEmailById(assigneeId);
  if (!email) return;

  const baseUrl = window.location.origin;
  await sendEmailNotification({
    recipientEmail: email,
    recipientName: name,
    notificationType: "task_assignment",
    data: {
      title: taskData.title,
      description: taskData.description,
      deadline: taskData.deadline,
      priority: taskData.priority,
      creator_name: taskData.creatorName,
      link: `${baseUrl}/tasks`,
      status: "Assigned",
    },
    relatedId: taskData.id,
  });
};

export const sendTaskOverdueEmail = async (
  assigneeId: string,
  taskData: {
    id: string;
    title: string;
    deadline: string;
  }
): Promise<void> => {
  const { email, name } = await getUserEmailById(assigneeId);
  if (!email) return;

  const baseUrl = window.location.origin;
  await sendEmailNotification({
    recipientEmail: email,
    recipientName: name,
    notificationType: "task_overdue",
    data: {
      title: taskData.title,
      deadline: taskData.deadline,
      link: `${baseUrl}/tasks`,
      status: "Overdue",
    },
    relatedId: taskData.id,
  });
};

export const sendMeetingInvitationEmail = async (
  participantId: string,
  meetingData: {
    id: string;
    title: string;
    date: string;
    time: string;
    location?: string;
    creatorName: string;
    participants?: string;
  }
): Promise<void> => {
  const { email, name } = await getUserEmailById(participantId);
  if (!email) return;

  const baseUrl = window.location.origin;
  await sendEmailNotification({
    recipientEmail: email,
    recipientName: name,
    notificationType: "meeting_invitation",
    data: {
      title: meetingData.title,
      deadline: `${meetingData.date} ${meetingData.time}`,
      location: meetingData.location,
      creator_name: meetingData.creatorName,
      participants: meetingData.participants,
      link: `${baseUrl}/meeting`,
    },
    relatedId: meetingData.id,
  });
};

export const sendShootingAssignmentEmail = async (
  crewId: string,
  shootingData: {
    id: string;
    title: string;
    date: string;
    time: string;
    location?: string;
    creatorName: string;
  }
): Promise<void> => {
  const { email, name } = await getUserEmailById(crewId);
  if (!email) return;

  const baseUrl = window.location.origin;
  await sendEmailNotification({
    recipientEmail: email,
    recipientName: name,
    notificationType: "shooting_assignment",
    data: {
      title: shootingData.title,
      deadline: `${shootingData.date} ${shootingData.time}`,
      location: shootingData.location,
      creator_name: shootingData.creatorName,
      link: `${baseUrl}/shooting`,
    },
    relatedId: shootingData.id,
  });
};

export const sendEventAssignmentEmail = async (
  crewId: string,
  eventData: {
    id: string;
    title: string;
    startDate: string;
    location?: string;
    creatorName: string;
  }
): Promise<void> => {
  const { email, name } = await getUserEmailById(crewId);
  if (!email) return;

  const baseUrl = window.location.origin;
  await sendEmailNotification({
    recipientEmail: email,
    recipientName: name,
    notificationType: "event_assignment",
    data: {
      title: eventData.title,
      deadline: eventData.startDate,
      location: eventData.location,
      creator_name: eventData.creatorName,
      link: `${baseUrl}/event/${eventData.id}`,
    },
    relatedId: eventData.id,
  });
};

export const sendProjectAssignmentEmail = async (
  memberId: string,
  projectData: {
    id: string;
    name: string;
    description?: string;
    creatorName: string;
  }
): Promise<void> => {
  const { email, name } = await getUserEmailById(memberId);
  if (!email) return;

  const baseUrl = window.location.origin;
  await sendEmailNotification({
    recipientEmail: email,
    recipientName: name,
    notificationType: "project_assignment",
    data: {
      title: projectData.name,
      description: projectData.description,
      creator_name: projectData.creatorName,
      link: `${baseUrl}/projects`,
    },
    relatedId: projectData.id,
  });
};
