import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, updateProfile } from "@/features/auth/api";
import {
  deleteWorkspace,
  listMyWorkspaces,
  renameWorkspace,
} from "@/features/workspace/api";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import type { ApiUser } from "@/types/api";

const THEMES = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const role = useAuthStore((s) => s.activeRole());
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useAuthStore((s) => s.setActiveWorkspaceId);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ---- Profile ----
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  useEffect(() => setFullName(user?.full_name ?? ""), [user?.full_name]);

  const profileMut = useMutation({
    mutationFn: () => updateProfile({ full_name: fullName.trim() }),
    onSuccess: (updated) => {
      setUser(updated as ApiUser);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  // ---- Password ----
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const pwValid = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPw);

  const passwordMut = useMutation({
    mutationFn: () => changePassword(oldPw, newPw),
    onSuccess: () => {
      toast.success("Password changed");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  // ---- Workspace ----
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: listMyWorkspaces });
  const activeWs = workspaces.data?.find((w) => w.id === workspaceId);
  const isAdmin = role === "admin";
  const isOwner = !!activeWs && !!user && activeWs.owner_id === user.id;

  const [wsName, setWsName] = useState("");
  useEffect(() => setWsName(activeWs?.name ?? ""), [activeWs?.name]);

  const renameMut = useMutation({
    mutationFn: () => renameWorkspace(workspaceId as string, wsName.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Workspace renamed");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteWorkspace(workspaceId as string),
    onSuccess: () => {
      toast.success("Workspace deleted");
      setActiveWorkspaceId(null);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/app", { replace: true });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, security, and workspace.</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Your name and account email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (fullName.trim()) profileMut.mutate();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="s-name">Full name</Label>
                <Input
                  id="s-name"
                  value={fullName}
                  maxLength={100}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-email">Email</Label>
                <Input id="s-email" value={user?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">Email can't be changed.</p>
              </div>
              <Button
                type="submit"
                disabled={profileMut.isPending || !fullName.trim() || fullName.trim() === user?.full_name}
              >
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Password</CardTitle>
            <CardDescription>Use 8+ characters with a letter and a number.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pwValid) return toast.error("New password is too weak");
                if (newPw !== confirmPw) return toast.error("Passwords don't match");
                passwordMut.mutate();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="s-old">Current password</Label>
                <Input id="s-old" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-new">New password</Label>
                <Input id="s-new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                {newPw && !pwValid && (
                  <p className="text-xs text-destructive">Needs 8+ chars, a letter and a number.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-confirm">Confirm new password</Label>
                <Input
                  id="s-confirm"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={passwordMut.isPending || !oldPw || !newPw || !confirmPw}>
                Change password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose your theme.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-accent",
                    theme === t.value && "border-primary bg-accent",
                  )}
                >
                  <t.icon className="h-5 w-5" />
                  {t.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Workspace */}
        {isAdmin && activeWs && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace</CardTitle>
              <CardDescription>Settings for “{activeWs.name}”.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (wsName.trim() && wsName.trim() !== activeWs.name) renameMut.mutate();
                }}
              >
                <Label htmlFor="s-ws">Workspace name</Label>
                <div className="flex gap-2">
                  <Input id="s-ws" value={wsName} maxLength={80} onChange={(e) => setWsName(e.target.value)} />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={renameMut.isPending || !wsName.trim() || wsName.trim() === activeWs.name}
                  >
                    Rename
                  </Button>
                </div>
              </form>

              {isOwner && (
                <div className="rounded-lg border border-destructive/40 p-4">
                  <p className="text-sm font-medium text-destructive">Danger zone</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Deleting a workspace removes it for everyone. This can't be undone.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-destructive hover:text-destructive"
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      if (
                        confirm(`Delete workspace "${activeWs.name}"? This removes it for all members.`)
                      )
                        deleteMut.mutate();
                    }}
                  >
                    Delete workspace
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
