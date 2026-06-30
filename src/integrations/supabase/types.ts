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
      admin_users: {
        Row: { created_at: string; user_id: string }
        Insert: { created_at?: string; user_id: string }
        Update: { created_at?: string; user_id?: string }
        Relationships: []
      }
      analytical_evaluations: {
        Row: {
          arom: string | null
          created_at: string
          dppd_fingers: Json | null
          dynamometer_msd: Json | null
          dynamometer_msi: Json | null
          dynamometer_notes: string | null
          edema: string | null
          edema_circummetry: Json | null
          emotional_state: string | null
          episode_id: string | null
          evaluation_date: string
          godet_test: string | null
          goniometry: Json | null
          id: string
          kapandji: string | null
          mobility_observations: string | null
          muscle_strength: string | null
          muscle_strength_cubital: string | null
          muscle_strength_daniels: Json | null
          muscle_strength_median: string | null
          muscle_strength_radial: string | null
          notes: string | null
          osas_score: number | null
          pain: string | null
          pain_aggravating_factors: string | null
          pain_appearance: string | null
          pain_characteristics: string | null
          pain_location: string | null
          pain_radiation: string | null
          pain_score: number | null
          pains: Json | null
          patient_id: string
          posture: string | null
          professional_id: string
          prom: string | null
          scar: string | null
          scar_evaluation: Json | null
          sections_config: Json | null
          sensitivity: string | null
          sensitivity_dos_puntos: string | null
          sensitivity_functional: string | null
          sensitivity_picking_up: string | null
          sensitivity_protective: string | null
          sensitivity_semmes_weinstein: string | null
          sensitivity_tacto_ligero: string | null
          sensitivity_temperatura: string | null
          sensitivity_toco_pincho: string | null
          session_id: string | null
          specific_tests: Json | null
          trophic_state: string | null
          updated_at: string
          vancouver_score: number | null
        }
        Insert: {
          arom?: string | null
          created_at?: string
          dppd_fingers?: Json | null
          dynamometer_msd?: Json | null
          dynamometer_msi?: Json | null
          dynamometer_notes?: string | null
          edema?: string | null
          edema_circummetry?: Json | null
          emotional_state?: string | null
          episode_id?: string | null
          evaluation_date?: string
          godet_test?: string | null
          goniometry?: Json | null
          id?: string
          kapandji?: string | null
          mobility_observations?: string | null
          muscle_strength?: string | null
          muscle_strength_cubital?: string | null
          muscle_strength_daniels?: Json | null
          muscle_strength_median?: string | null
          muscle_strength_radial?: string | null
          notes?: string | null
          osas_score?: number | null
          pain?: string | null
          pain_aggravating_factors?: string | null
          pain_appearance?: string | null
          pain_characteristics?: string | null
          pain_location?: string | null
          pain_radiation?: string | null
          pain_score?: number | null
          pains?: Json | null
          patient_id: string
          posture?: string | null
          professional_id: string
          prom?: string | null
          scar?: string | null
          scar_evaluation?: Json | null
          sections_config?: Json | null
          sensitivity?: string | null
          sensitivity_dos_puntos?: string | null
          sensitivity_functional?: string | null
          sensitivity_picking_up?: string | null
          sensitivity_protective?: string | null
          sensitivity_semmes_weinstein?: string | null
          sensitivity_tacto_ligero?: string | null
          sensitivity_temperatura?: string | null
          sensitivity_toco_pincho?: string | null
          session_id?: string | null
          specific_tests?: Json | null
          trophic_state?: string | null
          updated_at?: string
          vancouver_score?: number | null
        }
        Update: {
          arom?: string | null
          created_at?: string
          dppd_fingers?: Json | null
          dynamometer_msd?: Json | null
          dynamometer_msi?: Json | null
          dynamometer_notes?: string | null
          edema?: string | null
          edema_circummetry?: Json | null
          emotional_state?: string | null
          episode_id?: string | null
          evaluation_date?: string
          godet_test?: string | null
          goniometry?: Json | null
          id?: string
          kapandji?: string | null
          mobility_observations?: string | null
          muscle_strength?: string | null
          muscle_strength_cubital?: string | null
          muscle_strength_daniels?: Json | null
          muscle_strength_median?: string | null
          muscle_strength_radial?: string | null
          notes?: string | null
          osas_score?: number | null
          pain?: string | null
          pain_aggravating_factors?: string | null
          pain_appearance?: string | null
          pain_characteristics?: string | null
          pain_location?: string | null
          pain_radiation?: string | null
          pain_score?: number | null
          pains?: Json | null
          patient_id?: string
          posture?: string | null
          professional_id?: string
          prom?: string | null
          scar?: string | null
          scar_evaluation?: Json | null
          sections_config?: Json | null
          sensitivity?: string | null
          sensitivity_dos_puntos?: string | null
          sensitivity_functional?: string | null
          sensitivity_picking_up?: string | null
          sensitivity_protective?: string | null
          sensitivity_semmes_weinstein?: string | null
          sensitivity_tacto_ligero?: string | null
          sensitivity_temperatura?: string | null
          sensitivity_toco_pincho?: string | null
          session_id?: string | null
          specific_tests?: Json | null
          trophic_state?: string | null
          updated_at?: string
          vancouver_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytical_evaluations_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "treatment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytical_evaluations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytical_evaluations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytical_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "therapy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_end: string | null
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          professional_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_end?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          professional_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_end?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          professional_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          action_context: Database["public"]["Enums"]["audit_context"]
          changes: Json | null
          created_at: string
          description: string | null
          id: string
          performed_by: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          action_context?: Database["public"]["Enums"]["audit_context"]
          changes?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          performed_by?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          action_context?: Database["public"]["Enums"]["audit_context"]
          changes?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          performed_by?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cie10: {
        Row: {
          category: string | null
          code: string
          description: string
          description_search: string | null
          id: number
        }
        Insert: {
          category?: string | null
          code: string
          description: string
          description_search?: string | null
          id?: number
        }
        Update: {
          category?: string | null
          code?: string
          description?: string
          description_search?: string | null
          id?: number
        }
        Relationships: []
      }
      clinical_files: {
        Row: {
          category: Database["public"]["Enums"]["clinical_file_category"]
          created_at: string
          deleted_at: string | null
          description: string | null
          episode_id: string | null
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          is_deleted: boolean
          patient_id: string
          photo_date: string | null
          session_id: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["clinical_file_category"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          episode_id?: string | null
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          is_deleted?: boolean
          patient_id: string
          photo_date?: string | null
          session_id?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: Database["public"]["Enums"]["clinical_file_category"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          episode_id?: string | null
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          is_deleted?: boolean
          patient_id?: string
          photo_date?: string | null
          session_id?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_files_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "treatment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_files_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "therapy_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_body_regions: {
        Row: {
          id: string
          name: string
          professional_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          professional_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          professional_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_body_regions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_categories: {
        Row: {
          category: Database["public"]["Enums"]["exercise_category"]
          created_at: string
          exercise_id: string
          id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          exercise_id: string
          id?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          exercise_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_categories_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_custom_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          professional_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          professional_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_custom_categories_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_custom_category_assignments: {
        Row: {
          created_at: string
          custom_category_id: string
          exercise_id: string
          id: string
        }
        Insert: {
          created_at?: string
          custom_category_id: string
          exercise_id: string
          id?: string
        }
        Update: {
          created_at?: string
          custom_category_id?: string
          exercise_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_custom_category_assignments_custom_category_id_fkey"
            columns: ["custom_category_id"]
            isOneToOne: false
            referencedRelation: "exercise_custom_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_custom_category_assignments_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_library: {
        Row: {
          body_region: string | null
          body_region_id: string | null
          created_at: string
          equipment: string | null
          exercise_type: string | null
          precautions: string | null
          starting_position: string | null
          suggested_reps: number | null
          suggested_sets: number | null
          default_duration: string | null
          default_frequency: string | null
          default_repetitions: number | null
          default_sets: number | null
          description: string | null
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          professional_id: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          body_region?: string | null
          body_region_id?: string | null
          created_at?: string
          equipment?: string | null
          exercise_type?: string | null
          precautions?: string | null
          starting_position?: string | null
          suggested_reps?: number | null
          suggested_sets?: number | null
          default_duration?: string | null
          default_frequency?: string | null
          default_repetitions?: number | null
          default_sets?: number | null
          description?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          professional_id?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          body_region?: string | null
          body_region_id?: string | null
          created_at?: string
          equipment?: string | null
          exercise_type?: string | null
          precautions?: string | null
          starting_position?: string | null
          suggested_reps?: number | null
          suggested_sets?: number | null
          default_duration?: string | null
          default_frequency?: string | null
          default_repetitions?: number | null
          default_sets?: number | null
          description?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          professional_id?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_library_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_library_body_region_id_fkey"
            columns: ["body_region_id"]
            isOneToOne: false
            referencedRelation: "exercise_body_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_plan_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          patient_id: string
          plan_id: string
          professional_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          patient_id: string
          plan_id: string
          professional_id: string
          revoked_at?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          patient_id?: string
          plan_id?: string
          professional_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_plan_tokens_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "exercise_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_plan_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_plan_items: {
        Row: {
          assigned_reps: number | null
          assigned_sets: number | null
          created_at: string
          exercise_id: string
          frequency: string | null
          id: string
          notes: string | null
          order_index: number
          plan_id: string
        }
        Insert: {
          assigned_reps?: number | null
          assigned_sets?: number | null
          created_at?: string
          exercise_id: string
          frequency?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          plan_id: string
        }
        Update: {
          assigned_reps?: number | null
          assigned_sets?: number | null
          created_at?: string
          exercise_id?: string
          frequency?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "exercise_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_plan_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_plans: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          professional_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          professional_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          professional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_plans_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      functional_evaluations: {
        Row: {
          aivd: string | null
          avd: string | null
          barthel_items: Json | null
          barthel_score: number | null
          created_at: string
          dash_score: number | null
          dominance: Database["public"]["Enums"]["dominance_type"] | null
          episode_id: string | null
          evaluation_date: string
          fim_items: Json | null
          fim_score: number | null
          health_management: string | null
          id: string
          notes: string | null
          patient_id: string
          physical_activity: string | null
          professional_id: string
          quickdash_items: Json | null
          quickdash_score: number | null
          session_id: string | null
          sleep_rest: string | null
          updated_at: string
        }
        Insert: {
          aivd?: string | null
          avd?: string | null
          barthel_items?: Json | null
          barthel_score?: number | null
          created_at?: string
          dash_score?: number | null
          dominance?: Database["public"]["Enums"]["dominance_type"] | null
          episode_id?: string | null
          evaluation_date?: string
          fim_items?: Json | null
          fim_score?: number | null
          health_management?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          physical_activity?: string | null
          professional_id: string
          quickdash_items?: Json | null
          quickdash_score?: number | null
          session_id?: string | null
          sleep_rest?: string | null
          updated_at?: string
        }
        Update: {
          aivd?: string | null
          avd?: string | null
          barthel_items?: Json | null
          barthel_score?: number | null
          created_at?: string
          dash_score?: number | null
          dominance?: Database["public"]["Enums"]["dominance_type"] | null
          episode_id?: string | null
          evaluation_date?: string
          fim_items?: Json | null
          fim_score?: number | null
          health_management?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          physical_activity?: string | null
          professional_id?: string
          quickdash_items?: Json | null
          quickdash_score?: number | null
          session_id?: string | null
          sleep_rest?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "functional_evaluations_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "treatment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "functional_evaluations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "functional_evaluations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "functional_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "therapy_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      obras_sociales: {
        Row: {
          id: number
          is_active: boolean | null
          name: string
          name_search: string | null
          type: string | null
        }
        Insert: {
          id?: number
          is_active?: boolean | null
          name: string
          name_search?: string | null
          type?: string | null
        }
        Update: {
          id?: number
          is_active?: boolean | null
          name?: string
          name_search?: string | null
          type?: string | null
        }
        Relationships: []
      }
      patient_clinical_records: {
        Row: {
          created_at: string
          current_treatment: string | null
          days_post_injury: number | null
          days_post_surgery: number | null
          diagnosis: string | null
          doctor_name: string | null
          episode_id: string | null
          id: string
          immobilization_days: number | null
          immobilization_type: string | null
          immobilization_weeks: number | null
          injury_date: string | null
          injury_mechanism: string | null
          medical_history: string | null
          next_oyt_appointment: string | null
          notes: string | null
          patient_id: string
          pharmacological_treatment: string | null
          referral_reason: string | null
          studies: string | null
          surgery_date: string | null
          symptom_start_date: string | null
          treatment_type: string | null
          updated_at: string
          weeks_post_injury: number | null
          weeks_post_surgery: number | null
        }
        Insert: {
          created_at?: string
          current_treatment?: string | null
          days_post_injury?: number | null
          days_post_surgery?: number | null
          diagnosis?: string | null
          doctor_name?: string | null
          episode_id?: string | null
          id?: string
          immobilization_days?: number | null
          immobilization_type?: string | null
          immobilization_weeks?: number | null
          injury_date?: string | null
          injury_mechanism?: string | null
          medical_history?: string | null
          next_oyt_appointment?: string | null
          notes?: string | null
          patient_id: string
          pharmacological_treatment?: string | null
          referral_reason?: string | null
          studies?: string | null
          surgery_date?: string | null
          symptom_start_date?: string | null
          treatment_type?: string | null
          updated_at?: string
          weeks_post_injury?: number | null
          weeks_post_surgery?: number | null
        }
        Update: {
          created_at?: string
          current_treatment?: string | null
          days_post_injury?: number | null
          days_post_surgery?: number | null
          diagnosis?: string | null
          doctor_name?: string | null
          episode_id?: string | null
          id?: string
          immobilization_days?: number | null
          immobilization_type?: string | null
          immobilization_weeks?: number | null
          injury_date?: string | null
          injury_mechanism?: string | null
          medical_history?: string | null
          next_oyt_appointment?: string | null
          notes?: string | null
          patient_id?: string
          pharmacological_treatment?: string | null
          referral_reason?: string | null
          studies?: string | null
          surgery_date?: string | null
          symptom_start_date?: string | null
          treatment_type?: string | null
          updated_at?: string
          weeks_post_injury?: number | null
          weeks_post_surgery?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_clinical_records_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "treatment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_clinical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_occupational_profiles: {
        Row: {
          aivd: string | null
          avd: string | null
          created_at: string
          dash_score: number | null
          dominance: string | null
          education: string | null
          health_management: string | null
          id: string
          job: string | null
          leisure: string | null
          notes: string | null
          patient_id: string
          physical_activity: string | null
          sleep_rest: string | null
          support_network: string | null
          updated_at: string
        }
        Insert: {
          aivd?: string | null
          avd?: string | null
          created_at?: string
          dash_score?: number | null
          dominance?: string | null
          education?: string | null
          health_management?: string | null
          id?: string
          job?: string | null
          leisure?: string | null
          notes?: string | null
          patient_id: string
          physical_activity?: string | null
          sleep_rest?: string | null
          support_network?: string | null
          updated_at?: string
        }
        Update: {
          aivd?: string | null
          avd?: string | null
          created_at?: string
          dash_score?: number | null
          dominance?: string | null
          education?: string | null
          health_management?: string | null
          id?: string
          job?: string | null
          leisure?: string | null
          notes?: string | null
          patient_id?: string
          physical_activity?: string | null
          sleep_rest?: string | null
          support_network?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_occupational_profiles_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          admission_date: string
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          discharged_at: string | null
          dni: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          first_name: string
          gender: string | null
          id: string
          insurance: string | null
          insurance_number: string | null
          insurances: Json | null
          is_deleted: boolean
          last_name: string
          nationality: string | null
          phone: string | null
          professional_id: string
          status: Database["public"]["Enums"]["patient_status"]
          team_id: string | null
          updated_at: string
          user_profile_id: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          discharged_at?: string | null
          dni: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name: string
          gender?: string | null
          id?: string
          insurance?: string | null
          insurance_number?: string | null
          insurances?: Json | null
          is_deleted?: boolean
          last_name: string
          nationality?: string | null
          phone?: string | null
          professional_id: string
          status?: Database["public"]["Enums"]["patient_status"]
          team_id?: string | null
          updated_at?: string
          user_profile_id?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          discharged_at?: string | null
          dni?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          insurance?: string | null
          insurance_number?: string | null
          insurances?: Json | null
          is_deleted?: boolean
          last_name?: string
          nationality?: string | null
          phone?: string | null
          professional_id?: string
          status?: Database["public"]["Enums"]["patient_status"]
          team_id?: string | null
          updated_at?: string
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deactivated_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          license_number: string | null
          role: Database["public"]["Enums"]["profile_role"]
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          license_number?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          status: string
          team_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          status?: string
          team_id: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          status?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          }
        ]
      }
      team_members: {
        Row: {
          invited_by: string | null
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          role: string
          team_id: string
          user_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          member_limit: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          member_limit?: number
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          member_limit?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      therapy_sessions: {
        Row: {
          avd_followup: string | null
          clinical_changes: string | null
          created_at: string
          deleted_at: string | null
          episode_id: string | null
          evolution: string | null
          general_observations: string | null
          home_instructions_sent: string | null
          id: string
          interventions: string | null
          is_deleted: boolean
          next_appointment: string | null
          notes: string | null
          patient_id: string
          professional_id: string
          session_date: string
          session_number: number | null
          session_type: string | null
          symptom_changes: string | null
          treatment_adjustments: string | null
          updated_at: string
          week_at_session: number | null
        }
        Insert: {
          avd_followup?: string | null
          clinical_changes?: string | null
          created_at?: string
          deleted_at?: string | null
          episode_id?: string | null
          evolution?: string | null
          general_observations?: string | null
          home_instructions_sent?: string | null
          id?: string
          interventions?: string | null
          is_deleted?: boolean
          next_appointment?: string | null
          notes?: string | null
          patient_id: string
          professional_id: string
          session_date?: string
          session_number?: number | null
          session_type?: string | null
          symptom_changes?: string | null
          treatment_adjustments?: string | null
          updated_at?: string
          week_at_session?: number | null
        }
        Update: {
          avd_followup?: string | null
          clinical_changes?: string | null
          created_at?: string
          deleted_at?: string | null
          episode_id?: string | null
          evolution?: string | null
          general_observations?: string | null
          home_instructions_sent?: string | null
          id?: string
          interventions?: string | null
          is_deleted?: boolean
          next_appointment?: string | null
          notes?: string | null
          patient_id?: string
          professional_id?: string
          session_date?: string
          session_number?: number | null
          session_type?: string | null
          symptom_changes?: string | null
          treatment_adjustments?: string | null
          updated_at?: string
          week_at_session?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapy_sessions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "treatment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_sessions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_episodes: {
        Row: {
          admission_date: string
          affected_side: "MSD" | "MSI" | "both" | null
          created_at: string
          deleted_at: string | null
          diagnosis: string | null
          discharge_date: string | null
          episode_number: number
          id: string
          is_deleted: boolean
          notes: string | null
          patient_id: string
          professional_id: string
          referral_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admission_date?: string
          affected_side?: "MSD" | "MSI" | "both" | null
          created_at?: string
          deleted_at?: string | null
          diagnosis?: string | null
          discharge_date?: string | null
          episode_number?: number
          id?: string
          is_deleted?: boolean
          notes?: string | null
          patient_id: string
          professional_id: string
          referral_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admission_date?: string
          affected_side?: "MSD" | "MSI" | "both" | null
          created_at?: string
          deleted_at?: string | null
          diagnosis?: string | null
          discharge_date?: string | null
          episode_number?: number
          id?: string
          is_deleted?: boolean
          notes?: string | null
          patient_id?: string
          professional_id?: string
          referral_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_episodes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_episodes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_exercises: {
        Row: {
          created_at: string
          custom_description: string | null
          custom_name: string | null
          duration: string | null
          exercise_id: string
          frequency: string | null
          id: string
          notes: string | null
          order_index: number
          repetitions: number | null
          sets: number | null
          treatment_plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_description?: string | null
          custom_name?: string | null
          duration?: string | null
          exercise_id: string
          frequency?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          repetitions?: number | null
          sets?: number | null
          treatment_plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_description?: string | null
          custom_name?: string | null
          duration?: string | null
          exercise_id?: string
          frequency?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          repetitions?: number | null
          sets?: number | null
          treatment_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_exercises_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_date: string | null
          episode_id: string | null
          home_item_recommendations: string | null
          id: string
          indications: string | null
          is_deleted: boolean
          joint_protection_guidelines: string | null
          notes: string | null
          objective: string | null
          patient_id: string
          professional_id: string
          skin_care: string | null
          start_date: string
          status: Database["public"]["Enums"]["treatment_plan_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          episode_id?: string | null
          home_item_recommendations?: string | null
          id?: string
          indications?: string | null
          is_deleted?: boolean
          joint_protection_guidelines?: string | null
          notes?: string | null
          objective?: string | null
          patient_id: string
          professional_id: string
          skin_care?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          episode_id?: string | null
          home_item_recommendations?: string | null
          id?: string
          indications?: string | null
          is_deleted?: boolean
          joint_protection_guidelines?: string | null
          notes?: string | null
          objective?: string | null
          patient_id?: string
          professional_id?: string
          skin_care?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "treatment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quickdash_tokens: {
        Row: {
          id: string
          token: string
          patient_id: string
          session_id: string | null
          episode_id: string | null
          created_by: string
          created_at: string
          expires_at: string
          completed_at: string | null
          completed_by: "patient" | "therapist" | null
          result: Json | null
        }
        Insert: {
          id?: string
          token?: string
          patient_id: string
          session_id?: string | null
          episode_id?: string | null
          created_by: string
          created_at?: string
          expires_at: string
          completed_at?: string | null
          completed_by?: "patient" | "therapist" | null
          result?: Json | null
        }
        Update: {
          id?: string
          token?: string
          patient_id?: string
          session_id?: string | null
          episode_id?: string | null
          created_by?: string
          created_at?: string
          expires_at?: string
          completed_at?: string | null
          completed_by?: "patient" | "therapist" | null
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "quickdash_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickdash_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "therapy_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickdash_tokens_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "treatment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickdash_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["profile_role"]
      }
      insert_audit_log: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_description?: string
          p_record_id: string
          p_table_name: string
        }
        Returns: undefined
      }
      is_active_professional: { Args: never; Returns: boolean }
      is_my_patient: { Args: { p_patient_id: string }; Returns: boolean }
      search_cie10: {
        Args: { max_results?: number; search_input: string }
        Returns: {
          category: string
          code: string
          description: string
          rank: number
        }[]
      }
      get_quickdash_token: {
        Args: { p_token: string }
        Returns: Json
      }
      complete_quickdash_token: {
        Args: { p_token: string; p_items: Json; p_score: number }
        Returns: undefined
      }
      create_quickdash_token: {
        Args: { p_episode_id: string; p_patient_id: string; p_expires_at: string }
        Returns: string
      }
      soft_delete_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
    }
    Enums: {
      appointment_status: "scheduled" | "completed" | "cancelled"
      appointment_type: "consultation" | "follow_up" | "evaluation"
      audit_action:
        | "insert"
        | "update"
        | "delete"
        | "soft_delete"
        | "restore"
        | "deactivate"
      audit_context: "user" | "system"
      clinical_file_category: "study" | "photo" | "document"
      dominance_type: "right" | "left" | "ambidextrous"
      exercise_category:
        | "general"
        | "occupation"
        | "sport"
        | "joint_protection"
        | "skin_care"
      patient_status: "active" | "discharged" | "paused"
      profile_role: "professional" | "admin" | "patient"
      treatment_plan_status: "active" | "completed" | "archived"
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
      appointment_status: ["scheduled", "completed", "cancelled"],
      appointment_type: ["consultation", "follow_up", "evaluation"],
      audit_action: [
        "insert",
        "update",
        "delete",
        "soft_delete",
        "restore",
        "deactivate",
      ],
      audit_context: ["user", "system"],
      clinical_file_category: ["study", "photo", "document"],
      dominance_type: ["right", "left", "ambidextrous"],
      exercise_category: [
        "general",
        "occupation",
        "sport",
        "joint_protection",
        "skin_care",
      ],
      patient_status: ["active", "discharged", "paused"],
      profile_role: ["professional", "admin", "patient"],
      treatment_plan_status: ["active", "completed", "archived"],
    },
  },
} as const
