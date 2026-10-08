import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestUser, deleteTestUser, forgedSigner, requireIntegrationEnv, service, token } from "./helpers";

/*
 * M1 acceptance (SPEC §21.4): one user can't read another's profile. Proven against the real
 * database, with access tokens signed by Oya's server (docs/decisions.md D-010).
 */

requireIntegrationEnv();

let alice: { id: string; email: string };
let bob: { id: string; email: string };

beforeAll(async () => {
  alice = await createTestUser("alice");
  bob = await createTestUser("bob");
});

afterAll(async () => {
  await deleteTestUser(alice?.id);
  await deleteTestUser(bob?.id);
});

describe("profiles RLS", () => {
  it("a user sees only their own profile", async () => {
    const { data, error } = await asUser(token({ sub: alice.id }))
      .from("profiles")
      .select("id, display_name");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: alice.id, display_name: "Test alice" }]);
  });

  it("a user can't read another user's profile by id", async () => {
    const { data, error } = await asUser(token({ sub: alice.id }))
      .from("profiles")
      .select("id")
      .eq("id", bob.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a user can't write to their profile directly (writes go through server actions)", async () => {
    const { error } = await asUser(token({ sub: alice.id }))
      .from("profiles")
      .update({ display_name: "Hacked" })
      .eq("id", alice.id);
    expect(error).not.toBeNull();
  });

  it("anonymous callers see nothing", async () => {
    const { data, error } = await asUser(null).from("profiles").select("id");
    expect(error !== null || (Array.isArray(data) && data.length === 0)).toBe(true);
  });

  it("ops without two-factor (aal1) see only themselves", async () => {
    const { data } = await asUser(token({ sub: alice.id, appRole: "ops", aal: "aal1" }))
      .from("profiles")
      .select("id");
    expect(data?.map((r) => r.id)).toEqual([alice.id]);
  });

  it("ops with two-factor (aal2) can read other profiles", async () => {
    const { data } = await asUser(token({ sub: alice.id, appRole: "ops", aal: "aal2" }))
      .from("profiles")
      .select("id")
      .in("id", [alice.id, bob.id]);
    expect(data?.map((r) => r.id).sort()).toEqual([alice.id, bob.id].sort());
  });
});

describe("tokens", () => {
  it("rejects a token signed with the wrong key", async () => {
    const { error } = await asUser(token({ sub: alice.id }, { signWith: forgedSigner() }))
      .from("profiles")
      .select("id");
    expect(error).not.toBeNull();
  });

  it("rejects an expired token", async () => {
    const stale = token({ sub: alice.id }, { ttlSeconds: 60, now: Date.now() - 10 * 60_000 });
    const { error } = await asUser(stale).from("profiles").select("id");
    expect(error).not.toBeNull();
  });
});

describe("other identity tables", () => {
  it("consents: own rows only, and append-only", async () => {
    const client = asUser(token({ sub: bob.id }));
    const { data } = await client.from("consents").select("user_id, purpose");
    expect(data?.length).toBe(2);
    expect(new Set(data?.map((r) => r.user_id))).toEqual(new Set([bob.id]));

    const { error } = await client
      .from("consents")
      .insert({ user_id: bob.id, purpose: "location", granted: true, policy_version: "x" });
    expect(error).not.toBeNull();
  });

  it("user_roles and feature_flags are hidden from ordinary users", async () => {
    const client = asUser(token({ sub: alice.id }));
    expect((await client.from("user_roles").select("user_id")).data).toEqual([]);
    expect((await client.from("feature_flags").select("key")).data).toEqual([]);
  });

  it("server-only functions can't be called with a user token", async () => {
    const client = asUser(token({ sub: alice.id }));
    expect((await client.rpc("auth_get_credentials", { p_email: alice.email })).error).not.toBeNull();
    expect(
      (await client.rpc("auth_set_role", { p_user_id: alice.id, p_role: "admin", p_granted_by: alice.id })).error,
    ).not.toBeNull();
    expect((await client.rpc("hit_rate_limit", { p_key: "x", p_window_seconds: 60, p_max: 1 })).error).not.toBeNull();
  });

  it("the internal schema isn't reachable through the API", async () => {
    const { error } = await asUser(token({ sub: alice.id }))
      .schema("internal")
      .from("users")
      .select("id");
    expect(error).not.toBeNull();
  });
});

describe("rate limits", () => {
  it("allows up to the limit in a window, then refuses", async () => {
    const key = `test:${randomUUID()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { data } = await service.rpc("hit_rate_limit", { p_key: key, p_window_seconds: 3600, p_max: 3 });
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
