#!/usr/bin/env node
import { grantConsent, revokeConsent, checkConsent, HttpConsentAdapter, LocalConsentStore, VendorError, type Channel } from "./core.js";
import { VERSION } from "./version.js";

const help = `agentic-consent ${VERSION}\n\nUsage: agentic-consent <grant|check|revoke> --contact <contact> --channel <email|sms|phone|chat|mail> [--live] [--store <path>]\n\nDry run is the default. Use --live to write to the local store or call a vendor.`;

function parse(argv: string[]) {
  const action = argv.shift();
  if (!action || action === "--help" || action === "-h") return { help: true } as const;
  if (action === "--version" || action === "-V") return { version: true } as const;
  if (!["grant", "check", "revoke"].includes(action)) throw new Error(`unknown command "${action}"`);
  const result: { action: "grant" | "check" | "revoke"; contact?: string; channel?: Channel; source?: string; store?: string; live: boolean; endpoint?: string; apiKey?: string } = { action: action as "grant" | "check" | "revoke", live: false };
  while (argv.length) {
    const flag = argv.shift()!;
    if (flag === "--live") { result.live = true; continue; }
    const value = argv.shift();
    if (!value) throw new Error(`${flag} needs a value`);
    if (flag === "--contact") result.contact = value;
    else if (flag === "--channel") result.channel = value as Channel;
    else if (flag === "--source") result.source = value;
    else if (flag === "--store") result.store = value;
    else if (flag === "--endpoint") result.endpoint = value;
    else if (flag === "--api-key") result.apiKey = value;
    else throw new Error(`unknown flag "${flag}"`);
  }
  if (!result.contact || !result.channel) throw new Error("--contact and --channel are required");
  return result;
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    const request = parse([...argv]);
    if ("help" in request) { console.log(help); return 0; }
    if ("version" in request) { console.log(VERSION); return 0; }
    const vendor = request.endpoint ? new HttpConsentAdapter(request.endpoint, { apiKey: request.apiKey ?? process.env.AGENTIC_CONSENT_API_KEY }) : undefined;
    const store = new LocalConsentStore(request.store);
    const input = { contact: request.contact!, channel: request.channel!, source: request.source };
    const output = request.action === "check" ? await checkConsent(input, { store, vendor }) : request.action === "grant" ? await grantConsent(input, { store, vendor, dryRun: !request.live }) : await revokeConsent(input, { store, vendor, dryRun: !request.live });
    console.log(JSON.stringify(output));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return 1;
  }
}

if (process.argv[1]?.endsWith("cli.js")) runCli(process.argv.slice(2)).then((code) => process.exitCode = code);
