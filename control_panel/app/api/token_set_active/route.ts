import { NextResponse } from "next/server";
import { z } from "zod";

import { deactivateToken, setTokenActive } from "@/lib/tokens";

const PatchBody = z.object({
  id: z.number().int(),
  serverId: z.number().int(),
  active: z.boolean(),
});

/**
 * Sets one `env` row's `is_active` flag. Activating deactivates any other
 * token of the same `type` for the same server - see `setTokenActive`.
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

  const { id, serverId, active } = parsed.data;
  const updated = active
    ? setTokenActive(id, serverId)
    : deactivateToken(id, serverId);

  if (!updated) {
    return NextResponse.json({ error: `no env row for id ${id}` }, { status: 404 });
  }

  return NextResponse.json({ id, active });
}
