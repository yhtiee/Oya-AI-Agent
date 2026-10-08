/*
 * Generates the ES256 key our server uses to sign Supabase-compatible access tokens
 * (docs/decisions.md D-010). Never prints the private key.
 *
 *   pnpm tsx scripts/generate-jwt-signing-key.ts
 *
 * Writes:
 *  - .secrets/supabase-signing-key.json  private JWK to import into Supabase
 *                                        (Project Settings → JWT Keys → Create standby key → Import)
 *  - SUPABASE_JWT_SIGNING_KEY in .env    same key, base64-encoded, for the server
 */
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const envPath = join(root, ".env");
const envVar = "SUPABASE_JWT_SIGNING_KEY";

if (existsSync(envPath) && new RegExp(`^${envVar}=`, "m").test(readFileSync(envPath, "utf8"))) {
  console.error(`${envVar} is already set in .env. Remove it first if you really want a new key.`);
  process.exit(1);
}

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = {
  ...privateKey.export({ format: "jwk" }),
  kid: randomUUID(),
  alg: "ES256",
  use: "sig",
  key_ops: ["sign", "verify"],
  ext: true,
};

mkdirSync(join(root, ".secrets"), { recursive: true });
writeFileSync(join(root, ".secrets", "supabase-signing-key.json"), JSON.stringify(jwk, null, 2) + "\n", {
  mode: 0o600,
});
appendFileSync(envPath, `\n${envVar}=${Buffer.from(JSON.stringify(jwk)).toString("base64")}\n`);

console.log(`Key ${jwk.kid} written to .secrets/supabase-signing-key.json and ${envVar} added to .env.`);
console.log("Import the JSON file into Supabase: Project Settings → JWT Keys → Create standby key → Import.");
