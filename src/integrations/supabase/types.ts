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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_type: string
          after_data: Json | null
          before_data: Json | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          ip_address: string | null
          occurred_at: string
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string
          actor_type?: string
          after_data?: Json | null
          before_data?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          occurred_at?: string
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_type?: string
          after_data?: Json | null
          before_data?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          occurred_at?: string
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          accepted: boolean | null
          actor_id: string | null
          actor_name: string
          completed_at: string | null
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          model: string
          parameters: Json
          post_id: string | null
          prompt: string
          prompt_tokens: number | null
          result: string | null
          result_tokens: number | null
          status: string
          system_prompt: string | null
          task: string
          workspace_id: string | null
        }
        Insert: {
          accepted?: boolean | null
          actor_id?: string | null
          actor_name?: string
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          model?: string
          parameters?: Json
          post_id?: string | null
          prompt: string
          prompt_tokens?: number | null
          result?: string | null
          result_tokens?: number | null
          status?: string
          system_prompt?: string | null
          task: string
          workspace_id?: string | null
        }
        Update: {
          accepted?: boolean | null
          actor_id?: string | null
          actor_name?: string
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          model?: string
          parameters?: Json
          post_id?: string | null
          prompt?: string
          prompt_tokens?: number | null
          result?: string | null
          result_tokens?: number | null
          status?: string
          system_prompt?: string | null
          task?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          system_prompt: string | null
          task: string
          updated_at: string
          user_prompt: string
          variables: Json
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          system_prompt?: string | null
          task: string
          updated_at?: string
          user_prompt: string
          variables?: Json
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          system_prompt?: string | null
          task?: string
          updated_at?: string
          user_prompt?: string
          variables?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_daily: {
        Row: {
          api_errors: number
          api_requests: number
          bytes_out: number
          created_at: string
          id: string
          stat_date: string
          total_views: number
          unique_visitors: number
          workspace_id: string | null
        }
        Insert: {
          api_errors?: number
          api_requests?: number
          bytes_out?: number
          created_at?: string
          id?: string
          stat_date: string
          total_views?: number
          unique_visitors?: number
          workspace_id?: string | null
        }
        Update: {
          api_errors?: number
          api_requests?: number
          bytes_out?: number
          created_at?: string
          id?: string
          stat_date?: string
          total_views?: number
          unique_visitors?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          key_type: string
          last_used_at: string | null
          name: string
          permissions: Json
          revoked_at: string | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          key_type?: string
          last_used_at?: string | null
          name: string
          permissions?: Json
          revoked_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          key_type?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json
          revoked_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          api_key_id: string
          created_at: string
          id: string
          limit_count: number
          request_count: number
          updated_at: string
          window_start: string
          workspace_id: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string
          id?: string
          limit_count?: number
          request_count?: number
          updated_at?: string
          window_start: string
          workspace_id?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string
          id?: string
          limit_count?: number
          request_count?: number
          updated_at?: string
          window_start?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limits_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_rate_limits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          duration_ms: number | null
          error: string | null
          id: string
          ip_address: string | null
          method: string
          path: string
          requested_at: string
          status_code: number | null
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          path: string
          requested_at?: string
          status_code?: number | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          path?: string
          requested_at?: string
          status_code?: number | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          article_type: string | null
          author_name: string | null
          category: string | null
          content: string | null
          cover_image: string | null
          created_at: string
          excerpt: string | null
          featured: boolean | null
          id: string
          meta_description: string | null
          published_at: string | null
          reading_time: number | null
          scheduled_at: string | null
          seo_title: string | null
          slug: string
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          views: number | null
          word_count: number | null
          workspace_id: string | null
        }
        Insert: {
          article_type?: string | null
          author_name?: string | null
          category?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          meta_description?: string | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          seo_title?: string | null
          slug: string
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          views?: number | null
          word_count?: number | null
          workspace_id?: string | null
        }
        Update: {
          article_type?: string | null
          author_name?: string | null
          category?: string | null
          content?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          meta_description?: string | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          seo_title?: string | null
          slug?: string
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          views?: number | null
          word_count?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      articles_comments: {
        Row: {
          article_id: string
          author_email: string
          author_name: string
          author_website: string | null
          content: string
          created_at: string
          id: string
          ip_hash: string | null
          moderated_at: string | null
          moderated_by: string | null
          parent_id: string | null
          status: string
          updated_at: string
          user_agent: string | null
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          article_id: string
          author_email: string
          author_name: string
          author_website?: string | null
          content: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          parent_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          article_id?: string
          author_email?: string
          author_name?: string
          author_website?: string | null
          content?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          parent_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "articles_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      articles_engagement_daily: {
        Row: {
          article_id: string
          comments: number
          day: string
          id: string
          likes: number
          shares: number
          views: number
          workspace_id: string | null
        }
        Insert: {
          article_id: string
          comments?: number
          day: string
          id?: string
          likes?: number
          shares?: number
          views?: number
          workspace_id?: string | null
        }
        Update: {
          article_id?: string
          comments?: number
          day?: string
          id?: string
          likes?: number
          shares?: number
          views?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_engagement_daily_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_engagement_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      articles_likes: {
        Row: {
          article_id: string
          created_at: string
          id: string
          visitor_id: string
          workspace_id: string | null
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          visitor_id: string
          workspace_id?: string | null
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          visitor_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_likes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_likes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      articles_shares: {
        Row: {
          article_id: string
          channel: string
          created_at: string
          id: string
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          article_id: string
          channel: string
          created_at?: string
          id?: string
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          article_id?: string
          channel?: string
          created_at?: string
          id?: string
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_shares_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_shares_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      articles_views: {
        Row: {
          article_id: string
          created_at: string
          device_type: string | null
          id: string
          referrer: string | null
          user_agent: string | null
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          article_id: string
          created_at?: string
          device_type?: string | null
          id?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          article_id?: string
          created_at?: string
          device_type?: string | null
          id?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_views_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_usd: number
          created_at: string
          description: string | null
          id: string
          invoice_pdf_url: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_invoice_id: string | null
          workspace_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_pdf_url?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string | null
          workspace_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_pdf_url?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          interval: string
          is_active: boolean
          max_api_calls: number | null
          max_posts: number | null
          max_storage_gb: number | null
          max_team_members: number | null
          max_webhooks: number | null
          max_workspaces: number | null
          name: string
          price_usd: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          max_api_calls?: number | null
          max_posts?: number | null
          max_storage_gb?: number | null
          max_team_members?: number | null
          max_webhooks?: number | null
          max_workspaces?: number | null
          name: string
          price_usd?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          max_api_calls?: number | null
          max_posts?: number | null
          max_storage_gb?: number | null
          max_team_members?: number | null
          max_webhooks?: number | null
          max_workspaces?: number | null
          name?: string
          price_usd?: number
          slug?: string
        }
        Relationships: []
      }
      billing_subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_usage: {
        Row: {
          api_call_count: number
          bandwidth_bytes: number
          id: string
          member_count: number
          period_end: string
          period_start: string
          post_count: number
          recorded_at: string
          storage_bytes: number
          workspace_id: string
        }
        Insert: {
          api_call_count?: number
          bandwidth_bytes?: number
          id?: string
          member_count?: number
          period_end: string
          period_start: string
          post_count?: number
          recorded_at?: string
          storage_bytes?: number
          workspace_id: string
        }
        Update: {
          api_call_count?: number
          bandwidth_bytes?: number
          id?: string
          member_count?: number
          period_end?: string
          period_start?: string
          post_count?: number
          recorded_at?: string
          storage_bytes?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_comments: {
        Row: {
          author_email: string
          author_name: string
          author_website: string | null
          blog_post_id: string
          content: string
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          ip_hash: string | null
          moderated_at: string | null
          moderated_by: string | null
          parent_id: string | null
          post_id: string | null
          status: string
          updated_at: string
          user_agent: string | null
          visitor_id: string | null
          website: string | null
          workspace_id: string | null
        }
        Insert: {
          author_email: string
          author_name: string
          author_website?: string | null
          blog_post_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          ip_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          parent_id?: string | null
          post_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          website?: string | null
          workspace_id?: string | null
        }
        Update: {
          author_email?: string
          author_name?: string
          author_website?: string | null
          blog_post_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          ip_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          parent_id?: string | null
          post_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          website?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_blog_comments_post"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_engagement_daily: {
        Row: {
          blog_post_id: string
          comments: number
          day: string
          id: string
          likes: number
          shares: number
          views: number
          workspace_id: string | null
        }
        Insert: {
          blog_post_id: string
          comments?: number
          day: string
          id?: string
          likes?: number
          shares?: number
          views?: number
          workspace_id?: string | null
        }
        Update: {
          blog_post_id?: string
          comments?: number
          day?: string
          id?: string
          likes?: number
          shares?: number
          views?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_engagement_daily_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_engagement_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_likes: {
        Row: {
          blog_post_id: string
          created_at: string
          id: string
          post_id: string | null
          visitor_id: string
          workspace_id: string | null
        }
        Insert: {
          blog_post_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          visitor_id: string
          workspace_id?: string | null
        }
        Update: {
          blog_post_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          visitor_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_likes_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_likes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_blog_likes_post"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string
          canonical_url: string | null
          category: string
          content: string
          cover_image: string | null
          created_at: string
          deleted_at: string | null
          excerpt: string
          featured: boolean
          focus_keyword: string | null
          id: string
          meta_description: string | null
          og_description: string | null
          og_image: string | null
          og_title: string | null
          published_at: string | null
          reading_time: number
          robots: string | null
          scheduled_at: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: Json
          title: string
          twitter_card: string | null
          updated_at: string
          views: number
          word_count: number
          workspace_id: string | null
        }
        Insert: {
          author_name?: string
          canonical_url?: string | null
          category?: string
          content?: string
          cover_image?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string
          featured?: boolean
          focus_keyword?: string | null
          id?: string
          meta_description?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          published_at?: string | null
          reading_time?: number
          robots?: string | null
          scheduled_at?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: Json
          title?: string
          twitter_card?: string | null
          updated_at?: string
          views?: number
          word_count?: number
          workspace_id?: string | null
        }
        Update: {
          author_name?: string
          canonical_url?: string | null
          category?: string
          content?: string
          cover_image?: string | null
          created_at?: string
          deleted_at?: string | null
          excerpt?: string
          featured?: boolean
          focus_keyword?: string | null
          id?: string
          meta_description?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          published_at?: string | null
          reading_time?: number
          robots?: string | null
          scheduled_at?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: Json
          title?: string
          twitter_card?: string | null
          updated_at?: string
          views?: number
          word_count?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_shares: {
        Row: {
          blog_post_id: string
          channel: string
          created_at: string
          id: string
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          blog_post_id: string
          channel: string
          created_at?: string
          id?: string
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          blog_post_id?: string
          channel?: string
          created_at?: string
          id?: string
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_shares_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_shares_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_views: {
        Row: {
          blog_post_id: string
          created_at: string
          device_type: string | null
          id: string
          post_id: string | null
          referrer: string | null
          user_agent: string | null
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          blog_post_id: string
          created_at?: string
          device_type?: string | null
          id?: string
          post_id?: string | null
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          blog_post_id?: string
          created_at?: string
          device_type?: string | null
          id?: string
          post_id?: string | null
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_views_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_blog_views_post"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      cms_user_invites: {
        Row: {
          accepted_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_at: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_at?: string | null
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_at?: string | null
          role?: string
          token?: string
        }
        Relationships: []
      }
      cms_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          last_login_at: string | null
          name: string | null
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          name?: string | null
          role?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string | null
          role?: string
        }
        Relationships: []
      }
      collection_entries: {
        Row: {
          collection_id: string
          created_at: string | null
          data: Json
          id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          data?: Json
          id?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          data?: Json
          id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_entries_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          schema: Json
          slug: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          schema?: Json
          slug: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          schema?: Json
          slug?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          featured: boolean
          id: string
          meta_description: string | null
          question: string
          seo_title: string | null
          sort_order: number
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          answer?: string
          category?: string
          created_at?: string
          featured?: boolean
          id?: string
          meta_description?: string | null
          question?: string
          seo_title?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          featured?: boolean
          id?: string
          meta_description?: string | null
          question?: string
          seo_title?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faqs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media_files: {
        Row: {
          alt_text: string | null
          bucket: string
          caption: string | null
          created_at: string
          file_name: string
          folder: string
          height_px: number | null
          id: string
          metadata: Json
          mime_type: string
          size_bytes: number
          storage_path: string
          tags: Json
          updated_at: string
          uploaded_by: string | null
          width_px: number | null
          workspace_id: string | null
        }
        Insert: {
          alt_text?: string | null
          bucket?: string
          caption?: string | null
          created_at?: string
          file_name: string
          folder?: string
          height_px?: number | null
          id?: string
          metadata?: Json
          mime_type?: string
          size_bytes?: number
          storage_path: string
          tags?: Json
          updated_at?: string
          uploaded_by?: string | null
          width_px?: number | null
          workspace_id?: string | null
        }
        Update: {
          alt_text?: string | null
          bucket?: string
          caption?: string | null
          created_at?: string
          file_name?: string
          folder?: string
          height_px?: number | null
          id?: string
          metadata?: Json
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          tags?: Json
          updated_at?: string
          uploaded_by?: string | null
          width_px?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_path: string
          path: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_path?: string
          path: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_path?: string
          path?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          breaking: boolean
          category: string
          content: string
          cover_image: string | null
          created_at: string
          excerpt: string
          expires_at: string | null
          featured: boolean
          id: string
          meta_description: string | null
          published_at: string | null
          seo_title: string | null
          slug: string
          source_name: string | null
          source_url: string | null
          status: string
          title: string
          updated_at: string
          views: number
          workspace_id: string | null
        }
        Insert: {
          breaking?: boolean
          category?: string
          content?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string
          expires_at?: string | null
          featured?: boolean
          id?: string
          meta_description?: string | null
          published_at?: string | null
          seo_title?: string | null
          slug: string
          source_name?: string | null
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          views?: number
          workspace_id?: string | null
        }
        Update: {
          breaking?: boolean
          category?: string
          content?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string
          expires_at?: string | null
          featured?: boolean
          id?: string
          meta_description?: string | null
          published_at?: string | null
          seo_title?: string | null
          slug?: string
          source_name?: string | null
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          views?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      news_comments: {
        Row: {
          author_email: string
          author_name: string
          author_website: string | null
          content: string
          created_at: string
          id: string
          ip_hash: string | null
          moderated_at: string | null
          moderated_by: string | null
          news_id: string
          parent_id: string | null
          status: string
          updated_at: string
          user_agent: string | null
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          author_email: string
          author_name: string
          author_website?: string | null
          content: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          news_id: string
          parent_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          author_email?: string
          author_name?: string
          author_website?: string | null
          content?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          news_id?: string
          parent_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_comments_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "news_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      news_engagement_daily: {
        Row: {
          comments: number
          day: string
          id: string
          likes: number
          news_id: string
          shares: number
          views: number
          workspace_id: string | null
        }
        Insert: {
          comments?: number
          day: string
          id?: string
          likes?: number
          news_id: string
          shares?: number
          views?: number
          workspace_id?: string | null
        }
        Update: {
          comments?: number
          day?: string
          id?: string
          likes?: number
          news_id?: string
          shares?: number
          views?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_engagement_daily_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_engagement_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      news_likes: {
        Row: {
          created_at: string
          id: string
          news_id: string
          visitor_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          news_id: string
          visitor_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          news_id?: string
          visitor_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_likes_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_likes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      news_shares: {
        Row: {
          channel: string
          created_at: string
          id: string
          news_id: string
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          news_id: string
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          news_id?: string
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_shares_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_shares_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      news_views: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          news_id: string
          referrer: string | null
          user_agent: string | null
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          news_id: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          news_id?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_views_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          body: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          title: string
          type?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          body?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          browser: string | null
          country: string | null
          device: string | null
          duration_sec: number | null
          id: string
          path: string
          post_id: string | null
          referrer: string | null
          session_id: string | null
          viewed_at: string
          workspace_id: string | null
        }
        Insert: {
          browser?: string | null
          country?: string | null
          device?: string | null
          duration_sec?: number | null
          id?: string
          path: string
          post_id?: string | null
          referrer?: string | null
          session_id?: string | null
          viewed_at?: string
          workspace_id?: string | null
        }
        Update: {
          browser?: string | null
          country?: string | null
          device?: string | null
          duration_sec?: number | null
          id?: string
          path?: string
          post_id?: string | null
          referrer?: string | null
          session_id?: string | null
          viewed_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      post_versions: {
        Row: {
          author_name: string
          created_at: string
          excerpt: string
          id: string
          post_id: string
          snapshot: Json
          status: string
          title: string
        }
        Insert: {
          author_name?: string
          created_at?: string
          excerpt?: string
          id?: string
          post_id: string
          snapshot?: Json
          status?: string
          title?: string
        }
        Update: {
          author_name?: string
          created_at?: string
          excerpt?: string
          id?: string
          post_id?: string
          snapshot?: Json
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_versions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          compare_price: number | null
          content: string | null
          cover_image: string | null
          created_at: string
          currency: string | null
          description: string | null
          featured: boolean | null
          features: Json | null
          gallery: Json | null
          id: string
          meta_description: string | null
          name: string
          price: number | null
          seo_title: string | null
          sku: string | null
          slug: string
          sort_order: number | null
          specifications: Json | null
          status: string | null
          tags: string[] | null
          updated_at: string
          views: number | null
          workspace_id: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          compare_price?: number | null
          content?: string | null
          cover_image?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          featured?: boolean | null
          features?: Json | null
          gallery?: Json | null
          id?: string
          meta_description?: string | null
          name?: string
          price?: number | null
          seo_title?: string | null
          sku?: string | null
          slug: string
          sort_order?: number | null
          specifications?: Json | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          views?: number | null
          workspace_id?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          compare_price?: number | null
          content?: string | null
          cover_image?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          featured?: boolean | null
          features?: Json | null
          gallery?: Json | null
          id?: string
          meta_description?: string | null
          name?: string
          price?: number | null
          seo_title?: string | null
          sku?: string | null
          slug?: string
          sort_order?: number | null
          specifications?: Json | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          views?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products_comments: {
        Row: {
          author_email: string
          author_name: string
          author_website: string | null
          content: string
          created_at: string
          id: string
          ip_hash: string | null
          moderated_at: string | null
          moderated_by: string | null
          parent_id: string | null
          product_id: string
          status: string
          updated_at: string
          user_agent: string | null
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          author_email: string
          author_name: string
          author_website?: string | null
          content: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          parent_id?: string | null
          product_id: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          author_email?: string
          author_name?: string
          author_website?: string | null
          content?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          parent_id?: string | null
          product_id?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "products_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products_engagement_daily: {
        Row: {
          comments: number
          day: string
          id: string
          likes: number
          product_id: string
          shares: number
          views: number
          workspace_id: string | null
        }
        Insert: {
          comments?: number
          day: string
          id?: string
          likes?: number
          product_id: string
          shares?: number
          views?: number
          workspace_id?: string | null
        }
        Update: {
          comments?: number
          day?: string
          id?: string
          likes?: number
          product_id?: string
          shares?: number
          views?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_engagement_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_engagement_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products_likes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          visitor_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          visitor_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          visitor_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_likes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_likes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products_shares: {
        Row: {
          channel: string
          created_at: string
          id: string
          product_id: string
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          product_id: string
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          product_id?: string
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_shares_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shares_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products_views: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          product_id: string
          referrer: string | null
          user_agent: string | null
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          product_id: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          product_id?: string
          referrer?: string | null
          user_agent?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      search_history: {
        Row: {
          clicked_id: string | null
          clicked_type: string | null
          id: string
          query: string
          result_count: number | null
          searched_at: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          clicked_id?: string | null
          clicked_type?: string | null
          id?: string
          query: string
          result_count?: number | null
          searched_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          clicked_id?: string | null
          clicked_type?: string | null
          id?: string
          query?: string
          result_count?: number | null
          searched_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      search_index: {
        Row: {
          entity_id: string
          entity_type: string
          fts_vector: unknown
          icon: string | null
          id: string
          status: string | null
          subtitle: string | null
          title: string
          updated_at: string
          url: string | null
          workspace_id: string | null
        }
        Insert: {
          entity_id: string
          entity_type: string
          fts_vector?: unknown
          icon?: string | null
          id?: string
          status?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
          url?: string | null
          workspace_id?: string | null
        }
        Update: {
          entity_id?: string
          entity_type?: string
          fts_vector?: unknown
          icon?: string | null
          id?: string
          status?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_index_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      search_suggestions: {
        Row: {
          hit_count: number
          id: string
          last_searched: string
          query: string
          workspace_id: string | null
        }
        Insert: {
          hit_count?: number
          id?: string
          last_searched?: string
          query: string
          workspace_id?: string | null
        }
        Update: {
          hit_count?: number
          id?: string
          last_searched?: string
          query?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_suggestions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_usage: {
        Row: {
          file_count: number
          id: string
          snapshot_at: string
          total_bytes: number
          workspace_id: string | null
        }
        Insert: {
          file_count?: number
          id?: string
          snapshot_at?: string
          total_bytes?: number
          workspace_id?: string | null
        }
        Update: {
          file_count?: number
          id?: string
          snapshot_at?: string
          total_bytes?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          analysis_data: Json | null
          completed_at: string | null
          created_at: string | null
          id: string
          step: string
          updated_at: string | null
          user_id: string
          website_url: string | null
          workspace_id: string | null
        }
        Insert: {
          analysis_data?: Json | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          step?: string
          updated_at?: string | null
          user_id: string
          website_url?: string | null
          workspace_id?: string | null
        }
        Update: {
          analysis_data?: Json | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          step?: string
          updated_at?: string | null
          user_id?: string
          website_url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          delivered_at: string
          duration_ms: number | null
          error: string | null
          event: string
          id: string
          response_status: number | null
          webhook_id: string | null
        }
        Insert: {
          delivered_at?: string
          duration_ms?: number | null
          error?: string | null
          event: string
          id?: string
          response_status?: number | null
          webhook_id?: string | null
        }
        Update: {
          delivered_at?: string
          duration_ms?: number | null
          error?: string | null
          event?: string
          id?: string
          response_status?: number | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          name: string
          secret: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          name: string
          secret?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          name?: string
          secret?: string
          url?: string
        }
        Relationships: []
      }
      workspace_competitors: {
        Row: {
          content_strategy: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          strengths: string[] | null
          weaknesses: string[] | null
          website: string | null
          workspace_id: string
        }
        Insert: {
          content_strategy?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          strengths?: string[] | null
          weaknesses?: string[] | null
          website?: string | null
          workspace_id: string
        }
        Update: {
          content_strategy?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          strengths?: string[] | null
          weaknesses?: string[] | null
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_competitors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_content_opportunities: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          priority: string | null
          reason: string | null
          status: string
          title: string
          topic: string | null
          type: string | null
          workspace_id: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          priority?: string | null
          reason?: string | null
          status?: string
          title: string
          topic?: string | null
          type?: string | null
          workspace_id: string
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          priority?: string | null
          reason?: string | null
          status?: string
          title?: string
          topic?: string | null
          type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_content_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_keywords: {
        Row: {
          created_at: string | null
          difficulty: string | null
          id: string
          keyword: string
          opportunity_type: string | null
          volume: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          difficulty?: string | null
          id?: string
          keyword: string
          opportunity_type?: string | null
          volume?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          difficulty?: string | null
          id?: string
          keyword?: string
          opportunity_type?: string | null
          volume?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_keywords_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          ai_context: Json | null
          brand_voice: string | null
          business_model: string | null
          content_pillars: string[] | null
          created_at: string | null
          description: string | null
          engagement_features: Json
          engagement_settings: Json
          id: string
          industry: string | null
          language: string | null
          location: string | null
          name: string
          selected_collections: string[] | null
          show_branding: boolean
          slug: string
          social_links: Json | null
          target_audience: string | null
          updated_at: string | null
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          ai_context?: Json | null
          brand_voice?: string | null
          business_model?: string | null
          content_pillars?: string[] | null
          created_at?: string | null
          description?: string | null
          engagement_features?: Json
          engagement_settings?: Json
          id?: string
          industry?: string | null
          language?: string | null
          location?: string | null
          name: string
          selected_collections?: string[] | null
          show_branding?: boolean
          slug: string
          social_links?: Json | null
          target_audience?: string | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          ai_context?: Json | null
          brand_voice?: string | null
          business_model?: string | null
          content_pillars?: string[] | null
          created_at?: string | null
          description?: string | null
          engagement_features?: Json
          engagement_settings?: Json
          id?: string
          industry?: string | null
          language?: string | null
          location?: string | null
          name?: string
          selected_collections?: string[] | null
          show_branding?: boolean
          slug?: string
          social_links?: Json | null
          target_audience?: string | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_articles_engagement_daily: {
        Args: { p_article_id: string; p_metric: string; p_workspace_id: string }
        Returns: undefined
      }
      bump_blog_engagement_daily: {
        Args: {
          p_blog_post_id: string
          p_metric: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      bump_news_engagement_daily: {
        Args: { p_metric: string; p_news_id: string; p_workspace_id: string }
        Returns: undefined
      }
      bump_products_engagement_daily: {
        Args: { p_metric: string; p_product_id: string; p_workspace_id: string }
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
