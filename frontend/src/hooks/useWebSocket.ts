import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/store/authStore";

const WS_BASE = (import.meta.env.VITE_WS_URL ?? "ws://localhost:8000").replace(/\/$/, "");

interface WsEvent {
  type: string;
  payload?: { task_id?: string; project_id?: string; status?: string };
}

/**
 * Opens a single WebSocket to the backend for the active workspace and
 * invalidates the relevant TanStack Query caches when realtime events arrive.
 * Reconnects with exponential backoff and keeps the connection alive with a
 * client-side ping. Re-connects whenever the workspace or access token changes.
 */
export function useWebSocket() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const token = useAuthStore((s) => s.accessToken);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);
  const closedRef = useRef(false);

  useEffect(() => {
    if (!workspaceId || !token) return;
    closedRef.current = false;

    const handleEvent = (evt: WsEvent) => {
      const projectId = evt.payload?.project_id;
      const taskId = evt.payload?.task_id;
      if (evt.type.startsWith("task.") || evt.type.startsWith("subtask.")) {
        if (projectId) queryClient.invalidateQueries({ queryKey: ["board", projectId] });
        if (taskId) queryClient.invalidateQueries({ queryKey: ["task", taskId] });
        queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      } else if (evt.type.startsWith("comment.")) {
        if (taskId) {
          queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
          queryClient.invalidateQueries({ queryKey: ["task", taskId] });
        }
        if (projectId) queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      }
      // Workspace-scoped feeds always worth refreshing.
      queryClient.invalidateQueries({ queryKey: ["activity", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    const connect = () => {
      if (closedRef.current) return;
      const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}&workspace_id=${encodeURIComponent(workspaceId)}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25_000);
      };

      ws.onmessage = (msg) => {
        const data = typeof msg.data === "string" ? msg.data : "";
        if (!data || data === "pong") return;
        try {
          const evt = JSON.parse(data) as WsEvent;
          if (evt.type === "ping") return;
          handleEvent(evt);
        } catch {
          /* ignore non-JSON frames */
        }
      };

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };
    };

    const scheduleReconnect = () => {
      if (closedRef.current) return;
      attemptRef.current += 1;
      const delay = Math.min(1000 * 2 ** attemptRef.current, 30_000);
      reconnectRef.current = setTimeout(connect, delay);
    };

    connect();

    return () => {
      closedRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [workspaceId, token, queryClient]);
}
