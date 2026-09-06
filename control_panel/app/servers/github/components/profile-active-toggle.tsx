"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Switch } from "@/components/ui/switch";
import type { GithubProfile } from "../lib/github_profiles";

const ENDPOINT = "/api/github_set_active_profile";

export function ProfileActiveToggle({
  profile,
}: {
  profile: NonNullable<GithubProfile>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(checked: boolean) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profile.id, active: checked }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `request failed (${response.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to update");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Switch
        checked={Boolean(profile.is_active)}
        disabled={pending}
        onCheckedChange={handleToggle}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
