import { NextResponse } from "next/server";
import { z } from "zod";

import { setGithubProfileActive } from "@/app/servers/github/lib/github_profiles";

const PatchBody = z.object({
  id: z.number().int(),
  active: z.boolean(),
});

/**
 * Sets one `github_profiles` row's `is_active` flag. Storage only, scoped to
 * the github server - see `setGithubProfileActive` for the single-active
 * invariant.
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

  const { id, active } = parsed.data;
  const updated = setGithubProfileActive(id, active);

  if (!updated) {
    return NextResponse.json(
      { error: `no github_profiles row for id ${id}` },
      { status: 404 },
    );
  }

  return NextResponse.json({ id, active });
}
