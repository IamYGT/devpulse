import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Todo {
  id: number;
  text: string;
  is_done: boolean;
  priority: number;
  due_date: string | null;
  project_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type { Todo };

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTodos = useCallback(async (filters?: {
    projectId?: number;
    isDone?: boolean;
    dueDateFrom?: string;
    dueDateTo?: string;
  }) => {
    setLoading(true);
    try {
      const result = await invoke<Todo[]>("get_todos", filters || {});
      setTodos(result);
    } catch (e) {
      console.error("Failed to fetch todos:", e);
    }
    setLoading(false);
  }, []);

  const createTodo = useCallback(async (data: {
    text: string;
    priority?: number;
    dueDate?: string;
    projectId?: number;
  }) => {
    try {
      const todo = await invoke<Todo>("create_todo", {
        text: data.text,
        priority: data.priority || 0,
        dueDate: data.dueDate || null,
        projectId: data.projectId || null,
      });
      return todo;
    } catch (e) {
      console.error("Failed to create todo:", e);
      return null;
    }
  }, []);

  const updateTodo = useCallback(async (id: number, data: {
    isDone?: boolean;
    text?: string;
    priority?: number;
    dueDate?: string | null;
  }) => {
    try {
      await invoke("update_todo", { id, ...data });
    } catch (e) {
      console.error("Failed to update todo:", e);
    }
  }, []);

  const deleteTodo = useCallback(async (id: number) => {
    try {
      await invoke("delete_todo", { id });
    } catch (e) {
      console.error("Failed to delete todo:", e);
    }
  }, []);

  const reorderTodos = useCallback(async (ids: number[]) => {
    try {
      await invoke("reorder_todos", { ids });
    } catch (e) {
      console.error("Failed to reorder todos:", e);
    }
  }, []);

  return { todos, loading, fetchTodos, createTodo, updateTodo, deleteTodo, reorderTodos };
}
