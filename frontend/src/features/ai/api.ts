import { api } from "@/lib/api";

export type AiProvider = "gemini" | "groq" | "cache" | "none";

export interface AiResponse {
  text: string;
  provider_used: AiProvider;
  cached: boolean;
}

export interface TaskDraftResult {
  description: string;
  acceptance_criteria: string[];
  provider_used: AiProvider;
  cached: boolean;
}

export interface SubtaskBreakdownResult {
  subtasks: string[];
  provider_used: AiProvider;
  cached: boolean;
}

export async function aiProjectSummary(projectId: string): Promise<AiResponse> {
  const { data } = await api.post<AiResponse>("/ai/project-summary", { project_id: projectId });
  return data;
}

export async function aiTaskDraft(title: string, context?: string): Promise<TaskDraftResult> {
  const { data } = await api.post<TaskDraftResult>("/ai/task-draft", { title, context });
  return data;
}

export async function aiSubtaskBreakdown(input: {
  task_id?: string;
  title?: string;
}): Promise<SubtaskBreakdownResult> {
  const { data } = await api.post<SubtaskBreakdownResult>("/ai/subtask-breakdown", input);
  return data;
}

export async function aiStandup(workspaceId: string, days = 7): Promise<AiResponse> {
  const { data } = await api.post<AiResponse>("/ai/standup", {
    workspace_id: workspaceId,
    days,
  });
  return data;
}

/** The backend returns provider_used === "none" (HTTP 200) when no AI keys are set. */
export function aiUnavailable(provider: AiProvider): boolean {
  return provider === "none";
}
