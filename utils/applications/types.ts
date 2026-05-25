// Shared types for Applications

export type QuestionType =
  | "free_text"
  | "short_text"
  | "paragraph"
  | "single_choice"
  | "multiple_choice"
  | "scale_slider"
  | "yes_no";

export type SubmissionStatus =
  | "pending_review"
  | "passed"
  | "failed"
  | "action_failed";

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface QuestionConfig {
  choices?: ChoiceOption[];
  correctChoiceIds?: string[];
  multipleChoiceMode?: "exact" | "partial";
  partialPenalty?: number;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  scaleMode?: "exact" | "range" | "bands";
  exactValue?: number;
  rangeMin?: number;
  rangeMax?: number;
  bands?: Array<{ from: number; to: number; points: number }>;
  correctBoolean?: boolean;
  textMode?: "manual" | "accepted_list" | "keywords";
  acceptedAnswers?: string[];
  keywords?: string[];
  keywordRule?: "any" | "all";
  caseSensitive?: boolean;
  minLength?: number;
  maxLength?: number;
}

export interface QuestionRecord {
  id: string;
  formId: string;
  order: number;
  title: string;
  description: string | null;
  type: QuestionType | string;
  required: boolean;
  points: number;
  config: QuestionConfig | null;
}

export interface SubmittedAnswer {
  questionId: string;
  value: unknown;
}

export interface BreakdownItem {
  questionId: string;
  type: string;
  awardedPoints: number;
  maxPoints: number;
  correct: boolean | null;
  notes?: string;
}

export interface MarkingResult {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: SubmissionStatus;
  breakdown: BreakdownItem[];
}

export interface PublicQuestion {
  id: string;
  order: number;
  title: string;
  description: string | null;
  type: string;
  required: boolean;
  config: {
    choices?: ChoiceOption[];
    min?: number;
    max?: number;
    step?: number;
    minLabel?: string;
    maxLabel?: string;
    minLength?: number;
    maxLength?: number;
  };
}
