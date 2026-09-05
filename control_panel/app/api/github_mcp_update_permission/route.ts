import { NextResponse } from "next/server";
import { z } from "zod";

import {
  findGithubToolPermission,
  resetGithubToolState,
  updateGithubToolState,
} from "@/lib/db";

const PatchBody = z.object({
  slug: z.string().min(1),
  state: z.enum(["allow", "deny", "ask"]),
});

const DeleteBody = z.object({
  slug: z.string().min(1),
});

/**
 * Sets one github_mcp tool's `state`. Storage only - nothing yet reads
 * `state` before registering or executing a tool (see docs/07-plans/current.md),
 * so this changes what's recorded, not what the github MCP server allows.
 */
export async function PATCH(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { slug, state } = parsed.data;
  const updated = updateGithubToolState(slug, state);

  if (!updated) {
    return NextResponse.json(
      { error: `no github_mcp row for slug "${slug}"` },
      { status: 404 },
    );
  }

  return NextResponse.json({ slug, state });
}

/** Resets one github_mcp tool's `state` back to its seeded `default_state`. */
export async function DELETE(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = DeleteBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { slug } = parsed.data;
  const reset = resetGithubToolState(slug);

  if (!reset) {
    return NextResponse.json(
      { error: `no github_mcp row for slug "${slug}"` },
      { status: 404 },
    );
  }

  const row = findGithubToolPermission(slug);
  return NextResponse.json({ slug, state: row?.state });
}
