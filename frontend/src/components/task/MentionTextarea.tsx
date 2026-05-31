import { useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useWorkspaceMembers } from "@/features/workspace/useMembers";
import { cn, initials } from "@/lib/utils";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

interface MentionMatch {
  start: number; // index of '@'
  query: string; // text after '@' up to cursor
}

/** Detect an in-progress "@mention" immediately before the caret. */
function findMention(text: string, caret: number): MentionMatch | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      const before = i === 0 ? " " : text[i - 1];
      if (/\s/.test(before) || i === 0) {
        return { start: i, query: text.slice(i + 1, caret) };
      }
      return null;
    }
    // mention handles are word-ish chars; stop at whitespace
    if (/\s/.test(ch)) return null;
    i -= 1;
  }
  return null;
}

export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  rows = 3,
  disabled,
  autoFocus,
  className,
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { data: members = [] } = useWorkspaceMembers();
  const [mention, setMention] = useState<MentionMatch | null>(null);
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members
      .filter((m) => {
        const local = m.user.email.split("@")[0].toLowerCase();
        const name = m.user.full_name.toLowerCase();
        return q === "" || local.includes(q) || name.replace(/\s/g, "").includes(q);
      })
      .slice(0, 6);
  }, [members, mention]);

  function recompute() {
    const el = ref.current;
    if (!el) return;
    const m = findMention(el.value, el.selectionStart ?? el.value.length);
    setMention(m);
    setActive(0);
  }

  function applySuggestion(index: number) {
    const el = ref.current;
    if (!el || !mention) return;
    const picked = suggestions[index];
    if (!picked) return;
    const handle = picked.user.email.split("@")[0];
    const caret = el.selectionStart ?? value.length;
    const next = `${value.slice(0, mention.start)}@${handle} ${value.slice(caret)}`;
    onChange(next);
    setMention(null);
    // restore caret just after the inserted handle
    const pos = mention.start + handle.length + 2;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onChange={(e) => {
          onChange(e.target.value);
          recompute();
        }}
        onClick={recompute}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) recompute();
        }}
        onKeyDown={(e) => {
          if (mention && suggestions.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % suggestions.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              applySuggestion(active);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setMention(null);
              return;
            }
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        onBlur={() => setTimeout(() => setMention(null), 120)}
      />
      {mention && suggestions.length > 0 && (
        <ul className="absolute bottom-full z-50 mb-1 max-h-56 w-64 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map((m, i) => (
            <li key={m.user.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySuggestion(i);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {initials(m.user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate font-medium leading-none">
                    {m.user.full_name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{m.user.email.split("@")[0]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
