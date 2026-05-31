import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import { TaskCard } from "@/components/kanban/TaskCard";
import { moveTask, type Board, type Task } from "@/features/tasks/api";
import { getApiErrorMessage } from "@/lib/api";
import type { TaskStatus } from "@/types/api";

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

interface KanbanBoardProps {
  projectId: string;
  board: Board;
  onCreate?: (status: TaskStatus) => void;
  onTaskClick?: (task: Task) => void;
}

export function KanbanBoard({ projectId, board, onCreate, onTaskClick }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [optimistic, setOptimistic] = useState<Board | null>(null);
  const current = optimistic ?? board;

  const moveMut = useMutation({
    mutationFn: ({ id, status, before_id, after_id }: { id: string; status: TaskStatus; before_id?: string | null; after_id?: string | null }) =>
      moveTask(id, { status, before_id: before_id ?? null, after_id: after_id ?? null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      setOptimistic(null);
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
      setOptimistic(null);
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    },
  });

  function locateTask(id: string): { col: number; row: number } | null {
    for (let c = 0; c < current.columns.length; c += 1) {
      const idx = current.columns[c].items.findIndex((t) => t.id === id);
      if (idx >= 0) return { col: c, row: idx };
    }
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    const tid = e.active.id as string;
    const loc = locateTask(tid);
    if (loc) setActiveTask(current.columns[loc.col].items[loc.row]);
  }

  function handleDragOver(e: DragOverEvent) {
    const activeId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId || activeId === overId) return;
    const activeLoc = locateTask(activeId);
    if (!activeLoc) return;

    const next = current.columns.map((c) => ({ ...c, items: [...c.items] }));

    // If we're over a column id (string status)
    const overColIndex = STATUS_ORDER.indexOf(overId as TaskStatus);
    if (overColIndex >= 0 && overColIndex !== activeLoc.col) {
      const [moving] = next[activeLoc.col].items.splice(activeLoc.row, 1);
      moving.status = STATUS_ORDER[overColIndex];
      next[overColIndex].items.push(moving);
      setOptimistic({ columns: next });
      return;
    }

    // Otherwise we're over another task
    const overLoc = locateTask(overId);
    if (!overLoc) return;
    if (overLoc.col === activeLoc.col && overLoc.row === activeLoc.row) return;
    const [moving] = next[activeLoc.col].items.splice(activeLoc.row, 1);
    moving.status = STATUS_ORDER[overLoc.col];
    next[overLoc.col].items.splice(overLoc.row, 0, moving);
    setOptimistic({ columns: next });
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const activeId = e.active.id as string;
    const board = optimistic ?? current;
    const loc = locateTask(activeId);
    if (!loc) {
      setOptimistic(null);
      return;
    }
    const col = board.columns[loc.col];
    const before = loc.row > 0 ? col.items[loc.row - 1].id : null;
    const after = loc.row < col.items.length - 1 ? col.items[loc.row + 1].id : null;
    moveMut.mutate({
      id: activeId,
      status: col.status,
      before_id: before,
      after_id: after,
    });
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto px-1 pb-3">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {current.columns.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            tasks={col.items}
            onCreate={onCreate}
            onTaskClick={onTaskClick}
          />
        ))}
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
