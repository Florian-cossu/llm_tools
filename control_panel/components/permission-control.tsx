"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, HelpCircle, RotateCcw, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PermissionState, ToolDescriptor } from "@/lib/tools";

const STATE_COPY: Record<PermissionState, { label: string; hint: string; icon: typeof ShieldCheck }> = {
  allow: {
    label: "Allow",
    hint: "The model can call this tool without confirmation.",
    icon: ShieldCheck,
  },
  deny: {
    label: "Deny",
    hint: "The tool is never registered - the model doesn't see it.",
    icon: Ban,
  },
  ask: {
    label: "Ask",
    hint: "Not yet implemented anywhere - no tool is seeded with this state.",
    icon: HelpCircle,
  },
};

const ENDPOINT = "/api/github_mcp_update_permission";

export function PermissionControl({ tool }: { tool: ToolDescriptor }) {
  const router = useRouter();
  const [state, setState] = useState<PermissionState>(tool.state);
  const [savedState, setSavedState] = useState<PermissionState>(tool.state);
  const [pending, setPending] = useState<"save" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const Icon = STATE_COPY[state].icon;

  const dirty = state !== savedState;
  const canReset = savedState !== tool.default_state;

  async function request(input: RequestInit) {
    const response = await fetch(ENDPOINT, {
      ...input,
      headers: { "Content-Type": "application/json" },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `request failed (${response.status})`);
    return body as { slug: string; state: PermissionState };
  }

  async function handleSave() {
    setPending("save");
    setError(null);
    try {
      const body = await request({
        method: "PATCH",
        body: JSON.stringify({ slug: tool.slug, state }),
      });
      setSavedState(body.state);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to save");
    } finally {
      setPending(null);
    }
  }

  async function handleReset() {
    setPending("reset");
    setError(null);
    try {
      const body = await request({
        method: "DELETE",
        body: JSON.stringify({ slug: tool.slug }),
      });
      setState(body.state);
      setSavedState(body.state);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to reset");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Select
          value={state}
          onValueChange={(value) => setState(value as PermissionState)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATE_COPY) as PermissionState[]).map((option) => (
              <SelectItem key={option} value={option}>
                {STATE_COPY[option].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button disabled={!dirty || pending !== null} onClick={handleSave}>
          {pending === "save" ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="outline"
          disabled={!canReset || pending !== null}
          onClick={handleReset}
          title={`Reset to the seeded default (${tool.default_state})`}
        >
          <RotateCcw className="size-4" />
          {pending === "reset" ? "Resetting…" : "Reset"}
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {STATE_COPY[state].hint}
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
