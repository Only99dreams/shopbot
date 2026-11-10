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
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          shop_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          shop_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          shop_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          id: string
          last_message: string | null
          last_message_at: string | null
          shop_id: string
          unread_count: number | null
        }
        Insert: {
          buyer_id: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          shop_id: string
          unread_count?: number | null
        }
        Update: {
          buyer_id?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          shop_id?: string
          unread_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string
          shop_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone: string
          shop_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string
          shop_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_agents: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          city: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          id_document_url: string | null
          id_number: string
          id_type: string
          is_available: boolean
          phone: string
          rating: number
          rejection_reason: string | null
          selfie_url: string | null
          state: string
          status: string
          total_deliveries: number
          updated_at: string
          user_id: string
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          id_document_url?: string | null
          id_number: string
          id_type?: string
          is_available?: boolean
          phone: string
          rating?: number
          rejection_reason?: string | null
          selfie_url?: string | null
          state: string
          status?: string
          total_deliveries?: number
          updated_at?: string
          user_id: string
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          id_document_url?: string | null
          id_number?: string
          id_type?: string
          is_available?: boolean
          phone?: string
          rating?: number
          rejection_reason?: string | null
          selfie_url?: string | null
          state?: string
          status?: string
          total_deliveries?: number
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      delivery_assignments: {
        Row: {
          accepted_at: string | null
          agent_earning: number
          agent_id: string | null
          cancelled_at: string | null
          city: string
          created_at: string
          delivered_at: string | null
          delivery_fee: number
          id: string
          order_id: string
          picked_up_at: string | null
          platform_commission: number
          shop_id: string
          state: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agent_earning?: number
          agent_id?: string | null
          cancelled_at?: string | null
          city?: string
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          id?: string
          order_id: string
          picked_up_at?: string | null
          platform_commission?: number
          shop_id: string
          state: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agent_earning?: number
          agent_id?: string | null
          cancelled_at?: string | null
          city?: string
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          id?: string
          order_id?: string
          picked_up_at?: string | null
          platform_commission?: number
          shop_id?: string
          state?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_fees: {
        Row: {
          city: string
          created_at: string
          fee: number
          id: string
          is_active: boolean
          state: string
          updated_at: string
        }
        Insert: {
          city?: string
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          state: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_payout_requests: {
        Row: {
          account_name: string
          account_number: string
          admin_notes: string | null
          agent_id: string
          amount: number
          bank_name: string
          created_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          admin_notes?: string | null
          agent_id: string
          amount: number
          bank_name: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          admin_notes?: string | null
          agent_id?: string
          amount?: number
          bank_name?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_payout_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_wallets: {
        Row: {
          agent_id: string
          available_balance: number
          created_at: string
          id: string
          total_earned: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          available_balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          available_balance?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_wallets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          delivery_city: string | null
          delivery_fee: number
          delivery_state: string | null
          escrow_enabled: boolean | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: string | null
          redemption_code_id: string | null
          redemption_confirmed: boolean | null
          shop_id: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          delivery_city?: string | null
          delivery_fee?: number
          delivery_state?: string | null
          escrow_enabled?: boolean | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: string | null
          redemption_code_id?: string | null
          redemption_confirmed?: boolean | null
          shop_id: string
          status?: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          delivery_city?: string | null
          delivery_fee?: number
          delivery_state?: string | null
          escrow_enabled?: boolean | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string | null
          redemption_code_id?: string | null
          redemption_confirmed?: boolean | null
          shop_id?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_redemption_code_id_fkey"
            columns: ["redemption_code_id"]
            isOneToOne: false
            referencedRelation: "redemption_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verifications: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          id: string
          otp_code: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          otp_code: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      payment_proofs: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          payment_type: string
          proof_image_url: string | null
          reference_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          shop_id: string
          status: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          payment_type: string
          proof_image_url?: string | null
          reference_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id: string
          status?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          payment_type?: string
          proof_image_url?: string | null
          reference_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id?: string
          status?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          credited_at: string | null
          credited_to_seller: boolean | null
          id: string
          order_id: string
          paystack_reference: string
          paystack_transaction_id: string | null
          platform_fee: number | null
          seller_amount: number | null
          shop_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          credited_at?: string | null
          credited_to_seller?: boolean | null
          id?: string
          order_id: string
          paystack_reference: string
          paystack_transaction_id?: string | null
          platform_fee?: number | null
          seller_amount?: number | null
          shop_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          credited_at?: string | null
          credited_to_seller?: boolean | null
          id?: string
          order_id?: string
          paystack_reference?: string
          paystack_transaction_id?: string | null
          platform_fee?: number | null
          seller_amount?: number | null
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          account_name: string | null
          account_number: string | null
          admin_notes: string | null
          amount: number
          bank_name: string | null
          created_at: string
          id: string
          payout_type: string
          processed_at: string | null
          processed_by: string | null
          shop_id: string
          status: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          admin_notes?: string | null
          amount: number
          bank_name?: string | null
          created_at?: string
          id?: string
          payout_type?: string
          processed_at?: string | null
          processed_by?: string | null
          shop_id: string
          status?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          admin_notes?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string
          id?: string
          payout_type?: string
          processed_at?: string | null
          processed_by?: string | null
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          compare_at_price: number | null
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          is_available: boolean | null
          nafdac_number: string | null
          name: string
          price: number
          product_type: string | null
          shop_id: string
          stock_quantity: number | null
          updated_at: string
          verification_details: Json | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_available?: boolean | null
          nafdac_number?: string | null
          name: string
          price: number
          product_type?: string | null
          shop_id: string
          stock_quantity?: number | null
          updated_at?: string
          verification_details?: Json | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_available?: boolean | null
          nafdac_number?: string | null
          name?: string
          price?: number
          product_type?: string | null
          shop_id?: string
          stock_quantity?: number | null
          updated_at?: string
          verification_details?: Json | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      redemption_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          order_id: string
          redeemed_at: string | null
          redeemed_by: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemption_codes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemption_codes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          available_balance: number
          code: string
          created_at: string
          id: string
          total_earnings: number | null
          total_referrals: number | null
          total_withdrawn: number
          user_id: string
        }
        Insert: {
          available_balance?: number
          code: string
          created_at?: string
          id?: string
          total_earnings?: number | null
          total_referrals?: number | null
          total_withdrawn?: number
          user_id: string
        }
        Update: {
          available_balance?: number
          code?: string
          created_at?: string
          id?: string
          total_earnings?: number | null
          total_referrals?: number | null
          total_withdrawn?: number
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount: number | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number | null
          status?: string | null
        }
        Relationships: []
      }
      seller_ratings: {
        Row: {
          buyer_id: string | null
          created_at: string | null
          id: string
          rating: number
          review: string | null
          seller_id: string
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          rating: number
          review?: string | null
          seller_id: string
        }
        Update: {
          buyer_id?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          review?: string | null
          seller_id?: string
        }
        Relationships: []
      }
      seller_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          shop_id: string
          total_earned: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          shop_id: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          shop_id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_wallets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          account_name: string | null
          account_number: string | null
          address: string | null
          bank_name: string | null
          city: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          owner_id: string
          settings: Json | null
          state: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          owner_id: string
          settings?: Json | null
          state?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          settings?: Json | null
          state?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          shop_id: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          shop_id: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          shop_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          last_message: string | null
          last_message_at: string | null
          shop_id: string
          unread_count: number | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          shop_id: string
          unread_count?: number | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          shop_id?: string
          unread_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          media_url: string | null
          message_type: string | null
          status: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          media_url?: string | null
          message_type?: string | null
          status?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          media_url?: string | null
          message_type?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_delivery: { Args: { p_assignment_id: string }; Returns: Json }
      add_referral_earnings: {
        Args: { amount: number; referrer_user_id: string }
        Returns: undefined
      }
      approve_payment_proof: {
        Args: { p_admin_notes?: string; p_proof_id: string }
        Returns: Json
      }
      create_order: {
        Args: {
          p_address: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_delivery_city?: string
          p_delivery_state?: string
          p_items: Json
          p_notes: string
          p_shop_id: string
        }
        Returns: Json
      }
      generate_redemption_code: { Args: never; Returns: string }
      get_agent_deliveries: {
        Args: never
        Returns: {
          accepted_at: string
          address: string
          agent_earning: number
          assignment_id: string
          city: string
          created_at: string
          customer_name: string
          customer_phone: string
          delivered_at: string
          delivery_fee: number
          item_count: number
          items: Json
          order_id: string
          order_number: string
          state: string
          status: string
        }[]
      }
      get_delivery_commission: { Args: never; Returns: number }
      get_delivery_fee: {
        Args: { p_city?: string; p_state: string }
        Returns: number
      }
      get_or_create_my_referral_code: { Args: never; Returns: string }
      get_shop_metrics: { Args: { p_shop_id: string }; Returns: Json }
      get_user_shop_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_referral_count: {
        Args: { referrer_user_id: string }
        Returns: undefined
      }
      order_accepts_payment_proof: {
        Args: { p_amount: number; p_order_id: string; p_shop_id: string }
        Returns: boolean
      }
      request_delivery_payout: {
        Args: {
          p_account_name: string
          p_account_number: string
          p_amount: number
          p_bank_name: string
        }
        Returns: Json
      }
      review_delivery_agent: {
        Args: { p_action: string; p_agent_id: string; p_reason?: string }
        Returns: Json
      }
      review_delivery_payout: {
        Args: { p_action: string; p_note?: string; p_request_id: string }
        Returns: Json
      }
      track_order_by_number: { Args: { p_order_number: string }; Returns: Json }
      update_delivery_status: {
        Args: { p_assignment_id: string; p_status: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "seller" | "delivery_agent"
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
      app_role: ["admin", "seller", "delivery_agent"],
    },
  },
} as const
