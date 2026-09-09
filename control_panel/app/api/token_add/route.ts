import { NextResponse } from "next/server";
import { z } from "zod";

import { findServerBySlug } from "@/lib/servers";
import { addToken } from "@/lib/tokens";

const PostBody = z.object({
  serverSlug: z.string().min(1),
  tokenName: z.string().min(1),
  type: z.string().min(1),
});

/** Inserts one `env` row - registers a root `.env` key as a token for a server. */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = PostBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { serverSlug, tokenName, type } = parsed.data;
  const server = findServerBySlug(serverSlug);

  if (!server) {
    return NextResponse.json(
      { error: `no server for slug ${serverSlug}` },
      { status: 404 },
    );
  }

  const added = addToken(server.id, tokenName, type);

  if (!added) {
    return NextResponse.json({ error: "failed to add token" }, { status: 500 });
  }

  return NextResponse.json({ tokenName, type });
}
