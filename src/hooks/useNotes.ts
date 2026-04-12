import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Note {
  id: number;
  title: string;
  content: string;
  note_type: string;
  language: string | null;
  project_id: number | null;
  color: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export type { Note };

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(async (filters?: {
    noteType?: string;
    projectId?: number;
    searchQuery?: string;
    tagId?: number;
  }) => {
    setLoading(true);
    try {
      const result = await invoke<Note[]>("get_notes", filters || {});
      setNotes(result);
    } catch (e) {
      console.error("Failed to fetch notes:", e);
    }
    setLoading(false);
  }, []);

  const createNote = useCallback(async (data: {
    title?: string;
    content?: string;
    noteType?: string;
    language?: string;
    projectId?: number;
    color?: string;
  }) => {
    try {
      const note = await invoke<Note>("create_note", {
        title: data.title || "",
        content: data.content || "",
        noteType: data.noteType || "scratch",
        language: data.language || null,
        projectId: data.projectId || null,
        color: data.color || null,
      });
      return note;
    } catch (e) {
      console.error("Failed to create note:", e);
      return null;
    }
  }, []);

  const updateNote = useCallback(async (id: number, data: Partial<Note>) => {
    try {
      await invoke("update_note", { id, ...data });
    } catch (e) {
      console.error("Failed to update note:", e);
    }
  }, []);

  const deleteNote = useCallback(async (id: number) => {
    try {
      await invoke("delete_note", { id });
    } catch (e) {
      console.error("Failed to delete note:", e);
    }
  }, []);

  const searchNotes = useCallback(async (query: string) => {
    try {
      const results = await invoke<Note[]>("search_notes", { query });
      return results;
    } catch (e) {
      console.error("Search failed:", e);
      return [];
    }
  }, []);

  return { notes, loading, fetchNotes, createNote, updateNote, deleteNote, searchNotes };
}
