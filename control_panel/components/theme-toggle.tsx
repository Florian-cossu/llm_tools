"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ORDER = ["system", "light", "dark"] as const;
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;
const LABEL = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" } as const;

/** Cycles system -> light -> dark. Renders a stable placeholder until mounted, since the resolved theme isn't known during SSR. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? (theme as (typeof ORDER)[number] | undefined) ?? "system" : "system";
  const Icon = ICON[current];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={LABEL[current]}
          onClick={() => {
            const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
            setTheme(next);
          }}
        >
          {mounted ? <Icon /> : <Monitor className="opacity-0" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{LABEL[current]}</TooltipContent>
    </Tooltip>
  );
}
