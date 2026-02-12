"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/src/context/theme-context";
import { Button } from "@/components/ui/button";

export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="relative rounded-full border border-border/70 bg-card/50 text-foreground hover:bg-card"
    >
      <Sun
        className={`h-4 w-4 transition-all duration-200 ${isDark ? "scale-75 opacity-0" : "scale-100 opacity-100"}`}
      />
      <Moon
        className={`absolute h-4 w-4 transition-all duration-200 ${isDark ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
      />
    </Button>
  );
}
