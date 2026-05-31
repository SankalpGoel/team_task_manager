import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  commandOpen: boolean;
  shortcutsOpen: boolean;
  mobileNavOpen: boolean;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  applyTheme: () => void;
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "system",
      sidebarOpen: true,
      commandOpen: false,
      shortcutsOpen: false,
      mobileNavOpen: false,
      setTheme: (theme) => {
        set({ theme });
        const root = document.documentElement;
        const next = resolveTheme(theme);
        root.classList.toggle("dark", next === "dark");
      },
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      applyTheme: () => {
        const t = get().theme;
        const root = document.documentElement;
        const next = resolveTheme(t);
        root.classList.toggle("dark", next === "dark");
      },
    }),
    {
      name: "ttm-ui",
      partialize: (s) => ({ theme: s.theme, sidebarOpen: s.sidebarOpen }),
    },
  ),
);
