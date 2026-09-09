import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");

const TYPE_SEPARATOR = "__";

export type EnvKeyEntry = {
  key: string;
  suggestedType: string | null;
};

/**
 * Every key declared in the root `.env` file - names only. Values are never
 * read past the first `=` on each line, so they never enter memory here and
 * never appear in anything this returns.
 *
 * A key suffixed `__<TYPE>` (e.g. `GITHUB_TOKEN_1__AUTH`) yields a
 * `suggestedType`; the suffix stays part of `key` since that's the literal
 * env var name a `process.env` lookup needs.
 */
export function listEnvKeys(): EnvKeyEntry[] {
  let contents: string;
  try {
    contents = readFileSync(ENV_PATH, "utf8");
  } catch {
    return [];
  }

  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.split("=")[0]?.trim())
    .filter((key): key is string => Boolean(key))
    .map((key) => {
      const separatorIndex = key.lastIndexOf(TYPE_SEPARATOR);
      const suggestedType =
        separatorIndex === -1
          ? null
          : key.slice(separatorIndex + TYPE_SEPARATOR.length) || null;
      return { key, suggestedType };
    });
}
