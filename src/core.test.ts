import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { checkConsent, grantConsent, LocalConsentStore, revokeConsent } from "./core.js";
describe("consent core", () => {
 test("dry run is default", async () => { const s = new LocalConsentStore(join(await mkdtemp(join(tmpdir(), "c-")), "c.json")); expect((await grantConsent({ contact: "a", channel: "email" }, { store: s })).dryRun).toBe(true); expect((await checkConsent({ contact: "a", channel: "email" }, { store: s })).status).toBe("unknown"); });
 test("live local store records and revokes", async () => { const s = new LocalConsentStore(join(await mkdtemp(join(tmpdir(), "c-")), "c.json")); await grantConsent({ contact: "a", channel: "email" }, { store: s, dryRun: false }); expect((await checkConsent({ contact: "a", channel: "email" }, { store: s })).status).toBe("granted"); await revokeConsent({ contact: "a", channel: "email" }, { store: s, dryRun: false }); expect((await checkConsent({ contact: "a", channel: "email" }, { store: s })).status).toBe("revoked"); });
});
