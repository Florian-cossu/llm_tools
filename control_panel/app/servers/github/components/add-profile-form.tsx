"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderGit, TagPlus, UserCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ENDPOINT = "/api/github_add_profile";

export function AddProfileForm() {
  const router = useRouter();
  const [profileName, setProfileName] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    profileName.trim() !== "" && owner.trim() !== "" && repo.trim() !== "" && !pending;

  async function handleAdd() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileName, owner, repo }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `request failed (${response.status})`);

      setProfileName("");
      setOwner("");
      setRepo("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to add profile");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <div className="flex flex-col gap-2 h-full md:gap-4">
          <div className="flex flex-row gap-2 items-center">
            <TagPlus className="w-5 h-5 text-primary" />
            <h3>Profile name</h3>
          </div>
          <p className="text-muted-foreground">Name of the preset</p>
          <Input
            className="mt-auto"
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 h-full md:gap-4">
          <div className="flex flex-row gap-2 items-center">
            <UserCheck className="w-5 h-5 text-primary" />
            <h3>Default owner</h3>
          </div>
          <p className="text-muted-foreground">
            Default owner must match the repository
          </p>
          <Input
            className="mt-auto"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 h-full md:gap-4">
          <div className="flex flex-row gap-2 items-center">
            <FolderGit className="w-5 h-5 text-primary" />
            <h3>Default repository</h3>
          </div>
          <p className="text-muted-foreground">
            Default repository must be owned by the default owner
          </p>
          <Input
            className="mt-auto"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
          />
        </div>
      </div>

      <Button disabled={!canSubmit} onClick={handleAdd}>
        {pending ? "Adding…" : "Add profile"}
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
