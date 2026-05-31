import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { aiProjectSummary, aiUnavailable } from "@/features/ai/api";
import { getApiErrorMessage } from "@/lib/api";

interface ProjectSummaryDialogProps {
  projectId: string;
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSummaryDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: ProjectSummaryDialogProps) {
  const query = useQuery({
    queryKey: ["ai", "project-summary", projectId],
    queryFn: () => aiProjectSummary(projectId),
    enabled: open && !!projectId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const res = query.data;
  const unavailable = res && aiUnavailable(res.provider_used);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI project summary
          </DialogTitle>
          <DialogDescription>
            {projectName ? `Status digest for “${projectName}”.` : "Status digest for this project."}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        ) : query.isError ? (
          <p className="text-sm text-destructive">{getApiErrorMessage(query.error)}</p>
        ) : res ? (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{res.text}</p>
            {!unavailable && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {res.provider_used}
                </Badge>
                {res.cached && (
                  <Badge variant="outline" className="text-[10px]">
                    cached
                  </Badge>
                )}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
