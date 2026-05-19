import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((p) => (p === "dark" ? "light" : "dark")),
    []
  );

  return { theme, setTheme, toggleTheme };
}
