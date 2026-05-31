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
      accounts: {
        Row: {
          closing_day: number | null
          color: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          due_day: number | null
          icon: string | null
          id: string
          initial_balance: number
          is_hidden: boolean
          name: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          closing_day?: number | null
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          due_day?: number | null
          icon?: string | null
          id?: string
          initial_balance?: number
          is_hidden?: boolean
          name: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          closing_day?: number | null
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          due_day?: number | null
          icon?: string | null
          id?: string
          initial_balance?: number
          is_hidden?: boolean
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_default: boolean
          name: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          buy: number
          created_at: string
          fetched_at: string
          id: string
          rate_type: Database["public"]["Enums"]["rate_type"]
          sell: number
        }
        Insert: {
          buy: number
          created_at?: string
          fetched_at?: string
          id?: string
          rate_type: Database["public"]["Enums"]["rate_type"]
          sell: number
        }
        Update: {
          buy?: number
          created_at?: string
          fetched_at?: string
          id?: string
          rate_type?: Database["public"]["Enums"]["rate_type"]
          sell?: number
        }
        Relationships: []
      }
      movements: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          converted_amount: number | null
          created_at: string
          date: string
          dollar_type: string | null
          id: string
          installment_number: number | null
          installment_purchase_id: string | null
          installment_total: number | null
          is_future: boolean
          note: string | null
          original_currency: Database["public"]["Enums"]["currency"]
          recurring_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          converted_amount?: number | null
          created_at?: string
          date?: string
          dollar_type?: string | null
          id?: string
          installment_number?: number | null
          installment_purchase_id?: string | null
          installment_total?: number | null
          is_future?: boolean
          note?: string | null
          original_currency: Database["public"]["Enums"]["currency"]
          recurring_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          converted_amount?: number | null
          created_at?: string
          date?: string
          dollar_type?: string | null
          id?: string
          installment_number?: number | null
          installment_purchase_id?: string | null
          installment_total?: number | null
          is_future?: boolean
          note?: string | null
          original_currency?: Database["public"]["Enums"]["currency"]
          recurring_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          created_at: string
          date: string
          from_account_id: string
          from_amount: number
          id: string
          is_future: boolean
          note: string | null
          recurring_id: string | null
          to_account_id: string
          to_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          from_account_id: string
          from_amount: number
          id?: string
          is_future?: boolean
          note?: string | null
          recurring_id?: string | null
          to_account_id: string
          to_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          from_account_id?: string
          from_amount?: number
          id?: string
          is_future?: boolean
          note?: string | null
          recurring_id?: string | null
          to_account_id?: string
          to_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_currency: Database["public"]["Enums"]["currency"]
          id: string
          manual_rate: number | null
          rate_type: Database["public"]["Enums"]["rate_type"]
          theme: Database["public"]["Enums"]["ui_theme"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          manual_rate?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          theme?: Database["public"]["Enums"]["ui_theme"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          manual_rate?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          theme?: Database["public"]["Enums"]["ui_theme"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          account_name: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          currency: Database["public"]["Enums"]["currency"] | null
          current_balance: number | null
          is_hidden: boolean | null
          user_id: string | null
        }
        Relationships: []
      }
      account_balances_projected: {
        Row: {
          account_id: string | null
          account_name: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          currency: Database["public"]["Enums"]["currency"] | null
          is_hidden: boolean | null
          projected_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      seed_default_categories: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type:
        | "caja_ahorro"
        | "cuenta_corriente"
        | "efectivo"
        | "inversion"
        | "tarjeta_credito"
        | "billetera_virtual"
        | "otro"
      category_type: "income" | "expense"
      currency: "ARS" | "USD"
      movement_type: "income" | "expense"
      rate_type: "oficial" | "blue" | "mep" | "ccl" | "manual"
      ui_theme: "light" | "dark" | "system"
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
      account_type: [
        "caja_ahorro",
        "cuenta_corriente",
        "efectivo",
        "inversion",
        "tarjeta_credito",
        "billetera_virtual",
        "otro",
      ],
      category_type: ["income", "expense"],
      currency: ["ARS", "USD"],
      movement_type: ["income", "expense"],
      rate_type: ["oficial", "blue", "mep", "ccl", "manual"],
      ui_theme: ["light", "dark", "system"],
    },
  },
} as const
