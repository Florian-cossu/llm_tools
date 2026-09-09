import { recordEvent } from "@llm-tools/data";

export function withTracking<T>(
  serverSlug: string,
  toolSlug: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  return fn()
    .then((result) => {
      recordEvent({ server_slug: serverSlug, tool_slug: toolSlug, status: "success", duration_ms: Date.now() - start });
      return result;
    })
    .catch((err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      recordEvent({ server_slug: serverSlug, tool_slug: toolSlug, status: "error", error_message: errorMessage, duration_ms: Date.now() - start });
      throw err;
    });
}