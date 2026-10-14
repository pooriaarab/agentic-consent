import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { checkConsent, grantConsent, IntercomConsentAdapter, LocalConsentStore, MailchimpConsentAdapter, revokeConsent, TwilioConsentAdapter } from "./core.js";

describe("consent core", () => {
 test("dry run is default", async () => { const s = new LocalConsentStore(join(await mkdtemp(join(tmpdir(), "c-")), "c.json")); expect((await grantConsent({ contact: "a", channel: "email" }, { store: s })).dryRun).toBe(true); expect((await checkConsent({ contact: "a", channel: "email" }, { store: s })).status).toBe("unknown"); });
 test("live local store records and revokes", async () => { const s = new LocalConsentStore(join(await mkdtemp(join(tmpdir(), "c-")), "c.json")); await grantConsent({ contact: "a", channel: "email" }, { store: s, dryRun: false }); expect((await checkConsent({ contact: "a", channel: "email" }, { store: s })).status).toBe("granted"); await revokeConsent({ contact: "a", channel: "email" }, { store: s, dryRun: false }); expect((await checkConsent({ contact: "a", channel: "email" }, { store: s })).status).toBe("revoked"); });
 test.each([
  ["Mailchimp", new MailchimpConsentAdapter("audience", { apiKey: "key-us19" }), "https://us19.api.mailchimp.com/3.0/"],
  ["Twilio", new TwilioConsentAdapter("AC123", { apiKey: "token" }), "https://messaging.twilio.com/"],
  ["Intercom", new IntercomConsentAdapter({ apiKey: "token" }), "https://api.intercom.io/"],
 ] as const)("%s adapter calls its real HTTPS host with fake fetch", async (_name, adapter, host) => {
  const calls: string[] = [];
  const fetchFn: typeof fetch = async (input) => { calls.push(String(input)); return new Response("{}", { status: 200 }); };
  const rebuilt = adapter instanceof MailchimpConsentAdapter ? new MailchimpConsentAdapter("audience", { apiKey: "key-us19", fetchFn }) : adapter instanceof TwilioConsentAdapter ? new TwilioConsentAdapter("AC123", { apiKey: "token", fetchFn }) : new IntercomConsentAdapter({ apiKey: "token", fetchFn });
  await rebuilt.grant({ contact: "ada@example.com", channel: "email" });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatch(new RegExp(`^${host.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`));
 });
});
