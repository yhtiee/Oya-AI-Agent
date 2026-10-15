import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Prompts live in prompts/*.md (SPEC §10.1a). next.config.ts traces the folder into server bundles. */

const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  let text = cache.get(name);
  if (text === undefined) {
    text = readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf8");
    cache.set(name, text);
  }
  return text;
}
