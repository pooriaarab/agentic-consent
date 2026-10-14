# agentic-consent

[![npm version](https://img.shields.io/npm/v/agentic-consent)](https://www.npmjs.com/package/agentic-consent) [![Downloads/month](https://img.shields.io/npm/dm/agentic-consent)](https://www.npmjs.com/package/agentic-consent) [![MIT license](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/license/mit)

[Setup](#record-your-first-consent) · [API and commands](#runtime-surfaces) · [Coverage](#coverage) · [Comparisons](#compare)

agentic-consent is an open-source consent ledger for Node.js applications that record contact preferences. It stores grants and revocations for email, SMS, phone, chat, and mail. A CLI and Model Context Protocol (MCP) server expose the same local operations.

## Install

```bash
npm install agentic-consent
```

Node.js 18 or later is required. TypeScript declarations are included.

## Record your first consent

Preview, then write and read a local record:

```bash
npx agentic-consent grant --contact ada@example.com --channel email --store ./consent-demo.json
npx agentic-consent grant --contact ada@example.com --channel email --store ./consent-demo.json --live
npx agentic-consent check --contact ada@example.com --channel email --store ./consent-demo.json
```

The preview prints `dryRun: true` without writing. The second command writes `consent-demo.json` and prints `dryRun: false`.
The check prints a record with `status: "granted"`. No API keys or environment variables are needed.

Revoke the record with the same contact, channel, and store:

```bash
npx agentic-consent revoke --contact ada@example.com --channel email --store ./consent-demo.json --live
```

## How it works

```text
Contact + channel -> grant / revoke -> preview (default)
                                   -> local JSON file (live)
Contact + channel -> check -> latest record or unknown
SDK adapter option -> custom HTTP service
```

## Why it exists

Applications need a small local record before they send a message. agentic-consent stores that state without requiring a marketing platform.
Mailchimp and Intercom maintain their own contact records; this package stores its state locally and does not sync to them.

## Compare

Scope checked on 2026-10-14 against [Mailchimp member updates](https://mailchimp.com/developer/marketing/api/lists/members/update-member) and [Intercom contact updates](https://developers.intercom.com/docs/references/rest-api/api.intercom.io/contacts/updatecontact).
These vendor contact APIs are adjacent alternatives for applications that already use those platforms.

| Surface | agentic-consent | Mailchimp Marketing API | Intercom contact API |
|---|---|---|---|
| Record scope | Contact/channel grant state | Audience member subscription fields | Contact properties and custom attributes |
| Storage | Local JSON file by default | Vendor account | Vendor account |
| Configuration | SDK options or CLI flags | Audience and member API | Contact API |

## Coverage

| Surface | Status | Behavior |
|---|---|---|
| Local ledger | ✓ | Grant, revoke, and check five channel values |
| Custom HTTP service | ✓ | POST to your `/grant`, `/revoke`, and `/check` endpoints |

The source defines five channels, one local store, and one generic HTTP adapter. No vendor adapters ship.
Tests cover local and mocked HTTP behavior. No named vendor integration is credential-verified for this rewrite.

## Common use cases

1. Node.js developers: check local email preferences before a separate mail delivery call.
2. SMS application teams: record a revocation after their own Twilio webhook handler receives an opt-out.
3. Support developers: keep a local chat preference alongside an Intercom integration they implement separately.
4. Agent developers: preview a consent change through MCP before writing the local ledger.

## Features

- **Channel records:** store email, SMS, phone, chat, or mail preferences.
- **Dry runs:** preview grants and revocations without writes.
- **Local persistence:** replace a JSON file through a temporary file and rename.
- **Custom stores:** supply a `ConsentStore` implementation through the SDK.
- **Custom HTTP:** call your own consent service with a bearer key.

## Runtime surfaces

The Node.js SDK exports `grantConsent`, `revokeConsent`, `checkConsent`, `LocalConsentStore`, `HttpConsentAdapter`, and the `ConsentStore` and `VendorConsentAdapter` interfaces.

```js
import { LocalConsentStore, grantConsent, checkConsent } from 'agentic-consent';

const store = new LocalConsentStore('./consent-demo.json');
const request = { contact: 'ada@example.com', channel: 'email', source: 'signup' };
console.log(await grantConsent(request, { store })); // Preview first.
console.log(await grantConsent(request, { store, dryRun: false }));
console.log(await checkConsent(request, { store })); // status: granted
```

The command-line interface (CLI) provides `grant`, `check`, and `revoke`, plus `--help`/`-h` and `--version`/`-V`.
Flags include `--contact`, `--channel`, `--source`, `--store`, `--live`, `--endpoint`, and `--api-key`.

Start the MCP server with `npx agentic-consent-mcp`.
Its three tools are `grant_consent`, `check_consent`, and `revoke_consent`. Grant and revoke tools require `live: true` to write.
The default server uses the local ledger; its tools do not select named vendors.

## Delivery and behavior limits

- Records contain the latest state, not an append-only audit history or proof of permission.
- SHA-256 hashes index records. Contact values remain readable in the JSON file; the store does not encrypt them.
- Local writes have no cross-process lock. Concurrent writers can overwrite each other's changes.
- The package does not send messages, enforce sender suppression, receive webhooks, or process SMS STOP automatically.
- No built-in expiry rules, jurisdiction rules, or Canadian Anti-Spam Legislation (CASL) compliance engine exists.
- A supplied vendor replaces the local write path; it does not also update the local file.
- `check --endpoint` calls the HTTP service even without `--live`. The dry-run default applies only to grant and revoke.
- HTTP adapters have no configured timeout, retry policy, or response-schema validation.

## Integration guides

- Local Node.js storage: pass `new LocalConsentStore(path)` as the SDK `store` option, or use CLI `--store`.
- Custom HTTP service: implement POST `/grant`, `/revoke`, and `/check`; return a `ConsentRecord` JSON object.
- Custom HTTP authentication: export `AGENTIC_CONSENT_API_KEY` or pass CLI `--api-key` with `--endpoint`.
- Environment loading: export keys before launching the CLI. The package does not load `.env` files.

CLI `--endpoint` always uses the generic HTTP contract. A vendor's base URL does not implement that contract automatically.

## Status

Version 0.1.1 is an early release. APIs and adapter behavior can change before 1.0.
Use [GitHub issues](https://github.com/pooriaarab/agentic-consent/issues) for support. Public case studies are not yet published in this repository.

## FAQ

### What is agentic-consent?

agentic-consent stores contact preference state in a local JSON ledger. It exposes grant, revoke, and check operations through SDK, CLI, and MCP interfaces.

### Which integrations are verified?

agentic-consent has local-store tests and mocked HTTP tests. No vendor adapter ships, so no credential-backed vendor verification applies.

### Does agentic-consent provide a managed consent service?

agentic-consent runs in your Node.js process. You own the local file or the custom service you connect.

### How is agentic-consent different from Mailchimp?

agentic-consent stores local contact/channel state. Mailchimp maintains audience subscription fields through its own API; this package does not integrate with it.

### How is agentic-consent different from Intercom?

agentic-consent records local preferences without an Intercom account. This package does not integrate with the Intercom API.

### Does it process Twilio STOP messages?

agentic-consent does not receive SMS messages or register webhooks. Your handler must interpret the event and call `revokeConsent`.

### Does granting consent write immediately?

agentic-consent previews grants by default. Pass SDK `dryRun: false`, CLI `--live`, or MCP `live: true` to write.

### Is the ledger encrypted?

agentic-consent hashes lookup keys but stores contact details as plain JSON. File permissions and storage protection belong to your deployment.

### Does it preserve a consent audit trail?

agentic-consent stores one latest record per normalized contact and channel. New writes replace the prior record.

## License

[MIT](https://opensource.org/license/mit).
