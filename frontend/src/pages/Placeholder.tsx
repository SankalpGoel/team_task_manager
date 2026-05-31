import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {description ?? "This page will be implemented in a later phase."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Phase 1 ships authentication, workspaces, RBAC, invitations and the app shell. Subsequent
          phases will add projects, tasks, the Kanban board, comments, real-time, labels, search,
          email, and AI.
        </CardContent>
      </Card>
    </div>
  );
}
