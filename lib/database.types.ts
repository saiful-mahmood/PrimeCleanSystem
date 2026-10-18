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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor: string
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          meta: Json | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          meta?: Json | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          meta?: Json | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          basic_info: string | null
          created_at: string
          default_charge_method:
            | Database["public"]["Enums"]["charge_method"]
            | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["client_status"]
          stripe_customer_id: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string
        }
        Insert: {
          basic_info?: string | null
          created_at?: string
          default_charge_method?:
            | Database["public"]["Enums"]["charge_method"]
            | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          stripe_customer_id?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Update: {
          basic_info?: string | null
          created_at?: string
          default_charge_method?:
            | Database["public"]["Enums"]["charge_method"]
            | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          stripe_customer_id?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_cents: number
          cadence: Database["public"]["Enums"]["expense_cadence"]
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          id: string
          name: string
          next_due: string | null
          notes: string | null
          paid_at: string
          paid_with: string | null
          platform: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cadence?: Database["public"]["Enums"]["expense_cadence"]
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          id?: string
          name: string
          next_due?: string | null
          notes?: string | null
          paid_at: string
          paid_with?: string | null
          platform?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cadence?: Database["public"]["Enums"]["expense_cadence"]
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          id?: string
          name?: string
          next_due?: string | null
          notes?: string | null
          paid_at?: string
          paid_with?: string | null
          platform?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_jobs: {
        Row: {
          invoice_id: string
          job_id: string
        }
        Insert: {
          invoice_id: string
          job_id: string
        }
        Update: {
          invoice_id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_jobs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_economics"
            referencedColumns: ["job_id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          method: Database["public"]["Enums"]["charge_method"]
          notes: string | null
          paid_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          stripe_checkout_url: string | null
          stripe_invoice_id: string | null
          stripe_payment_link_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          method?: Database["public"]["Enums"]["charge_method"]
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_checkout_url?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_link_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          method?: Database["public"]["Enums"]["charge_method"]
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_checkout_url?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_link_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          accepted_at: string | null
          created_at: string
          done_at: string | null
          id: string
          job_id: string
          notes: string | null
          pay_cents: number
          payout_id: string | null
          provider_id: string
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          done_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          pay_cents: number
          payout_id?: string | null
          provider_id: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          done_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          pay_cents?: number
          payout_id?: string | null
          provider_id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_economics"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_assignments_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_owed"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "job_assignments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_ytd"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      job_series: {
        Row: {
          active: boolean
          charge_cents: number
          charge_method: Database["public"]["Enums"]["charge_method"] | null
          client_id: string
          created_at: string
          default_provider_id: string | null
          duration_min: number
          end_date: string | null
          id: string
          location_id: string
          notes: string | null
          provider_pay_cents: number
          rrule: string
          service_type_id: string
          start_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          charge_cents: number
          charge_method?: Database["public"]["Enums"]["charge_method"] | null
          client_id: string
          created_at?: string
          default_provider_id?: string | null
          duration_min?: number
          end_date?: string | null
          id?: string
          location_id: string
          notes?: string | null
          provider_pay_cents: number
          rrule: string
          service_type_id: string
          start_date: string
          start_time: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          charge_cents?: number
          charge_method?: Database["public"]["Enums"]["charge_method"] | null
          client_id?: string
          created_at?: string
          default_provider_id?: string | null
          duration_min?: number
          end_date?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          provider_pay_cents?: number
          rrule?: string
          service_type_id?: string
          start_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_series_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_series_default_provider_id_fkey"
            columns: ["default_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_series_default_provider_id_fkey"
            columns: ["default_provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_owed"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "job_series_default_provider_id_fkey"
            columns: ["default_provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_ytd"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "job_series_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_series_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          cancelled_reason: string | null
          charge_cents: number
          charge_method: Database["public"]["Enums"]["charge_method"] | null
          client_id: string
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          duration_min: number
          id: string
          location_id: string
          notes: string | null
          photo_paths: string[]
          scheduled_start: string
          series_id: string | null
          service_type_id: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          cancelled_reason?: string | null
          charge_cents: number
          charge_method?: Database["public"]["Enums"]["charge_method"] | null
          client_id: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          location_id: string
          notes?: string | null
          photo_paths?: string[]
          scheduled_start: string
          series_id?: string | null
          service_type_id: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          cancelled_reason?: string | null
          charge_cents?: number
          charge_method?: Database["public"]["Enums"]["charge_method"] | null
          client_id?: string
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          location_id?: string
          notes?: string | null
          photo_paths?: string[]
          scheduled_start?: string
          series_id?: string | null
          service_type_id?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "job_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          client_id: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          created_at: string
          email: string | null
          id: string
          intake: Json | null
          lost_reason: string | null
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          id?: string
          intake?: Json | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          id?: string
          intake?: Json | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          access_notes: string | null
          address_line1: string | null
          address_line2: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          client_id: string
          created_at: string
          id: string
          label: string
          lockbox_code_enc: string | null
          lockbox_hint: string | null
          postal_code: string | null
          scope_of_work: string | null
          sqft: number | null
          state: string | null
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          client_id: string
          created_at?: string
          id?: string
          label?: string
          lockbox_code_enc?: string | null
          lockbox_hint?: string | null
          postal_code?: string | null
          scope_of_work?: string | null
          sqft?: number | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          client_id?: string
          created_at?: string
          id?: string
          label?: string
          lockbox_code_enc?: string | null
          lockbox_hint?: string | null
          postal_code?: string | null
          scope_of_work?: string | null
          sqft?: number | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_links: {
        Row: {
          created_at: string
          expires_at: string
          job_id: string | null
          provider_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          job_id?: string | null
          provider_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          job_id?: string | null
          provider_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "magic_links_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_links_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_economics"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "magic_links_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_links_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_owed"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "magic_links_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_ytd"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          client_id: string | null
          created_at: string
          error: string | null
          external_id: string | null
          id: string
          job_id: string | null
          provider_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          template: string
          to_address: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          client_id?: string | null
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          job_id?: string | null
          provider_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template: string
          to_address: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          client_id?: string | null
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          job_id?: string | null
          provider_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template?: string
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_economics"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "messages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_owed"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "messages_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_ytd"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          client_id: string
          created_at: string
          external_ref: string | null
          fee_cents: number
          id: string
          invoice_id: string | null
          job_id: string | null
          method: Database["public"]["Enums"]["charge_method"]
          net_cents: number | null
          notes: string | null
          received_at: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents: number
          client_id: string
          created_at?: string
          external_ref?: string | null
          fee_cents?: number
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          method: Database["public"]["Enums"]["charge_method"]
          net_cents?: number | null
          notes?: string | null
          received_at?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          client_id?: string
          created_at?: string
          external_ref?: string | null
          fee_cents?: number
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          method?: Database["public"]["Enums"]["charge_method"]
          net_cents?: number | null
          notes?: string | null
          received_at?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_job_economics"
            referencedColumns: ["job_id"]
          },
        ]
      }
      payouts: {
        Row: {
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payout_method"]
          notes: string | null
          paid_at: string | null
          provider_id: string
          reference: string | null
          total_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payout_method"]
          notes?: string | null
          paid_at?: string | null
          provider_id: string
          reference?: string | null
          total_cents?: number
        }
        Update: {
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payout_method"]
          notes?: string | null
          paid_at?: string | null
          provider_id?: string
          reference?: string | null
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_owed"
            referencedColumns: ["provider_id"]
          },
          {
            foreignKeyName: "payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_ytd"
            referencedColumns: ["provider_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      proposal_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          fields: Json
          generated_by: string
          id: string
          model: string | null
          proposal_id: string
          rendered_md: string
          source_notes: string | null
          version_no: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          fields: Json
          generated_by?: string
          id?: string
          model?: string | null
          proposal_id: string
          rendered_md: string
          source_notes?: string | null
          version_no: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          fields?: Json
          generated_by?: string
          id?: string
          model?: string | null
          proposal_id?: string
          rendered_md?: string
          source_notes?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_id: string | null
          created_at: string
          current_version: number
          decided_at: string | null
          id: string
          lead_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          current_version?: number
          decided_at?: string | null
          id?: string
          lead_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          current_version?: number
          decided_at?: string | null
          id?: string
          lead_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          active: boolean
          created_at: string
          default_pay_cents: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          service_area: string | null
          updated_at: string
          w9_on_file: boolean
          zelle_handle: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_pay_cents?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          service_area?: string | null
          updated_at?: string
          w9_on_file?: boolean
          zelle_handle?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          default_pay_cents?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          service_area?: string | null
          updated_at?: string
          w9_on_file?: boolean
          zelle_handle?: string | null
        }
        Relationships: []
      }
      rate_cards: {
        Row: {
          active: boolean
          base_cents: number
          client_type: Database["public"]["Enums"]["client_type"]
          id: string
          min_charge_cents: number
          per_bathroom_cents: number
          per_bedroom_cents: number
          per_sqft_cents: number
          service_type_id: string
          target_margin_pct: number
        }
        Insert: {
          active?: boolean
          base_cents?: number
          client_type?: Database["public"]["Enums"]["client_type"]
          id?: string
          min_charge_cents?: number
          per_bathroom_cents?: number
          per_bedroom_cents?: number
          per_sqft_cents?: number
          service_type_id: string
          target_margin_pct?: number
        }
        Update: {
          active?: boolean
          base_cents?: number
          client_type?: Database["public"]["Enums"]["client_type"]
          id?: string
          min_charge_cents?: number
          per_bathroom_cents?: number
          per_bedroom_cents?: number
          per_sqft_cents?: number
          service_type_id?: string
          target_margin_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_cards_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          active: boolean
          default_duration_min: number
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          default_duration_min?: number
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          default_duration_min?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      v_ar_aging: {
        Row: {
          amount_cents: number | null
          client_id: string | null
          client_name: string | null
          days_outstanding: number | null
          kind: string | null
          ref_id: string | null
          since: string | null
        }
        Relationships: []
      }
      v_job_economics: {
        Row: {
          charge_cents: number | null
          charge_method: Database["public"]["Enums"]["charge_method"] | null
          cleaning_type: string | null
          client_id: string | null
          client_name: string | null
          fee_cents: number | null
          fully_paid: boolean | null
          job_id: string | null
          profit_cents: number | null
          profit_margin_pct: number | null
          provider_names: string | null
          provider_pay_cents: number | null
          provider_unpaid: boolean | null
          received_cents: number | null
          scheduled_start: string | null
          service_type_id: string | null
          status: Database["public"]["Enums"]["job_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      v_monthly_pnl: {
        Row: {
          ad_expense_cents: number | null
          month: string | null
          overhead_expense_cents: number | null
          provider_payment_cents: number | null
          received_cents: number | null
          stripe_fee_cents: number | null
          total_profit_cents: number | null
          ytd_profit_cents: number | null
        }
        Relationships: []
      }
      v_monthly_pnl_by_job: {
        Row: {
          ad_expense_cents: number | null
          charged_cents: number | null
          month: string | null
          overhead_expense_cents: number | null
          provider_payment_cents: number | null
          stripe_fee_cents: number | null
          total_profit_cents: number | null
          ytd_profit_cents: number | null
        }
        Relationships: []
      }
      v_provider_owed: {
        Row: {
          jobs_owed: number | null
          oldest_job_at: string | null
          owed_cents: number | null
          provider_id: string | null
          provider_name: string | null
          zelle_handle: string | null
        }
        Relationships: []
      }
      v_provider_ytd: {
        Row: {
          paid_cents: number | null
          provider_id: string | null
          provider_name: string | null
          w9_on_file: boolean | null
          year: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_owner: { Args: never; Returns: boolean }
    }
    Enums: {
      assignment_status:
        | "offered"
        | "accepted"
        | "declined"
        | "done"
        | "no_show"
        | "cancelled_paid"
      charge_method:
        | "stripe_card"
        | "stripe_ach"
        | "stripe_invoice"
        | "zelle"
        | "check"
        | "cash"
        | "venmo"
      client_status: "lead" | "active" | "inactive"
      client_type: "residential" | "commercial"
      expense_cadence:
        | "one_time"
        | "weekly"
        | "monthly"
        | "quarterly"
        | "annual"
      expense_category:
        | "overhead"
        | "software"
        | "ads"
        | "supplies"
        | "insurance"
        | "other"
      invoice_status: "draft" | "sent" | "paid" | "void" | "uncollectible"
      job_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "done"
        | "cancelled"
        | "skipped"
      lead_status: "new" | "contacted" | "quoted" | "won" | "lost"
      message_channel: "sms" | "email"
      message_status: "queued" | "sent" | "delivered" | "failed"
      payout_method: "zelle" | "cash" | "check" | "other"
      proposal_status: "draft" | "sent" | "accepted" | "declined" | "expired"
      user_role: "owner" | "provider"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      assignment_status: [
        "offered",
        "accepted",
        "declined",
        "done",
        "no_show",
        "cancelled_paid",
      ],
      charge_method: [
        "stripe_card",
        "stripe_ach",
        "stripe_invoice",
        "zelle",
        "check",
        "cash",
        "venmo",
      ],
      client_status: ["lead", "active", "inactive"],
      client_type: ["residential", "commercial"],
      expense_cadence: ["one_time", "weekly", "monthly", "quarterly", "annual"],
      expense_category: [
        "overhead",
        "software",
        "ads",
        "supplies",
        "insurance",
        "other",
      ],
      invoice_status: ["draft", "sent", "paid", "void", "uncollectible"],
      job_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "done",
        "cancelled",
        "skipped",
      ],
      lead_status: ["new", "contacted", "quoted", "won", "lost"],
      message_channel: ["sms", "email"],
      message_status: ["queued", "sent", "delivered", "failed"],
      payout_method: ["zelle", "cash", "check", "other"],
      proposal_status: ["draft", "sent", "accepted", "declined", "expired"],
      user_role: ["owner", "provider"],
    },
  },
} as const
