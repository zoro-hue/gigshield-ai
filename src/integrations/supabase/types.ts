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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      claims: {
        Row: {
          amount: number
          created_at: string
          fraud_check_passed: boolean | null
          fraud_score: number | null
          id: string
          location_city: string | null
          location_zone: string | null
          paid_at: string | null
          policy_id: string | null
          processing_time_seconds: number | null
          status: string
          trigger_type: string
          trigger_value: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fraud_check_passed?: boolean | null
          fraud_score?: number | null
          id?: string
          location_city?: string | null
          location_zone?: string | null
          paid_at?: string | null
          policy_id?: string | null
          processing_time_seconds?: number | null
          status?: string
          trigger_type: string
          trigger_value?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fraud_check_passed?: boolean | null
          fraud_score?: number | null
          id?: string
          location_city?: string | null
          location_zone?: string | null
          paid_at?: string | null
          policy_id?: string | null
          processing_time_seconds?: number | null
          status?: string
          trigger_type?: string
          trigger_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      disruption_events: {
        Row: {
          city: string
          description: string | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          severity: string | null
          source: string | null
          started_at: string
          title: string
          type: string
          zone: string | null
        }
        Insert: {
          city: string
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          severity?: string | null
          source?: string | null
          started_at?: string
          title: string
          type: string
          zone?: string | null
        }
        Update: {
          city?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          severity?: string | null
          source?: string | null
          started_at?: string
          title?: string
          type?: string
          zone?: string | null
        }
        Relationships: []
      }
      gps_logs: {
        Row: {
          accuracy: number | null
          anomaly_score: number | null
          flagged_reason: string | null
          id: string
          is_spoofed: boolean | null
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          anomaly_score?: number | null
          flagged_reason?: string | null
          id?: string
          is_spoofed?: boolean | null
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          anomaly_score?: number | null
          flagged_reason?: string | null
          id?: string
          is_spoofed?: boolean | null
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
          user_id?: string
        }
        Relationships: []
      }
      logs: {
        Row: {
          created_at: string
          id: string
          message: string | null
          metadata: Json | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          type?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          activated_at: string
          coverage_type: string | null
          expires_at: string | null
          id: string
          max_payout: number
          renewed_count: number | null
          status: string
          user_id: string
          weekly_premium: number
          worker_profile_id: string | null
        }
        Insert: {
          activated_at?: string
          coverage_type?: string | null
          expires_at?: string | null
          id?: string
          max_payout: number
          renewed_count?: number | null
          status?: string
          user_id: string
          weekly_premium: number
          worker_profile_id?: string | null
        }
        Update: {
          activated_at?: string
          coverage_type?: string | null
          expires_at?: string | null
          id?: string
          max_payout?: number
          renewed_count?: number | null
          status?: string
          user_id?: string
          weekly_premium?: number
          worker_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_worker_profile_id_fkey"
            columns: ["worker_profile_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      risk_assessments: {
        Row: {
          city: string
          created_at: string
          id: string
          model_version: string | null
          risk_label: string
          risk_score: number | null
          source: string | null
          weather_snapshot: Json | null
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          model_version?: string | null
          risk_label?: string
          risk_score?: number | null
          source?: string | null
          weather_snapshot?: Json | null
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          model_version?: string | null
          risk_label?: string
          risk_score?: number | null
          source?: string | null
          weather_snapshot?: Json | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          claim_id: string | null
          created_at: string
          id: string
          method: string | null
          payment_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          claim_id?: string | null
          created_at?: string
          id?: string
          method?: string | null
          payment_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          claim_id?: string | null
          created_at?: string
          id?: string
          method?: string | null
          payment_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_readings: {
        Row: {
          aqi: number | null
          city: string
          humidity: number | null
          id: string
          rainfall: number | null
          recorded_at: string
          source: string | null
          temperature: number | null
          wind_speed: number | null
          zone: string | null
        }
        Insert: {
          aqi?: number | null
          city: string
          humidity?: number | null
          id?: string
          rainfall?: number | null
          recorded_at?: string
          source?: string | null
          temperature?: number | null
          wind_speed?: number | null
          zone?: string | null
        }
        Update: {
          aqi?: number | null
          city?: string
          humidity?: number | null
          id?: string
          rainfall?: number | null
          recorded_at?: string
          source?: string | null
          temperature?: number | null
          wind_speed?: number | null
          zone?: string | null
        }
        Relationships: []
      }
      worker_profiles: {
        Row: {
          aadhaar_last4: string | null
          avg_weekly_earnings: number | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          max_payout: number | null
          phone: string | null
          platform: string | null
          risk_score: number | null
          segment: string | null
          updated_at: string
          user_id: string
          vehicle_type: string | null
          weekly_premium: number | null
          working_hours_per_day: number | null
          zone: string | null
        }
        Insert: {
          aadhaar_last4?: string | null
          avg_weekly_earnings?: number | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          max_payout?: number | null
          phone?: string | null
          platform?: string | null
          risk_score?: number | null
          segment?: string | null
          updated_at?: string
          user_id: string
          vehicle_type?: string | null
          weekly_premium?: number | null
          working_hours_per_day?: number | null
          zone?: string | null
        }
        Update: {
          aadhaar_last4?: string | null
          avg_weekly_earnings?: number | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          max_payout?: number | null
          phone?: string | null
          platform?: string | null
          risk_score?: number | null
          segment?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string | null
          weekly_premium?: number | null
          working_hours_per_day?: number | null
          zone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
