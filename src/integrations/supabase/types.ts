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
      asset_transactions: {
        Row: {
          asset_id: string
          checkin_at: string | null
          checkin_by: string | null
          checkin_location: string | null
          checkout_at: string | null
          checkout_by: string | null
          checkout_location: string | null
          condition_after: string | null
          condition_before: string | null
          created_at: string
          id: string
          notes: string | null
          transaction_type: string
          used_by: string | null
        }
        Insert: {
          asset_id: string
          checkin_at?: string | null
          checkin_by?: string | null
          checkin_location?: string | null
          checkout_at?: string | null
          checkout_by?: string | null
          checkout_location?: string | null
          condition_after?: string | null
          condition_before?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          transaction_type: string
          used_by?: string | null
        }
        Update: {
          asset_id?: string
          checkin_at?: string | null
          checkin_by?: string | null
          checkin_location?: string | null
          checkout_at?: string | null
          checkout_by?: string | null
          checkout_location?: string | null
          condition_after?: string | null
          condition_before?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          transaction_type?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transactions_checkin_by_fkey"
            columns: ["checkin_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transactions_checkout_by_fkey"
            columns: ["checkout_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_transactions_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          category: string
          code: string
          condition: string
          created_at: string
          created_by: string
          current_holder_id: string | null
          current_location: string | null
          default_location: string
          description: string | null
          id: string
          name: string
          qr_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          condition?: string
          created_at?: string
          created_by: string
          current_holder_id?: string | null
          current_location?: string | null
          default_location?: string
          description?: string | null
          id?: string
          name: string
          qr_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          condition?: string
          created_at?: string
          created_by?: string
          current_holder_id?: string | null
          current_location?: string | null
          default_location?: string
          description?: string | null
          id?: string
          name?: string
          qr_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_current_holder_id_fkey"
            columns: ["current_holder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          break_end: string | null
          break_start: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          photo_clock_in: string | null
          photo_clock_out: string | null
          tasks_completed: string[] | null
          total_break_minutes: number | null
          user_id: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          photo_clock_in?: string | null
          photo_clock_out?: string | null
          tasks_completed?: string[] | null
          total_break_minutes?: number | null
          user_id: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          photo_clock_in?: string | null
          photo_clock_out?: string | null
          tasks_completed?: string[] | null
          total_break_minutes?: number | null
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
      auto_clockout_notifications: {
        Row: {
          attendance_id: string
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          user_id: string
        }
        Insert: {
          attendance_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          user_id: string
        }
        Update: {
          attendance_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_clockout_notifications_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_assessments: {
        Row: {
          assessment_type: string
          assessor_id: string
          candidate_id: string
          created_at: string
          id: string
          notes: string | null
          rating: number | null
          updated_at: string
        }
        Insert: {
          assessment_type: string
          assessor_id: string
          candidate_id: string
          created_at?: string
          id?: string
          notes?: string | null
          rating?: number | null
          updated_at?: string
        }
        Update: {
          assessment_type?: string
          assessor_id?: string
          candidate_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          rating?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_assessments_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_assessments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_notes: {
        Row: {
          author_id: string
          candidate_id: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          candidate_id: string
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          candidate_id?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_status_history: {
        Row: {
          candidate_id: string
          changed_by: string
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["recruitment_status"]
          notes: string | null
          old_status: Database["public"]["Enums"]["recruitment_status"]
        }
        Insert: {
          candidate_id: string
          changed_by: string
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["recruitment_status"]
          notes?: string | null
          old_status: Database["public"]["Enums"]["recruitment_status"]
        }
        Update: {
          candidate_id?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["recruitment_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["recruitment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "candidate_status_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          applied_at: string
          created_at: string
          created_by: string
          cv_url: string | null
          division: string
          email: string
          full_name: string
          hr_pic_id: string | null
          id: string
          location: string | null
          phone: string
          portfolio_url: string | null
          position: string
          status: Database["public"]["Enums"]["recruitment_status"]
          updated_at: string
        }
        Insert: {
          applied_at?: string
          created_at?: string
          created_by: string
          cv_url?: string | null
          division: string
          email: string
          full_name: string
          hr_pic_id?: string | null
          id?: string
          location?: string | null
          phone: string
          portfolio_url?: string | null
          position: string
          status?: Database["public"]["Enums"]["recruitment_status"]
          updated_at?: string
        }
        Update: {
          applied_at?: string
          created_at?: string
          created_by?: string
          cv_url?: string | null
          division?: string
          email?: string
          full_name?: string
          hr_pic_id?: string | null
          id?: string
          location?: string | null
          phone?: string
          portfolio_url?: string | null
          position?: string
          status?: Database["public"]["Enums"]["recruitment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_hr_pic_id_fkey"
            columns: ["hr_pic_id"]
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
      company_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
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
      disciplinary_cases: {
        Row: {
          action_date: string | null
          action_taken: string | null
          case_date: string
          created_at: string
          description: string
          employee_id: string
          evidence_url: string | null
          id: string
          notes: string | null
          reported_by: string
          severity: string
          status: string
          updated_at: string
          violation_type: string
        }
        Insert: {
          action_date?: string | null
          action_taken?: string | null
          case_date?: string
          created_at?: string
          description: string
          employee_id: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          reported_by: string
          severity?: string
          status?: string
          updated_at?: string
          violation_type: string
        }
        Update: {
          action_date?: string | null
          action_taken?: string | null
          case_date?: string
          created_at?: string
          description?: string
          employee_id?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          reported_by?: string
          severity?: string
          status?: string
          updated_at?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_cases_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinary_cases_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checklists: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          event_id: string
          id: string
          is_completed: boolean | null
          item: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          is_completed?: boolean | null
          item: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          is_completed?: boolean | null
          item?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checklists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_crew: {
        Row: {
          bank_account: string | null
          created_at: string
          crew_type: string
          event_id: string
          fee: number | null
          freelancer_company: string | null
          freelancer_contact: string | null
          freelancer_location: string | null
          freelancer_name: string | null
          id: string
          is_paid: boolean | null
          notes: string | null
          paid_at: string | null
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          bank_account?: string | null
          created_at?: string
          crew_type: string
          event_id: string
          fee?: number | null
          freelancer_company?: string | null
          freelancer_contact?: string | null
          freelancer_location?: string | null
          freelancer_name?: string | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          role: string
          status?: string
          user_id?: string | null
        }
        Update: {
          bank_account?: string | null
          created_at?: string
          crew_type?: string
          event_id?: string
          fee?: number | null
          freelancer_company?: string | null
          freelancer_contact?: string | null
          freelancer_location?: string | null
          freelancer_name?: string | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_crew_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_crew_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_documents: {
        Row: {
          created_at: string
          document_type: string | null
          document_url: string | null
          event_id: string
          id: string
          notes: string | null
          title: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          document_url?: string | null
          event_id: string
          id?: string
          notes?: string | null
          title: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_type?: string | null
          document_url?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_history: {
        Row: {
          action: string
          changed_by: string
          created_at: string
          event_id: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          changed_by: string
          created_at?: string
          event_id: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          changed_by?: string
          created_at?: string
          event_id?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_issues: {
        Row: {
          created_at: string
          description: string
          event_id: string
          id: string
          reported_by: string
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
        }
        Insert: {
          created_at?: string
          description: string
          event_id: string
          id?: string
          reported_by: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          event_id?: string
          id?: string
          reported_by?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_issues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vendors: {
        Row: {
          contact: string | null
          cost: number | null
          created_at: string
          event_id: string
          id: string
          is_paid: boolean | null
          name: string
          notes: string | null
          purpose: string | null
          status: string
        }
        Insert: {
          contact?: string | null
          cost?: number | null
          created_at?: string
          event_id: string
          id?: string
          is_paid?: boolean | null
          name: string
          notes?: string | null
          purpose?: string | null
          status?: string
        }
        Update: {
          contact?: string | null
          cost?: number | null
          created_at?: string
          event_id?: string
          id?: string
          is_paid?: boolean | null
          name?: string
          notes?: string | null
          purpose?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_vendors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string
          current_phase: string
          end_date: string
          event_type: string
          id: string
          is_online: boolean | null
          location: string | null
          name: string
          notes: string | null
          pic_id: string | null
          project_id: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by: string
          current_phase?: string
          end_date: string
          event_type: string
          id?: string
          is_online?: boolean | null
          location?: string | null
          name: string
          notes?: string | null
          pic_id?: string | null
          project_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string
          current_phase?: string
          end_date?: string
          event_type?: string
          id?: string
          is_online?: boolean | null
          location?: string | null
          name?: string
          notes?: string | null
          pic_id?: string | null
          project_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_pic_id_fkey"
            columns: ["pic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          client_id: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          is_recurring: boolean | null
          ledger_entry_id: string | null
          paid_at: string | null
          project_id: string | null
          receipt_url: string | null
          recurring_id: string | null
          status: string
          sub_category: string | null
        }
        Insert: {
          amount: number
          category: string
          client_id?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          is_recurring?: boolean | null
          ledger_entry_id?: string | null
          paid_at?: string | null
          project_id?: string | null
          receipt_url?: string | null
          recurring_id?: string | null
          status?: string
          sub_category?: string | null
        }
        Update: {
          amount?: number
          category?: string
          client_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          is_recurring?: boolean | null
          ledger_entry_id?: string | null
          paid_at?: string | null
          project_id?: string | null
          receipt_url?: string | null
          recurring_id?: string | null
          status?: string
          sub_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancers: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          company: string | null
          contact: string | null
          created_at: string
          created_by: string
          id: string
          location: string | null
          name: string
          notes: string | null
          specialization: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          company?: string | null
          contact?: string | null
          created_at?: string
          created_by: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          specialization?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          company?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          specialization?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freelancers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          created_by: string
          date: string
          id: string
          ledger_entry_id: string | null
          notes: string | null
          project_id: string | null
          received_at: string | null
          recurring_id: string | null
          source: string
          status: string
          type: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          created_by: string
          date: string
          id?: string
          ledger_entry_id?: string | null
          notes?: string | null
          project_id?: string | null
          received_at?: string | null
          recurring_id?: string | null
          source: string
          status?: string
          type: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          ledger_entry_id?: string | null
          notes?: string | null
          project_id?: string | null
          received_at?: string | null
          recurring_id?: string | null
          source?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_budget"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_campaign_history: {
        Row: {
          action: string
          campaign_id: string
          created_at: string
          created_by: string
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          campaign_id: string
          created_at?: string
          created_by: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          campaign_id?: string
          created_at?: string
          created_by?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_campaign_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "kol_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_campaigns: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          campaign_name: string
          client_id: string | null
          created_at: string
          created_by: string
          evidence_url: string | null
          fee: number | null
          id: string
          is_paid: boolean
          is_posted: boolean
          is_visit: boolean
          kol_id: string
          paid_at: string | null
          paid_by: string | null
          pic_id: string | null
          platform: string
          post_link: string | null
          project_id: string | null
          status: string
          updated_at: string
          updated_by: string
          visit_location: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          campaign_name: string
          client_id?: string | null
          created_at?: string
          created_by: string
          evidence_url?: string | null
          fee?: number | null
          id?: string
          is_paid?: boolean
          is_posted?: boolean
          is_visit?: boolean
          kol_id: string
          paid_at?: string | null
          paid_by?: string | null
          pic_id?: string | null
          platform: string
          post_link?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          updated_by: string
          visit_location?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          campaign_name?: string
          client_id?: string | null
          created_at?: string
          created_by?: string
          evidence_url?: string | null
          fee?: number | null
          id?: string
          is_paid?: boolean
          is_posted?: boolean
          is_visit?: boolean
          kol_id?: string
          paid_at?: string | null
          paid_by?: string | null
          pic_id?: string | null
          platform?: string
          post_link?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string
          visit_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kol_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaigns_kol_id_fkey"
            columns: ["kol_id"]
            isOneToOne: false
            referencedRelation: "kol_database"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaigns_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaigns_pic_id_fkey"
            columns: ["pic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kol_campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kol_database: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          ig_followers: number | null
          industry: string | null
          instagram_url: string | null
          link_account: string | null
          linkedin_followers: number | null
          linkedin_url: string | null
          name: string
          notes: string | null
          rate_ig_feed: number | null
          rate_ig_reels: number | null
          rate_ig_story: number | null
          rate_tiktok_video: number | null
          rate_youtube_video: number | null
          threads_followers: number | null
          threads_url: string | null
          tiktok_followers: number | null
          tiktok_url: string | null
          twitter_followers: number | null
          twitter_url: string | null
          updated_at: string
          updated_by: string
          username: string
          youtube_followers: number | null
          youtube_url: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          id?: string
          ig_followers?: number | null
          industry?: string | null
          instagram_url?: string | null
          link_account?: string | null
          linkedin_followers?: number | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          rate_ig_feed?: number | null
          rate_ig_reels?: number | null
          rate_ig_story?: number | null
          rate_tiktok_video?: number | null
          rate_youtube_video?: number | null
          threads_followers?: number | null
          threads_url?: string | null
          tiktok_followers?: number | null
          tiktok_url?: string | null
          twitter_followers?: number | null
          twitter_url?: string | null
          updated_at?: string
          updated_by: string
          username: string
          youtube_followers?: number | null
          youtube_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          ig_followers?: number | null
          industry?: string | null
          instagram_url?: string | null
          link_account?: string | null
          linkedin_followers?: number | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          rate_ig_feed?: number | null
          rate_ig_reels?: number | null
          rate_ig_story?: number | null
          rate_tiktok_video?: number | null
          rate_youtube_video?: number | null
          threads_followers?: number | null
          threads_url?: string | null
          tiktok_followers?: number | null
          tiktok_url?: string | null
          twitter_followers?: number | null
          twitter_url?: string | null
          updated_at?: string
          updated_by?: string
          username?: string
          youtube_followers?: number | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leave_approver"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leave_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          created_by: string
          date: string
          id: string
          notes: string | null
          project_id: string | null
          source: string
          sub_category: string | null
          sub_type: string
          type: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          created_by: string
          date?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          source: string
          sub_category?: string | null
          sub_type: string
          type: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          source?: string
          sub_category?: string | null
          sub_type?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_activity_logs: {
        Row: {
          action: string
          changed_by: string
          created_at: string
          id: string
          letter_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          changed_by: string
          created_at?: string
          id?: string
          letter_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          changed_by?: string
          created_at?: string
          id?: string
          letter_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "letter_activity_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_activity_logs_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      letters: {
        Row: {
          category_code: string
          category_name: string
          created_at: string
          created_by: string
          document_url: string | null
          entity_code: string
          entity_name: string
          id: string
          is_confidential: boolean
          letter_number: string
          month: number
          notes: string | null
          project_id: string | null
          project_label: string | null
          recipient_company: string | null
          recipient_name: string
          running_number: number
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          category_code: string
          category_name: string
          created_at?: string
          created_by: string
          document_url?: string | null
          entity_code: string
          entity_name: string
          id?: string
          is_confidential?: boolean
          letter_number: string
          month: number
          notes?: string | null
          project_id?: string | null
          project_label?: string | null
          recipient_company?: string | null
          recipient_name: string
          running_number: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          category_code?: string
          category_name?: string
          created_at?: string
          created_by?: string
          document_url?: string | null
          entity_code?: string
          entity_name?: string
          id?: string
          is_confidential?: boolean
          letter_number?: string
          month?: number
          notes?: string | null
          project_id?: string | null
          project_label?: string | null
          recipient_company?: string | null
          recipient_name?: string
          running_number?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "letters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_external_participants: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          meeting_id: string
          name: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meeting_id: string
          name: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          meeting_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_external_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          meeting_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          meeting_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          meeting_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          meeting_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          meeting_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notifications_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          rejection_reason: string | null
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          rejection_reason?: string | null
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          rejection_reason?: string | null
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string
          end_time: string
          id: string
          is_confidential: boolean
          location: string | null
          meeting_date: string
          meeting_link: string | null
          mode: string
          notes: string | null
          original_date: string | null
          project_id: string | null
          reschedule_reason: string | null
          rescheduled_at: string | null
          start_time: string
          status: string
          task_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by: string
          end_time: string
          id?: string
          is_confidential?: boolean
          location?: string | null
          meeting_date: string
          meeting_link?: string | null
          mode?: string
          notes?: string | null
          original_date?: string | null
          project_id?: string | null
          reschedule_reason?: string | null
          rescheduled_at?: string | null
          start_time: string
          status?: string
          task_id?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          is_confidential?: boolean
          location?: string | null
          meeting_date?: string
          meeting_link?: string | null
          mode?: string
          notes?: string | null
          original_date?: string | null
          project_id?: string | null
          reschedule_reason?: string | null
          rescheduled_at?: string | null
          start_time?: string
          status?: string
          task_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_meetings_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          adjustment_lainnya: number | null
          adjustment_notes: string | null
          amount: number
          bonus: number | null
          created_at: string
          created_by: string
          employee_id: string
          id: string
          ledger_entry_id: string | null
          month: string
          paid_at: string | null
          pay_date: string | null
          potongan_kasbon: number | null
          potongan_terlambat: number | null
          reimburse: number | null
          status: string
        }
        Insert: {
          adjustment_lainnya?: number | null
          adjustment_notes?: string | null
          amount: number
          bonus?: number | null
          created_at?: string
          created_by: string
          employee_id: string
          id?: string
          ledger_entry_id?: string | null
          month: string
          paid_at?: string | null
          pay_date?: string | null
          potongan_kasbon?: number | null
          potongan_terlambat?: number | null
          reimburse?: number | null
          status?: string
        }
        Update: {
          adjustment_lainnya?: number | null
          adjustment_notes?: string | null
          amount?: number
          bonus?: number | null
          created_at?: string
          created_by?: string
          employee_id?: string
          id?: string
          ledger_entry_id?: string | null
          month?: string
          paid_at?: string | null
          pay_date?: string | null
          potongan_kasbon?: number | null
          potongan_terlambat?: number | null
          reimburse?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string | null
          email: string | null
          emergency_contact: string | null
          full_name: string
          gaji_pokok: number | null
          id: string
          ktp_number: string | null
          phone: string | null
          salary: number | null
          status: string | null
          tj_internet: number | null
          tj_kpi: number | null
          tj_transport: number | null
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          full_name: string
          gaji_pokok?: number | null
          id: string
          ktp_number?: string | null
          phone?: string | null
          salary?: number | null
          status?: string | null
          tj_internet?: number | null
          tj_kpi?: number | null
          tj_transport?: number | null
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          full_name?: string
          gaji_pokok?: number | null
          id?: string
          ktp_number?: string | null
          phone?: string | null
          salary?: number | null
          status?: string | null
          tj_internet?: number | null
          tj_kpi?: number | null
          tj_transport?: number | null
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
      prospect_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          prospect_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          prospect_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_comments_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_status_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_status: string
          old_status: string
          prospect_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          old_status: string
          prospect_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_status_history_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          company: string | null
          contact_name: string
          created_at: string
          created_by: string
          email: string | null
          id: string
          location: string | null
          needs: string | null
          phone: string | null
          pic_id: string | null
          product_service: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          contact_name: string
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          location?: string | null
          needs?: string | null
          phone?: string | null
          pic_id?: string | null
          product_service?: string | null
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          contact_name?: string
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          location?: string | null
          needs?: string | null
          phone?: string | null
          pic_id?: string | null
          product_service?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_pic_id_fkey"
            columns: ["pic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_budget: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          created_by: string
          custom_days: number | null
          due_day: number | null
          end_date: string | null
          id: string
          name: string
          period: string
          project_id: string | null
          start_date: string
          status: string
          type: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          created_by: string
          custom_days?: number | null
          due_day?: number | null
          end_date?: string | null
          id?: string
          name: string
          period: string
          project_id?: string | null
          start_date: string
          status?: string
          type: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          created_by?: string
          custom_days?: number | null
          due_day?: number | null
          end_date?: string | null
          id?: string
          name?: string
          period?: string
          project_id?: string | null
          start_date?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_budget_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_budget_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          client_id: string | null
          created_at: string
          id: string
          ledger_entry_id: string | null
          notes: string | null
          paid_at: string | null
          project_id: string | null
          receipt_url: string | null
          rejection_reason: string | null
          request_from: string
          request_type: string | null
          status: string
          title: string | null
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          ledger_entry_id?: string | null
          notes?: string | null
          paid_at?: string | null
          project_id?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          request_from: string
          request_type?: string | null
          status?: string
          title?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          ledger_entry_id?: string | null
          notes?: string | null
          paid_at?: string | null
          project_id?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          request_from?: string
          request_type?: string | null
          status?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          crew_role: string | null
          id: string
          responded_at: string | null
          shooting_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          crew_role?: string | null
          id?: string
          responded_at?: string | null
          shooting_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          crew_role?: string | null
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
          cancel_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          created_at: string | null
          director: string | null
          id: string
          location: string | null
          notes: string | null
          original_date: string | null
          project_id: string | null
          requested_by: string
          reschedule_reason: string | null
          rescheduled_from: string | null
          runner: string | null
          scheduled_date: string
          scheduled_time: string
          status: string | null
          task_id: string | null
          title: string
        }
        Insert: {
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string | null
          director?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          original_date?: string | null
          project_id?: string | null
          requested_by: string
          reschedule_reason?: string | null
          rescheduled_from?: string | null
          runner?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: string | null
          task_id?: string | null
          title: string
        }
        Update: {
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string | null
          director?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          original_date?: string | null
          project_id?: string | null
          requested_by?: string
          reschedule_reason?: string | null
          rescheduled_from?: string | null
          runner?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string | null
          task_id?: string | null
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
          {
            foreignKeyName: "shooting_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shooting_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shooting_schedules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      task_assignees: {
        Row: {
          assigned_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      task_notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_read: boolean
          meeting_id: string | null
          message: string
          notification_type: string
          shooting_id: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          meeting_id?: string | null
          message: string
          notification_type: string
          shooting_id?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          meeting_id?: string | null
          message?: string
          notification_type?: string
          shooting_id?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notifications_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notifications_shooting_id_fkey"
            columns: ["shooting_id"]
            isOneToOne: false
            referencedRelation: "shooting_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_public_comments: {
        Row: {
          commenter_name: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          commenter_name: string
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          commenter_name?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_public_comments_task_id_fkey"
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
          description_edited_at: string | null
          event_id: string | null
          id: string
          link: string | null
          priority: string | null
          project_id: string
          requested_at: string | null
          share_token: string | null
          status: string | null
          table_data: Json | null
          title: string
          title_edited_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by: string
          deadline?: string | null
          description?: string | null
          description_edited_at?: string | null
          event_id?: string | null
          id?: string
          link?: string | null
          priority?: string | null
          project_id: string
          requested_at?: string | null
          share_token?: string | null
          status?: string | null
          table_data?: Json | null
          title: string
          title_edited_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          deadline?: string | null
          description?: string | null
          description_edited_at?: string | null
          event_id?: string | null
          id?: string
          link?: string | null
          priority?: string | null
          project_id?: string
          requested_at?: string | null
          share_token?: string | null
          status?: string | null
          table_data?: Json | null
          title?: string
          title_edited_at?: string | null
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
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      get_next_letter_number: {
        Args: {
          p_category_code: string
          p_entity_code: string
          p_month: number
          p_year: number
        }
        Returns: number
      }
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
        | "finance"
        | "accounting"
        | "marketing"
        | "photographer"
        | "director"
        | "project_manager"
        | "sales"
      recruitment_status:
        | "applied"
        | "screening_hr"
        | "interview_user"
        | "interview_final"
        | "offering"
        | "hired"
        | "rejected"
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
        "finance",
        "accounting",
        "marketing",
        "photographer",
        "director",
        "project_manager",
        "sales",
      ],
      recruitment_status: [
        "applied",
        "screening_hr",
        "interview_user",
        "interview_final",
        "offering",
        "hired",
        "rejected",
      ],
    },
  },
} as const
