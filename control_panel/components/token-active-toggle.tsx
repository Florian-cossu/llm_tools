"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Switch } from "@/components/ui/switch";
import type { TokenRow } from "@/lib/tokens";

const ENDPOINT = "/api/token_set_active";

export function TokenActiveToggle({ token }: { token: TokenRow }) {
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
        body: JSON.stringify({
          id: token.id,
          serverId: token.server_id,
          active: checked,
        }),
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
        checked={Boolean(token.is_active)}
        disabled={pending}
        onCheckedChange={handleToggle}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
