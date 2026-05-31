import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { acceptInvitation, previewInvitation } from "@/features/workspace/api";
import { getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function AcceptInvitePage() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setActive = useAuthStore((s) => s.setActiveWorkspaceId);
  const queryClient = useQueryClient();

  const preview = useQuery({
    queryKey: ["invitation", "preview", token],
    queryFn: () => previewInvitation(token),
    enabled: !!token,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: async (inv) => {
      toast.success("Invitation accepted");
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setActive(inv.workspace_id);
      navigate("/app", { replace: true });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (preview.isLoading) {
    return (
      <div className="grid min-h-full place-items-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <div className="grid min-h-full place-items-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>This link may be invalid or already used.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/">Go home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invite = preview.data;
  const mismatch = !!user && user.email.toLowerCase() !== invite.email.toLowerCase();
  const expired = !invite.valid;

  return (
    <div className="grid min-h-full place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {invite.workspace_name}</CardTitle>
          <CardDescription>
            You've been invited as <strong>{invite.role}</strong> ({invite.email}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {expired && (
            <p className="text-sm text-destructive">
              This invitation is no longer valid (expired or revoked).
            </p>
          )}
          {!accessToken && !expired && (
            <p className="text-sm text-muted-foreground">
              Sign in or create an account with <strong>{invite.email}</strong> to accept.
            </p>
          )}
          {mismatch && !expired && (
            <p className="text-sm text-destructive">
              You're signed in as <strong>{user!.email}</strong>. This invitation was sent to{" "}
              <strong>{invite.email}</strong>.
            </p>
          )}
          <div className="flex gap-2">
            {accessToken ? (
              <Button
                onClick={() => accept.mutate()}
                disabled={accept.isPending || mismatch || expired}
              >
                {accept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept invitation
              </Button>
            ) : (
              <>
                <Button asChild disabled={expired}>
                  <Link to={`/login?next=/invite/${token}`}>Sign in</Link>
                </Button>
                <Button asChild variant="outline" disabled={expired}>
                  <Link to={`/signup?next=/invite/${token}`}>Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
