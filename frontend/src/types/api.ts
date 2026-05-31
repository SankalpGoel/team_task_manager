export type Role = "admin" | "manager" | "member";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type NotificationType =
  | "invitation"
  | "task_assigned"
  | "mention"
  | "due_soon"
  | "comment";

export interface ApiUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkspaceBrief {
  id: string;
  name: string;
  slug: string;
}

export interface Workspace extends WorkspaceBrief {
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceWithRole extends Workspace {
  role: Role;
}

export interface MembershipBrief {
  workspace: WorkspaceBrief;
  role: Role;
}

export interface MemberOut {
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
  };
  role: Role;
  joined_at: string;
  membership_id: string;
}

export interface AuthResponse {
  user: ApiUser;
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface MeResponse {
  user: ApiUser;
  memberships: MembershipBrief[];
}

export interface InvitationOut {
  id: string;
  workspace_id: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface InvitationPreview {
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  expires_at: string;
  valid: boolean;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface ApiErrorBody {
  detail: ApiErrorDetail;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
