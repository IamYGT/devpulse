import { useEffect } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

const registeredShortcuts: Shortcut[] = [];

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    shortcuts.forEach((s) => {
      if (
        !registeredShortcuts.find(
          (r) =>
            r.key === s.key &&
            r.ctrl === s.ctrl &&
            r.shift === s.shift &&
            r.alt === s.alt
        )
      ) {
        registeredShortcuts.push(s);
      }
    });

    const handler = (e: KeyboardEvent) => {
      for (const s of registeredShortcuts) {
        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          !!e.ctrlKey === !!s.ctrl &&
          !!e.shiftKey === !!s.shift &&
          !!e.altKey === !!s.alt
        ) {
          e.preventDefault();
          s.handler();
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

export function getRegisteredShortcuts(): Shortcut[] {
  return [...registeredShortcuts];
}

export type { Shortcut };
