// Hand-maintained to match supabase/migrations. When the Supabase CLI is
// available you can regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export type QuestionType = "single" | "multi";
export type QuestionSource =
  | "official-sample"
  | "mock-cyberskill"
  | "mock-cosx"
  | "mock-ccg"
  | "generated";

export interface Database {
  public: {
    Tables: {
      domains: {
        Row: {
          number: number;
          name: string;
          weight: number;
          blurb: string | null;
          accent: string | null;
        };
        Insert: Database["public"]["Tables"]["domains"]["Row"];
        Update: Partial<Database["public"]["Tables"]["domains"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          code: string;
          domain: number;
          statement: string;
          video_ref: string | null;
          sort: number;
        };
        Insert: Database["public"]["Tables"]["tasks"]["Row"];
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      scenarios: {
        Row: {
          slug: string;
          name: string;
          description: string;
          primary_domains: number[];
        };
        Insert: Database["public"]["Tables"]["scenarios"]["Row"];
        Update: Partial<Database["public"]["Tables"]["scenarios"]["Row"]>;
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          task_code: string | null;
          domain: number;
          scenario: string | null;
          stem: string;
          type: QuestionType;
          source: QuestionSource;
          difficulty: number | null;
          explanation: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["questions"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["questions"]["Row"]>;
        Relationships: [];
      };
      question_options: {
        Row: {
          id: string;
          question_id: string;
          label: string;
          body: string;
          is_correct: boolean;
          rationale: string | null;
          sort: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["question_options"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<
          Database["public"]["Tables"]["question_options"]["Row"]
        >;
        Relationships: [];
      };
      flashcards: {
        Row: {
          id: string;
          task_code: string | null;
          domain: number;
          front: string;
          back: string;
          source_ref: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["flashcards"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["flashcards"]["Row"]>;
        Relationships: [];
      };
      user_state: {
        Row: {
          user_id: string;
          key: string;
          value: unknown;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["user_state"]["Row"];
        Update: Partial<Database["public"]["Tables"]["user_state"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      question_type: QuestionType;
      question_source: QuestionSource;
    };
  };
}
