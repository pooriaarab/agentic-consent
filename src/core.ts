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


export type VendorName = "mailchimp" | "twilio" | "intercom";

interface VendorAdapterOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
}

abstract class BaseVendorConsentAdapter implements VendorConsentAdapter {
  abstract readonly name: string;
  protected readonly apiKey?: string;
  protected readonly fetchFn: typeof fetch;

  constructor(options: VendorAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  protected async post(url: string, body: unknown, headers: Record<string, string>): Promise<ConsentRecord> {
    if (!this.apiKey) throw new VendorError(`${this.name} API key is required for --live`);
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new VendorError(`${this.name} request failed: ${String(error)}`);
    }
    if (!response.ok) throw new VendorError(`${this.name} returned ${response.status}: ${await response.text()}`, response.status);
    return { contact: String((body as ConsentRequest).contact), channel: (body as ConsentRequest).channel, status: "granted", updatedAt: new Date().toISOString(), source: this.name };
  }

  abstract grant(request: ConsentRequest): Promise<ConsentRecord>;
  abstract revoke(request: ConsentRequest): Promise<ConsentRecord>;
  async check(request: Pick<ConsentRequest, "contact" | "channel">): Promise<ConsentRecord> {
    return { ...request, status: "unknown", updatedAt: new Date().toISOString(), source: this.name };
  }
}

/** Mailchimp Marketing API adapter for email opt-in and unsubscribe. */
export class MailchimpConsentAdapter extends BaseVendorConsentAdapter {
  readonly name = "mailchimp";
  constructor(private readonly audienceId: string, options: VendorAdapterOptions = {}) {
    super(options);
    if (!audienceId.trim()) throw new Error("Mailchimp audience ID is required");
  }
  private url(contact: string): string {
    const dc = this.apiKey?.split("-").at(-1) || "us1";
    return `https://${dc}.api.mailchimp.com/3.0/lists/${encodeURIComponent(this.audienceId)}/members/${createHash("md5").update(contact.trim().toLowerCase()).digest("hex")}`;
  }
  async grant(request: ConsentRequest): Promise<ConsentRecord> {
    await this.post(this.url(request.contact), { email_address: request.contact, status: "subscribed" }, { authorization: `Bearer ${this.apiKey}` });
    return preview({ ...request, source: this.name }, "granted");
  }
  async revoke(request: ConsentRequest): Promise<ConsentRecord> {
    await this.post(this.url(request.contact), { status: "unsubscribed" }, { authorization: `Bearer ${this.apiKey}` });
    return preview({ ...request, source: this.name }, "revoked");
  }
}

/** Twilio adapter for SMS STOP-style opt-out records. */
export class TwilioConsentAdapter extends BaseVendorConsentAdapter {
  readonly name = "twilio";
  constructor(private readonly accountSid: string, options: VendorAdapterOptions = {}) {
    super(options);
    if (!accountSid.trim()) throw new Error("Twilio account SID is required");
  }
  private url(): string { return `https://messaging.twilio.com/v1/Services/${encodeURIComponent(this.accountSid)}/Compliance/Usa2p/Usa2p`; }
  async grant(request: ConsentRequest): Promise<ConsentRecord> {
    await this.post(this.url(), { contact: request.contact, opt_in: true }, { authorization: `Bearer ${this.apiKey}` });
    return preview({ ...request, source: this.name }, "granted");
  }
  async revoke(request: ConsentRequest): Promise<ConsentRecord> {
    await this.post(this.url(), { contact: request.contact, opt_in: false, keyword: "STOP" }, { authorization: `Bearer ${this.apiKey}` });
    return preview({ ...request, source: this.name }, "revoked");
  }
}

/** Intercom adapter for chat consent attributes. */
export class IntercomConsentAdapter extends BaseVendorConsentAdapter {
  readonly name = "intercom";
  private url(contact: string): string { return `https://api.intercom.io/contacts/${encodeURIComponent(contact)}`; }
  async grant(request: ConsentRequest): Promise<ConsentRecord> {
    await this.post(this.url(request.contact), { custom_attributes: { consent: "granted" } }, { authorization: `Bearer ${this.apiKey}`, accept: "application/json" });
    return preview({ ...request, source: this.name }, "granted");
  }
  async revoke(request: ConsentRequest): Promise<ConsentRecord> {
    await this.post(this.url(request.contact), { custom_attributes: { consent: "revoked" } }, { authorization: `Bearer ${this.apiKey}`, accept: "application/json" });
    return preview({ ...request, source: this.name }, "revoked");
  }
}

export function createVendorConsentAdapter(name: VendorName, options: VendorAdapterOptions & { audienceId?: string; accountSid?: string }): VendorConsentAdapter {
  if (name === "mailchimp") return new MailchimpConsentAdapter(options.audienceId ?? "", options);
  if (name === "twilio") return new TwilioConsentAdapter(options.accountSid ?? "", options);
  return new IntercomConsentAdapter(options);
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
