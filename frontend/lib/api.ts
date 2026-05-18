import type {
  ApiResponse,
  CoachAgentResponse,
  CompleteDayResponse,
  DayNote,
  GeneratePlanRequest,
  LearningPlan,
  LoginRequest,
  RegisterRequest,
  ResourcesByDay,
  SavedPlan,
  User,
  YouTubeSearchResponse,
} from "./types";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(`/api/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  let payload: ApiResponse<T> | { detail?: string; message?: string };

  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.status, response.statusText || "Network error");
  }

  if (!response.ok) {
    const message =
      ("message" in payload && payload.message) ||
      ("detail" in payload && payload.detail) ||
      `Request failed (${response.status})`;
    throw new ApiError(response.status, String(message));
  }

  return payload as ApiResponse<T>;
}

// Auth
export const authApi = {
  login: (body: LoginRequest) =>
    request<{ user: User }>("auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  register: (body: RegisterRequest) =>
    request<{ user: User }>("auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => request<null>("auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("auth/me"),
};

// Learning plans
export const planApi = {
  generate: (body: GeneratePlanRequest) =>
    request<LearningPlan>("learning-plans/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  save: (plan: LearningPlan, resources_by_day?: ResourcesByDay) =>
    request<SavedPlan>("learning-plans/save", {
      method: "POST",
      body: JSON.stringify({ plan, resources_by_day }),
    }),
  active: () => request<SavedPlan | null>("learning-plans/active"),
  next: (planId: string) =>
    request<{ day: number; task: string } | null>(
      `learning-plans/${planId}/next`
    ),
  dayNote: (planId: string, day: number) =>
    request<DayNote>(`learning-plans/${planId}/days/${day}/note`),
  saveDayNote: (planId: string, day: number, note: string) =>
    request<DayNote>(`learning-plans/${planId}/days/${day}/note`, {
      method: "PUT",
      body: JSON.stringify({ note }),
    }),
  completeDay: (planId: string, day: number) =>
    request<CompleteDayResponse>(
      `learning-plans/${planId}/days/${day}/complete`,
      { method: "PATCH" }
    ),
};

// Tasks
export const taskApi = {
  complete: (taskId: string) =>
    request<{ task: { id: string; completed: boolean } }>(
      `tasks/${taskId}/complete`,
      { method: "PATCH" }
    ),
};

// Resources
export const resourceApi = {
  complete: (resourceId: string) =>
    request<{ id: string; completed: boolean; completed_at: string }>(
      `resources/${resourceId}/complete`,
      { method: "PATCH" }
    ),
};

// YouTube
export const youtubeApi = {
  search: (query: string, max_results = 5) =>
    request<YouTubeSearchResponse>("youtube/search", {
      method: "POST",
      body: JSON.stringify({ query, max_results }),
    }),
};

// Agent
export const agentApi = {
  coach: (question?: string) =>
    request<CoachAgentResponse>("agent/coach", {
      method: "POST",
      body: JSON.stringify({ question: question?.trim() || null }),
    }),
};

export { ApiError };
