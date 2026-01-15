export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Base categories + custom string categories are allowed
export type DocCategory = 'product' | 'competitor' | 'research' | 'output' | string

export type CampaignStatus =
  | 'pending_research'
  | 'research_complete'
  | 'step_1_running'
  | 'step_1_complete'
  | 'step_2_running'
  | 'step_2_complete'
  | 'step_3_running'
  | 'step_3_complete'
  | 'step_4_running'
  | 'completed'
  | 'error'

export type PlaybookType = 'ecp' | 'video_viral_ia' | 'custom'

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
          context_config: Json
          prompt_deep_research: string
          prompt_1_find_place: string
          prompt_2_select_assets: string
          prompt_3_proof_legit: string
          prompt_4_final_output: string
          step_1_guidance: string | null
          step_2_guidance: string | null
          step_3_guidance: string | null
          step_4_guidance: string | null
          flow_config: Json | null
          variable_definitions: Json
          deep_research_prompts: Json
          campaign_docs_guide: string | null
          playbook_type: PlaybookType
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
          context_config?: Json
          prompt_deep_research?: string
          prompt_1_find_place?: string
          prompt_2_select_assets?: string
          prompt_3_proof_legit?: string
          prompt_4_final_output?: string
          step_1_guidance?: string | null
          step_2_guidance?: string | null
          step_3_guidance?: string | null
          step_4_guidance?: string | null
          flow_config?: Json | null
          variable_definitions?: Json
          deep_research_prompts?: Json
          campaign_docs_guide?: string | null
          playbook_type?: PlaybookType
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          context_config?: Json
          prompt_deep_research?: string
          prompt_1_find_place?: string
          prompt_2_select_assets?: string
          prompt_3_proof_legit?: string
          prompt_4_final_output?: string
          step_1_guidance?: string | null
          step_2_guidance?: string | null
          step_3_guidance?: string | null
          step_4_guidance?: string | null
          flow_config?: Json | null
          variable_definitions?: Json
          deep_research_prompts?: Json
          campaign_docs_guide?: string | null
          playbook_type?: PlaybookType
        }
      }
      knowledge_base_docs: {
        Row: {
          id: string
          project_id: string
          filename: string
          category: DocCategory
          extracted_content: string
          description: string
          file_size_bytes: number | null
          token_count: number | null
          mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          filename: string
          category: DocCategory
          extracted_content: string
          description?: string
          file_size_bytes?: number | null
          token_count?: number | null
          mime_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          filename?: string
          category?: DocCategory
          extracted_content?: string
          description?: string
          file_size_bytes?: number | null
          token_count?: number | null
          mime_type?: string | null
          created_at?: string
        }
      }
      ecp_campaigns: {
        Row: {
          id: string
          project_id: string
          ecp_name: string
          problem_core: string
          country: string
          industry: string
          status: CampaignStatus
          deep_research_text: string | null
          deep_research_tokens: number | null
          output_1_find_place: string | null
          output_1_tokens: number | null
          output_2_select_assets: string | null
          output_2_tokens: number | null
          output_3_proof_legit: string | null
          output_3_tokens: number | null
          output_final_messages: string | null
          output_final_tokens: number | null
          created_at: string
          updated_at: string
          error_message: string | null
          custom_variables: Json
        }
        Insert: {
          id?: string
          project_id: string
          ecp_name: string
          problem_core: string
          country: string
          industry: string
          status?: CampaignStatus
          deep_research_text?: string | null
          deep_research_tokens?: number | null
          output_1_find_place?: string | null
          output_1_tokens?: number | null
          output_2_select_assets?: string | null
          output_2_tokens?: number | null
          output_3_proof_legit?: string | null
          output_3_tokens?: number | null
          output_final_messages?: string | null
          output_final_tokens?: number | null
          created_at?: string
          updated_at?: string
          error_message?: string | null
          custom_variables?: Json
        }
        Update: {
          id?: string
          project_id?: string
          ecp_name?: string
          problem_core?: string
          country?: string
          industry?: string
          status?: CampaignStatus
          deep_research_text?: string | null
          deep_research_tokens?: number | null
          output_1_find_place?: string | null
          output_1_tokens?: number | null
          output_2_select_assets?: string | null
          output_2_tokens?: number | null
          output_3_proof_legit?: string | null
          output_3_tokens?: number | null
          output_final_messages?: string | null
          output_final_tokens?: number | null
          created_at?: string
          updated_at?: string
          error_message?: string | null
          custom_variables?: Json
        }
      }
      execution_logs: {
        Row: {
          id: string
          campaign_id: string
          step_name: string
          status: 'started' | 'completed' | 'error'
          input_tokens: number | null
          output_tokens: number | null
          duration_ms: number | null
          model_used: string | null
          error_details: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          step_name: string
          status: 'started' | 'completed' | 'error'
          input_tokens?: number | null
          output_tokens?: number | null
          duration_ms?: number | null
          model_used?: string | null
          error_details?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          step_name?: string
          status?: 'started' | 'completed' | 'error'
          input_tokens?: number | null
          output_tokens?: number | null
          duration_ms?: number | null
          model_used?: string | null
          error_details?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      doc_category: DocCategory
    }
  }
}
