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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_tag: string
          assigned_name: string
          assigned_to: string | null
          brand: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          location_id: string | null
          model: string
          name: string
          notes: string
          purchase_date: string | null
          sector_id: string | null
          serial_number: string
          status: Database["public"]["Enums"]["asset_status"]
          supplier_id: string | null
          updated_at: string
          warranty_end: string | null
        }
        Insert: {
          asset_tag?: string
          assigned_name?: string
          assigned_to?: string | null
          brand?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          location_id?: string | null
          model?: string
          name: string
          notes?: string
          purchase_date?: string | null
          sector_id?: string | null
          serial_number?: string
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          updated_at?: string
          warranty_end?: string | null
        }
        Update: {
          asset_tag?: string
          assigned_name?: string
          assigned_to?: string | null
          brand?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          location_id?: string | null
          model?: string
          name?: string
          notes?: string
          purchase_date?: string | null
          sector_id?: string | null
          serial_number?: string
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          updated_at?: string
          warranty_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          author_id: string | null
          body: string
          category: string
          created_at: string
          id: string
          published: boolean
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          published?: boolean
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          published?: boolean
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          building: string
          created_at: string
          id: string
          name: string
          notes: string
          updated_at: string
        }
        Insert: {
          building?: string
          created_at?: string
          id?: string
          name: string
          notes?: string
          updated_at?: string
        }
        Update: {
          building?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          manager: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sla_policies: {
        Row: {
          created_at: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes: number
          response_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes?: number
          response_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_minutes?: number
          response_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact_email: string
          created_at: string
          id: string
          name: string
          notes: string
          phone: string
          updated_at: string
        }
        Insert: {
          contact_email?: string
          created_at?: string
          id?: string
          name: string
          notes?: string
          phone?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asset_id: string | null
          assignee_id: string | null
          category: string
          created_at: string
          description: string
          first_response_at: string | null
          id: string
          kb_article_id: string | null
          location_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          reporter_email: string
          reporter_name: string
          reporter_sector: string
          requester_id: string | null
          resolution_due_at: string | null
          resolved_at: string | null
          response_due_at: string | null
          sector_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assignee_id?: string | null
          category?: string
          created_at?: string
          description?: string
          first_response_at?: string | null
          id?: string
          kb_article_id?: string | null
          location_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reporter_email?: string
          reporter_name?: string
          reporter_sector?: string
          requester_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          response_due_at?: string | null
          sector_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assignee_id?: string | null
          category?: string
          created_at?: string
          description?: string
          first_response_at?: string | null
          id?: string
          kb_article_id?: string | null
          location_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reporter_email?: string
          reporter_name?: string
          reporter_sector?: string
          requester_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          response_due_at?: string | null
          sector_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_kb_article_id_fkey"
            columns: ["kb_article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "usuario"
      asset_kind:
        | "computador"
        | "notebook"
        | "monitor"
        | "impressora"
        | "rede"
        | "telefonia"
        | "licenca"
        | "outro"
      asset_status: "em_uso" | "estoque" | "manutencao" | "descartado"
      ticket_priority: "baixa" | "media" | "alta" | "critica"
      ticket_status:
        | "aberto"
        | "em_andamento"
        | "aguardando"
        | "resolvido"
        | "fechado"
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
      app_role: ["admin", "tecnico", "usuario"],
      asset_kind: [
        "computador",
        "notebook",
        "monitor",
        "impressora",
        "rede",
        "telefonia",
        "licenca",
        "outro",
      ],
      asset_status: ["em_uso", "estoque", "manutencao", "descartado"],
      ticket_priority: ["baixa", "media", "alta", "critica"],
      ticket_status: [
        "aberto",
        "em_andamento",
        "aguardando",
        "resolvido",
        "fechado",
      ],
    },
  },
} as const
