import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      toggle: () =>
        set((s) => {
          const next = s.theme === "light" ? "dark" : "light";
          document.documentElement.classList.toggle("dark", next === "dark");
          return { theme: next };
        }),
      set: (theme) => {
        document.documentElement.classList.toggle("dark", theme === "dark");
        return set({ theme });
      },
    }),
    {
      name: "volut-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.classList.toggle("dark", state.theme === "dark");
        }
      },
    }
  )
);
