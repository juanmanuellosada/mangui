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
      account_learning: {
        Row: {
          account_id: string
          context_key: string
          context_kind: string
          created_at: string
          hit_count: number
          id: string
          last_used_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          context_key: string
          context_kind: string
          created_at?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          context_key?: string
          context_kind?: string
          created_at?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_learning_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_learning_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_learning_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string | null
          closing_date: string | null
          // GENERATED ALWAYS AS (EXTRACT(DAY FROM closing_date)) — read-only,
          // kept for display-only consumers (see 0054 migration).
          closing_day: number | null
          color: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          due_date: string | null
          // GENERATED ALWAYS AS (EXTRACT(DAY FROM due_date)) — read-only.
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
          account_number?: string | null
          closing_date?: string | null
          closing_day?: number | null
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          due_date?: string | null
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
          account_number?: string | null
          closing_date?: string | null
          closing_day?: number | null
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          due_date?: string | null
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
      ai_usage: {
        Row: {
          created_at: string
          id: string
          model: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auto_rule_conditions: {
        Row: {
          created_at: string
          field: Database["public"]["Enums"]["rule_field"]
          id: string
          operator: Database["public"]["Enums"]["rule_operator"]
          position: number
          rule_id: string
          updated_at: string
          user_id: string
          value_num: number | null
          value_num2: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          field: Database["public"]["Enums"]["rule_field"]
          id?: string
          operator: Database["public"]["Enums"]["rule_operator"]
          position?: number
          rule_id: string
          updated_at?: string
          user_id: string
          value_num?: number | null
          value_num2?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          field?: Database["public"]["Enums"]["rule_field"]
          id?: string
          operator?: Database["public"]["Enums"]["rule_operator"]
          position?: number
          rule_id?: string
          updated_at?: string
          user_id?: string
          value_num?: number | null
          value_num2?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_rule_conditions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "auto_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_rules: {
        Row: {
          action_account_id: string | null
          action_category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          match: Database["public"]["Enums"]["rule_match"]
          name: string
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          action_account_id?: string | null
          action_category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          match?: Database["public"]["Enums"]["rule_match"]
          name: string
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          action_account_id?: string | null
          action_category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          match?: Database["public"]["Enums"]["rule_match"]
          name?: string
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_rules_action_account_id_fkey"
            columns: ["action_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "auto_rules_action_account_id_fkey"
            columns: ["action_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "auto_rules_action_account_id_fkey"
            columns: ["action_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_rules_action_category_id_fkey"
            columns: ["action_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          account_ids: string[]
          alert_threshold: number
          category_ids: string[]
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          end_date: string | null
          icon: string | null
          id: string
          is_recurring: boolean
          limit_amount: number
          name: string
          period: Database["public"]["Enums"]["budget_period"] | null
          rollover_enabled: boolean
          start_date: string
          status: Database["public"]["Enums"]["budget_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_ids?: string[]
          alert_threshold?: number
          category_ids?: string[]
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          end_date?: string | null
          icon?: string | null
          id?: string
          is_recurring?: boolean
          limit_amount: number
          name: string
          period?: Database["public"]["Enums"]["budget_period"] | null
          rollover_enabled?: boolean
          start_date?: string
          status?: Database["public"]["Enums"]["budget_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_ids?: string[]
          alert_threshold?: number
          category_ids?: string[]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          end_date?: string | null
          icon?: string | null
          id?: string
          is_recurring?: boolean
          limit_amount?: number
          name?: string
          period?: Database["public"]["Enums"]["budget_period"] | null
          rollover_enabled?: boolean
          start_date?: string
          status?: Database["public"]["Enums"]["budget_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      card_statements: {
        Row: {
          account_id: string
          close_date: string
          created_at: string
          due_date: string
          id: string
          note: string | null
          paid_amount: number | null
          paid_amount_usd: number | null
          paid_date: string | null
          paid_from_account_id: string | null
          paid_from_account_id_usd: string | null
          paid_movement_id_usd: string | null
          stamp_tax: number
          status: string
          total_amount: number
          total_amount_usd: number
          transfer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          close_date: string
          created_at?: string
          due_date: string
          id?: string
          note?: string | null
          paid_amount?: number | null
          paid_amount_usd?: number | null
          paid_date?: string | null
          paid_from_account_id?: string | null
          paid_from_account_id_usd?: string | null
          paid_movement_id_usd?: string | null
          stamp_tax?: number
          status?: string
          total_amount?: number
          total_amount_usd?: number
          transfer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          close_date?: string
          created_at?: string
          due_date?: string
          id?: string
          note?: string | null
          paid_amount?: number | null
          paid_amount_usd?: number | null
          paid_date?: string | null
          paid_from_account_id?: string | null
          paid_from_account_id_usd?: string | null
          paid_movement_id_usd?: string | null
          stamp_tax?: number
          status?: string
          total_amount?: number
          total_amount_usd?: number
          transfer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statements_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statements_paid_from_account_id_usd_fkey"
            columns: ["paid_from_account_id_usd"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_paid_from_account_id_usd_fkey"
            columns: ["paid_from_account_id_usd"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_paid_from_account_id_usd_fkey"
            columns: ["paid_from_account_id_usd"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statements_paid_movement_id_usd_fkey"
            columns: ["paid_movement_id_usd"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statements_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
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
      category_learning: {
        Row: {
          category_id: string
          created_at: string
          hit_count: number
          id: string
          last_used_at: string
          merchant_key: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          merchant_key: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          merchant_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_learning_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          buy: number
          created_at: string
          fetched_at: string
          id: string
          rate_date: string
          rate_type: Database["public"]["Enums"]["rate_type"]
          sell: number
        }
        Insert: {
          buy: number
          created_at?: string
          fetched_at?: string
          id?: string
          rate_date?: string
          rate_type: Database["public"]["Enums"]["rate_type"]
          sell: number
        }
        Update: {
          buy?: number
          created_at?: string
          fetched_at?: string
          id?: string
          rate_date?: string
          rate_type?: Database["public"]["Enums"]["rate_type"]
          sell?: number
        }
        Relationships: []
      }
      goal_accounts: {
        Row: {
          account_id: string
          goal_id: string
        }
        Insert: {
          account_id: string
          goal_id: string
        }
        Update: {
          account_id?: string
          goal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "goal_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_accounts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_categories: {
        Row: {
          category_id: string
          goal_id: string
        }
        Insert: {
          category_id: string
          goal_id: string
        }
        Update: {
          category_id?: string
          goal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_categories_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_snapshots: {
        Row: {
          amount: number
          created_at: string
          goal_id: string
          id: string
          month: string
          percent: number | null
          period_end: string | null
          period_start: string | null
          snap_status: string | null
          target_amount: number | null
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          goal_id: string
          id?: string
          month: string
          percent?: number | null
          period_end?: string | null
          period_start?: string | null
          snap_status?: string | null
          target_amount?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          goal_id?: string
          id?: string
          month?: string
          percent?: number | null
          period_end?: string | null
          period_start?: string | null
          snap_status?: string | null
          target_amount?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_snapshots_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          baseline_amount: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          deadline: string | null
          end_date: string
          icon: string | null
          id: string
          is_global: boolean
          name: string
          period: Database["public"]["Enums"]["goal_period"]
          recurring: boolean
          start_date: string
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number | null
          target_percent: number | null
          type: Database["public"]["Enums"]["goal_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_amount?: number | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          deadline?: string | null
          end_date?: string
          icon?: string | null
          id?: string
          is_global?: boolean
          name: string
          period?: Database["public"]["Enums"]["goal_period"]
          recurring?: boolean
          start_date?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          target_percent?: number | null
          type: Database["public"]["Enums"]["goal_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_amount?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          deadline?: string | null
          end_date?: string
          icon?: string | null
          id?: string
          is_global?: boolean
          name?: string
          period?: Database["public"]["Enums"]["goal_period"]
          recurring?: boolean
          start_date?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          target_percent?: number | null
          type?: Database["public"]["Enums"]["goal_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inflation_index: {
        Row: {
          created_at: string
          fetched_at: string
          ipc: number
          period: string
          source: string
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          ipc: number
          period: string
          source?: string
        }
        Update: {
          created_at?: string
          fetched_at?: string
          ipc?: number
          period?: string
          source?: string
        }
        Relationships: []
      }
      installment_purchases: {
        Row: {
          account_id: string
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          description: string
          dollar_type: string | null
          id: string
          installments_count: number
          note: string | null
          purchase_key: string | null
          start_date: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          category_id?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          description: string
          dollar_type?: string | null
          id?: string
          installments_count: number
          note?: string | null
          purchase_key?: string | null
          start_date: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          description?: string
          dollar_type?: string | null
          id?: string
          installments_count?: number
          note?: string | null
          purchase_key?: string | null
          start_date?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_purchases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "installment_purchases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "installment_purchases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_purchases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime_type: string | null
          movement_id: string | null
          statement_id: string | null
          transfer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime_type?: string | null
          movement_id?: string | null
          statement_id?: string | null
          transfer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          mime_type?: string | null
          movement_id?: string | null
          statement_id?: string | null
          transfer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movement_attachments_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_attachments_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "card_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_attachments_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
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
          import_statement_id: string | null
          installment_number: number | null
          installment_purchase_id: string | null
          installment_total: number | null
          is_future: boolean
          note: string | null
          original_currency: Database["public"]["Enums"]["currency"]
          recurring_id: string | null
          settles_previous: boolean
          tags: string[]
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
          import_statement_id?: string | null
          installment_number?: number | null
          installment_purchase_id?: string | null
          installment_total?: number | null
          is_future?: boolean
          note?: string | null
          original_currency: Database["public"]["Enums"]["currency"]
          recurring_id?: string | null
          settles_previous?: boolean
          tags?: string[]
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
          import_statement_id?: string | null
          installment_number?: number | null
          installment_purchase_id?: string | null
          installment_total?: number | null
          is_future?: boolean
          note?: string | null
          original_currency?: Database["public"]["Enums"]["currency"]
          recurring_id?: string | null
          settles_previous?: boolean
          tags?: string[]
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
          {
            foreignKeyName: "movements_import_statement_id_fkey"
            columns: ["import_statement_id"]
            isOneToOne: false
            referencedRelation: "card_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_installment_purchase_id_fkey"
            columns: ["installment_purchase_id"]
            isOneToOne: false
            referencedRelation: "installment_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          event_key: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          event_key: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          event_key?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_unlimited: boolean
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          is_demo: boolean
          mp_preapproval_id: string | null
          mp_subscription_status: string | null
          name: string | null
          onboarding_completed_at: string | null
          payment_exempt: boolean
          payment_exempt_reason: string | null
          plan: string
          subscription_status_changed_at: string | null
          updated_at: string
        }
        Insert: {
          ai_unlimited?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          is_demo?: boolean
          mp_preapproval_id?: string | null
          mp_subscription_status?: string | null
          name?: string | null
          onboarding_completed_at?: string | null
          payment_exempt?: boolean
          payment_exempt_reason?: string | null
          plan?: string
          subscription_status_changed_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_unlimited?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          mp_preapproval_id?: string | null
          mp_subscription_status?: string | null
          name?: string | null
          onboarding_completed_at?: string | null
          payment_exempt?: boolean
          payment_exempt_reason?: string | null
          plan?: string
          subscription_status_changed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_occurrences: {
        Row: {
          amount_override: number | null
          created_at: string
          id: string
          movement_id: string | null
          recurring_id: string
          scheduled_date: string
          status: Database["public"]["Enums"]["occurrence_status"]
          transfer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_override?: number | null
          created_at?: string
          id?: string
          movement_id?: string | null
          recurring_id: string
          scheduled_date: string
          status?: Database["public"]["Enums"]["occurrence_status"]
          transfer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_override?: number | null
          created_at?: string
          id?: string
          movement_id?: string | null
          recurring_id?: string
          scheduled_date?: string
          status?: Database["public"]["Enums"]["occurrence_status"]
          transfer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_occurrences_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_occurrences_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_occurrences_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          day_of_month: number | null
          day_of_week: number | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          interval_days: number | null
          is_card_recurring: boolean
          kind: Database["public"]["Enums"]["txn_kind"]
          month_of_year: number | null
          next_run: string | null
          note: string | null
          source_key: string | null
          start_date: string
          status: Database["public"]["Enums"]["recurring_status"]
          to_account_id: string | null
          to_amount: number | null
          updated_at: string
          user_id: string
          weekend_handling: Database["public"]["Enums"]["weekend_handling"]
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          day_of_month?: number | null
          day_of_week?: number | null
          end_date?: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          interval_days?: number | null
          is_card_recurring?: boolean
          kind: Database["public"]["Enums"]["txn_kind"]
          month_of_year?: number | null
          next_run?: string | null
          note?: string | null
          source_key?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["recurring_status"]
          to_account_id?: string | null
          to_amount?: number | null
          updated_at?: string
          user_id: string
          weekend_handling?: Database["public"]["Enums"]["weekend_handling"]
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          day_of_month?: number | null
          day_of_week?: number | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          interval_days?: number | null
          is_card_recurring?: boolean
          kind?: Database["public"]["Enums"]["txn_kind"]
          month_of_year?: number | null
          next_run?: string | null
          note?: string | null
          source_key?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["recurring_status"]
          to_account_id?: string | null
          to_amount?: number | null
          updated_at?: string
          user_id?: string
          weekend_handling?: Database["public"]["Enums"]["weekend_handling"]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances_projected"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          scope?: string
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "transfers_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
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
      user_ai_settings: {
        Row: {
          api_key_encrypted: string | null
          created_at: string
          id: string
          model: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string
          id?: string
          model?: string | null
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string
          id?: string
          model?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          budget_alerts_enabled: boolean
          card_reminder_enabled: boolean
          created_at: string
          default_currency: Database["public"]["Enums"]["currency"]
          id: string
          manual_rate: number | null
          notify_hour: number
          push_enabled: boolean
          rate_type: Database["public"]["Enums"]["rate_type"]
          theme: Database["public"]["Enums"]["ui_theme"]
          unusual_charge_enabled: boolean
          updated_at: string
          user_id: string
          weekly_insights_enabled: boolean
        }
        Insert: {
          budget_alerts_enabled?: boolean
          card_reminder_enabled?: boolean
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          manual_rate?: number | null
          notify_hour?: number
          push_enabled?: boolean
          rate_type?: Database["public"]["Enums"]["rate_type"]
          theme?: Database["public"]["Enums"]["ui_theme"]
          unusual_charge_enabled?: boolean
          updated_at?: string
          user_id: string
          weekly_insights_enabled?: boolean
        }
        Update: {
          budget_alerts_enabled?: boolean
          card_reminder_enabled?: boolean
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          manual_rate?: number | null
          notify_hour?: number
          push_enabled?: boolean
          rate_type?: Database["public"]["Enums"]["rate_type"]
          theme?: Database["public"]["Enums"]["ui_theme"]
          unusual_charge_enabled?: boolean
          updated_at?: string
          user_id?: string
          weekly_insights_enabled?: boolean
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
      exchange_rates_latest: {
        Row: {
          buy: number | null
          created_at: string | null
          fetched_at: string | null
          id: string | null
          rate_date: string | null
          rate_type: Database["public"]["Enums"]["rate_type"] | null
          sell: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      bump_account_learning: {
        Args: {
          p_account_id: string
          p_category_id: string
          p_currency: string
          p_merchant_key: string
        }
        Returns: undefined
      }
      bump_category_learning: {
        Args: { p_category_id: string; p_merchant_key: string }
        Returns: undefined
      }
      check_and_increment_ai_usage: {
        // p_limit/p_model se pasan NULL para usuarios sin límite (premium /
        // ai_unlimited, ver rate-limit.ts): el generador de tipos no modela
        // argumentos nullable, por eso se anotan a mano.
        Args: { p_user_id: string; p_limit: number | null; p_model: string | null }
        Returns: boolean
      }
      import_card_statement: { Args: { p_payload: Json }; Returns: Json }
      pay_card_statement: { Args: { p_payload: Json }; Returns: Json }
      seed_default_categories: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      user_is_not_demo: { Args: never; Returns: boolean }
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
      attachment_kind: "factura" | "recibo" | "comprobante" | "resumen"
      budget_period: "weekly" | "biweekly" | "monthly" | "quarterly" | "annual"
      budget_status: "active" | "paused"
      category_type: "income" | "expense"
      currency: "ARS" | "USD"
      goal_period:
        | "weekly"
        | "biweekly"
        | "monthly"
        | "quarterly"
        | "annual"
        | "custom"
      goal_status: "active" | "completed"
      goal_type: "saving" | "reduction" | "income"
      movement_type: "income" | "expense"
      occurrence_status: "pending" | "confirmed" | "skipped"
      rate_type: "oficial" | "blue" | "mep" | "ccl" | "manual"
      recurring_frequency:
        | "weekly"
        | "biweekly"
        | "monthly"
        | "bimonthly"
        | "annual"
        | "custom"
      recurring_status: "active" | "paused" | "inactive"
      rule_field: "note" | "amount" | "account" | "type"
      rule_match: "all" | "any"
      rule_operator:
        | "contains"
        | "starts_with"
        | "ends_with"
        | "equals"
        | "gt"
        | "lt"
        | "between"
      txn_kind: "income" | "expense" | "transfer"
      ui_theme: "light" | "dark" | "system"
      weekend_handling: "as_is" | "skip" | "previous_business_day"
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
      attachment_kind: ["factura", "recibo", "comprobante", "resumen"],
      budget_period: ["weekly", "biweekly", "monthly", "quarterly", "annual"],
      budget_status: ["active", "paused"],
      category_type: ["income", "expense"],
      currency: ["ARS", "USD"],
      goal_period: [
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "annual",
        "custom",
      ],
      goal_status: ["active", "completed"],
      goal_type: ["saving", "reduction", "income"],
      movement_type: ["income", "expense"],
      occurrence_status: ["pending", "confirmed", "skipped"],
      rate_type: ["oficial", "blue", "mep", "ccl", "manual"],
      recurring_frequency: [
        "weekly",
        "biweekly",
        "monthly",
        "bimonthly",
        "annual",
        "custom",
      ],
      recurring_status: ["active", "paused", "inactive"],
      rule_field: ["note", "amount", "account", "type"],
      rule_match: ["all", "any"],
      rule_operator: [
        "contains",
        "starts_with",
        "ends_with",
        "equals",
        "gt",
        "lt",
        "between",
      ],
      txn_kind: ["income", "expense", "transfer"],
      ui_theme: ["light", "dark", "system"],
      weekend_handling: ["as_is", "skip", "previous_business_day"],
    },
  },
} as const
