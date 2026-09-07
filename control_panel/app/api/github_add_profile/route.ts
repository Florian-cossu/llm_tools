import { NextResponse } from "next/server";
import { z } from "zod";

import { addGithubProfile } from "@/app/servers/github/lib/github_profiles";

const PostBody = z.object({
  profileName: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
});

/** Inserts one `github_profiles` row for the github server. */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = PostBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { profileName, owner, repo } = parsed.data;
  const added = addGithubProfile(profileName, owner, repo);

  if (!added) {
    return NextResponse.json(
      { error: "github server not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ profileName, owner, repo });
}
