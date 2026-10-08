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
        Relationships: []
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
    }
    Views: {
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
      hit_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
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
