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
      areas: {
        Row: {
          active: boolean
          captain_user_id: string | null
          centroid: unknown
          created_at: string
          geom: unknown
          id: string
          kind: string
          name: string
          parent_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          captain_user_id?: string | null
          centroid?: unknown
          created_at?: string
          geom?: unknown
          id?: string
          kind: string
          name: string
          parent_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          captain_user_id?: string | null
          centroid?: unknown
          created_at?: string
          geom?: unknown
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_shares: {
        Row: {
          contact_phone_e164: string
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          task_id: string
          token_hash: string
        }
        Insert: {
          contact_phone_e164: string
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          task_id: string
          token_hash: string
        }
        Update: {
          contact_phone_e164?: string
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          task_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_shares_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_identities: {
        Row: {
          channel: string
          created_at: string
          external_id: string
          id: string
          opt_in_at: string | null
          opt_out_at: string | null
          updated_at: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          external_id: string
          id?: string
          opt_in_at?: string | null
          opt_out_at?: string | null
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          external_id?: string
          id?: string
          opt_in_at?: string | null
          opt_out_at?: string | null
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      confirmations: {
        Row: {
          action_payload: Json
          confirmed_at: string | null
          consents: string[]
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          status: string
          summary_text: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_payload: Json
          confirmed_at?: string | null
          consents?: string[]
          conversation_id: string
          created_at?: string
          expires_at: string
          id?: string
          kind: string
          status?: string
          summary_text: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_payload?: Json
          confirmed_at?: string | null
          consents?: string[]
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          status?: string
          summary_text?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          channel: string
          created_at: string
          granted: boolean
          id: string
          policy_version: string
          purpose: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          granted: boolean
          id?: string
          policy_version: string
          purpose: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          granted?: boolean
          id?: string
          policy_version?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          channel: string
          created_at: string
          id: string
          last_message_at: string | null
          processing_by: string | null
          processing_until: string | null
          support_mode_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          processing_by?: string | null
          processing_until?: string | null
          support_mode_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          processing_by?: string | null
          processing_until?: string | null
          support_mode_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demand_signals: {
        Row: {
          area_id: string | null
          created_at: string
          id: string
          inferred_category: string | null
          raw_intent: string
          user_id: string | null
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          id?: string
          inferred_category?: string | null
          raw_intent: string
          user_id?: string | null
        }
        Update: {
          area_id?: string | null
          created_at?: string
          id?: string
          inferred_category?: string | null
          raw_intent?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_signals_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          assigned_to: string | null
          created_at: string
          details: string | null
          id: string
          opened_by: string
          reason: string
          resolution: string | null
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          details?: string | null
          id?: string
          opened_by: string
          reason: string
          resolution?: string | null
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          details?: string | null
          id?: string
          opened_by?: string
          reason?: string
          resolution?: string | null
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          gate_note: string | null
          gated: boolean
          key: string
          phase: string
          rules: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          enabled?: boolean
          gate_note?: string | null
          gated?: boolean
          key: string
          phase?: string
          rules?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          gate_note?: string | null
          gated?: boolean
          key?: string
          phase?: string
          rules?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      kb_documents: {
        Row: {
          aliases: string[]
          body_md: string
          category: string
          created_at: string
          fees: Json
          id: string
          jurisdiction: string
          last_verified_at: string | null
          official_urls: string[]
          one_liner: string
          required_documents: Json
          slug: string
          source_urls: string[]
          status: string
          steps: Json
          title: string
          tsv: unknown
          updated_at: string
          verified_by: string | null
          version: number
        }
        Insert: {
          aliases?: string[]
          body_md?: string
          category: string
          created_at?: string
          fees?: Json
          id?: string
          jurisdiction?: string
          last_verified_at?: string | null
          official_urls?: string[]
          one_liner: string
          required_documents?: Json
          slug: string
          source_urls?: string[]
          status?: string
          steps?: Json
          title: string
          tsv?: unknown
          updated_at?: string
          verified_by?: string | null
          version?: number
        }
        Update: {
          aliases?: string[]
          body_md?: string
          category?: string
          created_at?: string
          fees?: Json
          id?: string
          jurisdiction?: string
          last_verified_at?: string | null
          official_urls?: string[]
          one_liner?: string
          required_documents?: Json
          slug?: string
          source_urls?: string[]
          status?: string
          steps?: Json
          title?: string
          tsv?: unknown
          updated_at?: string
          verified_by?: string | null
          version?: number
        }
        Relationships: []
      }
      local_alerts: {
        Row: {
          area_ids: string[]
          body: string
          created_at: string
          ends_at: string | null
          id: string
          severity: string
          source_url: string
          starts_at: string
          title: string
          updated_at: string
          verified_by: string
        }
        Insert: {
          area_ids: string[]
          body: string
          created_at?: string
          ends_at?: string | null
          id?: string
          severity?: string
          source_url: string
          starts_at: string
          title: string
          updated_at?: string
          verified_by: string
        }
        Update: {
          area_ids?: string[]
          body?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          severity?: string
          source_url?: string
          starts_at?: string
          title?: string
          updated_at?: string
          verified_by?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          bucket: string
          bytes: number | null
          created_at: string
          duration_sec: number | null
          expires_at: string | null
          id: string
          mime: string
          owner_provider_id: string | null
          owner_user_id: string | null
          path: string
          transcript: string | null
          transcript_confidence: number | null
          transcript_language: string | null
        }
        Insert: {
          bucket: string
          bytes?: number | null
          created_at?: string
          duration_sec?: number | null
          expires_at?: string | null
          id?: string
          mime: string
          owner_provider_id?: string | null
          owner_user_id?: string | null
          path: string
          transcript?: string | null
          transcript_confidence?: number | null
          transcript_language?: string | null
        }
        Update: {
          bucket?: string
          bytes?: number | null
          created_at?: string
          duration_sec?: number | null
          expires_at?: string | null
          id?: string
          mime?: string
          owner_provider_id?: string | null
          owner_user_id?: string | null
          path?: string
          transcript?: string | null
          transcript_confidence?: number | null
          transcript_language?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_owner_provider_id_fkey"
            columns: ["owner_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_owner_provider_id_fkey"
            columns: ["owner_provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      message_media: {
        Row: {
          media_id: string
          message_id: string
          position: number
        }
        Insert: {
          media_id: string
          message_id: string
          position?: number
        }
        Update: {
          media_id?: string
          message_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          cards: Json
          channel: string
          conversation_id: string
          created_at: string
          external_message_id: string | null
          id: string
          idempotency_key: string | null
          retention_class: string
          role: string
          status: string
          task_id: string | null
          text: string | null
        }
        Insert: {
          cards?: Json
          channel: string
          conversation_id: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          idempotency_key?: string | null
          retention_class?: string
          role: string
          status?: string
          task_id?: string | null
          text?: string | null
        }
        Update: {
          cards?: Json
          channel?: string
          conversation_id?: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          idempotency_key?: string | null
          retention_class?: string
          role?: string
          status?: string
          task_id?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          cost_micros: number
          created_at: string
          error: string | null
          external_id: string | null
          id: string
          idempotency_key: string
          payload: Json
          provider_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          template_key: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel: string
          cost_micros?: number
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          idempotency_key: string
          payload?: Json
          provider_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_key: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          cost_micros?: number
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          idempotency_key?: string
          payload?: Json
          provider_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_queue: {
        Row: {
          area_id: string | null
          assigned_to: string | null
          created_at: string
          google_place_id: string | null
          id: string
          meta: Json
          note: string | null
          priority: number
          provider_id: string | null
          reason: string
          resolved_at: string | null
          status: string
          task_id: string | null
          times_shown: number
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          assigned_to?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          meta?: Json
          note?: string | null
          priority?: number
          provider_id?: string | null
          reason: string
          resolved_at?: string | null
          status?: string
          task_id?: string | null
          times_shown?: number
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          assigned_to?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          meta?: Json
          note?: string | null
          priority?: number
          provider_id?: string | null
          reason?: string
          resolved_at?: string | null
          status?: string
          task_id?: string | null
          times_shown?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_queue_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_queue_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_queue_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_queue_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          created_at: string
          google_place_id: string
          id: string
          lat_lng: unknown
          lat_lng_cached_at: string | null
          source: string
        }
        Insert: {
          created_at?: string
          google_place_id: string
          id?: string
          lat_lng?: unknown
          lat_lng_cached_at?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          google_place_id?: string
          id?: string
          lat_lng?: unknown
          lat_lng_cached_at?: string | null
          source?: string
        }
        Relationships: []
      }
      power_reports: {
        Row: {
          area_id: string
          counted: boolean
          id: string
          matched_consensus: boolean | null
          reported_at: string
          reporter_user_id: string | null
          source: string
          status: string
          via: string
          weight_at_report: number
        }
        Insert: {
          area_id: string
          counted: boolean
          id?: string
          matched_consensus?: boolean | null
          reported_at?: string
          reporter_user_id?: string | null
          source: string
          status: string
          via?: string
          weight_at_report: number
        }
        Update: {
          area_id?: string
          counted?: boolean
          id?: string
          matched_consensus?: boolean | null
          reported_at?: string
          reporter_user_id?: string | null
          source?: string
          status?: string
          via?: string
          weight_at_report?: number
        }
        Relationships: [
          {
            foreignKeyName: "power_reports_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      power_status: {
        Row: {
          area_id: string
          computed_at: string
          confidence: number
          confirmed_status: string | null
          last_change_at: string | null
          reporters_count: number
          status: string
        }
        Insert: {
          area_id: string
          computed_at?: string
          confidence?: number
          confirmed_status?: string | null
          last_change_at?: string | null
          reporters_count?: number
          status?: string
        }
        Update: {
          area_id?: string
          computed_at?: string
          confidence?: number
          confirmed_status?: string | null
          last_change_at?: string | null
          reporters_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "power_status_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: true
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      power_status_changes: {
        Row: {
          area_id: string
          changed_at: string
          from_status: string | null
          id: string
          reporter_ids: string[]
          to_status: string
        }
        Insert: {
          area_id: string
          changed_at?: string
          from_status?: string | null
          id?: string
          reporter_ids?: string[]
          to_status: string
        }
        Update: {
          area_id?: string
          changed_at?: string
          from_status?: string | null
          id?: string
          reporter_ids?: string[]
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "power_status_changes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_confirmed_at: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string | null
          id: string
          language: string
          last_otp_verified_at: string | null
          phone_e164: string | null
          phone_verified_by_ops_at: string | null
          power_area_id: string | null
          prefs: Json
          reporter_trust: number
          timezone: string
          updated_at: string
        }
        Insert: {
          age_confirmed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email?: string | null
          id: string
          language?: string
          last_otp_verified_at?: string | null
          phone_e164?: string | null
          phone_verified_by_ops_at?: string | null
          power_area_id?: string | null
          prefs?: Json
          reporter_trust?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          age_confirmed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          language?: string
          last_otp_verified_at?: string | null
          phone_e164?: string | null
          phone_verified_by_ops_at?: string | null
          power_area_id?: string | null
          prefs?: Json
          reporter_trust?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_power_area_id_fkey"
            columns: ["power_area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_check_ins: {
        Row: {
          at: string
          created_at: string
          id: string
          kind: string
          provider_id: string
          source: string
          task_id: string
        }
        Insert: {
          at?: string
          created_at?: string
          id?: string
          kind: string
          provider_id: string
          source: string
          task_id: string
        }
        Update: {
          at?: string
          created_at?: string
          id?: string
          kind?: string
          provider_id?: string
          source?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_check_ins_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_check_ins_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_check_ins_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_members: {
        Row: {
          created_at: string
          id: string
          provider_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_members_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_members_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_requests: {
        Row: {
          brief: Json
          channel: string
          created_at: string
          eta_minutes: number | null
          id: string
          kind: string
          link_bound_at: string | null
          note: string | null
          provider_id: string
          quote_kobo: number | null
          responded_at: string | null
          response: string
          sent_at: string | null
          task_id: string
          token_expires_at: string | null
          token_hash: string | null
          updated_at: string
          wave: number
        }
        Insert: {
          brief?: Json
          channel: string
          created_at?: string
          eta_minutes?: number | null
          id?: string
          kind: string
          link_bound_at?: string | null
          note?: string | null
          provider_id: string
          quote_kobo?: number | null
          responded_at?: string | null
          response?: string
          sent_at?: string | null
          task_id: string
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
          wave?: number
        }
        Update: {
          brief?: Json
          channel?: string
          created_at?: string
          eta_minutes?: number | null
          id?: string
          kind?: string
          link_bound_at?: string | null
          note?: string | null
          provider_id?: string
          quote_kobo?: number | null
          responded_at?: string | null
          response?: string
          sent_at?: string | null
          task_id?: string
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
          wave?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_services: {
        Row: {
          available_today: boolean
          available_until: string | null
          category: string
          created_at: string
          id: string
          is_call_out_fee: boolean
          name: string
          price_max_kobo: number | null
          price_min_kobo: number | null
          provider_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          available_today?: boolean
          available_until?: string | null
          category: string
          created_at?: string
          id?: string
          is_call_out_fee?: boolean
          name: string
          price_max_kobo?: number | null
          price_min_kobo?: number | null
          provider_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          available_today?: boolean
          available_until?: string | null
          category?: string
          created_at?: string
          id?: string
          is_call_out_fee?: boolean
          name?: string
          price_max_kobo?: number | null
          price_min_kobo?: number | null
          provider_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          accepting_requests: boolean
          address_text: string | null
          area_id: string | null
          categories: string[]
          completion_rate: number | null
          created_at: string
          description: string | null
          display_name: string
          does_home_visits: boolean
          emergency_capable: boolean
          hours: Json
          id: string
          id_check_ref: string | null
          id_checked_at: string | null
          landmark: string | null
          last_active_at: string | null
          licence_body: string | null
          licence_ref: string | null
          location: unknown
          median_response_sec: number | null
          no_show_count_30d: number
          open_24h: boolean
          payout_account_name_verified: string | null
          payout_account_number: string | null
          payout_bank_code: string | null
          payout_verified_at: string | null
          paystack_subaccount_code: string | null
          phone_e164: string | null
          phone_verified_by_ops_at: string | null
          photo_path: string | null
          rating_avg: number | null
          rating_count: number
          response_rate: number | null
          service_radius_m: number
          source: string
          status: string
          trades: string[]
          type: string
          updated_at: string
          verification_level: string
          verified_name: string | null
          whatsapp_opt_in_at: string | null
          whatsapp_opt_in_evidence: Json | null
        }
        Insert: {
          accepting_requests?: boolean
          address_text?: string | null
          area_id?: string | null
          categories?: string[]
          completion_rate?: number | null
          created_at?: string
          description?: string | null
          display_name: string
          does_home_visits?: boolean
          emergency_capable?: boolean
          hours?: Json
          id?: string
          id_check_ref?: string | null
          id_checked_at?: string | null
          landmark?: string | null
          last_active_at?: string | null
          licence_body?: string | null
          licence_ref?: string | null
          location?: unknown
          median_response_sec?: number | null
          no_show_count_30d?: number
          open_24h?: boolean
          payout_account_name_verified?: string | null
          payout_account_number?: string | null
          payout_bank_code?: string | null
          payout_verified_at?: string | null
          paystack_subaccount_code?: string | null
          phone_e164?: string | null
          phone_verified_by_ops_at?: string | null
          photo_path?: string | null
          rating_avg?: number | null
          rating_count?: number
          response_rate?: number | null
          service_radius_m?: number
          source?: string
          status?: string
          trades?: string[]
          type: string
          updated_at?: string
          verification_level?: string
          verified_name?: string | null
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_in_evidence?: Json | null
        }
        Update: {
          accepting_requests?: boolean
          address_text?: string | null
          area_id?: string | null
          categories?: string[]
          completion_rate?: number | null
          created_at?: string
          description?: string | null
          display_name?: string
          does_home_visits?: boolean
          emergency_capable?: boolean
          hours?: Json
          id?: string
          id_check_ref?: string | null
          id_checked_at?: string | null
          landmark?: string | null
          last_active_at?: string | null
          licence_body?: string | null
          licence_ref?: string | null
          location?: unknown
          median_response_sec?: number | null
          no_show_count_30d?: number
          open_24h?: boolean
          payout_account_name_verified?: string | null
          payout_account_number?: string | null
          payout_bank_code?: string | null
          payout_verified_at?: string | null
          paystack_subaccount_code?: string | null
          phone_e164?: string | null
          phone_verified_by_ops_at?: string | null
          photo_path?: string | null
          rating_avg?: number | null
          rating_count?: number
          response_rate?: number | null
          service_radius_m?: number
          source?: string
          status?: string
          trades?: string[]
          type?: string
          updated_at?: string
          verification_level?: string
          verified_name?: string | null
          whatsapp_opt_in_at?: string | null
          whatsapp_opt_in_evidence?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_ok_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_ok_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_ok_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          provider_id: string
          provider_reply: string | null
          rater_user_id: string
          score: number
          tags: string[]
          task_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          provider_id: string
          provider_reply?: string | null
          rater_user_id: string
          score: number
          tags?: string[]
          task_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          provider_id?: string
          provider_reply?: string | null
          rater_user_id?: string
          score?: number
          tags?: string[]
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          body: string | null
          created_at: string
          id: string
          important: boolean
          last_sent_at: string | null
          remind_at: string
          rrule: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          important?: boolean
          last_sent_at?: string | null
          remind_at: string
          rrule?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          important?: boolean
          last_sent_at?: string | null
          remind_at?: string
          rrule?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_events: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: string
          task_id: string | null
          text_excerpt: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind: string
          task_id?: string | null
          text_excerpt?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: string
          task_id?: string | null
          text_excerpt?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_places: {
        Row: {
          address_text: string | null
          area_id: string | null
          created_at: string
          id: string
          label: string
          landmark: string | null
          location: unknown
          updated_at: string
          user_id: string
        }
        Insert: {
          address_text?: string | null
          area_id?: string | null
          created_at?: string
          id?: string
          label: string
          landmark?: string | null
          location: unknown
          updated_at?: string
          user_id: string
        }
        Update: {
          address_text?: string | null
          area_id?: string | null
          created_at?: string
          id?: string
          label?: string
          landmark?: string | null
          location?: unknown
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_places_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          id: string
          kb_slug: string | null
          kb_version: number | null
          position: number
          task_id: string
          text: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: string
          kb_slug?: string | null
          kb_version?: number | null
          position?: number
          task_id: string
          text: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          id?: string
          kb_slug?: string | null
          kb_version?: number | null
          position?: number
          task_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          from_status: string | null
          id: string
          payload: Json
          seq: number
          task_id: string
          to_status: string | null
          type: string
          visibility: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string
          from_status?: string | null
          id?: string
          payload?: Json
          seq?: never
          task_id: string
          to_status?: string | null
          type: string
          visibility?: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          from_status?: string | null
          id?: string
          payload?: Json
          seq?: never
          task_id?: string
          to_status?: string | null
          type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_options: {
        Row: {
          as_of: string
          created_at: string
          distance_m: number | null
          eta_minutes: number | null
          facility_id: string | null
          google_place_id: string | null
          id: string
          price_kobo: number | null
          price_note: string | null
          provider_id: string | null
          rank: number | null
          rank_reasons: Json
          ready_at: string | null
          source: string
          status: string
          task_id: string
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          as_of: string
          created_at?: string
          distance_m?: number | null
          eta_minutes?: number | null
          facility_id?: string | null
          google_place_id?: string | null
          id?: string
          price_kobo?: number | null
          price_note?: string | null
          provider_id?: string | null
          rank?: number | null
          rank_reasons?: Json
          ready_at?: string | null
          source: string
          status?: string
          task_id: string
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          as_of?: string
          created_at?: string
          distance_m?: number | null
          eta_minutes?: number | null
          facility_id?: string | null
          google_place_id?: string | null
          id?: string
          price_kobo?: number | null
          price_note?: string | null
          provider_id?: string | null
          rank?: number | null
          rank_reasons?: Json
          ready_at?: string | null
          source?: string
          status?: string
          task_id?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_options_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_options_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_options_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_options_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_options_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_paused: boolean
          agreed_price_kobo: number | null
          area_id: string | null
          assigned_ops_id: string | null
          budget_kobo: number | null
          chosen_option_id: string | null
          closed_at: string | null
          completed_at: string | null
          conversation_id: string | null
          cost_micros: number
          created_at: string
          expected_end_at: string | null
          id: string
          job_type: string
          location: unknown
          outcome: string | null
          outcome_reason: string | null
          pin_released_at: string | null
          provider_id: string | null
          scheduled_for: string | null
          skill_id: string
          slots: Json
          status: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
          version: number
          visit_in_home: boolean
        }
        Insert: {
          agent_paused?: boolean
          agreed_price_kobo?: number | null
          area_id?: string | null
          assigned_ops_id?: string | null
          budget_kobo?: number | null
          chosen_option_id?: string | null
          closed_at?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          cost_micros?: number
          created_at?: string
          expected_end_at?: string | null
          id?: string
          job_type: string
          location?: unknown
          outcome?: string | null
          outcome_reason?: string | null
          pin_released_at?: string | null
          provider_id?: string | null
          scheduled_for?: string | null
          skill_id: string
          slots?: Json
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
          version?: number
          visit_in_home?: boolean
        }
        Update: {
          agent_paused?: boolean
          agreed_price_kobo?: number | null
          area_id?: string | null
          assigned_ops_id?: string | null
          budget_kobo?: number | null
          chosen_option_id?: string | null
          closed_at?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          cost_micros?: number
          created_at?: string
          expected_end_at?: string | null
          id?: string
          job_type?: string
          location?: unknown
          outcome?: string | null
          outcome_reason?: string | null
          pin_released_at?: string | null
          provider_id?: string | null
          scheduled_for?: string | null
          skill_id?: string
          slots?: Json
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
          visit_in_home?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tasks_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_chosen_option_id_fkey"
            columns: ["chosen_option_id"]
            isOneToOne: false
            referencedRelation: "task_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_flags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string | null
          source_task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          note?: string | null
          source_task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          source_task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_flags_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          area: string
          consent: boolean
          created_at: string
          current_ways: string[]
          email: string
          first_ask: string | null
          id: string
          languages: string[]
          name: string
          needs: string[]
          source: string
          whatsapp: string | null
        }
        Insert: {
          area: string
          consent: boolean
          created_at?: string
          current_ways?: string[]
          email: string
          first_ask?: string | null
          id?: string
          languages?: string[]
          name: string
          needs: string[]
          source?: string
          whatsapp?: string | null
        }
        Update: {
          area?: string
          consent?: boolean
          created_at?: string
          current_ways?: string[]
          email?: string
          first_ask?: string | null
          id?: string
          languages?: string[]
          name?: string
          needs?: string[]
          source?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      watches: {
        Row: {
          active: boolean
          area_id: string | null
          created_at: string
          fires_day: string | null
          fires_today: number
          id: string
          last_fired_at: string | null
          params: Json
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          area_id?: string | null
          created_at?: string
          fires_day?: string | null
          fires_today?: number
          id?: string
          last_fired_at?: string | null
          params?: Json
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          area_id?: string | null
          created_at?: string
          fires_day?: string | null
          fires_today?: number
          id?: string
          last_fired_at?: string | null
          params?: Json
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watches_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      providers_public: {
        Row: {
          accepting_requests: boolean | null
          area_id: string | null
          categories: string[] | null
          description: string | null
          display_name: string | null
          does_home_visits: boolean | null
          emergency_capable: boolean | null
          hours: Json | null
          id: string | null
          last_active_at: string | null
          open_24h: boolean | null
          photo_path: string | null
          rating_avg: number | null
          rating_count: number | null
          response_rate: number | null
          service_radius_m: number | null
          trades: string[] | null
          type: string | null
          verification_level: string | null
        }
        Insert: {
          accepting_requests?: boolean | null
          area_id?: string | null
          categories?: string[] | null
          description?: string | null
          display_name?: string | null
          does_home_visits?: boolean | null
          emergency_capable?: boolean | null
          hours?: Json | null
          id?: string | null
          last_active_at?: string | null
          open_24h?: boolean | null
          photo_path?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          response_rate?: number | null
          service_radius_m?: number | null
          trades?: string[] | null
          type?: string | null
          verification_level?: string | null
        }
        Update: {
          accepting_requests?: boolean | null
          area_id?: string | null
          categories?: string[] | null
          description?: string | null
          display_name?: string | null
          does_home_visits?: boolean | null
          emergency_capable?: boolean | null
          hours?: Json | null
          id?: string | null
          last_active_at?: string | null
          open_24h?: boolean | null
          photo_path?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          response_rate?: number | null
          service_radius_m?: number | null
          trades?: string[] | null
          type?: string | null
          verification_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_areas: {
        Row: {
          area: string | null
          latest_signup: string | null
          signups: number | null
        }
        Relationships: []
      }
      waitlist_current_ways: {
        Row: {
          signups: number | null
          way: string | null
        }
        Relationships: []
      }
      waitlist_needs: {
        Row: {
          need: string | null
          signups: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_create_session: {
        Args: {
          p_expires_at: string
          p_ip_hash: string
          p_token_hash: string
          p_user_agent: string
          p_user_id: string
        }
        Returns: string
      }
      auth_create_user: {
        Args: {
          p_display_name: string
          p_email: string
          p_language: string
          p_password_hash: string
          p_policy_version: string
        }
        Returns: string
      }
      auth_delete_user: {
        Args: { p_deleted_by: string; p_user_id: string }
        Returns: boolean
      }
      auth_find_user: { Args: { p_email: string }; Returns: string }
      auth_get_credentials: {
        Args: { p_email: string }
        Returns: {
          disabled_at: string
          locked_until: string
          password_hash: string
          user_id: string
        }[]
      }
      auth_get_password_hash: { Args: { p_user_id: string }; Returns: string }
      auth_get_session: {
        Args: { p_extend_to: string; p_token_hash: string }
        Returns: {
          aal: string
          app_role: string
          display_name: string
          email: string
          expires_at: string
          language: string
          mfa_enabled: boolean
          session_id: string
          timezone: string
          user_id: string
        }[]
      }
      auth_list_sessions: {
        Args: { p_user_id: string }
        Returns: {
          aal: string
          created_at: string
          last_seen_at: string
          session_id: string
          user_agent: string
        }[]
      }
      auth_mfa_accept: {
        Args: { p_session_id: string; p_step: number; p_user_id: string }
        Returns: boolean
      }
      auth_mfa_begin: {
        Args: { p_secret_ciphertext: string; p_user_id: string }
        Returns: boolean
      }
      auth_mfa_get: {
        Args: { p_user_id: string }
        Returns: {
          last_used_step: number
          secret_ciphertext: string
          verified_at: string
        }[]
      }
      auth_record_failed_sign_in: {
        Args: { p_lock_seconds: number; p_max: number; p_user_id: string }
        Returns: string
      }
      auth_remove_role: {
        Args: { p_removed_by: string; p_user_id: string }
        Returns: undefined
      }
      auth_revoke_other_sessions: {
        Args: { p_keep_session_id: string; p_user_id: string }
        Returns: number
      }
      auth_revoke_session: {
        Args: { p_token_hash: string }
        Returns: undefined
      }
      auth_set_password: {
        Args: { p_password_hash: string; p_user_id: string }
        Returns: undefined
      }
      auth_set_role: {
        Args: { p_granted_by: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      bump_invite_candidate: {
        Args: {
          p_area_id: string
          p_place_id: string
          p_priority?: number
          p_trade: string
        }
        Returns: string
      }
      claim_confirmation: {
        Args: { p_confirmation_id: string; p_user_id: string }
        Returns: {
          action_payload: Json
          confirmed_at: string | null
          consents: string[]
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          status: string
          summary_text: string
          task_id: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "confirmations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_conversation_lease: {
        Args: {
          p_conversation_id: string
          p_ttl_s?: number
          p_worker_id: string
        }
        Returns: boolean
      }
      claim_job_by_id: {
        Args: { p_id: string; p_worker: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_jobs: {
        Args: { p_limit?: number; p_worker: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_watch_fire: { Args: { p_watch_id: string }; Returns: boolean }
      complete_job: {
        Args: { p_id: string; p_worker: string }
        Returns: boolean
      }
      compute_power_status: { Args: { p_area_id: string }; Returns: Json }
      create_confirmation: {
        Args: {
          p_action_payload: Json
          p_consents?: string[]
          p_conversation_id: string
          p_kind: string
          p_summary_text: string
          p_task_id: string
          p_ttl_s?: number
          p_user_id: string
        }
        Returns: {
          action_payload: Json
          confirmed_at: string | null
          consents: string[]
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          status: string
          summary_text: string
          task_id: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "confirmations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      enqueue_job: {
        Args: {
          p_dedupe_key?: string
          p_max_attempts?: number
          p_payload?: Json
          p_run_at?: string
          p_type: string
        }
        Returns: {
          created: boolean
          id: string
        }[]
      }
      fail_job: {
        Args: {
          p_error: string
          p_id: string
          p_retry?: boolean
          p_worker: string
        }
        Returns: string
      }
      hit_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      ingest_webhook: {
        Args: { p_external_id: string; p_payload: Json; p_source: string }
        Returns: {
          duplicate: boolean
          event_id: string
          job_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_provider_member: { Args: { p_provider_id: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      jobs_overview: { Args: never; Returns: Json }
      join_waitlist: {
        Args: {
          p_area: string
          p_current_ways: string[]
          p_email: string
          p_first_ask: string
          p_languages: string[]
          p_name: string
          p_needs: string[]
          p_whatsapp: string
        }
        Returns: Json
      }
      kb_tsv: {
        Args: {
          p_aliases: string[]
          p_body: string
          p_one_liner: string
          p_title: string
        }
        Returns: unknown
      }
      llm_breaker_check: {
        Args: never
        Returns: {
          open_until: string
          provider: string
          state: string
        }[]
      }
      llm_breaker_record: {
        Args: { p_ok: boolean; p_probe?: boolean; p_provider: string }
        Returns: string
      }
      llm_breaker_states: {
        Args: never
        Returns: {
          open_until: string
          provider: string
          state: string
        }[]
      }
      log_llm_call: { Args: { p_call: Json }; Returns: string }
      nearby_providers: {
        Args: {
          p_dish: string
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_m: number
          p_skill: string
          p_trade: string
        }
        Returns: {
          display_name: string
          distance_m: number
          last_active_at: string
          matched_service_id: string
          matched_service_name: string
          no_show_count_30d: number
          price_max_kobo: number
          price_min_kobo: number
          provider_id: string
          rating_avg: number
          rating_count: number
          response_rate: number
          service_radius_m: number
          verification_level: string
        }[]
      }
      provider_get_profile: {
        Args: { p_provider_id: string }
        Returns: {
          accepting_requests: boolean
          address_text: string | null
          area_id: string | null
          categories: string[]
          completion_rate: number | null
          created_at: string
          description: string | null
          display_name: string
          does_home_visits: boolean
          emergency_capable: boolean
          hours: Json
          id: string
          id_check_ref: string | null
          id_checked_at: string | null
          landmark: string | null
          last_active_at: string | null
          licence_body: string | null
          licence_ref: string | null
          location: unknown
          median_response_sec: number | null
          no_show_count_30d: number
          open_24h: boolean
          payout_account_name_verified: string | null
          payout_account_number: string | null
          payout_bank_code: string | null
          payout_verified_at: string | null
          paystack_subaccount_code: string | null
          phone_e164: string | null
          phone_verified_by_ops_at: string | null
          photo_path: string | null
          rating_avg: number | null
          rating_count: number
          response_rate: number | null
          service_radius_m: number
          source: string
          status: string
          trades: string[]
          type: string
          updated_at: string
          verification_level: string
          verified_name: string | null
          whatsapp_opt_in_at: string | null
          whatsapp_opt_in_evidence: Json | null
        }[]
        SetofOptions: {
          from: "*"
          to: "providers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      provider_get_request: { Args: { p_request_id: string }; Returns: Json }
      provider_list_requests: {
        Args: never
        Returns: {
          area_name: string
          brief: Json
          chosen: boolean
          created_at: string
          id: string
          kind: string
          provider_id: string
          response: string
          scheduled_for: string
          task_status: string
          wave: number
        }[]
      }
      provider_respond: {
        Args: {
          p_eta_minutes: number
          p_note: string
          p_quote_kobo: number
          p_request_id: string
          p_response: string
        }
        Returns: {
          brief: Json
          channel: string
          created_at: string
          eta_minutes: number | null
          id: string
          kind: string
          link_bound_at: string | null
          note: string | null
          provider_id: string
          quote_kobo: number | null
          responded_at: string | null
          response: string
          sent_at: string | null
          task_id: string
          token_expires_at: string | null
          token_hash: string | null
          updated_at: string
          wave: number
        }[]
        SetofOptions: {
          from: "*"
          to: "provider_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      provider_update_profile: {
        Args: { p_patch: Json; p_provider_id: string }
        Returns: undefined
      }
      reap_jobs: { Args: { p_stale_after_s?: number }; Returns: number }
      record_heartbeat: { Args: { p_name: string }; Returns: string }
      record_power_report: {
        Args: {
          p_area_id: string
          p_reporter_user_id: string
          p_source: string
          p_status: string
          p_via?: string
        }
        Returns: Json
      }
      record_web_lookup: {
        Args: { p_lookup: Json }
        Returns: {
          crossed_threshold: boolean
          lookup_id: string
        }[]
      }
      release_conversation_lease: {
        Args: { p_conversation_id: string; p_worker_id: string }
        Returns: boolean
      }
      resolve_area: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          id: string
          kind: string
          name: string
        }[]
      }
      submit_power_report: {
        Args: { p_area_id?: string; p_status: string }
        Returns: Json
      }
      task_timer_valid: {
        Args: {
          p_anchor_event_id: string
          p_task_id: string
          p_valid_statuses: string[]
        }
        Returns: boolean
      }
      task_transition_allowed: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      track_event: {
        Args: { p_name: string; p_props?: Json; p_user_id: string }
        Returns: undefined
      }
      transition_task: {
        Args: {
          p_actor_id: string
          p_actor_type: string
          p_expected_version: number
          p_outcome?: string
          p_outcome_reason?: string
          p_payload?: Json
          p_task_id: string
          p_to: string
          p_visibility?: string
        }
        Returns: {
          event_id: string
          event_seq: number
          from_status: string
          task_id: string
          to_status: string
          version: number
        }[]
      }
      upsert_area: {
        Args: {
          p_active?: boolean
          p_geojson: Json
          p_kind: string
          p_name: string
          p_parent_id: string
          p_source: string
        }
        Returns: string
      }
      write_audit: {
        Args: {
          p_action: string
          p_actor_id: string
          p_diff?: Json
          p_entity: string
          p_entity_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
