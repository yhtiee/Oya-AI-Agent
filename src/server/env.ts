import "server-only";
import { parseEnv, type Env } from "./env.schema";

let cached: Env | undefined;

/** Validated server environment. Throws on the first call if anything is missing or malformed. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Throws with a readable message unless `value` is set. For variables a feature can't run without. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = getEnv()[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`${String(key)} is not set. Add it to your environment to use this feature.`);
  }
  return value as NonNullable<Env[K]>;
}
