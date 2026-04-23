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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_action_logs: {
        Row: {
          action_type: string
          admin_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          note: string
          user_id: string
        }
        Insert: {
          action_type: string
          admin_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          note?: string
          user_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_user_snapshots: {
        Row: {
          created_at: string
          created_by: string
          id: string
          reason: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          reason?: string
          snapshot?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          reason?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          action_type: string
          cost_estimate: number
          created_at: string
          error_message: string
          id: string
          metadata: Json
          model: string
          success: boolean
          tokens_in: number
          tokens_out: number
          user_id: string
        }
        Insert: {
          action_type: string
          cost_estimate?: number
          created_at?: string
          error_message?: string
          id?: string
          metadata?: Json
          model?: string
          success?: boolean
          tokens_in?: number
          tokens_out?: number
          user_id: string
        }
        Update: {
          action_type?: string
          cost_estimate?: number
          created_at?: string
          error_message?: string
          id?: string
          metadata?: Json
          model?: string
          success?: boolean
          tokens_in?: number
          tokens_out?: number
          user_id?: string
        }
        Relationships: []
      }
      essays: {
        Row: {
          competencia_1: number | null
          competencia_2: number | null
          competencia_3: number | null
          competencia_4: number | null
          competencia_5: number | null
          corrected_at: string | null
          created_at: string
          feedback_competencias: Json
          feedback_geral: string
          id: string
          line_count: number
          nota_total: number | null
          status: string
          tema: string
          texto: string
          tipo_prova: string
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          competencia_1?: number | null
          competencia_2?: number | null
          competencia_3?: number | null
          competencia_4?: number | null
          competencia_5?: number | null
          corrected_at?: string | null
          created_at?: string
          feedback_competencias?: Json
          feedback_geral?: string
          id?: string
          line_count?: number
          nota_total?: number | null
          status?: string
          tema?: string
          texto?: string
          tipo_prova?: string
          updated_at?: string
          user_id: string
          word_count?: number
        }
        Update: {
          competencia_1?: number | null
          competencia_2?: number | null
          competencia_3?: number | null
          competencia_4?: number | null
          competencia_5?: number | null
          corrected_at?: string | null
          created_at?: string
          feedback_competencias?: Json
          feedback_geral?: string
          id?: string
          line_count?: number
          nota_total?: number | null
          status?: string
          tema?: string
          texto?: string
          tipo_prova?: string
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: []
      }
      flora_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      flora_decisions: {
        Row: {
          accepted: boolean | null
          created_at: string
          decision_type: string
          id: string
          reasoning: string
          recommendation: Json
          user_id: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string
          decision_type: string
          id?: string
          reasoning?: string
          recommendation?: Json
          user_id: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string
          decision_type?: string
          id?: string
          reasoning?: string
          recommendation?: Json
          user_id?: string
        }
        Relationships: []
      }
      gamification_profiles: {
        Row: {
          created_at: string
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notebook_ai_activities: {
        Row: {
          created_at: string
          detail: string
          id: string
          notebook_id: string | null
          page_id: string | null
          title: string
          topic_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: string
          notebook_id?: string | null
          page_id?: string | null
          title: string
          topic_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          notebook_id?: string | null
          page_id?: string | null
          title?: string
          topic_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_ai_activities_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_ai_activities_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "notebook_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_page_state: {
        Row: {
          created_at: string
          link_payload: Json
          meta_payload: Json
          notebook_id: string
          page_id: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          link_payload?: Json
          meta_payload?: Json
          notebook_id: string
          page_id: string
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          link_payload?: Json
          meta_payload?: Json
          notebook_id?: string
          page_id?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_page_state_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_page_state_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: true
            referencedRelation: "notebook_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_pages: {
        Row: {
          content: string
          created_at: string
          drawing_data: Json | null
          id: string
          notebook_id: string
          page_number: number
          tags: string[]
          template: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          drawing_data?: Json | null
          id?: string
          notebook_id: string
          page_number?: number
          tags?: string[]
          template?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          drawing_data?: Json | null
          id?: string
          notebook_id?: string
          page_number?: number
          tags?: string[]
          template?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_pages_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_shares: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_public: boolean | null
          notebook_id: string
          owner_id: string
          share_token: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_public?: boolean | null
          notebook_id: string
          owner_id: string
          share_token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_public?: boolean | null
          notebook_id?: string
          owner_id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_shares_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: true
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_shares_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          cover_color: string
          created_at: string
          folder: string | null
          id: string
          is_favorite: boolean
          subject: string | null
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_color?: string
          created_at?: string
          folder?: string | null
          id?: string
          is_favorite?: boolean
          subject?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_color?: string
          created_at?: string
          folder?: string | null
          id?: string
          is_favorite?: boolean
          subject?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          is_admin?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      spaced_reviews: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          interval_days: number
          materia: string
          scheduled_date: string
          topic_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          interval_days: number
          materia: string
          scheduled_date: string
          topic_id: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          interval_days?: number
          materia?: string
          scheduled_date?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: []
      }
      student_onboarding: {
        Row: {
          completed: boolean
          created_at: string
          materias_dificeis: string[]
          meta_resultado: string
          objetivo: string
          rotina: string
          tempo_disponivel_min: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          materias_dificeis?: string[]
          meta_resultado?: string
          objetivo?: string
          rotina?: string
          tempo_disponivel_min?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          materias_dificeis?: string[]
          meta_resultado?: string
          objetivo?: string
          rotina?: string
          tempo_disponivel_min?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_performance: {
        Row: {
          accuracy: number
          acertos: number
          erro_recorrente: boolean
          erros: number
          id: string
          materia: string
          prioridade: number
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number
          acertos?: number
          erro_recorrente?: boolean
          erros?: number
          id?: string
          materia: string
          prioridade?: number
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number
          acertos?: number
          erro_recorrente?: boolean
          erros?: number
          id?: string
          materia?: string
          prioridade?: number
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_goals: {
        Row: {
          created_at: string
          monthly_hours_target: number
          updated_at: string
          user_id: string
          weekly_hours_target: number
          weekly_revisions_target: number
          weekly_topics_target: number
        }
        Insert: {
          created_at?: string
          monthly_hours_target?: number
          updated_at?: string
          user_id: string
          weekly_hours_target?: number
          weekly_revisions_target?: number
          weekly_topics_target?: number
        }
        Update: {
          created_at?: string
          monthly_hours_target?: number
          updated_at?: string
          user_id?: string
          weekly_hours_target?: number
          weekly_revisions_target?: number
          weekly_topics_target?: number
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          duration_ms: number
          end_at: string | null
          id: string
          start_at: string
          subject: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          end_at?: string | null
          id: string
          start_at: string
          subject?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          end_at?: string | null
          id?: string
          start_at?: string
          subject?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_state: {
        Row: {
          created_at: string
          sessions: Json
          topics: Json
          updated_at: string
          user_id: string
          weekly_slots: Json
        }
        Insert: {
          created_at?: string
          sessions?: Json
          topics?: Json
          updated_at?: string
          user_id: string
          weekly_slots?: Json
        }
        Update: {
          created_at?: string
          sessions?: Json
          topics?: Json
          updated_at?: string
          user_id?: string
          weekly_slots?: Json
        }
        Relationships: []
      }
      study_topics: {
        Row: {
          created_at: string
          flashcards: Json
          id: string
          materia: string
          notas: string
          quiz_attempts: number
          quiz_errors: Json
          quiz_last_score: number | null
          rating: number
          revisions: Json
          skip_weekends_revisions: boolean
          study_date: string
          tema: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flashcards?: Json
          id: string
          materia: string
          notas?: string
          quiz_attempts?: number
          quiz_errors?: Json
          quiz_last_score?: number | null
          rating?: number
          revisions?: Json
          skip_weekends_revisions?: boolean
          study_date: string
          tema: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flashcards?: Json
          id?: string
          materia?: string
          notas?: string
          quiz_attempts?: number
          quiz_errors?: Json
          quiz_last_score?: number | null
          rating?: number
          revisions?: Json
          skip_weekends_revisions?: boolean
          study_date?: string
          tema?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tier_limits: {
        Row: {
          action_type: string
          daily_limit: number
          id: string
          tier: string
          updated_at: string
        }
        Insert: {
          action_type: string
          daily_limit?: number
          id?: string
          tier: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          daily_limit?: number
          id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          materia: string | null
          metadata: Json
          topic_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          materia?: string | null
          metadata?: Json
          topic_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          materia?: string | null
          metadata?: Json
          topic_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_tiers: {
        Row: {
          created_at: string
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_slots: {
        Row: {
          concluido: boolean
          descricao: string
          dia: number
          horario: string
          id: string
          materia: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          descricao?: string
          dia: number
          horario: string
          id: string
          materia?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          descricao?: string
          dia?: number
          horario?: string
          id?: string
          materia?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_ai_quota: {
        Args: { p_action: string; p_user_id: string }
        Returns: Json
      }
      is_admin_user: { Args: never; Returns: boolean }
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
