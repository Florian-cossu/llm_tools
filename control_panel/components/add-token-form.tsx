"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, SearchAlert, Tag } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EnvKeyEntry } from "@/lib/env_file";

const ENDPOINT = "/api/token_add";

export function AddTokenForm({
  serverSlug,
  availableKeys,
}: {
  serverSlug: string;
  availableKeys: EnvKeyEntry[];
}) {
  const router = useRouter();
  const [tokenName, setTokenName] = useState("");
  const [type, setType] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = tokenName.trim() !== "" && type.trim() !== "" && !pending;

  function handleSelectKey(key: string) {
    setTokenName(key);
    setType(availableKeys.find((entry) => entry.key === key)?.suggestedType ?? "");
  }

  async function handleAdd() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverSlug, tokenName, type }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `request failed (${response.status})`);

      setTokenName("");
      setType("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to add token");
    } finally {
      setPending(false);
    }
  }

  if (availableKeys.length === 0) {
    return (
      <div className="flex flex-row gap-2 items-center">
        <SearchAlert />
        <p className="text-muted-foreground">
          No unregistered keys found in the root .env file.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <div className="flex flex-col gap-2 h-full md:gap-4">
          <div className="flex flex-row gap-2 items-center">
            <KeyRound className="w-5 h-5 text-primary" />
            <h3>Env var</h3>
          </div>
          <p className="text-muted-foreground">Name declared in the root .env file</p>
          <Select value={tokenName} onValueChange={handleSelectKey}>
            <SelectTrigger className="mt-auto w-full">
              <SelectValue placeholder="Select a key" />
            </SelectTrigger>
            <SelectContent>
              {availableKeys.map(({ key }) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 h-full md:gap-4">
          <div className="flex flex-row gap-2 items-center">
            <Tag className="w-5 h-5 text-primary" />
            <h3>Type</h3>
          </div>
          <p className="text-muted-foreground">
            Pre-filled from the key&apos;s __suffix, editable
          </p>
          <Input
            className="mt-auto"
            value={type}
            onChange={(event) => setType(event.target.value)}
          />
        </div>
      </div>

      <Button disabled={!canSubmit} onClick={handleAdd}>
        {pending ? "Adding…" : "Add token"}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
