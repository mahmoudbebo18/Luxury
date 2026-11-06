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
      admin_notes: {
        Row: {
          body: string
          entity_id: string
          entity_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          entity_id: string
          entity_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          entity_id?: string
          entity_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          bank_details: string
          bank_transfer: boolean
          company_min_seats: number
          company_online_max: number
          company_tiers: Json
          id: number
          notify_email: string
          price_individual: number
          renewal_reminder_days: number[]
          reply_to: string
          seller_address: string
          seller_cr: string
          seller_name: string
          seller_vat: string
          sender_email: string
          sender_name: string
          site_url: string
          terms_version: number
          vat_rate: number
        }
        Insert: {
          bank_details?: string
          bank_transfer?: boolean
          company_min_seats?: number
          company_online_max?: number
          company_tiers?: Json
          id?: number
          notify_email?: string
          price_individual?: number
          renewal_reminder_days?: number[]
          reply_to?: string
          seller_address?: string
          seller_cr?: string
          seller_name?: string
          seller_vat?: string
          sender_email?: string
          sender_name?: string
          site_url?: string
          terms_version?: number
          vat_rate?: number
        }
        Update: {
          bank_details?: string
          bank_transfer?: boolean
          company_min_seats?: number
          company_online_max?: number
          company_tiers?: Json
          id?: number
          notify_email?: string
          price_individual?: number
          renewal_reminder_days?: number[]
          reply_to?: string
          seller_address?: string
          seller_cr?: string
          seller_name?: string
          seller_vat?: string
          sender_email?: string
          sender_name?: string
          site_url?: string
          terms_version?: number
          vat_rate?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string
          card_name: string
          city: string
          company_no: number
          cr_number: string
          created_at: string
          created_by: string | null
          email_domain: string | null
          id: string
          legal_name: string
          logo_url: string | null
          vat_number: string
        }
        Insert: {
          address?: string
          card_name: string
          city?: string
          company_no?: number
          cr_number?: string
          created_at?: string
          created_by?: string | null
          email_domain?: string | null
          id?: string
          legal_name: string
          logo_url?: string | null
          vat_number?: string
        }
        Update: {
          address?: string
          card_name?: string
          city?: string
          company_no?: number
          cr_number?: string
          created_at?: string
          created_by?: string | null
          email_domain?: string | null
          id?: string
          legal_name?: string
          logo_url?: string | null
          vat_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_admins: {
        Row: {
          company_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          join_token: string | null
          seats: number
          starts_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          join_token?: string | null
          seats?: number
          starts_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          join_token?: string | null
          seats?: number
          starts_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience: string
          body_html: string
          created_at: string
          created_by: string | null
          failed: number
          id: string
          sent: number
          status: string
          subject: string
          total: number
        }
        Insert: {
          audience: string
          body_html: string
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          sent?: number
          status?: string
          subject: string
          total?: number
        }
        Update: {
          audience?: string
          body_html?: string
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          sent?: number
          status?: string
          subject?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          body_html: string | null
          campaign_id: string | null
          created_at: string
          error: string | null
          id: number
          kind: string
          lang: string
          member_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          to_email: string
          to_name: string | null
          vars: Json
        }
        Insert: {
          body_html?: string | null
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: number
          kind?: string
          lang?: string
          member_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_email: string
          to_name?: string | null
          vars?: Json
        }
        Update: {
          body_html?: string | null
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: number
          kind?: string
          lang?: string
          member_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_email?: string
          to_name?: string | null
          vars?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_html_en: string
          kind: string
          label: string
          subject: string
          subject_en: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_html_en?: string
          kind: string
          label: string
          subject: string
          subject_en?: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_html_en?: string
          kind?: string
          label?: string
          subject?: string
          subject_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          contract_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          invited_by: string | null
          membership_id: string | null
          phone: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          contract_id: string
          created_at?: string
          email: string
          full_name?: string
          id?: string
          invited_by?: string | null
          membership_id?: string | null
          phone?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          contract_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          membership_id?: string | null
          phone?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "admin_companies"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "invites_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      keep_alive: {
        Row: {
          id: number
        }
        Insert: {
          id: number
        }
        Update: {
          id?: number
        }
        Relationships: []
      }
      memberships: {
        Row: {
          assigned_at: string | null
          contract_id: string | null
          created_at: string
          expires_at: string
          holder_id: string | null
          id: string
          kind: string
          order_id: string | null
          starts_at: string
        }
        Insert: {
          assigned_at?: string | null
          contract_id?: string | null
          created_at?: string
          expires_at: string
          holder_id?: string | null
          id?: string
          kind: string
          order_id?: string | null
          starts_at?: string
        }
        Update: {
          assigned_at?: string | null
          contract_id?: string | null
          created_at?: string
          expires_at?: string
          holder_id?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "admin_companies"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "memberships_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string | null
          contract_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_pct: number
          id: string
          method: string | null
          mf_invoice_id: string | null
          mf_payment_id: string | null
          notes: string | null
          order_no: string
          paid_at: string | null
          payment_url: string | null
          period_factor: number
          quantity: number
          status: string
          subtotal: number
          terms_version: number | null
          total: number
          type: string
          unit_price: number
          updated_at: string
          user_id: string | null
          vat_amount: number
        }
        Insert: {
          company_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_pct?: number
          id?: string
          method?: string | null
          mf_invoice_id?: string | null
          mf_payment_id?: string | null
          notes?: string | null
          order_no?: string
          paid_at?: string | null
          payment_url?: string | null
          period_factor?: number
          quantity?: number
          status?: string
          subtotal: number
          terms_version?: number | null
          total: number
          type: string
          unit_price: number
          updated_at?: string
          user_id?: string | null
          vat_amount: number
        }
        Update: {
          company_id?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_pct?: number
          id?: string
          method?: string | null
          mf_invoice_id?: string | null
          mf_payment_id?: string | null
          notes?: string | null
          order_no?: string
          paid_at?: string | null
          payment_url?: string | null
          period_factor?: number
          quantity?: number
          status?: string
          subtotal?: number
          terms_version?: number | null
          total?: number
          type?: string
          unit_price?: number
          updated_at?: string
          user_id?: string | null
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "admin_companies"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          id: number
          order_id: string | null
          payload: Json
          received_at: string
          reference: string | null
          source: string
        }
        Insert: {
          id?: number
          order_id?: string | null
          payload: Json
          received_at?: string
          reference?: string | null
          source: string
        }
        Update: {
          id?: number
          order_id?: string | null
          payload?: Json
          received_at?: string
          reference?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          lang: string
          member_code: string
          member_no: number | null
          phone: string
          role: string
          signup_kind: string
          terms_version: number | null
        }
        Insert: {
          city?: string
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          lang?: string
          member_code?: string
          member_no?: number | null
          phone?: string
          role?: string
          signup_kind?: string
          terms_version?: number | null
        }
        Update: {
          city?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          lang?: string
          member_code?: string
          member_no?: number | null
          phone?: string
          role?: string
          signup_kind?: string
          terms_version?: number | null
        }
        Relationships: []
      }
      seat_history: {
        Row: {
          assigned_at: string
          holder_id: string | null
          id: number
          membership_id: string
          released_at: string | null
          released_by: string | null
        }
        Insert: {
          assigned_at: string
          holder_id?: string | null
          id?: number
          membership_id: string
          released_at?: string | null
          released_by?: string | null
        }
        Update: {
          assigned_at?: string
          holder_id?: string | null
          id?: number
          membership_id?: string
          released_at?: string | null
          released_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seat_history_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_history_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_history_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_history_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_history_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          channel: string
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          member_id: string
          membership_id: string | null
          note: string | null
          service_id: string
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          member_id: string
          membership_id?: string | null
          note?: string | null
          service_id: string
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          member_id?: string
          membership_id?: string | null
          note?: string | null
          service_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "admin_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          annual_quota: number | null
          ask_location: boolean
          created_at: string
          email: string | null
          features_ar: string[]
          features_en: string[]
          how_ar: string
          how_en: string
          icon: string
          id: string
          is_published: boolean
          message_ar: string
          message_en: string
          quota_label_ar: string
          quota_label_en: string
          slug: string | null
          sort_order: number
          summary_ar: string
          summary_en: string
          title_ar: string
          title_en: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          annual_quota?: number | null
          ask_location?: boolean
          created_at?: string
          email?: string | null
          features_ar?: string[]
          features_en?: string[]
          how_ar?: string
          how_en?: string
          icon?: string
          id?: string
          is_published?: boolean
          message_ar?: string
          message_en?: string
          quota_label_ar?: string
          quota_label_en?: string
          slug?: string | null
          sort_order?: number
          summary_ar?: string
          summary_en?: string
          title_ar: string
          title_en?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          annual_quota?: number | null
          ask_location?: boolean
          created_at?: string
          email?: string | null
          features_ar?: string[]
          features_en?: string[]
          how_ar?: string
          how_en?: string
          icon?: string
          id?: string
          is_published?: boolean
          message_ar?: string
          message_en?: string
          quota_label_ar?: string
          quota_label_en?: string
          slug?: string | null
          sort_order?: number
          summary_ar?: string
          summary_en?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      site_page_versions: {
        Row: {
          body_ar: string
          body_en: string
          id: number
          saved_at: string
          saved_by: string | null
          slug: string
          title_ar: string
          title_en: string
          version: number
        }
        Insert: {
          body_ar: string
          body_en: string
          id?: number
          saved_at: string
          saved_by?: string | null
          slug: string
          title_ar: string
          title_en: string
          version: number
        }
        Update: {
          body_ar?: string
          body_en?: string
          id?: number
          saved_at?: string
          saved_by?: string | null
          slug?: string
          title_ar?: string
          title_en?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_page_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_page_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_page_versions_slug_fkey"
            columns: ["slug"]
            isOneToOne: false
            referencedRelation: "site_pages"
            referencedColumns: ["slug"]
          },
        ]
      }
      site_pages: {
        Row: {
          body_ar: string
          body_en: string
          slug: string
          title_ar: string
          title_en: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          body_ar?: string
          body_en?: string
          slug: string
          title_ar: string
          title_en: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          body_ar?: string
          body_en?: string
          slug?: string
          title_ar?: string
          title_en?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_companies: {
        Row: {
          address: string | null
          admins: string | null
          card_name: string | null
          city: string | null
          company_label: string | null
          company_no: number | null
          contract_id: string | null
          contract_status: string | null
          cr_number: string | null
          created_at: string | null
          created_by: string | null
          email_domain: string | null
          expires_at: string | null
          id: string | null
          invites_pending: number | null
          legal_name: string | null
          logo_url: string | null
          quotes_open: number | null
          seats: number | null
          seats_used: number | null
          starts_at: string | null
          vat_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_members: {
        Row: {
          city: string | null
          company_id: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          lang: string | null
          last_expires_at: string | null
          member_code: string | null
          member_label: string | null
          member_no: number | null
          membership_id: string | null
          membership_kind: string | null
          phone: string | null
          role: string | null
          services_done: number | null
          signup_kind: string | null
          status: string | null
        }
        Relationships: []
      }
      admin_orders: {
        Row: {
          company_id: string | null
          company_name: string | null
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          discount_pct: number | null
          id: string | null
          member_label: string | null
          method: string | null
          mf_invoice_id: string | null
          mf_payment_id: string | null
          notes: string | null
          order_no: string | null
          paid_at: string | null
          payment_url: string | null
          period_factor: number | null
          quantity: number | null
          status: string | null
          subtotal: number | null
          terms_version: number | null
          total: number | null
          type: string | null
          unit_price: number | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          vat_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "admin_companies"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_service_requests: {
        Row: {
          annual_quota: number | null
          channel: string | null
          created_at: string | null
          done_at: string | null
          done_by: string | null
          done_by_name: string | null
          id: string | null
          member_id: string | null
          member_label: string | null
          member_name: string | null
          member_phone: string | null
          membership_id: string | null
          note: string | null
          service_id: string | null
          service_title: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "admin_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "admin_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_services: {
        Row: {
          annual_quota: number | null
          ask_location: boolean | null
          created_at: string | null
          email: string | null
          features_ar: string[] | null
          features_en: string[] | null
          how_ar: string | null
          how_en: string | null
          icon: string | null
          id: string | null
          is_published: boolean | null
          message_ar: string | null
          message_en: string | null
          quota_label_ar: string | null
          quota_label_en: string | null
          requests_30d: number | null
          requests_open: number | null
          requests_total: number | null
          slug: string | null
          sort_order: number | null
          summary_ar: string | null
          summary_en: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          annual_quota?: number | null
          ask_location?: boolean | null
          created_at?: string | null
          email?: string | null
          features_ar?: string[] | null
          features_en?: string[] | null
          how_ar?: string | null
          how_en?: string | null
          icon?: string | null
          id?: string | null
          is_published?: boolean | null
          message_ar?: string | null
          message_en?: string | null
          quota_label_ar?: string | null
          quota_label_en?: string | null
          requests_30d?: never
          requests_open?: never
          requests_total?: never
          slug?: string | null
          sort_order?: number | null
          summary_ar?: string | null
          summary_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          annual_quota?: number | null
          ask_location?: boolean | null
          created_at?: string | null
          email?: string | null
          features_ar?: string[] | null
          features_en?: string[] | null
          how_ar?: string | null
          how_en?: string | null
          icon?: string | null
          id?: string | null
          is_published?: boolean | null
          message_ar?: string | null
          message_en?: string | null
          quota_label_ar?: string | null
          quota_label_en?: string | null
          requests_30d?: never
          requests_open?: never
          requests_total?: never
          slug?: string | null
          sort_order?: number | null
          summary_ar?: string | null
          summary_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: Json }
      activate_order: {
        Args: { p_method: string; p_order: string; p_payment_id?: string }
        Returns: Json
      }
      admin_add_company_admin: {
        Args: { p_company: string; p_email: string }
        Returns: undefined
      }
      admin_company_adjust: {
        Args: {
          p_add_days: number
          p_add_seats: number
          p_company: string
          p_note?: string
        }
        Returns: Json
      }
      admin_create_campaign: {
        Args: {
          p_audience: string
          p_body_html: string
          p_member_ids: string[]
          p_subject: string
        }
        Returns: string
      }
      admin_create_company_order: {
        Args: {
          p_company: string
          p_notes?: string
          p_quantity: number
          p_type: string
          p_unit_price: number
        }
        Returns: Json
      }
      admin_grant_membership: {
        Args: { p_days: number; p_member: string; p_note?: string }
        Returns: string
      }
      admin_mark_refunded: {
        Args: { p_note?: string; p_order: string }
        Returns: undefined
      }
      admin_price_quote: {
        Args: {
          p_notes?: string
          p_order: string
          p_quantity: number
          p_unit_price: number
        }
        Returns: Json
      }
      admin_record_service: {
        Args: { p_member: string; p_note?: string; p_service: string }
        Returns: string
      }
      admin_save_note: {
        Args: { p_body: string; p_id: string; p_type: string }
        Returns: undefined
      }
      admin_send_payment_link: { Args: { p_order: string }; Returns: undefined }
      admin_set_active: {
        Args: { p_active: boolean; p_member: string }
        Returns: undefined
      }
      admin_set_request: {
        Args: { p_note?: string; p_request: string; p_status: string }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      assert_admin: { Args: never; Returns: undefined }
      assert_company_admin: { Args: { p_company: string }; Returns: undefined }
      check_invite: { Args: { p_token: string }; Returns: Json }
      check_join_link: { Args: { p_token: string }; Returns: Json }
      company_invite: {
        Args: { p_contract: string; p_people: Json }
        Returns: Json
      }
      company_overview: { Args: { p_company: string }; Returns: Json }
      company_release_seat: {
        Args: { p_membership: string }
        Returns: undefined
      }
      company_resend_invite: { Args: { p_invite: string }; Returns: undefined }
      company_revoke_invite: { Args: { p_invite: string }; Returns: undefined }
      company_set_join_link: {
        Args: { p_contract: string; p_on: boolean }
        Returns: string
      }
      company_update: {
        Args: {
          p_address: string
          p_card_name: string
          p_city: string
          p_company: string
          p_cr_number: string
          p_email_domain: string
          p_vat_number: string
        }
        Returns: undefined
      }
      create_order: {
        Args: {
          p_company?: string
          p_contract?: string
          p_quantity?: number
          p_request_quote?: boolean
          p_type: string
        }
        Returns: Json
      }
      current_membership: {
        Args: { p_user: string }
        Returns: {
          assigned_at: string | null
          contract_id: string | null
          created_at: string
          expires_at: string
          holder_id: string | null
          id: string
          kind: string
          order_id: string | null
          starts_at: string
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gen_code: { Args: { len: number }; Returns: string }
      get_member_card: { Args: { p_code: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_company_admin: { Args: { p_company: string }; Returns: boolean }
      join_by_link: { Args: { p_token: string }; Returns: Json }
      list_services: { Args: never; Returns: Json }
      log_service_request: {
        Args: { p_channel: string; p_service_id: string }
        Returns: undefined
      }
      member_label: { Args: { n: number }; Returns: string }
      membership_live: {
        Args: { m: Database["public"]["Tables"]["memberships"]["Row"] }
        Returns: boolean
      }
      my_account: { Args: never; Returns: Json }
      profile_status: {
        Args: { p: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: string
      }
      public_pricing: { Args: never; Returns: Json }
      queue_daily_notices: { Args: never; Returns: Json }
      queue_seat_activated: {
        Args: { p_contract: string; p_user: string }
        Returns: undefined
      }
      quote_price: {
        Args: { p_contract?: string; p_quantity: number; p_type: string }
        Returns: Json
      }
      settings: {
        Args: never
        Returns: {
          bank_details: string
          bank_transfer: boolean
          company_min_seats: number
          company_online_max: number
          company_tiers: Json
          id: number
          notify_email: string
          price_individual: number
          renewal_reminder_days: number[]
          reply_to: string
          seller_address: string
          seller_cr: string
          seller_name: string
          seller_vat: string
          sender_email: string
          sender_name: string
          site_url: string
          terms_version: number
          vat_rate: number
        }
        SetofOptions: {
          from: "*"
          to: "app_settings"
          isOneToOne: true
          isSetofReturn: false
        }
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
