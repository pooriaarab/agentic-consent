import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const CHANNELS = ["email", "sms", "phone", "chat", "mail"] as const;
export type Channel = (typeof CHANNELS)[number];
export type ConsentStatus = "granted" | "revoked" | "unknown";

export interface ConsentRecord {
  contact: string;
  channel: Channel;
  status: ConsentStatus;
  updatedAt: string;
  source?: string;
}

export interface ConsentRequest {
  contact: string;
  channel: Channel;
  source?: string;
}

export interface ConsentResult {
  dryRun: boolean;
  record: ConsentRecord;
}

export class VendorError extends Error {
  readonly code = "VENDOR_FAILED";
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "VendorError";
  }
}

export function assertConsentRequest(request: ConsentRequest): void {
  if (!request.contact || request.contact.trim().length === 0) {
    throw new Error("contact must not be empty");
  }
  if (!CHANNELS.includes(request.channel)) {
    throw new Error(`channel must be one of: ${CHANNELS.join(", ")}`);
  }
}

function keyFor(contact: string, channel: Channel): string {
  return createHash("sha256").update(`${contact.trim().toLowerCase()}\0${channel}`).digest("hex");
}

export interface ConsentStore {
  get(request: Pick<ConsentRequest, "contact" | "channel">): Promise<ConsentRecord>;
  set(record: ConsentRecord): Promise<ConsentRecord>;
}

export class LocalConsentStore implements ConsentStore {
  constructor(readonly path = ".agentic-consent.json") {}

  private async read(): Promise<Record<string, ConsentRecord>> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as Record<string, ConsentRecord>;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  async get(request: Pick<ConsentRequest, "contact" | "channel">): Promise<ConsentRecord> {
    assertConsentRequest(request);
    const records = await this.read();
    return records[keyFor(request.contact, request.channel)] ?? {
      contact: request.contact,
      channel: request.channel,
      status: "unknown",
      updatedAt: new Date(0).toISOString(),
    };
  }

  async set(record: ConsentRecord): Promise<ConsentRecord> {
    assertConsentRequest(record);
    const records = await this.read();
    records[keyFor(record.contact, record.channel)] = record;
    const absolute = resolve(this.path);
    await mkdir(dirname(absolute), { recursive: true });
    const temporary = `${absolute}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, "utf8");
    await rename(temporary, absolute);
    return record;
  }
}

export interface VendorConsentAdapter {
  readonly name: string;
  grant(request: ConsentRequest): Promise<ConsentRecord>;
  revoke(request: ConsentRequest): Promise<ConsentRecord>;
  check(request: Pick<ConsentRequest, "contact" | "channel">): Promise<ConsentRecord>;
}

export class HttpConsentAdapter implements VendorConsentAdapter {
  readonly name = "http";
  private readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly fetchFn: typeof fetch;

  constructor(endpoint: string, options: { apiKey?: string; fetchFn?: typeof fetch } = {}) {
    if (!endpoint.trim()) throw new Error("vendor endpoint must not be empty");
    this.endpoint = endpoint.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async request(action: string, request: ConsentRequest): Promise<ConsentRecord> {
    if (!this.apiKey) throw new VendorError("vendor API key is required for --live");
    let response: Response;
    try {
      response = await this.fetchFn(`${this.endpoint}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(request),
      });
    } catch (error) {
      throw new VendorError(`vendor request failed: ${String(error)}`);
    }
    if (!response.ok) throw new VendorError(`vendor returned ${response.status}: ${await response.text()}`, response.status);
    return (await response.json()) as ConsentRecord;
  }

  grant(request: ConsentRequest): Promise<ConsentRecord> { return this.request("grant", request); }
  revoke(request: ConsentRequest): Promise<ConsentRecord> { return this.request("revoke", request); }
  check(request: Pick<ConsentRequest, "contact" | "channel">): Promise<ConsentRecord> {
    return this.request("check", request);
  }
}

function preview(request: ConsentRequest, status: ConsentStatus): ConsentRecord {
  return { contact: request.contact, channel: request.channel, status, updatedAt: new Date().toISOString(), source: request.source };
}

export async function grantConsent(request: ConsentRequest, options: { store?: ConsentStore; vendor?: VendorConsentAdapter; dryRun?: boolean } = {}): Promise<ConsentResult> {
  assertConsentRequest(request);
  if (options.dryRun ?? true) return { dryRun: true, record: preview(request, "granted") };
  const record = options.vendor ? await options.vendor.grant(request) : await (options.store ?? new LocalConsentStore()).set(preview(request, "granted"));
  return { dryRun: false, record };
}

export async function revokeConsent(request: ConsentRequest, options: { store?: ConsentStore; vendor?: VendorConsentAdapter; dryRun?: boolean } = {}): Promise<ConsentResult> {
  assertConsentRequest(request);
  if (options.dryRun ?? true) return { dryRun: true, record: preview(request, "revoked") };
  const record = options.vendor ? await options.vendor.revoke(request) : await (options.store ?? new LocalConsentStore()).set(preview(request, "revoked"));
  return { dryRun: false, record };
}

export async function checkConsent(request: Pick<ConsentRequest, "contact" | "channel">, options: { store?: ConsentStore; vendor?: VendorConsentAdapter } = {}): Promise<ConsentRecord> {
  assertConsentRequest(request);
  return options.vendor ? options.vendor.check(request) : (options.store ?? new LocalConsentStore()).get(request);
}
