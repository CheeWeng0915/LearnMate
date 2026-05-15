export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type User = {
  id: string;
  email: string;
  name?: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  name?: string;
  turnstile_token: string;
};

export type LearningDay = {
  day: number;
  title: string;
  tasks: string[];
  search_queries: string[];
};

export type LearningPlan = {
  goal: string;
  topic: string;
  duration_days: number;
  level: string;
  daily_minutes: number;
  learning_outcome: string;
  days: LearningDay[];
};

export type GeneratePlanRequest = {
  goal: string;
  level: "beginner" | "intermediate" | "advanced";
  daily_minutes: number;
  language: string;
};

export type YouTubeVideo = {
  id?: string;
  video_id: string;
  title: string;
  description: string;
  channel_title: string;
  published_at: string;
  thumbnail_url: string;
  url: string;
  completed?: boolean;
  completed_at?: string | null;
};

export type YouTubeSearchResponse = {
  query: string;
  videos: YouTubeVideo[];
};

export type ResourcesByDay = Record<string, YouTubeVideo[]>;

export type SavedPlan = {
  id: string;
  user_id: string;
  plan: LearningPlan;
  resources_by_day?: ResourcesByDay;
  created_at: string;
  last_studied_at?: string | null;
  is_active: boolean;
  tasks?: SavedTask[];
};

export type SavedTask = {
  id: string;
  plan_id: string;
  day: number;
  description: string;
  completed: boolean;
  completed_at?: string | null;
};

export type DayNote = {
  id?: string;
  plan_id: string;
  day: number;
  note: string;
  updated_at?: string | null;
};

export type CompleteDayResponse = {
  plan_id: string;
  day: number;
  completed: boolean;
  completed_at: string;
  progress_percent: number;
  is_plan_completed: boolean;
};
