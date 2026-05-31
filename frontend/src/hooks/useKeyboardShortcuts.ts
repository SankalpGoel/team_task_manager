import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useUiStore } from "@/store/uiStore";

/** Custom event the Board listens for to open its "new task" dialog. */
export const NEW_TASK_EVENT = "ttm:new-task";

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable
  );
}

/**
 * Global keyboard shortcuts:
 *   /        open command palette        ? show shortcuts help
 *   c        new task (board only)       g d / g p / g a  navigate
 * Cmd/Ctrl+K (palette) is handled inside CommandPalette.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const gPendingRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      // Chord: "g" then a destination key.
      if (gPendingRef.current) {
        gPendingRef.current = false;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);
        const dest: Record<string, string> = { d: "/app", p: "/app/projects", a: "/app/activity" };
        const to = dest[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          navigate(to);
          return;
        }
      }

      switch (e.key) {
        case "/":
          e.preventDefault();
          setCommandOpen(true);
          break;
        case "?":
          e.preventDefault();
          setShortcutsOpen(true);
          break;
        case "c":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent(NEW_TASK_EVENT));
          break;
        case "g":
          gPendingRef.current = true;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => {
            gPendingRef.current = false;
          }, 1200);
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [navigate, setCommandOpen, setShortcutsOpen]);
}
