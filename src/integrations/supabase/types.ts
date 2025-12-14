export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          photo_clock_in: string | null
          photo_clock_out: string | null
          tasks_completed: string[] | null
          user_id: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          photo_clock_in?: string | null
          photo_clock_out?: string | null
          tasks_completed?: string[] | null
          user_id: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          photo_clock_in?: string | null
          photo_clock_out?: string | null
          tasks_completed?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_attendance_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          created_at: string | null
          created_by: string
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          created_by: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          project_id: string | null
          task_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          project_id?: string | null
          task_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          project_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comments_author_profiles"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_logs: {
        Row: {
          created_at: string
          deleted_by: string
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          reason: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_by: string
          entity_id: string
          entity_name: string
          entity_type: string
          id?: string
          reason: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_by?: string
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          reason?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deletion_logs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          ktp_number: string | null
          phone: string | null
          salary: number | null
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id: string
          ktp_number?: string | null
          phone?: string | null
          salary?: number | null
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          ktp_number?: string | null
          phone?: string | null
          salary?: number | null
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string | null
          deadline: string | null
          description: string | null
          id: string
          status: string | null
          title: string
          type: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          status?: string | null
          title: string
          type?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          status?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_assigned_to"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          client_id: string
          content: string
          created_at: string | null
          created_by: string
          id: string
          platform: string
          scheduled_date: string
          scheduled_time: string
          status: string | null
          task_id: string | null
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          platform: string
          scheduled_date: string
          scheduled_time: string
          status?: string | null
          task_id?: string | null
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          platform?: string
          scheduled_date?: string
          scheduled_time?: string
          status?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      shooting_crew: {
        Row: {
          created_at: string | null
          freelance_cost: number | null
          freelance_name: string | null
          id: string
          is_freelance: boolean | null
          role: string
          shooting_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          freelance_cost?: number | null
          freelance_name?: string | null
          id?: string
          is_freelance?: boolean | null
          role: string
          shooting_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          freelance_cost?: number | null
          freelance_name?: string | null
          id?: string
          is_freelance?: boolean | null
          role?: string
          shooting_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_shooting_crew_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shooting_crew_shooting_id_fkey"
            columns: ["shooting_id"]
            isOneToOne: false
            referencedRelation: "shooting_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      shooting_notifications: {
        Row: {
          created_at: string | null
          id: string
          responded_at: string | null
          shooting_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          responded_at?: string | null
          shooting_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          responded_at?: string | null
          shooting_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shooting_notifications_shooting_id_fkey"
            columns: ["shooting_id"]
            isOneToOne: false
            referencedRelation: "shooting_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      shooting_schedules: {
        Row: {
          approved_by: string | null
          created_at: string | null
          director: string | null
          id: string
          location: string | null
          notes: string | null
          requested_by: string
          runner: string | null
          scheduled_date: string
          scheduled_time: string
          status: string | null
          title: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string | null
          director?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          requested_by: string
          runner?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: string | null
          title: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string | null
          director?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          requested_by?: string
          runner?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shooting_director_profiles"
            columns: ["director"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shooting_requested_by_profiles"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shooting_runner_profiles"
            columns: ["runner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          id: string
          task_id: string | null
          task_title: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          id?: string
          task_id?: string | null
          task_title?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          id?: string
          task_id?: string | null
          task_title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_task_attachments_uploader_profiles"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          created_at: string | null
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          link: string | null
          priority: string | null
          project_id: string
          requested_at: string | null
          status: string | null
          title: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          link?: string | null
          priority?: string | null
          project_id: string
          requested_at?: string | null
          status?: string | null
          title: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          link?: string | null
          priority?: string | null
          project_id?: string
          requested_at?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_assigned_to"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_assigned_to_profiles"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_created_by_profiles"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "hr"
        | "graphic_designer"
        | "socmed_admin"
        | "copywriter"
        | "video_editor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "hr",
        "graphic_designer",
        "socmed_admin",
        "copywriter",
        "video_editor",
      ],
    },
  },
} as const
