import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, Plus, Trash2, UserX } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  changeMemberRole,
  createInvitation,
  listMembers,
  listPendingInvitations,
  removeMember,
  revokeInvitation,
} from "@/features/workspace/api";
import { getApiErrorMessage } from "@/lib/api";
import { initials } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import type { Role } from "@/types/api";

export default function MembersPage() {
  const role = useAuthStore((s) => s.activeRole());
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");

  const isAdmin = role === "admin";

  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;
  const copyInviteLink = async (token: string) => {
    const url = inviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard");
    } catch {
      toast.message(url, { description: "Copy this invite link" });
    }
  };

  const members = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => listMembers(workspaceId!),
    enabled: !!workspaceId,
  });

  const invitations = useQuery({
    queryKey: ["invitations", workspaceId],
    queryFn: () => listPendingInvitations(workspaceId!),
    enabled: !!workspaceId && isAdmin,
  });

  const invite = useMutation({
    mutationFn: () => createInvitation(workspaceId!, inviteEmail.trim().toLowerCase(), inviteRole),
    onSuccess: async (inv) => {
      await copyInviteLink(inv.token);
      toast.success(`Invitation created for ${inv.email}. Link copied`);
      await queryClient.invalidateQueries({ queryKey: ["invitations", workspaceId] });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const changeRole = useMutation({
    mutationFn: (vars: { userId: string; role: Role }) =>
      changeMemberRole(workspaceId!, vars.userId, vars.role),
    onSuccess: async () => {
      toast.success("Role updated");
      await queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(workspaceId!, userId),
    onSuccess: async () => {
      toast.success("Member removed");
      await queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onSuccess: async () => {
      toast.success("Invitation revoked");
      await queryClient.invalidateQueries({ queryKey: ["invitations", workspaceId] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (!workspaceId) {
    return (
      <div className="container py-8">
        <p className="text-sm text-muted-foreground">Select a workspace to view its members.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Invite teammates, change roles, or remove members."
              : "Your team's roster."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Invite member
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : members.data && members.data.length > 0 ? (
            <ul className="divide-y">
              {members.data.map((m) => {
                const isSelf = m.user.id === currentUserId;
                return (
                  <li key={m.membership_id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{initials(m.user.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {m.user.full_name}
                          {isSelf && (
                            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && !isSelf ? (
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={m.role}
                          onChange={(e) =>
                            changeRole.mutate({ userId: m.user.id, role: e.target.value as Role })
                          }
                          disabled={changeRole.isPending}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <Badge variant="outline" className="capitalize">
                          {m.role}
                        </Badge>
                      )}
                      {isAdmin && !isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remove ${m.user.full_name} from this workspace?`)) {
                              remove.mutate(m.user.id);
                            }
                          }}
                          aria-label="Remove member"
                        >
                          <UserX className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
            <CardDescription>Invitations expire after 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : invitations.data && invitations.data.length > 0 ? (
              <ul className="divide-y">
                {invitations.data.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.role} · expires {format(parseISO(inv.expires_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => copyInviteLink(inv.token)}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => revoke.mutate(inv.id)}
                        aria-label="Revoke invitation"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              We'll create an invite link and copy it to your clipboard. If email is configured
              they'll also receive it, otherwise just share the copied link. They sign up (or in)
              with this email to join.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inviteEmail.trim()) invite.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label htmlFor="i-email">Email</Label>
              <Input
                id="i-email"
                type="email"
                autoFocus
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="i-role">Role</Label>
              <select
                id="i-role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
              >
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!inviteEmail.trim() || invite.isPending}>
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
