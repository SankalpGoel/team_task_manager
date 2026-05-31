import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MentionTextarea } from "@/components/task/MentionTextarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createComment,
  deleteComment,
  listComments,
  type Comment,
} from "@/features/comments/api";
import { getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { cn, initials } from "@/lib/utils";

/** Render comment body, bolding @mention tokens. */
function renderBody(body: string) {
  const parts = body.split(/(@[\w.\-+]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-medium text-primary">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  onReply: (c: Comment) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}

function CommentItem({ comment, isReply, onReply, onDelete, canDelete }: CommentItemProps) {
  return (
    <div className={cn("flex gap-2", isReply && "ml-8")}>
      <Avatar className="mt-0.5 h-7 w-7 shrink-0">
        <AvatarFallback className="text-[10px]">
          {initials(comment.author?.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">
            {comment.author?.full_name ?? "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {renderBody(comment.body)}
        </p>
        <div className="mt-0.5 flex items-center gap-3">
          {!isReply && (
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reply
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CommentThreadProps {
  taskId: string;
  projectId: string;
}

export function CommentThread({ taskId, projectId }: CommentThreadProps) {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.activeRole());
  const isManagerPlus = role === "admin" || role === "manager";

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const commentsQuery = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => listComments(taskId),
    enabled: !!taskId,
  });

  const tree = useMemo(() => {
    const all = commentsQuery.data ?? [];
    const roots = all.filter((c) => !c.parent_id);
    const byParent = new Map<string, Comment[]>();
    for (const c of all) {
      if (c.parent_id) {
        const arr = byParent.get(c.parent_id) ?? [];
        arr.push(c);
        byParent.set(c.parent_id, arr);
      }
    }
    return { roots, byParent };
  }, [commentsQuery.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      createComment(taskId, { body: body.trim(), parent_id: replyTo?.id ?? null }),
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      invalidate();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const canDelete = (c: Comment) => c.author?.id === me?.id || isManagerPlus;

  const submit = () => {
    if (body.trim()) createMut.mutate();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">
        Comments
        {tree.roots.length > 0 && (
          <span className="ml-1 text-muted-foreground">({commentsQuery.data?.length})</span>
        )}
      </h3>

      {commentsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : tree.roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
      ) : (
        <div className="space-y-4">
          {tree.roots.map((c) => (
            <div key={c.id} className="space-y-3">
              <CommentItem
                comment={c}
                onReply={(r) => setReplyTo(r)}
                onDelete={deleteMut.mutate}
                canDelete={canDelete(c)}
              />
              {(tree.byParent.get(c.id) ?? []).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isReply
                  onReply={() => undefined}
                  onDelete={deleteMut.mutate}
                  canDelete={canDelete(reply)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 border-t pt-3">
        {replyTo && (
          <div className="flex items-center justify-between rounded-md bg-muted px-2 py-1 text-xs">
            <span className="text-muted-foreground">
              Replying to <span className="font-medium">{replyTo.author?.full_name}</span>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
        <MentionTextarea
          value={body}
          onChange={setBody}
          onSubmit={submit}
          placeholder="Write a comment… use @ to mention a teammate"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</span>
          <Button size="sm" disabled={!body.trim() || createMut.isPending} onClick={submit}>
            {replyTo ? "Reply" : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
