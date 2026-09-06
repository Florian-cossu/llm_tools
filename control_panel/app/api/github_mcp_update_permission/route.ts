import { NextResponse } from "next/server";
import { z } from "zod";

import { findToolPermission, resetToolState, updateToolState } from "@/lib/db";

const PatchBody = z.object({
  serverId: z.number().int(),
  slug: z.string().min(1),
  state: z.enum(["allow", "deny", "ask"]),
});

const DeleteBody = z.object({
  serverId: z.number().int(),
  slug: z.string().min(1),
});

/**
 * Sets one `permissions` row's `state`. Storage only - nothing yet reads
 * `state` before registering or executing a tool (see docs/07-plans/current.md),
 * so this changes what's recorded, not what any MCP server allows.
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

  const { serverId, slug, state } = parsed.data;
  const updated = updateToolState(serverId, slug, state);

  if (!updated) {
    return NextResponse.json(
      { error: `no permissions row for server ${serverId}, slug "${slug}"` },
      { status: 404 },
    );
  }

  return NextResponse.json({ slug, state });
}

/** Resets one `permissions` row's `state` back to its seeded `default_state`. */
export async function DELETE(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = DeleteBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { serverId, slug } = parsed.data;
  const reset = resetToolState(slug, serverId);

  if (!reset) {
    return NextResponse.json(
      { error: `no permissions row for server ${serverId}, slug "${slug}"` },
      { status: 404 },
    );
  }

  const row = findToolPermission(slug, serverId);
  return NextResponse.json({ slug, state: row?.state });
}
